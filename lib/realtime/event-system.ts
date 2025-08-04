/**
 * Real-time Event System
 * 
 * Centralized event coordination system that manages real-time
 * communications across WebSocket, push notifications, and other channels
 */

import { EventEmitter } from 'events'
import { getWebSocketServer } from './websocket-server'
import { getPushNotificationSystem, NotificationPayload } from './push-notifications'
import { getMLPipelineAPI } from '../ai/ml-pipeline/ml-pipeline-api'
import { performanceMonitor } from '../performance/metrics'
import { getCache } from '../cache/redis-cache'
import { getOptimizedDB } from '../database/optimized-queries'

export interface BloodDonationEvent {
  id: string
  type: 'blood_request_created' | 'blood_request_updated' | 'donor_matched' | 
        'donation_scheduled' | 'donation_completed' | 'emergency_alert' |
        'supply_shortage' | 'donor_available' | 'hospital_capacity_update'
  priority: 'low' | 'medium' | 'high' | 'critical'
  source: string
  timestamp: Date
  data: any
  metadata: {
    userId?: string
    hospitalId?: string
    region?: string
    bloodType?: string
    correlationId?: string
  }
  targeting?: {
    userIds?: string[]
    roles?: string[]
    regions?: string[]
    bloodTypes?: string[]
    radius?: number
    coordinates?: { latitude: number; longitude: number }
  }
}

export interface EventHandler {
  id: string
  eventTypes: string[]
  handler: (event: BloodDonationEvent) => Promise<void>
  priority: number
  isActive: boolean
}

export interface EventProcessingResult {
  eventId: string
  processed: boolean
  handlers: Array<{
    handlerId: string
    success: boolean
    processingTime: number
    error?: string
  }>
  notifications: Array<{
    notificationId: string
    success: boolean
    channels: string[]
  }>
  totalProcessingTime: number
}

class RealTimeEventSystem extends EventEmitter {
  private webSocketServer = getWebSocketServer()
  private pushNotificationSystem = getPushNotificationSystem()
  private mlPipeline = getMLPipelineAPI()
  private cache = getCache()
  private db = getOptimizedDB()
  
  private eventHandlers: Map<string, EventHandler> = new Map()
  private eventQueue: BloodDonationEvent[] = []
  private processingQueue = false
  private eventHistory: Map<string, BloodDonationEvent> = new Map()

  // Configuration
  private readonly CONFIG = {
    maxQueueSize: 10000,
    processingBatchSize: 50,
    eventRetention: 24 * 60 * 60 * 1000, // 24 hours
    processingInterval: 100, // 100ms
    maxHandlerTimeout: 30000, // 30 seconds
    enableEventPersistence: true,
    enableMetrics: true
  }

  // Event type definitions
  private readonly EVENT_TYPES = {
    BLOOD_REQUEST_CREATED: 'blood_request_created',
    BLOOD_REQUEST_UPDATED: 'blood_request_updated',
    DONOR_MATCHED: 'donor_matched',
    DONATION_SCHEDULED: 'donation_scheduled',
    DONATION_COMPLETED: 'donation_completed',
    EMERGENCY_ALERT: 'emergency_alert',
    SUPPLY_SHORTAGE: 'supply_shortage',
    DONOR_AVAILABLE: 'donor_available',
    HOSPITAL_CAPACITY_UPDATE: 'hospital_capacity_update'
  }

  constructor() {
    super()
    this.initializeDefaultHandlers()
    this.startEventProcessing()
    this.setupEventCleanup()
  }

  async publishEvent(event: BloodDonationEvent): Promise<EventProcessingResult> {
    const startTime = performance.now()

    try {
      // Validate event
      this.validateEvent(event)

      // Enrich event with additional data
      const enrichedEvent = await this.enrichEvent(event)

      // Add to queue
      if (this.eventQueue.length >= this.CONFIG.maxQueueSize) {
        throw new Error('Event queue is full')
      }

      this.eventQueue.push(enrichedEvent)
      this.eventHistory.set(enrichedEvent.id, enrichedEvent)

      // Persist event if enabled
      if (this.CONFIG.enableEventPersistence) {
        await this.persistEvent(enrichedEvent)
      }

      // Emit internal event
      this.emit('event_published', enrichedEvent)

      // Process immediately for critical events
      if (enrichedEvent.priority === 'critical') {
        return await this.processEventImmediate(enrichedEvent)
      }

      // Return pending result for non-critical events
      return {
        eventId: enrichedEvent.id,
        processed: false,
        handlers: [],
        notifications: [],
        totalProcessingTime: performance.now() - startTime
      }

    } catch (error) {
      const processingTime = performance.now() - startTime

      if (this.CONFIG.enableMetrics) {
        performanceMonitor.recordCustomMetric({
          name: 'event_publish_duration',
          value: processingTime,
          unit: 'ms',
          timestamp: Date.now(),
          tags: {
            success: 'false',
            event_type: event.type,
            error: (error as Error).message
          }
        })
      }

      throw new Error(`Event publishing failed: ${(error as Error).message}`)
    }
  }

  private async processEventImmediate(event: BloodDonationEvent): Promise<EventProcessingResult> {
    const startTime = performance.now()
    const result: EventProcessingResult = {
      eventId: event.id,
      processed: false,
      handlers: [],
      notifications: [],
      totalProcessingTime: 0
    }

    try {
      // Get relevant handlers
      const relevantHandlers = this.getRelevantHandlers(event)

      // Process handlers in parallel
      const handlerPromises = relevantHandlers.map(async (handler) => {
        const handlerStartTime = performance.now()
        
        try {
          await Promise.race([
            handler.handler(event),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Handler timeout')), this.CONFIG.maxHandlerTimeout)
            )
          ])

          return {
            handlerId: handler.id,
            success: true,
            processingTime: performance.now() - handlerStartTime
          }
        } catch (error) {
          return {
            handlerId: handler.id,
            success: false,
            processingTime: performance.now() - handlerStartTime,
            error: (error as Error).message
          }
        }
      })

      result.handlers = await Promise.all(handlerPromises)

      // Send notifications
      const notifications = await this.sendEventNotifications(event)
      result.notifications = notifications

      result.processed = true
      result.totalProcessingTime = performance.now() - startTime

      // Record metrics
      if (this.CONFIG.enableMetrics) {
        this.recordEventMetrics(event, result)
      }

      return result

    } catch (error) {
      result.totalProcessingTime = performance.now() - startTime
      
      if (this.CONFIG.enableMetrics) {
        performanceMonitor.recordCustomMetric({
          name: 'event_process_duration',
          value: result.totalProcessingTime,
          unit: 'ms',
          timestamp: Date.now(),
          tags: {
            success: 'false',
            event_type: event.type,
            error: (error as Error).message
          }
        })
      }

      throw error
    }
  }

  private async enrichEvent(event: BloodDonationEvent): Promise<BloodDonationEvent> {
    const enrichedEvent = { ...event }

    // Add correlation ID if not present
    if (!enrichedEvent.metadata.correlationId) {
      enrichedEvent.metadata.correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    // Enrich based on event type
    switch (event.type) {
      case this.EVENT_TYPES.BLOOD_REQUEST_CREATED:
        enrichedEvent.data = await this.enrichBloodRequestEvent(event.data)
        break

      case this.EVENT_TYPES.DONOR_MATCHED:
        enrichedEvent.data = await this.enrichDonorMatchEvent(event.data)
        break

      case this.EVENT_TYPES.EMERGENCY_ALERT:
        enrichedEvent.data = await this.enrichEmergencyEvent(event.data)
        break
    }

    return enrichedEvent
  }

  private async enrichBloodRequestEvent(data: any): Promise<any> {
    // Get ML recommendations for the blood request
    try {
      const mlResult = await this.mlPipeline.processRequest({
        type: 'recommendation',
        data: {
          bloodRequest: data.bloodRequest,
          maxRecommendations: 10,
          includeReasons: true
        }
      })

      return {
        ...data,
        mlRecommendations: mlResult.recommendations?.slice(0, 5), // Top 5 recommendations
        mlConfidence: mlResult.metadata.confidence
      }
    } catch (error) {
      console.error('Failed to enrich blood request with ML data:', error)
      return data
    }
  }

  private async enrichDonorMatchEvent(data: any): Promise<any> {
    // Add estimated arrival time and route information
    return {
      ...data,
      estimatedArrival: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      routeOptimized: true
    }
  }

  private async enrichEmergencyEvent(data: any): Promise<any> {
    // Get supply forecast for emergency planning
    try {
      const forecastResult = await this.mlPipeline.processRequest({
        type: 'forecast',
        data: {
          regions: [data.region],
          bloodTypes: [data.bloodType],
          horizonDays: 3
        }
      })

      return {
        ...data,
        supplyForecast: forecastResult.forecasts?.supplyForecasts[0],
        riskAssessment: forecastResult.forecasts?.riskAssessment
      }
    } catch (error) {
      console.error('Failed to enrich emergency event with forecast data:', error)
      return data
    }
  }

  private getRelevantHandlers(event: BloodDonationEvent): EventHandler[] {
    return Array.from(this.eventHandlers.values())
      .filter(handler => 
        handler.isActive && 
        handler.eventTypes.includes(event.type)
      )
      .sort((a, b) => b.priority - a.priority)
  }

  private async sendEventNotifications(event: BloodDonationEvent): Promise<EventProcessingResult['notifications']> {
    const notifications: EventProcessingResult['notifications'] = []

    try {
      // Determine notification strategy based on event type and priority
      const notificationPayload = this.createNotificationPayload(event)

      if (notificationPayload) {
        const result = await this.pushNotificationSystem.sendNotification(notificationPayload)
        
        notifications.push({
          notificationId: result.id,
          success: result.status === 'sent',
          channels: result.channels.map(c => c.type)
        })
      }

      // Send WebSocket notifications
      await this.sendWebSocketNotifications(event)

    } catch (error) {
      console.error('Failed to send event notifications:', error)
    }

    return notifications
  }

  private createNotificationPayload(event: BloodDonationEvent): NotificationPayload | null {
    const basePayload = {
      id: `event_${event.id}`,
      userId: event.metadata.userId || 'system',
      data: event.data,
      targeting: event.targeting
    }

    switch (event.type) {
      case this.EVENT_TYPES.BLOOD_REQUEST_CREATED:
        return {
          ...basePayload,
          type: 'blood_request' as const,
          priority: event.priority,
          title: `${event.priority === 'critical' ? 'URGENT: ' : ''}Blood Request - ${event.data.bloodType}`,
          body: `${event.data.hospital} needs ${event.data.units} units of ${event.data.bloodType} blood`,
          channels: [
            { type: 'push', enabled: true, config: { sound: event.priority === 'critical' ? 'urgent' : 'default' } },
            { type: 'websocket', enabled: true, config: { room: 'emergency' } },
            { type: 'in_app', enabled: true, config: { persistent: event.priority === 'critical' } }
          ]
        }

      case this.EVENT_TYPES.DONOR_MATCHED:
        return {
          ...basePayload,
          type: 'donor_match' as const,
          priority: 'medium',
          title: 'Donor Match Found!',
          body: `A donor has been matched for your ${event.data.bloodType} request`,
          channels: [
            { type: 'push', enabled: true },
            { type: 'email', enabled: true },
            { type: 'in_app', enabled: true }
          ]
        }

      case this.EVENT_TYPES.EMERGENCY_ALERT:
        return {
          ...basePayload,
          type: 'emergency' as const,
          priority: 'critical',
          title: 'EMERGENCY ALERT',
          body: event.data.message,
          channels: [
            { type: 'push', enabled: true, config: { sound: 'emergency', badge: 1 } },
            { type: 'websocket', enabled: true, config: { room: 'emergency' } },
            { type: 'sms', enabled: true },
            { type: 'in_app', enabled: true, config: { persistent: true } }
          ]
        }

      default:
        return null
    }
  }

  private async sendWebSocketNotifications(event: BloodDonationEvent): Promise<void> {
    const message = {
      type: 'event_notification',
      data: {
        eventId: event.id,
        eventType: event.type,
        priority: event.priority,
        timestamp: event.timestamp,
        data: event.data,
        metadata: event.metadata
      },
      timestamp: new Date(),
      messageId: `event_${event.id}`,
      priority: event.priority
    }

    // Send to relevant rooms based on event type
    switch (event.type) {
      case this.EVENT_TYPES.EMERGENCY_ALERT:
        this.webSocketServer.broadcastToRoom('emergency', message)
        break

      case this.EVENT_TYPES.BLOOD_REQUEST_CREATED:
        if (event.metadata.region) {
          this.webSocketServer.broadcastToRoom(`region_${event.metadata.region}`, message)
        }
        this.webSocketServer.broadcastToRole('donor', message)
        break

      case this.EVENT_TYPES.DONOR_MATCHED:
        if (event.metadata.hospitalId) {
          this.webSocketServer.broadcastToRoom(`hospital_${event.metadata.hospitalId}`, message)
        }
        break

      default:
        this.webSocketServer.broadcastToRoom('general', message)
    }
  }

  private initializeDefaultHandlers(): void {
    // Blood Request Handler
    this.registerHandler({
      id: 'blood_request_handler',
      eventTypes: [this.EVENT_TYPES.BLOOD_REQUEST_CREATED],
      priority: 100,
      isActive: true,
      handler: async (event) => {
        console.log(`Processing blood request: ${event.id}`)
        
        // Create dynamic room for this blood request
        const roomId = `blood_request_${event.data.id}`
        this.webSocketServer.createRoom({
          id: roomId,
          name: `Blood Request ${event.data.id}`,
          type: 'blood_request',
          permissions: {
            canJoin: ['donor', 'hospital', 'admin'],
            canSend: ['hospital', 'admin'],
            canModerate: ['admin']
          }
        })

        // Notify potential donors in the region
        if (event.data.mlRecommendations) {
          for (const recommendation of event.data.mlRecommendations) {
            this.webSocketServer.broadcastToUser(recommendation.donorId, {
              type: 'donor_recommendation',
              data: {
                bloodRequestId: event.data.id,
                score: recommendation.score,
                reasoning: recommendation.reasoning
              },
              timestamp: new Date(),
              messageId: `rec_${event.id}_${recommendation.donorId}`
            })
          }
        }
      }
    })

    // Emergency Alert Handler
    this.registerHandler({
      id: 'emergency_alert_handler',
      eventTypes: [this.EVENT_TYPES.EMERGENCY_ALERT],
      priority: 200,
      isActive: true,
      handler: async (event) => {
        console.log(`Processing emergency alert: ${event.id}`)
        
        // Escalate to all available channels
        this.webSocketServer.broadcastGlobal({
          type: 'emergency_broadcast',
          data: event.data,
          timestamp: new Date(),
          messageId: `emergency_${event.id}`,
          priority: 'critical'
        })

        // Log emergency event
        await this.db.insert('emergency_logs', {
          id: event.id,
          type: event.data.type,
          message: event.data.message,
          region: event.metadata.region,
          blood_type: event.metadata.bloodType,
          severity: event.priority,
          created_at: event.timestamp
        })
      }
    })

    // Analytics Handler
    this.registerHandler({
      id: 'analytics_handler',
      eventTypes: Object.values(this.EVENT_TYPES),
      priority: 10,
      isActive: true,
      handler: async (event) => {
        // Record event for analytics
        if (this.CONFIG.enableMetrics) {
          performanceMonitor.recordCustomMetric({
            name: 'blood_donation_event',
            value: 1,
            unit: 'count',
            timestamp: Date.now(),
            tags: {
              event_type: event.type,
              priority: event.priority,
              source: event.source,
              region: event.metadata.region || 'unknown',
              blood_type: event.metadata.bloodType || 'unknown'
            }
          })
        }
      }
    })
  }

  private startEventProcessing(): void {
    setInterval(async () => {
      if (this.processingQueue || this.eventQueue.length === 0) {
        return
      }

      this.processingQueue = true

      try {
        const batch = this.eventQueue.splice(0, this.CONFIG.processingBatchSize)
        
        await Promise.all(
          batch.map(event => this.processEventImmediate(event).catch(error => {
            console.error(`Failed to process event ${event.id}:`, error)
          }))
        )

      } catch (error) {
        console.error('Error in event processing batch:', error)
      } finally {
        this.processingQueue = false
      }
    }, this.CONFIG.processingInterval)
  }

  private setupEventCleanup(): void {
    // Clean up old events every hour
    setInterval(() => {
      const cutoff = Date.now() - this.CONFIG.eventRetention
      
      for (const [eventId, event] of this.eventHistory.entries()) {
        if (event.timestamp.getTime() < cutoff) {
          this.eventHistory.delete(eventId)
        }
      }
    }, 60 * 60 * 1000) // Every hour
  }

  private validateEvent(event: BloodDonationEvent): void {
    if (!event.id || !event.type || !event.source || !event.timestamp) {
      throw new Error('Missing required event fields')
    }

    if (!Object.values(this.EVENT_TYPES).includes(event.type)) {
      throw new Error(`Invalid event type: ${event.type}`)
    }

    if (!['low', 'medium', 'high', 'critical'].includes(event.priority)) {
      throw new Error(`Invalid priority: ${event.priority}`)
    }
  }

  private async persistEvent(event: BloodDonationEvent): Promise<void> {
    try {
      await this.db.insert('event_logs', {
        id: event.id,
        type: event.type,
        priority: event.priority,
        source: event.source,
        data: JSON.stringify(event.data),
        metadata: JSON.stringify(event.metadata),
        targeting: JSON.stringify(event.targeting),
        created_at: event.timestamp
      })
    } catch (error) {
      console.error('Failed to persist event:', error)
    }
  }

  private recordEventMetrics(event: BloodDonationEvent, result: EventProcessingResult): void {
    performanceMonitor.recordCustomMetric({
      name: 'event_process_duration',
      value: result.totalProcessingTime,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        success: 'true',
        event_type: event.type,
        priority: event.priority,
        handlers_count: result.handlers.length.toString(),
        notifications_count: result.notifications.length.toString()
      }
    })

    // Record handler performance
    for (const handler of result.handlers) {
      performanceMonitor.recordCustomMetric({
        name: 'event_handler_duration',
        value: handler.processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          handler_id: handler.handlerId,
          success: handler.success.toString(),
          event_type: event.type
        }
      })
    }
  }

  // Public API methods
  public registerHandler(handler: EventHandler): void {
    this.eventHandlers.set(handler.id, handler)
    console.log(`Registered event handler: ${handler.id}`)
  }

  public unregisterHandler(handlerId: string): void {
    this.eventHandlers.delete(handlerId)
    console.log(`Unregistered event handler: ${handlerId}`)
  }

  public async getEventHistory(eventType?: string, limit = 100): Promise<BloodDonationEvent[]> {
    const events = Array.from(this.eventHistory.values())
      .filter(event => !eventType || event.type === eventType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)

    return events
  }

  public getSystemStats() {
    return {
      queueSize: this.eventQueue.length,
      handlersCount: this.eventHandlers.size,
      historySize: this.eventHistory.size,
      processingQueue: this.processingQueue,
      eventTypes: Object.values(this.EVENT_TYPES)
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const queueHealth = this.eventQueue.length < this.CONFIG.maxQueueSize * 0.8
    const handlersHealth = this.eventHandlers.size > 0
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (!queueHealth || !handlersHealth) {
      status = 'unhealthy'
    } else if (this.eventQueue.length > this.CONFIG.maxQueueSize * 0.5) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        queueSize: this.eventQueue.length,
        maxQueueSize: this.CONFIG.maxQueueSize,
        handlersCount: this.eventHandlers.size,
        processingQueue: this.processingQueue,
        historySize: this.eventHistory.size
      }
    }
  }
}

// Singleton instance
let realTimeEventSystemInstance: RealTimeEventSystem | null = null

export function getRealTimeEventSystem(): RealTimeEventSystem {
  if (!realTimeEventSystemInstance) {
    realTimeEventSystemInstance = new RealTimeEventSystem()
  }
  return realTimeEventSystemInstance
}

export default RealTimeEventSystem
