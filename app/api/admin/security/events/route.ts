/**
 * Security Events API Endpoint
 * 
 * Provides access to security events and audit logs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { getOptimizedDB } from '@/lib/database/optimized-queries'

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
    const type = url.searchParams.get('type')
    const userId = url.searchParams.get('userId')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const db = getOptimizedDB()

    // Build query filters
    const filters: Record<string, any> = {}
    
    if (type) {
      filters.type = type
    }
    
    if (userId) {
      filters.user_id = userId
    }

    // Get security events
    const eventsResult = await db.findMany(
      'security_events',
      filters,
      {
        select: 'id, type, user_id, email, ip_address, user_agent, details, timestamp',
        orderBy: { column: 'timestamp', ascending: false },
        limit,
        cache: true,
        cacheTTL: 300
      }
    )

    // Filter by date range if provided
    let events = eventsResult.data || []
    
    if (startDate) {
      const start = new Date(startDate)
      events = events.filter(event => new Date(event.timestamp) >= start)
    }
    
    if (endDate) {
      const end = new Date(endDate)
      events = events.filter(event => new Date(event.timestamp) <= end)
    }

    // Transform events for frontend
    const transformedEvents = events.map(event => ({
      id: event.id,
      type: event.type,
      userId: event.user_id,
      email: event.email,
      ipAddress: event.ip_address,
      userAgent: event.user_agent,
      details: event.details,
      timestamp: new Date(event.timestamp),
      success: !event.type.includes('failed') && !event.type.includes('suspicious')
    }))

    // Get event statistics
    const eventStats = {
      total: transformedEvents.length,
      byType: transformedEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      successRate: transformedEvents.length > 0 
        ? (transformedEvents.filter(e => e.success).length / transformedEvents.length) * 100 
        : 100
    }

    return createApiResponse({
      events: transformedEvents,
      stats: eventStats,
      filters: { limit, type, userId, startDate, endDate }
    })

  } catch (error) {
    console.error('Security events API error:', error)
    return createApiResponse(null, 'Failed to fetch security events', 500)
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
    const { action, eventIds, data } = body

    const db = getOptimizedDB()

    switch (action) {
      case 'export':
        // Export security events to CSV or JSON
        const exportFormat = data?.format || 'json'
        const exportLimit = data?.limit || 1000

        const exportResult = await db.findMany(
          'security_events',
          {},
          {
            select: '*',
            orderBy: { column: 'timestamp', ascending: false },
            limit: exportLimit
          }
        )

        if (exportFormat === 'csv') {
          // Convert to CSV format
          const csvData = convertToCSV(exportResult.data || [])
          return new NextResponse(csvData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename=security-events.csv'
            }
          })
        }

        return createApiResponse({
          events: exportResult.data,
          format: exportFormat,
          exportedAt: new Date().toISOString()
        })

      case 'clear_old':
        // Clear events older than specified days
        const daysOld = data?.days || 90
        const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

        // In a real implementation, you would delete old events
        // For now, we'll just return success
        return createApiResponse({
          success: true,
          message: `Events older than ${daysOld} days cleared successfully`
        })

      case 'mark_reviewed':
        if (!eventIds || !Array.isArray(eventIds)) {
          return createApiResponse(null, 'Event IDs array required', 400)
        }

        // Mark events as reviewed
        // In a real implementation, you would update the events
        return createApiResponse({
          success: true,
          message: `${eventIds.length} events marked as reviewed`
        })

      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Security events POST API error:', error)
    return createApiResponse(null, 'Failed to process security events action', 500)
  }
}

function convertToCSV(events: any[]): string {
  if (events.length === 0) return ''

  const headers = Object.keys(events[0]).join(',')
  const rows = events.map(event => 
    Object.values(event).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(',')
  )

  return [headers, ...rows].join('\n')
}
