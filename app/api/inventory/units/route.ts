/**
 * Blood Units API Endpoint
 * Manage individual blood units
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { inventoryManagementService } from '@/lib/inventory-management-service'
import { z } from 'zod'

const addBloodUnitsSchema = z.object({
  units: z.array(z.object({
    donorId: z.string().uuid('Invalid donor ID'),
    bloodType: z.string().regex(/^(O|A|B|AB)[+-]$/, 'Invalid blood type'),
    volume: z.number().min(50).max(500, 'Volume must be between 50-500mL'),
    collectionDate: z.string().datetime('Invalid collection date'),
    expiryDate: z.string().datetime('Invalid expiry date').optional(),
    status: z.enum(['available', 'testing', 'quarantine']).default('testing'),
    location: z.string().min(1, 'Location is required'),
    storageConditions: z.object({
      temperature: z.number(),
      humidity: z.number(),
      lastChecked: z.string().datetime('Invalid timestamp')
    }),
    qualityScore: z.number().min(0).max(100).default(85),
    batchNumber: z.string().min(1, 'Batch number is required'),
    testResults: z.object({
      hiv: z.enum(['negative', 'positive', 'pending']).default('pending'),
      hepatitisB: z.enum(['negative', 'positive', 'pending']).default('pending'),
      hepatitisC: z.enum(['negative', 'positive', 'pending']).default('pending'),
      syphilis: z.enum(['negative', 'positive', 'pending']).default('pending'),
      completedAt: z.string().datetime('Invalid completion date').optional()
    }),
    metadata: z.object({
      collectionCenter: z.string().min(1, 'Collection center is required'),
      processingStaff: z.string().min(1, 'Processing staff is required'),
      notes: z.string().optional()
    })
  })).min(1, 'At least one blood unit is required')
})

const reserveUnitsSchema = z.object({
  bloodType: z.string().regex(/^(O|A|B|AB)[+-]$/, 'Invalid blood type'),
  unitsNeeded: z.number().min(1).max(10, 'Can reserve 1-10 units at a time'),
  requestId: z.string().uuid('Invalid request ID'),
  expiryPreference: z.enum(['oldest_first', 'newest_first']).default('oldest_first')
})

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/inventory/units', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse query parameters
    const url = new URL(request.url)
    const bloodType = url.searchParams.get('bloodType')
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Get user's blood bank ID
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('blood_bank_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.blood_bank_id) {
      throw ValidationError('User must be associated with a blood bank')
    }

    console.log(`🩸 Getting blood units for blood bank: ${userProfile.blood_bank_id}`)

    // Build query
    let query = supabase
      .from('blood_units')
      .select(`
        id,
        donor_id,
        blood_type,
        volume,
        collection_date,
        expiry_date,
        status,
        location,
        storage_temperature,
        storage_humidity,
        quality_score,
        batch_number,
        test_results,
        metadata,
        reserved_for_request,
        reserved_at,
        created_at,
        updated_at
      `)
      .eq('blood_bank_id', userProfile.blood_bank_id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (bloodType) {
      query = query.eq('blood_type', bloodType)
    }
    if (status) {
      query = query.eq('status', status)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: bloodUnits, error: queryError } = await query

    if (queryError) {
      throw new Error(`Failed to fetch blood units: ${queryError.message}`)
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('blood_units')
      .select('id', { count: 'exact', head: true })
      .eq('blood_bank_id', userProfile.blood_bank_id)

    if (bloodType) countQuery = countQuery.eq('blood_type', bloodType)
    if (status) countQuery = countQuery.eq('status', status)

    const { count } = await countQuery

    const response = {
      success: true,
      data: {
        units: bloodUnits || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasNext: (count || 0) > offset + limit
        },
        filters: {
          bloodType,
          status
        }
      }
    }

    console.log(`✅ Retrieved ${(bloodUnits || []).length} blood units`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/inventory/units', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Get user profile to check permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, blood_bank_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.blood_bank_id) {
      throw ValidationError('User must be associated with a blood bank')
    }

    if (!['blood_bank_staff', 'blood_bank_admin', 'admin', 'super_admin'].includes(userProfile.role)) {
      throw ValidationError('Insufficient permissions to add blood units')
    }

    // Parse and validate request body
    const body = await request.json()
    const action = body.action

    if (action === 'add') {
      // Add new blood units
      const validatedData = addBloodUnitsSchema.parse(body)
      const { units } = validatedData

      console.log(`🩸 Adding ${units.length} blood units`)

      const result = await inventoryManagementService.addBloodUnits(units)

      const response = {
        success: result.success,
        message: `Added ${result.unitsAdded}/${units.length} blood units successfully`,
        data: {
          unitsAdded: result.unitsAdded,
          totalUnits: units.length,
          errors: result.errors,
          addedAt: new Date().toISOString()
        }
      }

      console.log(`✅ Added ${result.unitsAdded} blood units`)
      tracker.end(result.success ? 200 : 400)
      return NextResponse.json(response)

    } else if (action === 'reserve') {
      // Reserve blood units for a request
      const validatedData = reserveUnitsSchema.parse(body)
      const { bloodType, unitsNeeded, requestId, expiryPreference } = validatedData

      console.log(`🔒 Reserving ${unitsNeeded} ${bloodType} units for request ${requestId}`)

      const result = await inventoryManagementService.reserveBloodUnits(
        bloodType,
        unitsNeeded,
        requestId,
        expiryPreference
      )

      const response = {
        success: result.success,
        message: result.message,
        data: {
          reservedUnits: result.reservedUnits,
          bloodType,
          unitsNeeded,
          requestId,
          reservedAt: new Date().toISOString()
        }
      }

      console.log(`${result.success ? '✅' : '❌'} Reservation result: ${result.message}`)
      tracker.end(result.success ? 200 : 400)
      return NextResponse.json(response)

    } else if (action === 'process_expired') {
      // Process expired units
      console.log('🗑️ Processing expired blood units')

      const result = await inventoryManagementService.processExpiredUnits()

      const response = {
        success: true,
        message: `Processed ${result.processedCount} expired units`,
        data: {
          processedCount: result.processedCount,
          disposedUnits: result.disposedUnits,
          processedAt: new Date().toISOString()
        }
      }

      console.log(`✅ Processed ${result.processedCount} expired units`)
      tracker.end(200)
      return NextResponse.json(response)

    } else {
      throw ValidationError('Invalid action. Use "add", "reserve", or "process_expired"')
    }

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}