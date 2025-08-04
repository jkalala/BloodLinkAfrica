/**
 * Security Threats API Endpoint
 * 
 * Provides access to security threat data for the admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { getThreatDetectionSystem } from '@/lib/security/threat-detection'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    // Authenticate and authorize admin access
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return createApiResponse(null, 'Insufficient permissions', 403)
    }

    // Get query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const severity = url.searchParams.get('severity')
    const type = url.searchParams.get('type')
    const resolved = url.searchParams.get('resolved')

    // Get threat detection system
    const threatSystem = getThreatDetectionSystem()
    let threats = threatSystem.getThreats(limit)

    // Apply filters
    if (severity) {
      threats = threats.filter(threat => threat.severity === severity)
    }

    if (type) {
      threats = threats.filter(threat => threat.type === type)
    }

    if (resolved !== null) {
      const isResolved = resolved === 'true'
      threats = threats.filter(threat => threat.resolved === isResolved)
    }

    return createApiResponse({
      threats,
      total: threats.length,
      filters: { limit, severity, type, resolved }
    })

  } catch (error) {
    console.error('Security threats API error:', error)
    return createApiResponse(null, 'Failed to fetch security threats', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate and authorize admin access
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return createApiResponse(null, 'Insufficient permissions', 403)
    }

    const body = await request.json()
    const { action, threatId, data } = body

    const threatSystem = getThreatDetectionSystem()

    switch (action) {
      case 'resolve':
        if (!threatId) {
          return createApiResponse(null, 'Threat ID required', 400)
        }
        
        threatSystem.resolveThreat(threatId, data?.resolution || 'Manually resolved')
        
        return createApiResponse({
          success: true,
          message: 'Threat resolved successfully'
        })

      case 'bulk_resolve':
        if (!data?.threatIds || !Array.isArray(data.threatIds)) {
          return createApiResponse(null, 'Threat IDs array required', 400)
        }

        data.threatIds.forEach((id: string) => {
          threatSystem.resolveThreat(id, data?.resolution || 'Bulk resolved')
        })

        return createApiResponse({
          success: true,
          message: `${data.threatIds.length} threats resolved successfully`
        })

      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Security threats POST API error:', error)
    return createApiResponse(null, 'Failed to process threat action', 500)
  }
}
