/**
 * Unblock IP API Endpoint
 * 
 * Allows administrators to unblock IP addresses
 */

import { NextRequest, NextResponse } from 'next/server'
import { getThreatDetectionSystem } from '@/lib/security/threat-detection'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'

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
    const { ip } = body

    if (!ip) {
      return createApiResponse(null, 'IP address is required', 400)
    }

    // Validate IP address format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(ip)) {
      return createApiResponse(null, 'Invalid IP address format', 400)
    }

    // Unblock the IP
    const threatSystem = getThreatDetectionSystem()
    threatSystem.unblockIP(ip)

    // Log the admin action
    console.log(`Admin ${user.email} unblocked IP: ${ip}`)

    return createApiResponse({
      success: true,
      message: `IP address ${ip} has been unblocked successfully`,
      unblockedIP: ip,
      unblockedBy: user.email,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Unblock IP API error:', error)
    return createApiResponse(null, 'Failed to unblock IP address', 500)
  }
}
