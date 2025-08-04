/**
 * Blood Banks Location API Endpoint
 * Find blood banks near a specific location
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '@/lib/supabase'
import { handleError, createErrorResponse, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const bloodBanksSchema = z.object({
  lat: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= -90 && val <= 90),
  lng: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= -180 && val <= 180),
  radius: z.string().optional().default('25').transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0 && val <= 100),
  bloodType: z.string().optional(),
  isActive: z.string().optional().default('true').transform(val => val === 'true'),
  maxResults: z.string().optional().default('20').transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0 && val <= 50)
})

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/location/blood-banks', 'GET')

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
    
    const validatedParams = bloodBanksSchema.parse(queryParams)
    const { lat, lng, radius, bloodType, isActive, maxResults } = validatedParams

    console.log(`🏥 Finding blood banks near ${lat}, ${lng} within ${radius}km`)

    // Build query for blood banks
    let query = supabase
      .from('institutions')
      .select(`
        id,
        name,
        address,
        phone,
        email,
        location_lat,
        location_lng,
        is_active,
        type,
        specialties,
        operating_hours,
        services,
        capacity,
        inventory (
          blood_type,
          units_available,
          status,
          last_updated
        )
      `)
      .in('type', ['blood_bank', 'hospital'])
      .order('name', { ascending: true })
      .limit(maxResults * 2) // Get more to filter by distance

    // Filter by active status
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive)
    }

    const { data: bloodBanks, error } = await query

    if (error) {
      console.error('Database error:', error)
      throw new Error('Failed to fetch blood banks')
    }

    // Filter by distance and process data
    const filteredBanks = (bloodBanks || [])
      .filter(bank => {
        if (!bank.location_lat || !bank.location_lng) return false
        
        const distance = calculateDistance(
          lat, lng,
          bank.location_lat, bank.location_lng
        )
        
        return distance <= radius
      })
      .map(bank => {
        const distance = calculateDistance(lat, lng, bank.location_lat, bank.location_lng)
        
        // Process inventory data
        const inventory: Record<string, number> = {}
        if (bank.inventory && Array.isArray(bank.inventory)) {
          bank.inventory.forEach((item: any) => {
            if (item.blood_type && item.units_available) {
              inventory[item.blood_type] = item.units_available
            }
          })
        }

        // Filter by blood type if specified
        if (bloodType && !inventory[bloodType]) {
          return null
        }

        return {
          id: bank.id,
          name: bank.name,
          coordinates: {
            lat: bank.location_lat,
            lng: bank.location_lng
          },
          address: bank.address,
          phone: bank.phone,
          email: bank.email,
          isActive: bank.is_active,
          distance,
          type: bank.type,
          specialties: bank.specialties || [],
          operatingHours: bank.operating_hours || {},
          services: bank.services || {},
          capacity: bank.capacity,
          inventory,
          hasRequiredBloodType: bloodType ? !!inventory[bloodType] : true,
          totalUnits: Object.values(inventory).reduce((sum: number, units: number) => sum + units, 0)
        }
      })
      .filter(bank => bank !== null)
      .slice(0, maxResults)

    // Sort by distance and availability
    filteredBanks.sort((a, b) => {
      // Prioritize banks with required blood type
      if (bloodType) {
        const aHasBlood = a.inventory[bloodType] > 0
        const bHasBlood = b.inventory[bloodType] > 0
        
        if (aHasBlood && !bHasBlood) return -1
        if (!aHasBlood && bHasBlood) return 1
      }
      
      // Then sort by distance
      return a.distance - b.distance
    })

    const response = {
      success: true,
      data: {
        bloodBanks: filteredBanks,
        searchCriteria: {
          center: { lat, lng },
          radius,
          bloodType,
          isActive,
          maxResults
        },
        totalFound: filteredBanks.length,
        searchRadius: radius,
        summary: {
          totalBanks: filteredBanks.length,
          activeBanks: filteredBanks.filter(bank => bank.isActive).length,
          banksWithRequiredBlood: bloodType ? filteredBanks.filter(bank => bank.inventory[bloodType] > 0).length : null
        }
      }
    }

    console.log(`✅ Found ${filteredBanks.length} blood banks`)
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