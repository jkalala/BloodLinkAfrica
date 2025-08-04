/**
 * Blood Requests Location API Endpoint
 * Find blood requests near a specific location
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '@/lib/supabase'
import { handleError, createErrorResponse, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const bloodRequestsSchema = z.object({
  lat: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= -90 && val <= 90),
  lng: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= -180 && val <= 180),
  radius: z.string().optional().default('20').transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0 && val <= 100),
  urgency: z.enum(['normal', 'urgent', 'critical']).optional(),
  maxResults: z.string().optional().default('30').transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0 && val <= 100)
})

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/location/blood-requests', 'GET')

  try {
    // Verify user authentication
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const supabase = createAuthenticatedServerClient(authResult.context.session.access_token)
    
    // Parse and validate query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    const validatedParams = bloodRequestsSchema.parse(queryParams)
    const { lat, lng, radius, urgency, maxResults } = validatedParams

    console.log(`🩸 Finding blood requests near ${lat}, ${lng} within ${radius}km`)

    // Build query for blood requests with location filtering
    let query = supabase
      .from('blood_requests')
      .select(`
        id,
        patient_name,
        blood_type,
        urgency,
        latitude,
        longitude,
        hospital_name,
        units_needed,
        status,
        created_at,
        updated_at,
        description,
        contact_phone
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(maxResults)

    // Filter by urgency if specified
    if (urgency) {
      query = query.eq('urgency', urgency)
    }

    const { data: bloodRequests, error } = await query

    if (error) {
      console.error('Database error:', error)
      throw new Error('Failed to fetch blood requests')
    }

    // Filter by distance (simplified - in production use PostGIS)
    const filteredRequests = (bloodRequests || []).filter(request => {
      if (!request.latitude || !request.longitude) return false
      
      const distance = calculateDistance(
        lat, lng,
        request.latitude, request.longitude
      )
      
      return distance <= radius
    }).map(request => ({
      id: request.id,
      patientName: request.patient_name,
      bloodType: request.blood_type,
      urgency: request.urgency,
      coordinates: {
        lat: request.latitude,
        lng: request.longitude
      },
      hospital: request.hospital_name,
      unitsNeeded: request.units_needed,
      status: request.status,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
      description: request.description,
      contactPhone: request.contact_phone,
      distance: calculateDistance(lat, lng, request.latitude, request.longitude)
    }))

    // Sort by urgency and distance
    filteredRequests.sort((a, b) => {
      const urgencyOrder = { critical: 0, urgent: 1, normal: 2 }
      const urgencyDiff = urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder]
      
      if (urgencyDiff !== 0) return urgencyDiff
      return a.distance - b.distance
    })

    const response = {
      success: true,
      data: {
        requests: filteredRequests,
        searchCriteria: {
          center: { lat, lng },
          radius,
          urgency,
          maxResults
        },
        totalFound: filteredRequests.length,
        searchRadius: radius
      }
    }

    console.log(`✅ Found ${filteredRequests.length} blood requests`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}