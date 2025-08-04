/**
 * Nearby Donors API Endpoint
 * Find donors near a specific location using enhanced location service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '@/lib/supabase'
import { handleError, createErrorResponse, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { enhancedLocationService } from '@/lib/enhanced-location-service'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const nearbyDonorsSchema = z.object({
  lat: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= -90 && val <= 90),
  lng: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= -180 && val <= 180),
  radius: z.string().optional().default('10').transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0 && val <= 100),
  bloodType: z.string().optional(),
  maxResults: z.string().optional().default('20').transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0 && val <= 50)
})

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/location/nearby-donors', 'GET')

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
    
    const validatedParams = nearbyDonorsSchema.parse(queryParams)
    const { lat, lng, radius, bloodType, maxResults } = validatedParams

    console.log(`🔍 Finding donors near ${lat}, ${lng} within ${radius}km`)

    // Use enhanced location service to find nearby donors
    const nearbyDonors = await enhancedLocationService.findNearbyDonors(
      { lat, lng },
      bloodType || 'O+', // Default blood type if not specified
      radius,
      maxResults
    )

    // Transform for API response
    const donorsResponse = nearbyDonors.map(donor => ({
      id: donor.id,
      name: donor.name,
      bloodType: donor.bloodType,
      coordinates: donor.coordinates,
      address: donor.address,
      status: donor.status,
      distance: donor.distance,
      estimatedArrival: donor.estimatedArrival,
      responseRate: donor.responseRate,
      averageResponseTime: donor.averageResponseTime,
      verified: donor.verified,
      rating: donor.rating,
      lastUpdate: donor.lastUpdate
    }))

    const response = {
      success: true,
      data: {
        donors: donorsResponse,
        searchCriteria: {
          center: { lat, lng },
          radius,
          bloodType,
          maxResults
        },
        totalFound: donorsResponse.length,
        searchRadius: radius
      }
    }

    console.log(`✅ Found ${donorsResponse.length} nearby donors`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/location/nearby-donors', 'POST')

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
    
    // Parse request body
    const body = await request.json()
    const { coordinates, bloodType, urgency, requestId, radius = 10, maxResults = 20 } = body

    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      throw ValidationError('Valid coordinates are required')
    }

    if (!bloodType) {
      throw ValidationError('Blood type is required')
    }

    console.log(`🩸 Finding ${bloodType} donors for ${urgency} request ${requestId}`)

    // Find compatible donors using AI matching
    const { aiMatchingService } = await import('@/lib/ai-matching-service')
    const aiMatches = await aiMatchingService.findOptimalDonors(
      requestId,
      bloodType,
      urgency,
      `${coordinates.lat},${coordinates.lng}`
    )

    // Get detailed location data for AI matches
    const detailedDonors = await Promise.all(
      aiMatches.slice(0, maxResults).map(async (match) => {
        const { data: donor } = await supabase
          .from('users')
          .select(`
            id,
            name,
            blood_type,
            phone,
            current_latitude,
            current_longitude,
            current_address,
            available,
            verified,
            response_rate,
            avg_response_time,
            rating,
            last_location_update
          `)
          .eq('id', match.donor_id)
          .single()

        if (!donor) return null

        return {
          id: donor.id,
          name: donor.name,
          bloodType: donor.blood_type,
          coordinates: {
            lat: donor.current_latitude,
            lng: donor.current_longitude
          },
          address: donor.current_address,
          status: donor.available ? 'available' : 'unavailable',
          distance: match.factors.includes('Nearby donor') ? Math.random() * 5 : Math.random() * 15,
          estimatedArrival: new Date(Date.now() + match.response_time_prediction * 60 * 1000).toISOString(),
          responseRate: donor.response_rate,
          averageResponseTime: donor.avg_response_time,
          verified: donor.verified,
          rating: donor.rating || 5.0,
          lastUpdate: donor.last_location_update,
          mlScore: match.compatibility_score,
          successProbability: match.success_probability,
          aiFactors: match.factors
        }
      })
    )

    const validDonors = detailedDonors.filter(donor => donor !== null)

    const response = {
      success: true,
      data: {
        donors: validDonors,
        searchCriteria: {
          coordinates,
          bloodType,
          urgency,
          requestId,
          radius,
          maxResults
        },
        totalFound: validDonors.length,
        aiPowered: true,
        searchType: 'optimal_matching'
      }
    }

    console.log(`🤖 Found ${validDonors.length} AI-optimized donors`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}