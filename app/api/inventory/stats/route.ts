/**
 * Inventory Statistics API Endpoint
 * Get comprehensive inventory statistics and metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { inventoryManagementService } from '@/lib/inventory-management-service'

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/inventory/stats', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Get user's blood bank ID from query params or user profile
    const url = new URL(request.url)
    const bloodBankId = url.searchParams.get('bloodBankId')
    
    let targetBloodBankId = bloodBankId

    // If no bloodBankId provided, get from user profile
    if (!targetBloodBankId) {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('blood_bank_id')
        .eq('id', user.id)
        .single()

      targetBloodBankId = userProfile?.blood_bank_id
    }

    console.log(`📊 Getting inventory stats for blood bank: ${targetBloodBankId}`)

    // Get comprehensive inventory statistics
    const stats = await inventoryManagementService.getInventoryStats(targetBloodBankId || undefined)

    const response = {
      success: true,
      data: {
        stats,
        bloodBankId: targetBloodBankId,
        generatedAt: new Date().toISOString()
      }
    }

    console.log(`✅ Generated inventory stats: ${stats.totalUnits} total units`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}