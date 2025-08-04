/**
 * Notification Send API Endpoint
 * Send comprehensive notifications through multiple channels
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { notificationService, type NotificationAlert } from '@/lib/notification-service'
import { z } from 'zod'

const sendNotificationSchema = z.object({
  type: z.enum(['blood_request', 'emergency', 'donor_match', 'status_update', 'reminder', 'system']),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  message: z.string().min(1, 'Message is required').max(500, 'Message too long'),
  recipients: z.array(z.string().uuid()).min(1, 'At least one recipient required').max(1000, 'Too many recipients'),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  channels: z.array(z.enum(['push', 'sms', 'email', 'whatsapp', 'call'])).min(1, 'At least one channel required'),
  data: z.record(z.any()).optional(),
  scheduled_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional()
})

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/notifications/send', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = sendNotificationSchema.parse(body)

    console.log(`📤 Sending ${validatedData.type} notification to ${validatedData.recipients.length} recipients via ${validatedData.channels.join(', ')}`)

    // Check user permissions for sending notifications
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, institution_id')
      .eq('user_id', user.id)
      .single()

    // Permission check based on notification type and user role
    const canSendNotifications = 
      userProfile?.role === 'admin' ||
      userProfile?.role === 'super_admin' ||
      (validatedData.type === 'blood_request' && ['hospital_staff', 'emergency_responder'].includes(userProfile?.role)) ||
      (validatedData.type === 'emergency' && userProfile?.role === 'emergency_responder') ||
      (validatedData.type === 'system' && userProfile?.role === 'admin')

    if (!canSendNotifications) {
      throw ValidationError('Insufficient permissions to send this type of notification')
    }

    // Create notification alert
    const alertData: NotificationAlert = {
      type: validatedData.type,
      title: validatedData.title,
      message: validatedData.message,
      recipients: validatedData.recipients,
      priority: validatedData.priority,
      channels: validatedData.channels,
      data: validatedData.data,
      scheduled_at: validatedData.scheduled_at,
      expires_at: validatedData.expires_at
    }

    // Send the notification
    const result = await notificationService.sendAlert(alertData)

    if (!result.success) {
      throw new Error(result.error || 'Failed to send notification')
    }

    // Log the notification activity
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'notification_sent',
        risk_level: 'low',
        user_id: user.id,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        details: {
          notification_type: validatedData.type,
          recipients_count: validatedData.recipients.length,
          channels: validatedData.channels,
          priority: validatedData.priority,
          sent: result.sent,
          failed: result.failed
        },
        resolved: true
      }])

    const response = {
      success: true,
      message: `Notification sent successfully`,
      data: {
        type: validatedData.type,
        recipients_targeted: validatedData.recipients.length,
        notifications_sent: result.sent,
        notifications_failed: result.failed,
        channels_used: validatedData.channels,
        priority: validatedData.priority,
        sent_at: new Date().toISOString()
      }
    }

    console.log(`✅ Notification sent: ${result.sent} successful, ${result.failed} failed`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/notifications/send', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Get notification statistics
    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '30')
    const userId = url.searchParams.get('user_id')

    // Check permissions for viewing stats
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const canViewStats = 
      userProfile?.role === 'admin' ||
      userProfile?.role === 'super_admin' ||
      (userId === user.id) // Users can view their own stats

    if (!canViewStats) {
      throw ValidationError('Insufficient permissions to view notification statistics')
    }

    const statsResult = await notificationService.getNotificationStats(
      userId || undefined,
      days
    )

    if (!statsResult.success) {
      throw new Error(statsResult.error || 'Failed to get notification statistics')
    }

    const response = {
      success: true,
      data: {
        period_days: days,
        user_id: userId,
        statistics: statsResult.data
      }
    }

    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}