"use client"

import { getSupabase } from "./supabase"
import { toast } from "@/hooks/use-toast"

export interface PushNotification {
  id: string
  title: string
  body: string
  data?: unknown
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  actions?: NotificationAction[]
}

export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

export class PushNotificationService {
  private supabase = getSupabase()
  private registration: ServiceWorkerRegistration | null = null
  private pushSupported = false
  private permission: NotificationPermission = 'default'

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      // Check if service workers and push notifications are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported')
        return
      }

      this.pushSupported = true

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js')
      console.log('Service Worker registered:', this.registration)

      // Check current permission
      this.permission = Notification.permission

      // Request permission if not granted
      if (this.permission === 'default') {
        await this.requestPermission()
      }

      // Set up notification click handler
      this.setupNotificationHandlers()

    } catch (error) {
      console.error('Error initializing push notifications:', error)
    }
  }

  private async requestPermission(): Promise<boolean> {
    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  private setupNotificationHandlers() {
    if (!this.registration) return

    // Handle notification clicks
    this.registration.addEventListener('notificationclick', (event: NotificationEvent) => {
      event.notification.close()

      const data = event.notification.data
      if (data && data.url) {
        // Open the URL in a new window/tab
        event.waitUntil(
          (event as any).clients.openWindow(data.url)
        )
      }
    })

    // Handle notification actions
    this.registration.addEventListener('notificationclose', (event: NotificationEvent) => {
      console.log('Notification closed:', event.notification.tag)
    })
  }

  public async subscribeToPushNotifications(userId: string): Promise<boolean> {
    if (!this.pushSupported || !this.registration) {
      console.log('Push notifications not supported')
      return false
    }

    try {
      // Request permission if needed
      if (this.permission !== 'granted') {
        const granted = await this.requestPermission()
        if (!granted) {
          toast({
            title: "Permission Denied",
            description: "Push notifications are disabled. Please enable them in your browser settings.",
            variant: "destructive"
          })
          return false
        }
      }

      // Get push subscription
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '')
      })

      // Store subscription in database
      const { error } = await this.supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription: subscription,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error storing push subscription:', error)
        return false
      }

      toast({
        title: "Push Notifications Enabled",
        description: "You'll now receive real-time updates about blood requests."
      })

      return true
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      return false
    }
  }

  public async unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
    try {
      // Get current subscription
      const subscription = await this.registration?.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }

      // Remove from database
      const { error } = await this.supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)

      if (error) {
        console.error('Error removing push subscription:', error)
        return false
      }

      toast({
        title: "Push Notifications Disabled",
        description: "You'll no longer receive push notifications."
      })

      return true
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return false
    }
  }

  public async sendLocalNotification(notification: PushNotification): Promise<void> {
    if (!this.pushSupported || this.permission !== 'granted') {
      return
    }

    try {
      const options: NotificationOptions = {
        body: notification.body,
        icon: notification.icon || '/logo-192x192.png',
        badge: notification.badge || '/logo-192x192.png',
        tag: notification.tag,
        requireInteraction: notification.requireInteraction || false,
        data: notification.data,
        actions: notification.actions?.map(action => ({
          action: action.action,
          title: action.title,
          icon: action.icon
        }))
      }

      await this.registration?.showNotification(notification.title, options)
      
      // Log notification for analytics
      await this.logNotification(notification)
    } catch (error) {
      console.error('Error showing local notification:', error)
    }
  }

  public async sendBloodRequestNotification(request: Record<string, unknown>): Promise<void> {
    const notification: PushNotification = {
      id: `blood-request-${request.id}`,
      title: `🩸 ${request.emergency_level === 'critical' ? 'CRITICAL' : 'URGENT'} Blood Request`,
      body: `${request.blood_type} blood needed at ${request.hospital_name || request.location}`,
      data: {
        url: `/requests/${request.id}`,
        requestId: request.id,
        type: 'blood_request',
        bloodType: request.blood_type,
        location: request.location,
        urgency: request.emergency_level
      },
      tag: `blood-request-${request.id}`,
      requireInteraction: request.emergency_level === 'critical',
      actions: [
        {
          action: 'respond',
          title: 'I can help',
          icon: '/icons/heart-16.png'
        },
        {
          action: 'share',
          title: 'Share request',
          icon: '/icons/share-16.png'
        }
      ]
    }

    await this.sendLocalNotification(notification)
  }

  public async sendEmergencyAlert(alert: Record<string, unknown>): Promise<void> {
    const notification: PushNotification = {
      id: `emergency-${alert.id}`,
      title: '🚨 EMERGENCY ALERT',
      body: alert.message,
      data: {
        url: `/emergency/${alert.id}`,
        alertId: alert.id,
        type: 'emergency'
      },
      tag: `emergency-${alert.id}`,
      requireInteraction: true
    }

    await this.sendLocalNotification(notification)
  }

  public async sendDonationReminder(user: Record<string, unknown>): Promise<void> {
    const notification: PushNotification = {
      id: `reminder-${Date.now()}`,
      title: '🩸 Donation Reminder',
      body: `It's time for your next blood donation. Help save lives!`,
      data: {
        url: '/schedule',
        type: 'reminder'
      },
      tag: 'donation-reminder'
    }

    await this.sendLocalNotification(notification)
  }

  public async sendDonorMatchNotification(request: Record<string, unknown>, donor: Record<string, unknown>): Promise<void> {
    const notification: PushNotification = {
      id: `match-${request.id}`,
      title: '✅ Donor Found!',
      body: `${donor.name} has accepted your blood request`,
      data: {
        url: `/request-status/${request.id}`,
        requestId: request.id,
        donorId: donor.id,
        type: 'donor_match'
      },
      tag: `match-${request.id}`
    }

    await this.sendLocalNotification(notification)
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  public isSupported(): boolean {
    return this.pushSupported
  }

  public getPermission(): NotificationPermission {
    return this.permission
  }

  public async checkSubscription(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking subscription:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error checking subscription:', error)
      return false
    }
  }

  /**
   * Log notification for analytics and tracking
   */
  private async logNotification(notification: PushNotification): Promise<void> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return

      await this.supabase
        .from('notification_logs')
        .insert({
          user_id: user.id,
          notification_id: notification.id,
          title: notification.title,
          body: notification.body,
          type: notification.data?.type || 'general',
          data: notification.data,
          sent_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error logging notification:', error)
      // Don't throw as this is not critical
    }
  }

  /**
   * Get notification history for user
   */
  public async getNotificationHistory(userId: string, limit: number = 50): Promise<unknown[]> {
    try {
      const { data, error } = await this.supabase
        .from('notification_logs')
        .select('*')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error getting notification history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting notification history:', error)
      return []
    }
  }

  /**
   * Send notification to nearby donors based on location
   */
  public async sendLocationBasedNotification(
    bloodType: string, 
    location: { latitude: number; longitude: number }, 
    radius: number = 10
  ): Promise<void> {
    try {
      // This would typically be handled by the backend
      // For now, we'll simulate finding nearby donors
      const { data: nearbyDonors } = await this.supabase
        .from('users')
        .select('id, full_name, latitude, longitude')
        .eq('blood_type', bloodType)
        .eq('available', true)

      if (!nearbyDonors) return

      // Calculate distance and filter by radius
      const donorsInRadius = nearbyDonors.filter(donor => {
        if (!donor.latitude || !donor.longitude) return false
        const distance = this.calculateDistance(
          location.latitude, location.longitude,
          donor.latitude, donor.longitude
        )
        return distance <= radius
      })

      // Send notifications to donors in radius
      for (const donor of donorsInRadius) {
        const notification: PushNotification = {
          id: `nearby-request-${Date.now()}-${donor.id}`,
          title: `🎯 Nearby Blood Request - ${bloodType}`,
          body: `Someone near you needs ${bloodType} blood. You're within ${radius}km!`,
          data: {
            type: 'nearby_request',
            bloodType,
            location,
            donorId: donor.id
          },
          tag: `nearby-${bloodType}`,
          actions: [
            {
              action: 'respond',
              title: 'I can help',
              icon: '/icons/heart-16.png'
            },
            {
              action: 'directions',
              title: 'Get directions',
              icon: '/icons/map-16.png'
            }
          ]
        }
        // In a real app, this would be sent via backend
        console.log('Would send notification to donor:', donor.id, notification)
      }
    } catch (error) {
      console.error('Error sending location-based notification:', error)
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1)
    const dLon = this.deg2rad(lon2 - lon1)
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180)
  }
}

// Singleton instance
let pushNotificationService: PushNotificationService | null = null

export const getPushNotificationService = (): PushNotificationService => {
  if (!pushNotificationService) {
    pushNotificationService = new PushNotificationService()
  }
  return pushNotificationService
} 