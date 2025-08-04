/**
 * Push Notification System
 * 
 * Multi-channel push notification system supporting FCM, APNs, 
 * email, SMS, and in-app notifications with intelligent delivery
 */

import { getOptimizedDB } from '../database/optimized-queries'
import { getCache } from '../cache/redis-cache'
import { performanceMonitor } from '../performance/metrics'
import { getWebSocketServer } from './websocket-server'

export interface NotificationPayload {
  id: string
  userId: string
  type: 'blood_request' | 'donor_match' | 'emergency' | 'reminder' | 'system' | 'marketing'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  body: string
  data?: Record<string, any>
  channels: NotificationChannel[]
  scheduling?: {
    sendAt?: Date
    timezone?: string
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly'
      interval: number
      endDate?: Date
    }
  }
  targeting?: {
    userIds?: string[]
    roles?: string[]
    regions?: string[]
    bloodTypes?: string[]
    customFilters?: Record<string, any>
  }
  personalization?: {
    variables: Record<string, string>
    template?: string
  }
}

export interface NotificationChannel {
  type: 'push' | 'email' | 'sms' | 'websocket' | 'in_app'
  enabled: boolean
  config?: {
    // Push notification config
    badge?: number
    sound?: string
    icon?: string
    image?: string
    clickAction?: string
    
    // Email config
    template?: string
    attachments?: string[]
    
    // SMS config
    shortCode?: string
    
    // WebSocket config
    room?: string
    
    // In-app config
    persistent?: boolean
    actionButtons?: Array<{
      id: string
      title: string
      action: string
    }>
  }
}

export interface NotificationResult {
  id: string
  status: 'sent' | 'failed' | 'scheduled' | 'cancelled'
  channels: Array<{
    type: string
    status: 'sent' | 'failed' | 'skipped'
    deliveredAt?: Date
    error?: string
    messageId?: string
  }>
  sentAt?: Date
  deliveredCount: number
  failedCount: number
  metadata: {
    processingTime: number
    retryCount: number
    cost?: number
  }
}

export interface NotificationTemplate {
  id: string
  name: string
  type: string
  channels: NotificationChannel[]
  content: {
    title: string
    body: string
    variables: string[]
  }
  targeting: {
    defaultRoles: string[]
    defaultRegions: string[]
  }
  isActive: boolean
}

class PushNotificationSystem {
  private db = getOptimizedDB()
  private cache = getCache()
  private webSocketServer = getWebSocketServer()
  private processingQueue: Map<string, NotificationPayload> = new Map()
  private templates: Map<string, NotificationTemplate> = new Map()

  // Configuration
  private readonly CONFIG = {
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    batchSize: 100,
    rateLimits: {
      push: 1000, // per hour
      email: 500,  // per hour
      sms: 100,    // per hour
    },
    providers: {
      fcm: {
        enabled: !!process.env.FCM_SERVER_KEY,
        serverKey: process.env.FCM_SERVER_KEY,
        endpoint: 'https://fcm.googleapis.com/fcm/send'
      },
      apns: {
        enabled: !!process.env.APNS_KEY_ID,
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID,
        bundleId: process.env.APNS_BUNDLE_ID
      },
      email: {
        enabled: !!process.env.SMTP_HOST,
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      sms: {
        enabled: !!process.env.SMS_API_KEY,
        provider: process.env.SMS_PROVIDER || 'twilio',
        apiKey: process.env.SMS_API_KEY,
        from: process.env.SMS_FROM_NUMBER
      }
    }
  }

  constructor() {
    this.initializeTemplates()
    this.startProcessingQueue()
  }

  async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    const startTime = performance.now()

    try {
      // Validate payload
      this.validatePayload(payload)

      // Apply personalization
      const personalizedPayload = await this.personalizeNotification(payload)

      // Resolve targeting
      const targetUsers = await this.resolveTargeting(personalizedPayload)

      if (targetUsers.length === 0) {
        throw new Error('No target users found')
      }

      // Check scheduling
      if (personalizedPayload.scheduling?.sendAt && personalizedPayload.scheduling.sendAt > new Date()) {
        return this.scheduleNotification(personalizedPayload)
      }

      // Send to each channel
      const channelResults = await this.sendToChannels(personalizedPayload, targetUsers)

      const result: NotificationResult = {
        id: payload.id,
        status: channelResults.some(r => r.status === 'sent') ? 'sent' : 'failed',
        channels: channelResults,
        sentAt: new Date(),
        deliveredCount: channelResults.filter(r => r.status === 'sent').length,
        failedCount: channelResults.filter(r => r.status === 'failed').length,
        metadata: {
          processingTime: performance.now() - startTime,
          retryCount: 0
        }
      }

      // Store notification record
      await this.storeNotificationRecord(result, targetUsers)

      // Record metrics
      this.recordNotificationMetrics(result)

      return result

    } catch (error) {
      const processingTime = performance.now() - startTime

      performanceMonitor.recordCustomMetric({
        name: 'notification_send_duration',
        value: processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          success: 'false',
          error: (error as Error).message,
          type: payload.type,
          priority: payload.priority
        }
      })

      throw new Error(`Notification send failed: ${(error as Error).message}`)
    }
  }

  private async sendToChannels(payload: NotificationPayload, targetUsers: string[]): Promise<NotificationResult['channels']> {
    const results: NotificationResult['channels'] = []

    for (const channel of payload.channels) {
      if (!channel.enabled) {
        results.push({
          type: channel.type,
          status: 'skipped'
        })
        continue
      }

      try {
        let channelResult: NotificationResult['channels'][0]

        switch (channel.type) {
          case 'push':
            channelResult = await this.sendPushNotifications(payload, targetUsers, channel)
            break

          case 'email':
            channelResult = await this.sendEmailNotifications(payload, targetUsers, channel)
            break

          case 'sms':
            channelResult = await this.sendSMSNotifications(payload, targetUsers, channel)
            break

          case 'websocket':
            channelResult = await this.sendWebSocketNotifications(payload, targetUsers, channel)
            break

          case 'in_app':
            channelResult = await this.sendInAppNotifications(payload, targetUsers, channel)
            break

          default:
            channelResult = {
              type: channel.type,
              status: 'failed',
              error: 'Unsupported channel type'
            }
        }

        results.push(channelResult)

      } catch (error) {
        results.push({
          type: channel.type,
          status: 'failed',
          error: (error as Error).message
        })
      }
    }

    return results
  }

  private async sendPushNotifications(
    payload: NotificationPayload,
    targetUsers: string[],
    channel: NotificationChannel
  ): Promise<NotificationResult['channels'][0]> {
    if (!this.CONFIG.providers.fcm.enabled) {
      return { type: 'push', status: 'failed', error: 'FCM not configured' }
    }

    try {
      // Get device tokens for target users
      const deviceTokens = await this.getDeviceTokens(targetUsers)

      if (deviceTokens.length === 0) {
        return { type: 'push', status: 'failed', error: 'No device tokens found' }
      }

      // Prepare FCM payload
      const fcmPayload = {
        registration_ids: deviceTokens,
        notification: {
          title: payload.title,
          body: payload.body,
          icon: channel.config?.icon || 'default',
          sound: channel.config?.sound || 'default',
          badge: channel.config?.badge,
          click_action: channel.config?.clickAction
        },
        data: {
          ...payload.data,
          notification_id: payload.id,
          type: payload.type,
          priority: payload.priority
        },
        priority: payload.priority === 'critical' ? 'high' : 'normal'
      }

      // Send via FCM
      const response = await fetch(this.CONFIG.providers.fcm.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.CONFIG.providers.fcm.serverKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcmPayload)
      })

      const result = await response.json()

      if (response.ok && result.success > 0) {
        return {
          type: 'push',
          status: 'sent',
          deliveredAt: new Date(),
          messageId: result.multicast_id?.toString()
        }
      } else {
        return {
          type: 'push',
          status: 'failed',
          error: result.error || 'FCM send failed'
        }
      }

    } catch (error) {
      return {
        type: 'push',
        status: 'failed',
        error: (error as Error).message
      }
    }
  }

  private async sendEmailNotifications(
    payload: NotificationPayload,
    targetUsers: string[],
    channel: NotificationChannel
  ): Promise<NotificationResult['channels'][0]> {
    if (!this.CONFIG.providers.email.enabled) {
      return { type: 'email', status: 'failed', error: 'Email not configured' }
    }

    try {
      // Get email addresses for target users
      const emailAddresses = await this.getEmailAddresses(targetUsers)

      if (emailAddresses.length === 0) {
        return { type: 'email', status: 'failed', error: 'No email addresses found' }
      }

      // Prepare email content
      const emailContent = await this.prepareEmailContent(payload, channel)

      // Send emails (batch processing)
      const emailResults = await this.sendBatchEmails(emailAddresses, emailContent)

      const successCount = emailResults.filter(r => r.success).length

      return {
        type: 'email',
        status: successCount > 0 ? 'sent' : 'failed',
        deliveredAt: new Date(),
        messageId: `batch_${Date.now()}`
      }

    } catch (error) {
      return {
        type: 'email',
        status: 'failed',
        error: (error as Error).message
      }
    }
  }

  private async sendSMSNotifications(
    payload: NotificationPayload,
    targetUsers: string[],
    channel: NotificationChannel
  ): Promise<NotificationResult['channels'][0]> {
    if (!this.CONFIG.providers.sms.enabled) {
      return { type: 'sms', status: 'failed', error: 'SMS not configured' }
    }

    try {
      // Get phone numbers for target users
      const phoneNumbers = await this.getPhoneNumbers(targetUsers)

      if (phoneNumbers.length === 0) {
        return { type: 'sms', status: 'failed', error: 'No phone numbers found' }
      }

      // Prepare SMS content (truncate if necessary)
      const smsContent = this.prepareSMSContent(payload)

      // Send SMS messages
      const smsResults = await this.sendBatchSMS(phoneNumbers, smsContent)

      const successCount = smsResults.filter(r => r.success).length

      return {
        type: 'sms',
        status: successCount > 0 ? 'sent' : 'failed',
        deliveredAt: new Date(),
        messageId: `sms_batch_${Date.now()}`
      }

    } catch (error) {
      return {
        type: 'sms',
        status: 'failed',
        error: (error as Error).message
      }
    }
  }

  private async sendWebSocketNotifications(
    payload: NotificationPayload,
    targetUsers: string[],
    channel: NotificationChannel
  ): Promise<NotificationResult['channels'][0]> {
    try {
      const message = {
        type: 'notification',
        room: channel.config?.room,
        data: {
          id: payload.id,
          type: payload.type,
          priority: payload.priority,
          title: payload.title,
          body: payload.body,
          data: payload.data
        },
        timestamp: new Date(),
        messageId: `ws_${payload.id}`,
        priority: payload.priority
      }

      if (channel.config?.room) {
        // Send to specific room
        this.webSocketServer.broadcastToRoom(channel.config.room, message)
      } else {
        // Send to specific users
        for (const userId of targetUsers) {
          this.webSocketServer.broadcastToUser(userId, message)
        }
      }

      return {
        type: 'websocket',
        status: 'sent',
        deliveredAt: new Date(),
        messageId: message.messageId
      }

    } catch (error) {
      return {
        type: 'websocket',
        status: 'failed',
        error: (error as Error).message
      }
    }
  }

  private async sendInAppNotifications(
    payload: NotificationPayload,
    targetUsers: string[],
    channel: NotificationChannel
  ): Promise<NotificationResult['channels'][0]> {
    try {
      // Store in-app notifications in database
      const notifications = targetUsers.map(userId => ({
        id: `${payload.id}_${userId}`,
        user_id: userId,
        type: payload.type,
        priority: payload.priority,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        is_read: false,
        is_persistent: channel.config?.persistent || false,
        action_buttons: channel.config?.actionButtons || [],
        created_at: new Date(),
        expires_at: payload.type === 'emergency' ? 
          new Date(Date.now() + 24 * 60 * 60 * 1000) : // 24 hours for emergency
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days for others
      }))

      await this.db.insertMany('in_app_notifications', notifications)

      return {
        type: 'in_app',
        status: 'sent',
        deliveredAt: new Date(),
        messageId: `in_app_${payload.id}`
      }

    } catch (error) {
      return {
        type: 'in_app',
        status: 'failed',
        error: (error as Error).message
      }
    }
  }

  // Helper methods
  private validatePayload(payload: NotificationPayload): void {
    if (!payload.id || !payload.userId || !payload.title || !payload.body) {
      throw new Error('Missing required notification fields')
    }

    if (!payload.channels || payload.channels.length === 0) {
      throw new Error('At least one notification channel must be specified')
    }

    if (!['low', 'medium', 'high', 'critical'].includes(payload.priority)) {
      throw new Error('Invalid priority level')
    }
  }

  private async personalizeNotification(payload: NotificationPayload): Promise<NotificationPayload> {
    if (!payload.personalization) {
      return payload
    }

    let personalizedTitle = payload.title
    let personalizedBody = payload.body

    // Replace variables in title and body
    for (const [key, value] of Object.entries(payload.personalization.variables)) {
      const placeholder = `{{${key}}}`
      personalizedTitle = personalizedTitle.replace(new RegExp(placeholder, 'g'), value)
      personalizedBody = personalizedBody.replace(new RegExp(placeholder, 'g'), value)
    }

    return {
      ...payload,
      title: personalizedTitle,
      body: personalizedBody
    }
  }

  private async resolveTargeting(payload: NotificationPayload): Promise<string[]> {
    if (payload.targeting?.userIds) {
      return payload.targeting.userIds
    }

    // Build query based on targeting criteria
    const filters: any = {}

    if (payload.targeting?.roles) {
      filters.role = { in: payload.targeting.roles }
    }

    if (payload.targeting?.regions) {
      filters.region = { in: payload.targeting.regions }
    }

    if (payload.targeting?.bloodTypes) {
      filters.blood_type = { in: payload.targeting.bloodTypes }
    }

    // Add custom filters
    if (payload.targeting?.customFilters) {
      Object.assign(filters, payload.targeting.customFilters)
    }

    const result = await this.db.findMany('users', filters, {
      select: 'id',
      limit: 10000 // Reasonable limit
    })

    return result.data?.map(user => user.id) || []
  }

  private async scheduleNotification(payload: NotificationPayload): Promise<NotificationResult> {
    // Store scheduled notification
    await this.db.insert('scheduled_notifications', {
      id: payload.id,
      payload: JSON.stringify(payload),
      send_at: payload.scheduling!.sendAt,
      status: 'scheduled',
      created_at: new Date()
    })

    return {
      id: payload.id,
      status: 'scheduled',
      channels: [],
      deliveredCount: 0,
      failedCount: 0,
      metadata: {
        processingTime: 0,
        retryCount: 0
      }
    }
  }

  private async getDeviceTokens(userIds: string[]): Promise<string[]> {
    const result = await this.db.findMany('user_devices', 
      { user_id: { in: userIds }, is_active: true },
      { select: 'push_token' }
    )

    return result.data?.map(device => device.push_token).filter(Boolean) || []
  }

  private async getEmailAddresses(userIds: string[]): Promise<string[]> {
    const result = await this.db.findMany('users',
      { id: { in: userIds }, email_verified: true },
      { select: 'email' }
    )

    return result.data?.map(user => user.email).filter(Boolean) || []
  }

  private async getPhoneNumbers(userIds: string[]): Promise<string[]> {
    const result = await this.db.findMany('users',
      { id: { in: userIds }, phone_verified: true },
      { select: 'phone' }
    )

    return result.data?.map(user => user.phone).filter(Boolean) || []
  }

  private async prepareEmailContent(payload: NotificationPayload, channel: NotificationChannel) {
    // In production, this would use email templates
    return {
      subject: payload.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${payload.title}</h2>
          <p>${payload.body}</p>
          ${payload.data?.actionUrl ? `<a href="${payload.data.actionUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Action</a>` : ''}
        </div>
      `,
      text: `${payload.title}\n\n${payload.body}`
    }
  }

  private prepareSMSContent(payload: NotificationPayload): string {
    // Truncate SMS content to 160 characters
    const content = `${payload.title}: ${payload.body}`
    return content.length > 160 ? content.substring(0, 157) + '...' : content
  }

  private async sendBatchEmails(emails: string[], content: any): Promise<Array<{ success: boolean; error?: string }>> {
    // Mock implementation - in production, use actual email service
    return emails.map(() => ({ success: true }))
  }

  private async sendBatchSMS(phones: string[], content: string): Promise<Array<{ success: boolean; error?: string }>> {
    // Mock implementation - in production, use actual SMS service
    return phones.map(() => ({ success: true }))
  }

  private async storeNotificationRecord(result: NotificationResult, targetUsers: string[]): Promise<void> {
    await this.db.insert('notification_logs', {
      id: result.id,
      status: result.status,
      channels: JSON.stringify(result.channels),
      target_user_count: targetUsers.length,
      delivered_count: result.deliveredCount,
      failed_count: result.failedCount,
      sent_at: result.sentAt,
      processing_time: result.metadata.processingTime,
      created_at: new Date()
    })
  }

  private recordNotificationMetrics(result: NotificationResult): void {
    performanceMonitor.recordCustomMetric({
      name: 'notification_send_duration',
      value: result.metadata.processingTime,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        success: 'true',
        status: result.status,
        delivered_count: result.deliveredCount.toString(),
        failed_count: result.failedCount.toString()
      }
    })

    // Record per-channel metrics
    for (const channel of result.channels) {
      performanceMonitor.recordCustomMetric({
        name: 'notification_channel_delivery',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        tags: {
          channel_type: channel.type,
          status: channel.status
        }
      })
    }
  }

  private initializeTemplates(): void {
    // Initialize default notification templates
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'blood_request_urgent',
        name: 'Urgent Blood Request',
        type: 'blood_request',
        channels: [
          { type: 'push', enabled: true, config: { sound: 'urgent', badge: 1 } },
          { type: 'websocket', enabled: true, config: { room: 'emergency' } },
          { type: 'in_app', enabled: true, config: { persistent: true } }
        ],
        content: {
          title: 'Urgent: {{bloodType}} Blood Needed',
          body: '{{hospitalName}} urgently needs {{units}} units of {{bloodType}} blood. Can you help?',
          variables: ['bloodType', 'hospitalName', 'units']
        },
        targeting: {
          defaultRoles: ['donor'],
          defaultRegions: []
        },
        isActive: true
      },
      {
        id: 'donor_match_found',
        name: 'Donor Match Found',
        type: 'donor_match',
        channels: [
          { type: 'push', enabled: true },
          { type: 'email', enabled: true },
          { type: 'in_app', enabled: true }
        ],
        content: {
          title: 'Great News! We Found a Match',
          body: 'A donor has been matched for your {{bloodType}} blood request. Expected donation time: {{donationTime}}',
          variables: ['bloodType', 'donationTime']
        },
        targeting: {
          defaultRoles: ['hospital'],
          defaultRegions: []
        },
        isActive: true
      }
    ]

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template)
    }
  }

  private startProcessingQueue(): void {
    // Process scheduled notifications every minute
    setInterval(async () => {
      try {
        const now = new Date()
        const scheduledResult = await this.db.findMany('scheduled_notifications',
          { send_at: { lte: now }, status: 'scheduled' },
          { limit: 100 }
        )

        for (const scheduled of scheduledResult.data || []) {
          try {
            const payload = JSON.parse(scheduled.payload)
            await this.sendNotification(payload)
            
            // Update status
            await this.db.update('scheduled_notifications',
              { id: scheduled.id },
              { status: 'sent', sent_at: new Date() }
            )
          } catch (error) {
            console.error(`Failed to send scheduled notification ${scheduled.id}:`, error)
            
            // Update status with error
            await this.db.update('scheduled_notifications',
              { id: scheduled.id },
              { status: 'failed', error: (error as Error).message }
            )
          }
        }
      } catch (error) {
        console.error('Error processing notification queue:', error)
      }
    }, 60000) // Every minute
  }

  // Public API methods
  public async sendFromTemplate(templateId: string, variables: Record<string, string>, targeting?: NotificationPayload['targeting']): Promise<NotificationResult> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    const payload: NotificationPayload = {
      id: `template_${templateId}_${Date.now()}`,
      userId: 'system',
      type: template.type as any,
      priority: 'medium',
      title: template.content.title,
      body: template.content.body,
      channels: template.channels,
      targeting: targeting || {
        roles: template.targeting.defaultRoles,
        regions: template.targeting.defaultRegions
      },
      personalization: {
        variables
      }
    }

    return this.sendNotification(payload)
  }

  public getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId)
  }

  public listTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values())
  }

  public async getNotificationHistory(userId: string, limit = 50): Promise<any[]> {
    const result = await this.db.query(
      'notification_logs',
      (query) => query
        .select('*')
        .contains('target_users', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
    )

    return result.data || []
  }

  public async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db.update('in_app_notifications',
      { id: notificationId, user_id: userId },
      { is_read: true, read_at: new Date() }
    )
  }

  public getSystemStats() {
    return {
      templates: this.templates.size,
      queueSize: this.processingQueue.size,
      providers: {
        fcm: this.CONFIG.providers.fcm.enabled,
        apns: this.CONFIG.providers.apns.enabled,
        email: this.CONFIG.providers.email.enabled,
        sms: this.CONFIG.providers.sms.enabled
      }
    }
  }
}

// Singleton instance
let pushNotificationInstance: PushNotificationSystem | null = null

export function getPushNotificationSystem(): PushNotificationSystem {
  if (!pushNotificationInstance) {
    pushNotificationInstance = new PushNotificationSystem()
  }
  return pushNotificationInstance
}

export default PushNotificationSystem
