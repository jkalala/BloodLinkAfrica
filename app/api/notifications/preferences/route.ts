/**
 * Notification Preferences API Endpoint
 * Manage user notification preferences and settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { notificationService, type NotificationPreferences } from '@/lib/notification-service'
import { z } from 'zod'

const updatePreferencesSchema = z.object({
  push_notifications: z.boolean().optional(),
  sms_notifications: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  whatsapp_notifications: z.boolean().optional(),
  call_notifications: z.boolean().optional(),
  emergency_only: z.boolean().optional(),
  quiet_hours_start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  quiet_hours_end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  blood_request_alerts: z.boolean().optional(),
  donation_reminders: z.boolean().optional(),
  system_updates: z.boolean().optional()
})

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/notifications/preferences', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    console.log(`📱 Getting notification preferences for user ${user.id}`)

    // Get user notification preferences
    const preferencesResult = await notificationService.getNotificationPreferences(user.id)

    if (!preferencesResult.success) {
      throw new Error(preferencesResult.error || 'Failed to get notification preferences')
    }

    // Get default preferences if none exist
    const defaultPreferences: NotificationPreferences = {
      user_id: user.id,
      push_notifications: true,
      sms_notifications: true,
      email_notifications: true,
      call_notifications: false,
      emergency_only: false,
      blood_request_alerts: true,
      donation_reminders: true,
      system_updates: true
    }

    const preferences = preferencesResult.data || defaultPreferences

    const response = {
      success: true,
      data: {
        user_id: user.id,
        preferences,
        last_updated: new Date().toISOString()
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

export async function PUT(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/notifications/preferences', 'PUT')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updatePreferencesSchema.parse(body)

    console.log(`⚙️ Updating notification preferences for user ${user.id}`)

    // Validate quiet hours if provided
    if (validatedData.quiet_hours_start && validatedData.quiet_hours_end) {
      const start = validatedData.quiet_hours_start
      const end = validatedData.quiet_hours_end
      
      if (start === end) {
        throw ValidationError('Quiet hours start and end times cannot be the same')
      }
    }

    // Update notification preferences
    const updateResult = await notificationService.updateNotificationPreferences(
      user.id,
      validatedData
    )

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update notification preferences')
    }

    // Get updated preferences to return
    const preferencesResult = await notificationService.getNotificationPreferences(user.id)
    
    // Log the preference update
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'preferences_updated',
        risk_level: 'low',
        user_id: user.id,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        details: {
          updated_fields: Object.keys(validatedData),
          preferences_type: 'notifications'
        },
        resolved: true
      }])

    const response = {
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        user_id: user.id,
        preferences: preferencesResult.data,
        updated_at: new Date().toISOString()
      }
    }

    console.log(`✅ Updated notification preferences for user ${user.id}`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/notifications/preferences', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    console.log(`🔧 Resetting notification preferences to defaults for user ${user.id}`)

    // Reset to default preferences
    const defaultPreferences: Partial<NotificationPreferences> = {
      push_notifications: true,
      sms_notifications: true,
      email_notifications: true,
      call_notifications: false,
      emergency_only: false,
      blood_request_alerts: true,
      donation_reminders: true,
      system_updates: true,
      quiet_hours_start: undefined,
      quiet_hours_end: undefined
    }

    const updateResult = await notificationService.updateNotificationPreferences(
      user.id,
      defaultPreferences
    )

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to reset notification preferences')
    }

    // Get updated preferences to return
    const preferencesResult = await notificationService.getNotificationPreferences(user.id)

    // Log the preference reset
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'preferences_reset',
        risk_level: 'low',
        user_id: user.id,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        details: {
          action: 'reset_to_defaults',
          preferences_type: 'notifications'
        },
        resolved: true
      }])

    const response = {
      success: true,
      message: 'Notification preferences reset to defaults',
      data: {
        user_id: user.id,
        preferences: preferencesResult.data,
        reset_at: new Date().toISOString()
      }
    }

    console.log(`✅ Reset notification preferences for user ${user.id}`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}