/**
 * Blood Request Status API Endpoint
 * Update and track blood request status with real-time updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { enhancedBloodRequestService } from '@/lib/enhanced-blood-request-service'
import { z } from 'zod'

const statusUpdateSchema = z.object({
  request_id: z.string().uuid('Invalid request ID'),
  status: z.enum(['pending', 'processing', 'matched', 'partially_fulfilled', 'completed', 'expired', 'cancelled']),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional()
})

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/blood-requests/status', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = statusUpdateSchema.parse(body)
    const { request_id, status, notes, metadata } = validatedData

    console.log(`📊 Updating request ${request_id} status to: ${status} by user ${user.id}`)

    // Get user permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()

    // Check if user has permission to update this request
    const { data: bloodRequest } = await supabase
      .from('blood_requests')
      .select('id, requester_id, institution_id, status')
      .eq('id', request_id)
      .single()

    if (!bloodRequest) {
      throw ValidationError('Blood request not found')
    }

    // Permission check
    const canUpdate = 
      bloodRequest.requester_id === user.id || // Request creator
      userProfile?.role === 'admin' || // Admin
      userProfile?.role === 'super_admin' || // Super admin
      (userProfile?.institution_id === bloodRequest.institution_id && 
       ['hospital_staff', 'blood_bank_staff', 'emergency_responder'].includes(userProfile.role)) // Institution staff

    if (!canUpdate) {
      throw ValidationError('Insufficient permissions to update this request')
    }

    // Update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('blood_requests')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(metadata && { metadata })
      })
      .eq('id', request_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`)
    }

    // Log the status update
    await enhancedBloodRequestService.logRequestUpdate(
      request_id,
      user.id,
      'status_change',
      bloodRequest.status,
      status,
      notes
    )

    // Broadcast real-time status update
    await enhancedBloodRequestService.updateRequestStatus(request_id, status, metadata)

    // Handle specific status updates
    if (status === 'completed') {
      // Update donor statistics
      const { data: responses } = await supabase
        .from('donor_responses')
        .select('donor_id')
        .eq('request_id', request_id)
        .eq('response_type', 'accept')

      for (const response of responses || []) {
        await supabase
          .from('users')
          .update({
            successful_donations: supabase.rpc('increment_donations', { donor_id: response.donor_id })
          })
          .eq('id', response.donor_id)
      }
    }

    const response = {
      success: true,
      message: `Request status updated to ${status}`,
      data: {
        request: updatedRequest,
        previous_status: bloodRequest.status,
        updated_by: user.id,
        updatedAt: new Date().toISOString()
      }
    }

    console.log(`✅ Updated request ${request_id} status: ${bloodRequest.status} → ${status}`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/blood-requests/status', 'GET')

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
    const includeHistory = url.searchParams.get('include_history') === 'true'

    if (!requestId) {
      throw ValidationError('request_id parameter is required')
    }

    // Get the blood request with detailed information
    const { data: bloodRequest, error: requestError } = await supabase
      .from('blood_requests')
      .select(`
        *,
        donor_responses (
          id,
          donor_id,
          response_type,
          status,
          eta_minutes,
          current_location,
          confirmed_at,
          created_at,
          users!donor_responses_donor_id_fkey (
            name,
            phone,
            blood_type
          )
        )
      `)
      .eq('id', requestId)
      .single()

    if (requestError || !bloodRequest) {
      throw ValidationError('Blood request not found')
    }

    // Check user permissions to view this request
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()

    const canView = 
      bloodRequest.requester_id === user.id || // Request creator
      userProfile?.role === 'admin' || // Admin
      userProfile?.role === 'super_admin' || // Super admin
      (userProfile?.institution_id === bloodRequest.institution_id && 
       ['hospital_staff', 'blood_bank_staff', 'emergency_responder'].includes(userProfile.role)) || // Institution staff
      (bloodRequest.donor_responses || []).some((r: any) => r.donor_id === user.id) // Responding donor

    if (!canView) {
      throw ValidationError('Insufficient permissions to view this request')
    }

    let statusHistory = null
    if (includeHistory) {
      const historyResult = await enhancedBloodRequestService.getRequestUpdates(requestId)
      statusHistory = historyResult.data || []
    }

    const response = {
      success: true,
      data: {
        request: bloodRequest,
        status_history: statusHistory,
        response_summary: {
          total_responses: (bloodRequest.donor_responses || []).length,
          accepted: (bloodRequest.donor_responses || []).filter((r: any) => r.response_type === 'accept').length,
          declined: (bloodRequest.donor_responses || []).filter((r: any) => r.response_type === 'decline').length,
          maybe: (bloodRequest.donor_responses || []).filter((r: any) => r.response_type === 'maybe').length
        },
        real_time_tracking: bloodRequest.status === 'matched' || bloodRequest.status === 'partially_fulfilled'
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