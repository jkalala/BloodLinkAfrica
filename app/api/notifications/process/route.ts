/**
 * Notification Processing API Endpoint
 * Process pending notifications and manage notification queue
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { notificationService } from '@/lib/notification-service'

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/notifications/process', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication - only system/admin users can trigger processing
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Check user permissions - only admins and system processes can trigger this
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const canProcessNotifications = 
      userProfile?.role === 'admin' ||
      userProfile?.role === 'super_admin' ||
      userProfile?.role === 'system'

    if (!canProcessNotifications) {
      throw ValidationError('Insufficient permissions to process notifications')
    }

    console.log(`🔄 Processing pending notifications triggered by user ${user.id}`)

    // Process pending notifications
    const processResult = await notificationService.processPendingNotifications()

    if (!processResult.success) {
      throw new Error(processResult.error || 'Failed to process notifications')
    }

    // Log the processing activity
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'notification_processing',
        risk_level: 'low',
        user_id: user.id,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        details: {
          processed: processResult.processed,
          retried: processResult.retried,
          processing_trigger: 'manual'
        },
        resolved: true
      }])

    const response = {
      success: true,
      message: 'Notification processing completed',
      data: {
        processed: processResult.processed,
        retried: processResult.retried,
        processed_at: new Date().toISOString(),
        triggered_by: user.id
      }
    }

    console.log(`✅ Processed ${processResult.processed} notifications, retried ${processResult.retried}`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/notifications/process', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Check user permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const canViewQueue = 
      userProfile?.role === 'admin' ||
      userProfile?.role === 'super_admin'

    if (!canViewQueue) {
      throw ValidationError('Insufficient permissions to view notification queue')
    }

    // Get notification queue status
    const { data: queueData, error: queueError } = await supabase
      .from('notification_queue')
      .select('status, priority, notification_type, created_at, delivery_attempts')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (queueError) {
      throw new Error(`Failed to fetch queue data: ${queueError.message}`)
    }

    // Calculate queue statistics
    const stats = {
      total_notifications: queueData?.length || 0,
      pending: queueData?.filter(n => n.status === 'pending').length || 0,
      sent: queueData?.filter(n => n.status === 'sent').length || 0,
      failed: queueData?.filter(n => n.status === 'failed').length || 0,
      processing: queueData?.filter(n => n.status === 'processing').length || 0,
      by_priority: {
        critical: queueData?.filter(n => n.priority === 'critical').length || 0,
        high: queueData?.filter(n => n.priority === 'high').length || 0,
        normal: queueData?.filter(n => n.priority === 'normal').length || 0,
        low: queueData?.filter(n => n.priority === 'low').length || 0
      },
      by_type: {},
      failed_with_retries: queueData?.filter(n => n.status === 'failed' && (n.delivery_attempts || 0) >= 3).length || 0,
      pending_retries: queueData?.filter(n => n.status === 'failed' && (n.delivery_attempts || 0) < 3).length || 0
    }

    // Group by notification type
    for (const notification of queueData || []) {
      if (!stats.by_type[notification.notification_type]) {
        stats.by_type[notification.notification_type] = 0
      }
      stats.by_type[notification.notification_type]++
    }

    // Get recent processing history
    const { data: recentProcessing, error: historyError } = await supabase
      .from('security_events')
      .select('created_at, details')
      .eq('event_type', 'notification_processing')
      .order('created_at', { ascending: false })
      .limit(10)

    const response = {
      success: true,
      data: {
        queue_statistics: stats,
        last_processing_runs: recentProcessing || [],
        queue_health: {
          status: stats.failed > stats.sent * 0.1 ? 'unhealthy' : 'healthy',
          backlog_size: stats.pending + stats.processing,
          failure_rate: stats.total_notifications > 0 ? (stats.failed / stats.total_notifications * 100).toFixed(2) + '%' : '0%'
        },
        recommendations: [
          ...(stats.pending > 100 ? ['High number of pending notifications - consider manual processing'] : []),
          ...(stats.failed_with_retries > 50 ? ['Many failed notifications with max retries - check service configuration'] : []),
          ...(stats.by_priority.critical > 0 ? ['Critical priority notifications in queue - process immediately'] : [])
        ]
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