/**
 * Donor Response API Endpoint
 * Handle donor responses to blood requests with real-time updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { enhancedBloodRequestService } from '@/lib/enhanced-blood-request-service'
import { z } from 'zod'

const donorResponseSchema = z.object({
  request_id: z.string().uuid('Invalid request ID'),
  response_type: z.enum(['accept', 'decline', 'maybe']),
  eta_minutes: z.number().min(5).max(480).optional(), // 5 minutes to 8 hours
  current_location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional(),
  notes: z.string().max(500).optional()
})

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/blood-requests/respond', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = donorResponseSchema.parse(body)
    const { request_id, response_type, eta_minutes, current_location, notes } = validatedData

    console.log(`👤 Processing donor response: ${response_type} for request ${request_id} by user ${user.id}`)

    // Verify user is a donor
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, blood_type')
      .eq('id', user.id)
      .single()

    if (!userProfile || !['donor', 'verified_donor'].includes(userProfile.role)) {
      throw ValidationError('Only registered donors can respond to blood requests')
    }

    // Check if the request is still active
    const { data: bloodRequest } = await supabase
      .from('blood_requests')
      .select('id, status, blood_type, urgency_level, patient_name, hospital_name')
      .eq('id', request_id)
      .single()

    if (!bloodRequest) {
      throw ValidationError('Blood request not found')
    }

    if (['completed', 'cancelled', 'expired'].includes(bloodRequest.status)) {
      throw ValidationError('This blood request is no longer active')
    }

    // Handle the donor response
    const responseResult = await enhancedBloodRequestService.handleDonorResponse(
      request_id,
      user.id,
      response_type,
      {
        eta_minutes,
        current_location,
        notes
      }
    )

    if (!responseResult.success) {
      throw new Error(responseResult.error || 'Failed to process donor response')
    }

    // Log the response in security events
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'donor_response',
        risk_level: 'low',
        user_id: user.id,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        details: {
          request_id,
          response_type,
          matched: responseResult.matched,
          eta_minutes
        },
        resolved: true
      }])

    const response = {
      success: true,
      message: `Response recorded successfully${responseResult.matched ? ' - Request fully matched!' : ''}`,
      data: {
        request_id,
        response_type,
        donor_id: user.id,
        matched: responseResult.matched,
        eta_minutes,
        respondedAt: new Date().toISOString()
      }
    }

    console.log(`✅ Donor response processed: ${response_type} for request ${request_id}${responseResult.matched ? ' - MATCHED!' : ''}`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/blood-requests/respond', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Get query parameters
    const url = new URL(request.url)
    const requestId = url.searchParams.get('request_id')

    if (requestId) {
      // Get specific request responses
      const { data: responses, error } = await supabase
        .from('donor_responses')
        .select(`
          *,
          users!donor_responses_donor_id_fkey (
            name,
            phone,
            blood_type
          )
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch responses: ${error.message}`)
      }

      const response = {
        success: true,
        data: {
          request_id: requestId,
          responses: responses || [],
          totalResponses: (responses || []).length,
          acceptedCount: (responses || []).filter(r => r.response_type === 'accept').length
        }
      }

      tracker.end(200)
      return NextResponse.json(response)
    } else {
      // Get user's responses
      const { data: userResponses, error } = await supabase
        .from('donor_responses')
        .select(`
          *,
          blood_requests!donor_responses_request_id_fkey (
            patient_name,
            hospital_name,
            blood_type,
            urgency_level,
            status
          )
        `)
        .eq('donor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        throw new Error(`Failed to fetch user responses: ${error.message}`)
      }

      const response = {
        success: true,
        data: {
          donor_id: user.id,
          responses: userResponses || [],
          totalResponses: (userResponses || []).length,
          acceptedResponses: (userResponses || []).filter(r => r.response_type === 'accept').length
        }
      }

      tracker.end(200)
      return NextResponse.json(response)
    }

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}