/**
 * Resolve security threat API endpoint
 * Allows admin users to mark security threats as resolved
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, AuthorizationError, ValidationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { z } from 'zod'

const resolveThreadSchema = z.object({
  threatId: z.string().uuid('Invalid threat ID format'),
  resolution: z.object({
    action: z.enum(['resolved', 'false_positive', 'mitigated']),
    notes: z.string().min(1, 'Resolution notes are required').max(500, 'Notes too long'),
    resolvedBy: z.string().optional()
  })
})

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/admin/security/resolve-threat', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Verify admin permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, name')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      throw AuthorizationError('Admin access required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = resolveThreadSchema.parse(body)

    const { threatId, resolution } = validatedData

    // Verify threat exists and is not already resolved
    const { data: existingThreat, error: threatError } = await supabase
      .from('security_events')
      .select('*')
      .eq('id', threatId)
      .single()

    if (threatError || !existingThreat) {
      throw ValidationError('Threat not found')
    }

    if (existingThreat.resolved) {
      throw ValidationError('Threat is already resolved')
    }

    // Update the threat with resolution information
    const { error: updateError } = await supabase
      .from('security_events')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_action: resolution.action,
        resolution_notes: resolution.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', threatId)

    if (updateError) {
      throw new Error(`Failed to resolve threat: ${updateError.message}`)
    }

    // Log the resolution action
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'threat_resolved',
        risk_level: 'low',
        user_id: user.id,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        details: {
          original_threat_id: threatId,
          resolution_action: resolution.action,
          resolved_by: userProfile.name || user.email,
          notes: resolution.notes
        },
        resolved: true,
        timestamp: new Date().toISOString()
      }])

    const response = {
      success: true,
      message: 'Threat resolved successfully',
      data: {
        threatId,
        resolvedAt: new Date().toISOString(),
        resolvedBy: userProfile.name || user.email,
        action: resolution.action
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

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/admin/security/resolve-threat', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Verify admin permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      throw AuthorizationError('Admin access required')
    }

    // Get threat ID from query parameters
    const url = new URL(request.url)
    const threatId = url.searchParams.get('threatId')

    if (!threatId) {
      throw ValidationError('Threat ID is required')
    }

    // Get threat details
    const { data: threat, error: threatError } = await supabase
      .from('security_events')
      .select(`
        *,
        resolver:resolved_by(name, email)
      `)
      .eq('id', threatId)
      .single()

    if (threatError || !threat) {
      throw ValidationError('Threat not found')
    }

    const response = {
      success: true,
      data: {
        threat: {
          id: threat.id,
          eventType: threat.event_type,
          riskLevel: threat.risk_level,
          timestamp: threat.timestamp,
          resolved: threat.resolved,
          resolvedAt: threat.resolved_at,
          resolvedBy: threat.resolver?.name || threat.resolver?.email,
          resolutionAction: threat.resolution_action,
          resolutionNotes: threat.resolution_notes,
          details: threat.details,
          ipAddress: threat.ip_address,
          userAgent: threat.user_agent
        }
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