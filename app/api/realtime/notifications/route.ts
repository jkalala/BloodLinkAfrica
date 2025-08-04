/**
 * Notifications API Endpoint
 * 
 * Provides REST API for sending notifications and managing notification preferences
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPushNotificationSystem, NotificationPayload } from '@/lib/realtime/push-notifications'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const NotificationSendSchema = z.object({
  type: z.enum(['blood_request', 'donor_match', 'emergency', 'reminder', 'system', 'marketing']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.any()).optional(),
  channels: z.array(z.object({
    type: z.enum(['push', 'email', 'sms', 'websocket', 'in_app']),
    enabled: z.boolean(),
    config: z.record(z.any()).optional()
  })),
  scheduling: z.object({
    sendAt: z.string().datetime().optional(),
    timezone: z.string().optional(),
    recurring: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      interval: z.number().min(1),
      endDate: z.string().datetime().optional()
    }).optional()
  }).optional(),
  targeting: z.object({
    userIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    bloodTypes: z.array(z.string()).optional(),
    customFilters: z.record(z.any()).optional()
  }).optional(),
  personalization: z.object({
    variables: z.record(z.string()),
    template: z.string().optional()
  }).optional()
})

const NotificationTemplateSchema = z.object({
  templateId: z.string(),
  variables: z.record(z.string()),
  targeting: z.object({
    userIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    bloodTypes: z.array(z.string()).optional()
  }).optional()
})

const NotificationQuerySchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  type: z.string().optional(),
  status: z.enum(['sent', 'failed', 'scheduled', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional()
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

    // Check permissions - only certain roles can send notifications
    if (!['hospital', 'admin', 'super_admin'].includes(user.role)) {
      return createApiResponse(null, 'Insufficient permissions to send notifications', 403)
    }

    // Parse request body
    const body = await request.json()
    
    // Check if this is a template-based notification
    if (body.templateId) {
      return await handleTemplateNotification(body, user)
    } else {
      return await handleDirectNotification(body, user)
    }

  } catch (error) {
    console.error('Notification send API error:', error)
    
    return createApiResponse(null, 'Notification send failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

async function handleDirectNotification(body: any, user: any) {
  // Validate direct notification
  const validationResult = NotificationSendSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid notification data', 400, {
      errors: validationResult.error.errors
    })
  }

  const notificationData = validationResult.data

  // Additional validation based on user role
  if (notificationData.type === 'emergency' && !['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Only admins can send emergency notifications', 403)
  }

  if (notificationData.channels.some(c => c.type === 'sms') && user.role !== 'super_admin') {
    return createApiResponse(null, 'SMS notifications require super admin privileges', 403)
  }

  // Create notification payload
  const payload: NotificationPayload = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    type: notificationData.type,
    priority: notificationData.priority,
    title: notificationData.title,
    body: notificationData.body,
    data: notificationData.data,
    channels: notificationData.channels,
    scheduling: notificationData.scheduling ? {
      sendAt: notificationData.scheduling.sendAt ? new Date(notificationData.scheduling.sendAt) : undefined,
      timezone: notificationData.scheduling.timezone,
      recurring: notificationData.scheduling.recurring
    } : undefined,
    targeting: notificationData.targeting,
    personalization: notificationData.personalization
  }

  // Send notification
  const pushNotificationSystem = getPushNotificationSystem()
  const result = await pushNotificationSystem.sendNotification(payload)

  // Log the notification
  console.log(`Notification sent by user ${user.id}:`, {
    notificationId: result.id,
    type: payload.type,
    priority: payload.priority,
    status: result.status,
    deliveredCount: result.deliveredCount,
    processingTime: result.metadata.processingTime
  })

  return createApiResponse({
    success: true,
    data: {
      notificationId: result.id,
      status: result.status,
      deliveredCount: result.deliveredCount,
      failedCount: result.failedCount,
      channels: result.channels.map(c => ({
        type: c.type,
        status: c.status,
        messageId: c.messageId
      })),
      processingTime: result.metadata.processingTime
    },
    metadata: {
      timestamp: result.sentAt?.toISOString(),
      sentBy: user.id
    }
  })
}

async function handleTemplateNotification(body: any, user: any) {
  // Validate template notification
  const validationResult = NotificationTemplateSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid template notification data', 400, {
      errors: validationResult.error.errors
    })
  }

  const templateData = validationResult.data

  // Send notification from template
  const pushNotificationSystem = getPushNotificationSystem()
  const result = await pushNotificationSystem.sendFromTemplate(
    templateData.templateId,
    templateData.variables,
    templateData.targeting
  )

  return createApiResponse({
    success: true,
    data: {
      notificationId: result.id,
      templateId: templateData.templateId,
      status: result.status,
      deliveredCount: result.deliveredCount,
      failedCount: result.failedCount,
      processingTime: result.metadata.processingTime
    },
    metadata: {
      timestamp: result.sentAt?.toISOString(),
      sentBy: user.id
    }
  })
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

    // Parse query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    // Convert numeric parameters
    if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit)
    if (queryParams.offset) queryParams.offset = parseInt(queryParams.offset)

    const validationResult = NotificationQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid query parameters', 400, {
        errors: validationResult.error.errors
      })
    }

    const query = validationResult.data

    // Get notification system
    const pushNotificationSystem = getPushNotificationSystem()

    // Check what information to return based on query
    const action = url.searchParams.get('action')

    switch (action) {
      case 'templates':
        return await handleGetTemplates(user, pushNotificationSystem)
      
      case 'history':
        return await handleGetHistory(user, query, pushNotificationSystem)
      
      case 'stats':
        return await handleGetStats(user, pushNotificationSystem)
      
      default:
        return await handleGetUserNotifications(user, query, pushNotificationSystem)
    }

  } catch (error) {
    console.error('Notification query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve notifications', 500)
  }
}

async function handleGetTemplates(user: any, pushNotificationSystem: any) {
  // Get available templates
  const templates = pushNotificationSystem.listTemplates()

  // Filter templates based on user role
  const filteredTemplates = templates.filter(template => {
    if (template.id.includes('emergency') && !['admin', 'super_admin'].includes(user.role)) {
      return false
    }
    return template.isActive
  })

  return createApiResponse({
    success: true,
    data: {
      templates: filteredTemplates.map(template => ({
        id: template.id,
        name: template.name,
        type: template.type,
        channels: template.channels,
        content: template.content,
        targeting: template.targeting
      }))
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

async function handleGetHistory(user: any, query: any, pushNotificationSystem: any) {
  // Check permissions for viewing notification history
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to view notification history', 403)
  }

  // Get notification history
  const history = await pushNotificationSystem.getNotificationHistory('system', query.limit)

  // Apply filters
  let filteredHistory = history

  if (query.type) {
    filteredHistory = filteredHistory.filter(notif => notif.type === query.type)
  }

  if (query.status) {
    filteredHistory = filteredHistory.filter(notif => notif.status === query.status)
  }

  if (query.priority) {
    filteredHistory = filteredHistory.filter(notif => notif.priority === query.priority)
  }

  // Apply pagination
  const paginatedHistory = filteredHistory.slice(query.offset, query.offset + query.limit)

  return createApiResponse({
    success: true,
    data: {
      notifications: paginatedHistory,
      count: paginatedHistory.length
    },
    pagination: {
      total: filteredHistory.length,
      limit: query.limit,
      offset: query.offset
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

async function handleGetStats(user: any, pushNotificationSystem: any) {
  // Check permissions for viewing stats
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to view notification stats', 403)
  }

  const stats = pushNotificationSystem.getSystemStats()

  return createApiResponse({
    success: true,
    data: {
      systemStats: stats,
      timestamp: new Date().toISOString()
    },
    metadata: {
      requestedBy: user.id
    }
  })
}

async function handleGetUserNotifications(user: any, query: any, pushNotificationSystem: any) {
  // Get user's notifications (in-app notifications)
  const notifications = await pushNotificationSystem.getNotificationHistory(user.id, query.limit)

  // Apply filters
  let filteredNotifications = notifications

  if (query.type) {
    filteredNotifications = filteredNotifications.filter(notif => notif.type === query.type)
  }

  if (query.priority) {
    filteredNotifications = filteredNotifications.filter(notif => notif.priority === query.priority)
  }

  // Apply pagination
  const paginatedNotifications = filteredNotifications.slice(query.offset, query.offset + query.limit)

  return createApiResponse({
    success: true,
    data: {
      notifications: paginatedNotifications,
      unreadCount: paginatedNotifications.filter(n => !n.is_read).length
    },
    pagination: {
      total: filteredNotifications.length,
      limit: query.limit,
      offset: query.offset
    },
    metadata: {
      timestamp: new Date().toISOString(),
      userId: user.id
    }
  })
}

// Mark notification as read
export async function PATCH(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const { notificationId, action } = body

    if (!notificationId || !action) {
      return createApiResponse(null, 'Missing notificationId or action', 400)
    }

    const pushNotificationSystem = getPushNotificationSystem()

    switch (action) {
      case 'mark_read':
        await pushNotificationSystem.markAsRead(notificationId, user.id)
        break
      
      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

    return createApiResponse({
      success: true,
      data: {
        notificationId,
        action,
        userId: user.id
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Notification update API error:', error)
    
    return createApiResponse(null, 'Failed to update notification', 500)
  }
}
