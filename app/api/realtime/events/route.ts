/**
 * Real-time Events API Endpoint
 * 
 * Provides REST API for publishing and managing real-time events
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRealTimeEventSystem, BloodDonationEvent } from '@/lib/realtime/event-system'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schema
const EventPublishSchema = z.object({
  type: z.enum([
    'blood_request_created',
    'blood_request_updated', 
    'donor_matched',
    'donation_scheduled',
    'donation_completed',
    'emergency_alert',
    'supply_shortage',
    'donor_available',
    'hospital_capacity_update'
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  source: z.string().min(1),
  data: z.record(z.any()),
  metadata: z.object({
    userId: z.string().optional(),
    hospitalId: z.string().optional(),
    region: z.string().optional(),
    bloodType: z.string().optional(),
    correlationId: z.string().optional()
  }).optional(),
  targeting: z.object({
    userIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    bloodTypes: z.array(z.string()).optional(),
    radius: z.number().optional(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    }).optional()
  }).optional()
})

const EventQuerySchema = z.object({
  type: z.string().optional(),
  limit: z.number().min(1).max(1000).default(50),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  source: z.string().optional(),
  region: z.string().optional(),
  bloodType: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user) {
      return createApiResponse(null, 'Invalid token', 401)
    }

    // Check permissions - only certain roles can publish events
    if (!['hospital', 'admin', 'super_admin', 'system'].includes(user.role)) {
      return createApiResponse(null, 'Insufficient permissions to publish events', 403)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = EventPublishSchema.safeParse(body)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid event data', 400, {
        errors: validationResult.error.errors
      })
    }

    const eventData = validationResult.data

    // Create event object
    const event: BloodDonationEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventData.type,
      priority: eventData.priority,
      source: eventData.source,
      timestamp: new Date(),
      data: eventData.data,
      metadata: {
        userId: user.id,
        ...eventData.metadata
      },
      targeting: eventData.targeting
    }

    // Additional validation based on event type
    if (event.type === 'emergency_alert' && event.priority !== 'critical') {
      return createApiResponse(null, 'Emergency alerts must have critical priority', 400)
    }

    if (event.type === 'blood_request_created' && !event.data.bloodType) {
      return createApiResponse(null, 'Blood type is required for blood request events', 400)
    }

    // Publish event
    const eventSystem = getRealTimeEventSystem()
    const result = await eventSystem.publishEvent(event)

    // Log the event publication
    console.log(`Event published by user ${user.id}:`, {
      eventId: event.id,
      type: event.type,
      priority: event.priority,
      source: event.source,
      processed: result.processed,
      processingTime: result.totalProcessingTime
    })

    return createApiResponse({
      success: true,
      data: {
        eventId: event.id,
        published: true,
        processed: result.processed,
        handlers: result.handlers.length,
        notifications: result.notifications.length,
        processingTime: result.totalProcessingTime
      },
      metadata: {
        timestamp: event.timestamp.toISOString(),
        publishedBy: user.id,
        correlationId: event.metadata.correlationId
      }
    })

  } catch (error) {
    console.error('Event publication API error:', error)
    
    return createApiResponse(null, 'Event publication failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user) {
      return createApiResponse(null, 'Invalid token', 401)
    }

    // Check permissions
    if (!authManager.hasPermission(user, 'read:events')) {
      return createApiResponse(null, 'Insufficient permissions', 403)
    }

    // Parse query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    // Convert numeric parameters
    if (queryParams.limit) {
      queryParams.limit = parseInt(queryParams.limit)
    }

    const validationResult = EventQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid query parameters', 400, {
        errors: validationResult.error.errors
      })
    }

    const query = validationResult.data

    // Get event system
    const eventSystem = getRealTimeEventSystem()

    // Get event history
    const events = await eventSystem.getEventHistory(query.type, query.limit)

    // Filter events based on query parameters and user permissions
    let filteredEvents = events

    // Apply filters
    if (query.priority) {
      filteredEvents = filteredEvents.filter(event => event.priority === query.priority)
    }

    if (query.source) {
      filteredEvents = filteredEvents.filter(event => event.source === query.source)
    }

    if (query.region) {
      filteredEvents = filteredEvents.filter(event => event.metadata.region === query.region)
    }

    if (query.bloodType) {
      filteredEvents = filteredEvents.filter(event => event.metadata.bloodType === query.bloodType)
    }

    // Filter sensitive data based on user role
    const sanitizedEvents = filteredEvents.map(event => {
      const sanitizedEvent = { ...event }

      // Remove sensitive data for non-admin users
      if (!['admin', 'super_admin'].includes(user.role)) {
        delete sanitizedEvent.targeting
        if (sanitizedEvent.metadata) {
          delete sanitizedEvent.metadata.userId
        }
      }

      return sanitizedEvent
    })

    // Get system stats for admin users
    let systemStats = undefined
    if (['admin', 'super_admin'].includes(user.role)) {
      systemStats = eventSystem.getSystemStats()
    }

    return createApiResponse({
      success: true,
      data: {
        events: sanitizedEvents,
        count: sanitizedEvents.length,
        systemStats
      },
      pagination: {
        total: sanitizedEvents.length,
        limit: query.limit,
        offset: 0
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestedBy: user.id,
        filters: query
      }
    })

  } catch (error) {
    console.error('Event query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve events', 500)
  }
}
