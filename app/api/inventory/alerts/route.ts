/**
 * Inventory Alerts API Endpoint
 * Manage inventory alerts and notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { inventoryManagementService } from '@/lib/inventory-management-service'
import { z } from 'zod'

const resolveAlertSchema = z.object({
  alertId: z.string().uuid('Invalid alert ID'),
  resolution: z.string().min(1, 'Resolution description is required')
})

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/inventory/alerts', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse query parameters
    const url = new URL(request.url)
    const resolved = url.searchParams.get('resolved') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '50')

    console.log(`🚨 Getting inventory alerts (resolved: ${resolved})`)

    // Get inventory alerts
    const alerts = await inventoryManagementService.getInventoryAlerts(resolved)

    // Limit results
    const limitedAlerts = alerts.slice(0, limit)

    const response = {
      success: true,
      data: {
        alerts: limitedAlerts,
        total: limitedAlerts.length,
        resolved,
        retrievedAt: new Date().toISOString()
      }
    }

    console.log(`✅ Retrieved ${limitedAlerts.length} inventory alerts`)
    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/inventory/alerts', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const action = body.action

    if (action === 'check') {
      // Check for new alerts
      console.log('🔍 Checking for new inventory alerts')
      
      const newAlerts = await inventoryManagementService.checkInventoryAlerts()
      
      const response = {
        success: true,
        data: {
          newAlerts,
          count: newAlerts.length,
          checkedAt: new Date().toISOString()
        }
      }

      console.log(`✅ Found ${newAlerts.length} new alerts`)
      tracker.end(200)
      return NextResponse.json(response)

    } else if (action === 'resolve') {
      // Resolve an alert
      const validatedData = resolveAlertSchema.parse(body)
      const { alertId, resolution } = validatedData

      console.log(`✅ Resolving alert: ${alertId}`)

      // Update alert as resolved
      const { error: updateError } = await supabase
        .from('inventory_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          details: supabase.rpc('jsonb_set', {
            target: supabase.raw('details'),
            path: '{resolution}',
            new_value: JSON.stringify(resolution)
          })
        })
        .eq('id', alertId)

      if (updateError) {
        throw new Error(`Failed to resolve alert: ${updateError.message}`)
      }

      const response = {
        success: true,
        message: 'Alert resolved successfully',
        data: {
          alertId,
          resolvedBy: user.id,
          resolvedAt: new Date().toISOString(),
          resolution
        }
      }

      console.log(`✅ Alert resolved: ${alertId}`)
      tracker.end(200)
      return NextResponse.json(response)

    } else {
      throw ValidationError('Invalid action. Use "check" or "resolve"')
    }

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}