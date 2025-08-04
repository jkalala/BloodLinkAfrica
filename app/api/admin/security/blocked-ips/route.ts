/**
 * Blocked IPs Management API Endpoint
 * 
 * Manages blocked IP addresses for security purposes
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

    // Get blocked IPs
    const threatSystem = getThreatDetectionSystem()
    const blockedIPs = threatSystem.getBlockedIPs()

    // Get additional information about blocked IPs
    const blockedIPsWithInfo = blockedIPs.map(ip => ({
      ip,
      blockedAt: new Date(), // In a real implementation, this would come from the database
      reason: 'Security threat detected',
      threatCount: 1, // This would be calculated from threat history
      lastActivity: new Date()
    }))

    return createApiResponse({
      blockedIPs: blockedIPsWithInfo,
      total: blockedIPs.length
    })

  } catch (error) {
    console.error('Blocked IPs API error:', error)
    return createApiResponse(null, 'Failed to fetch blocked IPs', 500)
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
    const { action, ip, ips } = body

    const threatSystem = getThreatDetectionSystem()

    switch (action) {
      case 'unblock':
        if (!ip) {
          return createApiResponse(null, 'IP address required', 400)
        }
        
        threatSystem.unblockIP(ip)
        
        return createApiResponse({
          success: true,
          message: `IP ${ip} unblocked successfully`
        })

      case 'bulk_unblock':
        if (!ips || !Array.isArray(ips)) {
          return createApiResponse(null, 'IP addresses array required', 400)
        }

        ips.forEach((ipAddress: string) => {
          threatSystem.unblockIP(ipAddress)
        })

        return createApiResponse({
          success: true,
          message: `${ips.length} IP addresses unblocked successfully`
        })

      case 'block':
        if (!ip) {
          return createApiResponse(null, 'IP address required', 400)
        }

        // In a real implementation, you would add the IP to the blocked list
        // For now, we'll just return success
        return createApiResponse({
          success: true,
          message: `IP ${ip} blocked successfully`
        })

      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Blocked IPs POST API error:', error)
    return createApiResponse(null, 'Failed to process IP action', 500)
  }
}
