"use client"

import { getSupabase } from "./supabase"
import { aiMatchingService } from "./ai-matching-service"
import { performanceMonitor } from "./performance-monitoring"

export interface EmergencyAlert {
  id: string
  type: 'blood_shortage' | 'mass_casualty' | 'natural_disaster' | 'hospital_emergency' | 'critical_patient'
  priority: 'low' | 'medium' | 'high' | 'critical'
  bloodType: string
  unitsNeeded: number
  hospitalId: string
  hospitalName: string
  location: {
    latitude: number
    longitude: number
    address: string
    city: string
    country: string
  }
  description: string
  contactInfo: {
    phone: string
    email: string
    emergencyContact: string
  }
  status: 'active' | 'partially_fulfilled' | 'fulfilled' | 'expired' | 'cancelled'
  createdAt: Date
  expiresAt: Date
  fulfilledAt?: Date
  alertRadius: number // in kilometers
  estimatedResponseTime: number // in minutes
  metadata: Record<string, unknown>
}

export interface AlertResponse {
  donorId: string
  alertId: string
  responseType: 'available' | 'en_route' | 'arrived' | 'donated' | 'unavailable'
  responseTime: Date
  estimatedArrival?: Date
  unitsOffered: number
  location?: {
    latitude: number
    longitude: number
  }
  notes?: string
}

export interface EmergencyCoordinator {
  id: string
  name: string
  role: 'coordinator' | 'supervisor' | 'dispatcher'
  hospitalId?: string
  phone: string
  email: string
  isOnDuty: boolean
  lastActivity: Date
}

export class EmergencyAlertService {
  private supabase = getSupabase()
  private activeAlerts = new Map<string, EmergencyAlert>()
  private coordinators = new Map<string, EmergencyCoordinator>()
  private alertTimeouts = new Map<string, NodeJS.Timeout>()
  private maxActiveAlerts = 50
  private defaultAlertRadius = 25 // kilometers
  private maxAlertRadius = 100 // kilometers

  constructor() {
    this.initializeService()
  }

  /**
   * Initialize emergency alert service
   */
  private async initializeService(): Promise<void> {
    try {
      console.log('🚨 Initializing emergency alert service...')
      
      await this.loadActiveAlerts()
      await this.loadCoordinators()
      this.startAlertMonitoring()
      
      console.log('✅ Emergency alert service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize emergency alert service:', error)
    }
  }

  /**
   * Create new emergency alert
   */
  async createEmergencyAlert(alertData: {
    type: EmergencyAlert['type']
    priority: EmergencyAlert['priority']
    bloodType: string
    unitsNeeded: number
    hospitalId: string
    hospitalName: string
    location: EmergencyAlert['location']
    description: string
    contactInfo: EmergencyAlert['contactInfo']
    alertRadius?: number
    estimatedResponseTime?: number
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const tracker = performanceMonitor.startTracking('emergency-alert', 'CREATE_ALERT')
    
    try {
      if (this.activeAlerts.size >= this.maxActiveAlerts) {
        throw new Error('Maximum number of active alerts reached')
      }

      const alertId = this.generateAlertId()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + this.getAlertDuration(alertData.priority))

      const alert: EmergencyAlert = {
        id: alertId,
        type: alertData.type,
        priority: alertData.priority,
        bloodType: alertData.bloodType,
        unitsNeeded: alertData.unitsNeeded,
        hospitalId: alertData.hospitalId,
        hospitalName: alertData.hospitalName,
        location: alertData.location,
        description: alertData.description,
        contactInfo: alertData.contactInfo,
        status: 'active',
        createdAt: now,
        expiresAt,
        alertRadius: alertData.alertRadius || this.defaultAlertRadius,
        estimatedResponseTime: alertData.estimatedResponseTime || this.calculateEstimatedResponseTime(alertData.priority),
        metadata: alertData.metadata || {}
      }

      // Store in database
      await this.storeAlert(alert)

      // Add to active alerts
      this.activeAlerts.set(alertId, alert)

      // Set expiration timer
      this.setAlertExpiration(alert)

      // Broadcast alert to nearby donors
      await this.broadcastAlert(alert)

      // Notify coordinators
      await this.notifyCoordinators(alert)

      console.log(`🚨 Emergency alert created: ${alertId} (${alert.priority} priority)`)
      tracker.end(200)

      return alertId

    } catch (error) {
      console.error('❌ Failed to create emergency alert:', error)
      tracker.end(500)
      throw error
    }
  }

  /**
   * Broadcast alert to nearby donors
   */
  private async broadcastAlert(alert: EmergencyAlert): Promise<void> {
    try {
      console.log(`📡 Broadcasting alert ${alert.id} to nearby donors...`)

      // Find nearby donors using AI matching service
      const compatibleDonors = await aiMatchingService.findOptimalDonors(
        alert.id,
        alert.bloodType,
        alert.priority,
        `${alert.location.latitude},${alert.location.longitude}`
      )

      // Filter donors within alert radius
      const nearbyDonors = await this.filterDonorsByDistance(
        compatibleDonors.map(d => d.donor_id),
        alert.location,
        alert.alertRadius
      )

      console.log(`Found ${nearbyDonors.length} nearby compatible donors`)

      // Send notifications based on priority
      const notificationPromises = nearbyDonors.map(async (donor) => {
        try {
          // Send push notification
          await this.sendPushNotification(donor.id, alert)

          // Send SMS for critical alerts
          if (alert.priority === 'critical' && donor.phone) {
            await this.sendSMSAlert(donor.phone, alert)
          }

          // Send email notification
          if (donor.email) {
            await this.sendEmailAlert(donor.email, alert)
          }

          // Log notification sent
          await this.logNotification(alert.id, donor.id, 'sent')

        } catch (error) {
          console.error(`Failed to notify donor ${donor.id}:`, error)
          await this.logNotification(alert.id, donor.id, 'failed')
        }
      })

      await Promise.allSettled(notificationPromises)

      // Update alert with notification count
      await this.updateAlertMetadata(alert.id, {
        donorsNotified: nearbyDonors.length,
        notificationsSent: notificationPromises.length
      })

    } catch (error) {
      console.error('❌ Failed to broadcast alert:', error)
    }
  }

  /**
   * Handle donor response to emergency alert
   */
  async handleDonorResponse(response: {
    donorId: string
    alertId: string
    responseType: AlertResponse['responseType']
    unitsOffered: number
    estimatedArrival?: Date
    location?: { latitude: number; longitude: number }
    notes?: string
  }): Promise<void> {
    try {
      const alert = this.activeAlerts.get(response.alertId)
      if (!alert) {
        throw new Error('Alert not found or no longer active')
      }

      const alertResponse: AlertResponse = {
        donorId: response.donorId,
        alertId: response.alertId,
        responseType: response.responseType,
        responseTime: new Date(),
        estimatedArrival: response.estimatedArrival,
        unitsOffered: response.unitsOffered,
        location: response.location,
        notes: response.notes
      }

      // Store response in database
      await this.storeAlertResponse(alertResponse)

      // Update alert status if needed
      await this.updateAlertFulfillment(alert.id)

      // Notify coordinators of response
      await this.notifyCoordinatorsOfResponse(alertResponse)

      // Send confirmation to donor
      await this.sendResponseConfirmation(response.donorId, alert, response.responseType)

      console.log(`✅ Donor response recorded: ${response.donorId} -> ${response.responseType}`)

    } catch (error) {
      console.error('❌ Failed to handle donor response:', error)
      throw error
    }
  }

  /**
   * Update alert fulfillment status
   */
  private async updateAlertFulfillment(alertId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId)
      if (!alert) return

      // Get all positive responses
      const { data: responses } = await this.supabase
        .from('emergency_alert_responses')
        .select('*')
        .eq('alert_id', alertId)
        .in('response_type', ['available', 'en_route', 'arrived', 'donated'])

      const totalUnitsOffered = responses?.reduce((sum, r) => sum + r.units_offered, 0) || 0
      const donatedUnits = responses?.filter(r => r.response_type === 'donated')
        .reduce((sum, r) => sum + r.units_offered, 0) || 0

      let newStatus = alert.status

      if (donatedUnits >= alert.unitsNeeded) {
        newStatus = 'fulfilled'
        alert.fulfilledAt = new Date()
        this.clearAlertTimeout(alertId)
      } else if (totalUnitsOffered >= alert.unitsNeeded) {
        newStatus = 'partially_fulfilled'
      }

      if (newStatus !== alert.status) {
        alert.status = newStatus
        this.activeAlerts.set(alertId, alert)

        // Update in database
        await this.supabase
          .from('emergency_alerts')
          .update({
            status: newStatus,
            fulfilled_at: alert.fulfilledAt?.toISOString(),
            metadata: {
              ...alert.metadata,
              totalUnitsOffered,
              donatedUnits,
              lastUpdated: new Date().toISOString()
            }
          })
          .eq('id', alertId)

        console.log(`📊 Alert ${alertId} status updated to: ${newStatus}`)

        // Notify coordinators of status change
        if (newStatus === 'fulfilled') {
          await this.notifyCoordinatorsOfFulfillment(alert)
        }
      }

    } catch (error) {
      console.error('❌ Failed to update alert fulfillment:', error)
    }
  }

  /**
   * Cancel emergency alert
   */
  async cancelAlert(alertId: string, reason: string, cancelledBy: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId)
      if (!alert) {
        throw new Error('Alert not found')
      }

      alert.status = 'cancelled'
      alert.metadata = {
        ...alert.metadata,
        cancelReason: reason,
        cancelledBy,
        cancelledAt: new Date().toISOString()
      }

      // Update in database
      await this.supabase
        .from('emergency_alerts')
        .update({
          status: 'cancelled',
          metadata: alert.metadata
        })
        .eq('id', alertId)

      // Clear timeout
      this.clearAlertTimeout(alertId)

      // Remove from active alerts
      this.activeAlerts.delete(alertId)

      // Notify affected donors
      await this.notifyAlertCancellation(alert)

      console.log(`🚫 Alert ${alertId} cancelled: ${reason}`)

    } catch (error) {
      console.error('❌ Failed to cancel alert:', error)
      throw error
    }
  }

  /**
   * Get active alerts for coordinator dashboard
   */
  async getActiveAlerts(coordinatorId?: string): Promise<EmergencyAlert[]> {
    try {
      let query = this.supabase
        .from('emergency_alerts')
        .select('*')
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })

      if (coordinatorId) {
        const coordinator = this.coordinators.get(coordinatorId)
        if (coordinator?.hospitalId) {
          query = query.eq('hospital_id', coordinator.hospitalId)
        }
      }

      const { data: alerts, error } = await query

      if (error) throw error

      return alerts?.map(this.mapDatabaseAlertToInterface) || []

    } catch (error) {
      console.error('❌ Failed to get active alerts:', error)
      return []
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(timeRange: 'today' | 'week' | 'month' = 'today'): Promise<{
    totalAlerts: number
    activeAlerts: number
    fulfilledAlerts: number
    averageResponseTime: number
    topAlertTypes: Array<{ type: string; count: number }>
    responseRate: number
  }> {
    try {
      const startDate = this.getTimeRangeStart(timeRange)

      const { data: alerts } = await this.supabase
        .from('emergency_alerts')
        .select('*')
        .gte('created_at', startDate.toISOString())

      const { data: responses } = await this.supabase
        .from('emergency_alert_responses')
        .select('*')
        .gte('response_time', startDate.toISOString())

      const totalAlerts = alerts?.length || 0
      const activeAlerts = alerts?.filter(a => a.status === 'active').length || 0
      const fulfilledAlerts = alerts?.filter(a => a.status === 'fulfilled').length || 0

      const responseTimes = responses
        ?.filter(r => r.response_type !== 'unavailable')
        .map(r => new Date(r.response_time).getTime() - new Date(r.created_at).getTime())
        || []

      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length / 60000 // in minutes
        : 0

      const alertTypeCounts: Record<string, number> = {}
      alerts?.forEach(alert => {
        alertTypeCounts[alert.type] = (alertTypeCounts[alert.type] || 0) + 1
      })

      const topAlertTypes = Object.entries(alertTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const totalNotifications = alerts?.reduce((sum, alert) => 
        sum + (alert.metadata?.donorsNotified || 0), 0) || 0
      const totalResponses = responses?.length || 0
      const responseRate = totalNotifications > 0 ? totalResponses / totalNotifications : 0

      return {
        totalAlerts,
        activeAlerts,
        fulfilledAlerts,
        averageResponseTime,
        topAlertTypes,
        responseRate
      }

    } catch (error) {
      console.error('❌ Failed to get alert statistics:', error)
      return {
        totalAlerts: 0,
        activeAlerts: 0,
        fulfilledAlerts: 0,
        averageResponseTime: 0,
        topAlertTypes: [],
        responseRate: 0
      }
    }
  }

  /**
   * Private utility methods
   */
  private async loadActiveAlerts(): Promise<void> {
    try {
      const { data: alerts } = await this.supabase
        .from('emergency_alerts')
        .select('*')
        .eq('status', 'active')

      alerts?.forEach(alert => {
        const mappedAlert = this.mapDatabaseAlertToInterface(alert)
        this.activeAlerts.set(mappedAlert.id, mappedAlert)
        this.setAlertExpiration(mappedAlert)
      })

      console.log(`📊 Loaded ${alerts?.length || 0} active alerts`)
    } catch (error) {
      console.error('❌ Failed to load active alerts:', error)
    }
  }

  private async loadCoordinators(): Promise<void> {
    try {
      const { data: coordinators } = await this.supabase
        .from('emergency_coordinators')
        .select('*')
        .eq('is_active', true)

      coordinators?.forEach(coordinator => {
        this.coordinators.set(coordinator.id, {
          id: coordinator.id,
          name: coordinator.name,
          role: coordinator.role,
          hospitalId: coordinator.hospital_id,
          phone: coordinator.phone,
          email: coordinator.email,
          isOnDuty: coordinator.is_on_duty,
          lastActivity: new Date(coordinator.last_activity)
        })
      })

      console.log(`👥 Loaded ${coordinators?.length || 0} coordinators`)
    } catch (error) {
      console.error('❌ Failed to load coordinators:', error)
    }
  }

  private startAlertMonitoring(): void {
    // Monitor alerts every 30 seconds
    setInterval(() => {
      this.checkAlertExpiration()
      this.updateCoordinatorActivity()
    }, 30000)

    console.log('⏰ Alert monitoring started')
  }

  private checkAlertExpiration(): void {
    const now = new Date()
    const expiredAlerts: string[] = []

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (now > alert.expiresAt && alert.status === 'active') {
        expiredAlerts.push(alertId)
      }
    }

    expiredAlerts.forEach(async (alertId) => {
      await this.expireAlert(alertId)
    })
  }

  private async expireAlert(alertId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId)
      if (!alert) return

      alert.status = 'expired'
      
      await this.supabase
        .from('emergency_alerts')
        .update({ status: 'expired' })
        .eq('id', alertId)

      this.activeAlerts.delete(alertId)
      this.clearAlertTimeout(alertId)

      console.log(`⏰ Alert ${alertId} expired`)
    } catch (error) {
      console.error(`❌ Failed to expire alert ${alertId}:`, error)
    }
  }

  private setAlertExpiration(alert: EmergencyAlert): void {
    const timeUntilExpiration = alert.expiresAt.getTime() - Date.now()
    
    if (timeUntilExpiration > 0) {
      const timeout = setTimeout(() => {
        this.expireAlert(alert.id)
      }, timeUntilExpiration)

      this.alertTimeouts.set(alert.id, timeout)
    }
    else {
      // Alert is already expired
      this.expireAlert(alert.id)
    }
  }

  private clearAlertTimeout(alertId: string): void {
    const timeout = this.alertTimeouts.get(alertId)
    if (timeout) {
      clearTimeout(timeout)
      this.alertTimeouts.delete(alertId)
    }
  }

  private getAlertDuration(priority: EmergencyAlert['priority']): number {
    // Duration in milliseconds
    switch (priority) {
      case 'critical': return 2 * 60 * 60 * 1000 // 2 hours
      case 'high': return 4 * 60 * 60 * 1000 // 4 hours
      case 'medium': return 8 * 60 * 60 * 1000 // 8 hours
      case 'low': return 24 * 60 * 60 * 1000 // 24 hours
      default: return 4 * 60 * 60 * 1000
    }
  }

  private calculateEstimatedResponseTime(priority: EmergencyAlert['priority']): number {
    // Estimated response time in minutes
    switch (priority) {
      case 'critical': return 15
      case 'high': return 30
      case 'medium': return 60
      case 'low': return 120
      default: return 30
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async filterDonorsByDistance(
    donorIds: string[],
    location: EmergencyAlert['location'],
    maxDistance: number
  ): Promise<Array<{ id: string; phone?: string; email?: string; distance: number }>> {
    try {
      const { data: donors } = await this.supabase
        .from('users')
        .select('id, phone, email, latitude, longitude')
        .in('id', donorIds)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      const nearbyDonors = donors
        ?.map(donor => {
          const distance = this.calculateDistance(
            location.latitude,
            location.longitude,
            donor.latitude,
            donor.longitude
          )
          return {
            id: donor.id,
            phone: donor.phone,
            email: donor.email,
            distance
          }
        })
        .filter(donor => donor.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance) || []

      return nearbyDonors
    } catch (error) {
      console.error('❌ Failed to filter donors by distance:', error)
      return []
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  private getTimeRangeStart(range: 'today' | 'week' | 'month'): Date {
    const now = new Date()
    switch (range) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate())
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        return weekStart
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
  }

  private mapDatabaseAlertToInterface(dbAlert: Record<string, unknown>): EmergencyAlert {
    return {
      id: dbAlert.id,
      type: dbAlert.type,
      priority: dbAlert.priority,
      bloodType: dbAlert.blood_type,
      unitsNeeded: dbAlert.units_needed,
      hospitalId: dbAlert.hospital_id,
      hospitalName: dbAlert.hospital_name,
      location: {
        latitude: dbAlert.latitude,
        longitude: dbAlert.longitude,
        address: dbAlert.address,
        city: dbAlert.city,
        country: dbAlert.country
      },
      description: dbAlert.description,
      contactInfo: {
        phone: dbAlert.contact_phone,
        email: dbAlert.contact_email,
        emergencyContact: dbAlert.emergency_contact
      },
      status: dbAlert.status,
      createdAt: new Date(dbAlert.created_at),
      expiresAt: new Date(dbAlert.expires_at),
      fulfilledAt: dbAlert.fulfilled_at ? new Date(dbAlert.fulfilled_at) : undefined,
      alertRadius: dbAlert.alert_radius,
      estimatedResponseTime: dbAlert.estimated_response_time,
      metadata: dbAlert.metadata || {}
    }
  }

  // Placeholder methods for notification services
  private async sendPushNotification(donorId: string, alert: EmergencyAlert): Promise<void> {
    // Implementation would integrate with push notification service
    console.log(`📱 Push notification sent to donor ${donorId} for alert ${alert.id}`)
  }

  private async sendSMSAlert(phone: string, alert: EmergencyAlert): Promise<void> {
    // Implementation would integrate with SMS service
    console.log(`📱 SMS alert sent to ${phone} for alert ${alert.id}`)
  }

  private async sendEmailAlert(email: string, alert: EmergencyAlert): Promise<void> {
    // Implementation would integrate with email service
    console.log(`📧 Email alert sent to ${email} for alert ${alert.id}`)
  }

  private async notifyCoordinators(alert: EmergencyAlert): Promise<void> {
    console.log(`👥 Coordinators notified of alert ${alert.id}`)
  }

  private async notifyCoordinatorsOfResponse(response: AlertResponse): Promise<void> {
    console.log(`👥 Coordinators notified of response from donor ${response.donorId}`)
  }

  private async notifyCoordinatorsOfFulfillment(alert: EmergencyAlert): Promise<void> {
    console.log(`👥 Coordinators notified that alert ${alert.id} is fulfilled`)
  }

  private async notifyAlertCancellation(alert: EmergencyAlert): Promise<void> {
    console.log(`📢 Alert cancellation notification sent for ${alert.id}`)
  }

  private async sendResponseConfirmation(donorId: string, alert: EmergencyAlert, responseType: string): Promise<void> {
    console.log(`✅ Response confirmation sent to donor ${donorId} for ${responseType}`)
  }

  private async storeAlert(alert: EmergencyAlert): Promise<void> {
    await this.supabase
      .from('emergency_alerts')
      .insert({
        id: alert.id,
        type: alert.type,
        priority: alert.priority,
        blood_type: alert.bloodType,
        units_needed: alert.unitsNeeded,
        hospital_id: alert.hospitalId,
        hospital_name: alert.hospitalName,
        latitude: alert.location.latitude,
        longitude: alert.location.longitude,
        address: alert.location.address,
        city: alert.location.city,
        country: alert.location.country,
        description: alert.description,
        contact_phone: alert.contactInfo.phone,
        contact_email: alert.contactInfo.email,
        emergency_contact: alert.contactInfo.emergencyContact,
        status: alert.status,
        created_at: alert.createdAt.toISOString(),
        expires_at: alert.expiresAt.toISOString(),
        alert_radius: alert.alertRadius,
        estimated_response_time: alert.estimatedResponseTime,
        metadata: alert.metadata
      })
  }

  private async storeAlertResponse(response: AlertResponse): Promise<void> {
    await this.supabase
      .from('emergency_alert_responses')
      .insert({
        donor_id: response.donorId,
        alert_id: response.alertId,
        response_type: response.responseType,
        response_time: response.responseTime.toISOString(),
        estimated_arrival: response.estimatedArrival?.toISOString(),
        units_offered: response.unitsOffered,
        latitude: response.location?.latitude,
        longitude: response.location?.longitude,
        notes: response.notes,
        created_at: new Date().toISOString()
      })
  }

  private async updateAlertMetadata(alertId: string, metadata: Record<string, unknown>): Promise<void> {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.metadata = { ...alert.metadata, ...metadata }
      
      await this.supabase
        .from('emergency_alerts')
        .update({ metadata: alert.metadata })
        .eq('id', alertId)
    }
  }

  private async logNotification(alertId: string, donorId: string, status: 'sent' | 'failed'): Promise<void> {
    try {
      await this.supabase
        .from('alert_notifications')
        .insert({
          alert_id: alertId,
          donor_id: donorId,
          status,
          sent_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to log notification:', error)
    }
  }

  private async updateCoordinatorActivity(): Promise<void> {
    // Update coordinator last activity timestamps
    console.log('📊 Updating coordinator activity')
  }

  /**
   * Get service health and statistics
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    activeAlerts: number
    coordinators: number
    uptime: string
    memoryUsage: number
  } {
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (this.activeAlerts.size > 30) {
      status = 'degraded'
    }
    if (this.activeAlerts.size >= this.maxActiveAlerts) {
      status = 'unhealthy'
    }

    return {
      status,
      activeAlerts: this.activeAlerts.size,
      coordinators: this.coordinators.size,
      uptime: `${hours}h ${minutes}m`,
      memoryUsage: Math.round(memoryUsage)
    }
  }
}

// Export singleton instance
export const emergencyAlertService = new EmergencyAlertService()