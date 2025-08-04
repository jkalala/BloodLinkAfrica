/**
 * Start Location Tracking API Endpoint
 * Begin real-time location tracking for users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { enhancedLocationService } from '@/lib/enhanced-location-service'
import { requireAuth, canAccessUserResource } from '@/lib/auth-middleware'
import { z } from 'zod'

const startTrackingSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  type: z.enum(['donor', 'blood_bank', 'request', 'transport']),
  requestId: z.string().uuid('Invalid request ID').optional(),
  highAccuracy: z.boolean().optional().default(false),
  updateInterval: z.number().min(5000).max(300000).optional().default(30000) // 5 seconds to 5 minutes
})

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/location/tracking/start', 'POST')

  try {
    // Verify user authentication
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const { context: authContext } = authResult
    const supabase = createAuthenticatedServerClient(authResult.context.session.access_token)

    // Parse and validate request body
    const body = await request.json()
    const validatedData = startTrackingSchema.parse(body)
    const { userId, type, requestId, highAccuracy, updateInterval } = validatedData

    // Verify user can start tracking for this userId (themselves or admin)
    if (!canAccessUserResource(authContext, userId, { allowSelf: true, requireAdmin: false })) {
      throw ValidationError('Can only start tracking for your own account')
    }

    // Check if user has given tracking consent
    const { data: targetUser } = await supabase
      .from('users')
      .select('tracking_consent, location_sharing_enabled')
      .eq('id', userId)
      .single()

    if (!targetUser?.tracking_consent) {
      throw ValidationError('User has not consented to location tracking')
    }

    if (!targetUser?.location_sharing_enabled) {
      throw ValidationError('User has disabled location sharing')
    }

    console.log(`📍 Starting location tracking for user ${userId}`)

    // Start tracking using enhanced location service
    const trackingResult = await enhancedLocationService.startLocationTracking(
      userId,
      type,
      {
        highAccuracy,
        updateInterval,
        ...(requestId && { requestId })
      }
    )

    if (!trackingResult.success) {
      throw new Error('Failed to start location tracking')
    }

    // Log tracking start in security events
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    await supabase
      .from('security_events')
      .insert([{
        event_type: 'location_tracking_started',
        risk_level: 'low',
        user_id: authContext.user.id,
        ip_address: clientIp,
        user_agent: request.headers.get('user-agent') || 'unknown',
        details: {
          tracked_user_id: userId,
          tracking_type: type,
          request_id: requestId,
          high_accuracy: highAccuracy,
          update_interval: updateInterval
        },
        resolved: true
      }])

    const response = {
      success: true,
      message: 'Location tracking started successfully',
      data: {
        trackingId: trackingResult.trackingId,
        userId,
        type,
        highAccuracy,
        updateInterval,
        requestId,
        startedAt: new Date().toISOString()
      }
    }

    console.log(`✅ Location tracking started: ${trackingResult.trackingId}`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/location/tracking/start', 'GET')

  try {
    // Verify user authentication
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const { context: authContext } = authResult
    const supabase = createAuthenticatedServerClient(authResult.context.session.access_token)

    // Get active tracking sessions for user
    const { data: trackingSessions } = await supabase
      .from('location_tracking')
      .select(`
        id,
        user_id,
        type,
        status,
        request_id,
        high_accuracy,
        update_interval,
        started_at,
        stopped_at
      `)
      .eq('user_id', authContext.user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })

    const response = {
      success: true,
      data: {
        activeTrackingSessions: trackingSessions || [],
        totalActive: (trackingSessions || []).length
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