/**
 * Enhanced Blood Request Creation API
 * Create blood requests with AI-powered real-time matching
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { enhancedBloodRequestService } from '@/lib/enhanced-blood-request-service'
import { z } from 'zod'

const createBloodRequestSchema = z.object({
  patient_name: z.string().min(2, 'Patient name must be at least 2 characters'),
  patient_age: z.number().min(0).max(120).optional(),
  patient_gender: z.enum(['male', 'female', 'other']).optional(),
  hospital_name: z.string().min(2, 'Hospital name must be at least 2 characters'),
  hospital_id: z.string().uuid().optional(),
  blood_type: z.string().regex(/^(O|A|B|AB)[+-]$/, 'Invalid blood type format'),
  units_needed: z.number().min(1).max(10, 'Units needed must be between 1-10'),
  urgency_level: z.enum(['normal', 'urgent', 'critical', 'emergency']).default('normal'),
  medical_condition: z.string().optional(),
  surgery_date: z.string().datetime().optional(),
  contact_name: z.string().min(2, 'Contact name is required'),
  contact_phone: z.string().min(10, 'Valid phone number is required'),
  contact_email: z.string().email().optional(),
  additional_info: z.string().optional(),
  location: z.string().min(3, 'Location is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5, 'Address is required'),
  request_type: z.enum(['donation', 'emergency', 'scheduled', 'reserve']).default('donation'),
  estimated_cost: z.number().min(0).optional(),
  insurance_info: z.record(z.any()).optional(),
  medical_notes: z.string().optional(),
  donor_requirements: z.record(z.any()).optional(),
  completion_deadline: z.string().datetime().optional(),
  emergency_contact: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional()
})

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/blood-requests/create', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createBloodRequestSchema.parse(body)

    console.log(`🩸 Creating blood request for ${validatedData.blood_type} by user ${user.id}`)

    // Get user profile for additional context
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('institution_id, role')
      .eq('id', user.id)
      .single()

    // Create enhanced blood request data
    const requestData = {
      ...validatedData,
      requester_id: user.id,
      institution_id: userProfile?.institution_id || null,
      urgency: validatedData.urgency_level // Legacy field mapping
    }

    // Create the blood request with real-time matching
    const result = await enhancedBloodRequestService.createBloodRequest(requestData)

    if (!result.success) {
      throw new Error(result.error || 'Failed to create blood request')
    }

    const response = {
      success: true,
      message: 'Blood request created successfully with AI-powered matching initiated',
      data: {
        request: result.data,
        matches: result.matches,
        realTimeMatching: true,
        createdAt: new Date().toISOString()
      }
    }

    console.log(`✅ Created blood request: ${result.data?.id}`)
    if (result.matches) {
      console.log(`🤖 Found ${result.matches.donor_matches?.length || 0} donor matches, ${result.matches.blood_bank_matches?.length || 0} blood bank matches`)
    }

    tracker.end(201)
    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/blood-requests/create', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Get user's blood requests
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('institution_id, role')
      .eq('id', user.id)
      .single()

    const result = await enhancedBloodRequestService.getBloodRequests(
      user.id,
      userProfile?.role || 'donor',
      userProfile?.institution_id || undefined
    )

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch blood requests')
    }

    const response = {
      success: true,
      data: {
        requests: result.data || [],
        userRole: userProfile?.role,
        institutionId: userProfile?.institution_id,
        totalRequests: (result.data || []).length
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