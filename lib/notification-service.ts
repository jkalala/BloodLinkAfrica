import { createServerSupabaseClient } from "./supabase"

export interface Notification {
  id: string
  user_id: string
  notification_type: string
  title: string
  message: string
  data?: unknown
  status: string
  created_at: string
  sent_at?: string
  delivery_attempts?: number
  channels?: string[]
  priority: 'low' | 'normal' | 'high' | 'critical'
}

export interface NotificationAlert {
  type: 'blood_request' | 'emergency' | 'donor_match' | 'status_update' | 'reminder' | 'system'
  title: string
  message: string
  recipients: string[]
  priority: 'low' | 'normal' | 'high' | 'critical'
  channels: string[]
  data?: Record<string, unknown>
  scheduled_at?: string
  expires_at?: string
}

export interface NotificationPreferences {
  user_id: string
  push_notifications: boolean
  sms_notifications: boolean
  email_notifications: boolean
  whatsapp_notifications: boolean
  call_notifications: boolean
  emergency_only: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  blood_request_alerts: boolean
  donation_reminders: boolean
  system_updates: boolean
}

export class NotificationService {
  private supabase = createServerSupabaseClient()

  /**
   * Create a notification for a user
   */
  async createNotification(notification: Omit<Notification, 'id' | 'status' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('notification_queue')
        .insert({
          user_id: notification.user_id,
          notification_type: notification.notification_type,
          title: notification.title,
          message: notification.message,
          data: notification.data || {},
          status: 'pending'
        })

      if (error) {
        console.error('Error creating notification:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error in createNotification:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string): Promise<{ success: boolean; data?: Notification[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error: unknown) {
      console.error('Error in getUserNotifications:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('notification_queue')
        .update({ status: 'delivered' })
        .eq('id', notificationId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error in markNotificationAsRead:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send alert (simplified for now)
   */
  async sendAlert(alertData: NotificationAlert): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
    try {
      console.log(`📢 Sending ${alertData.type} alert to ${alertData.recipients.length} recipients`)
      
      // Create notifications for all recipients
      const notifications = alertData.recipients.map(recipient => ({
        user_id: recipient,
        notification_type: alertData.type,
        title: alertData.title,
        message: alertData.message,
        data: alertData.data || {},
        priority: alertData.priority,
        channels: alertData.channels,
        status: 'pending'
      }))

      const { error } = await this.supabase
        .from('notification_queue')
        .insert(notifications)

      if (error) {
        console.error('Error sending alert:', error)
        return { success: false, sent: 0, failed: alertData.recipients.length, error: error.message }
      }

      return { success: true, sent: alertData.recipients.length, failed: 0 }
    } catch (error: unknown) {
      console.error('Error in sendAlert:', error)
      return { success: false, sent: 0, failed: 0, error: error.message }
    }
  }

  /**
   * Process pending notifications (simplified)
   */
  async processPendingNotifications(): Promise<{ success: boolean; processed: number; retried: number; error?: string }> {
    try {
      // Get pending notifications
      const { data: notifications, error: fetchError } = await this.supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(100)

      if (fetchError) {
        return { success: false, processed: 0, retried: 0, error: fetchError.message }
      }

      if (!notifications || notifications.length === 0) {
        return { success: true, processed: 0, retried: 0 }
      }

      let processed = 0
      for (const notification of notifications) {
        try {
          // Mark as sent (simplified processing)
          const { error: updateError } = await this.supabase
            .from('notification_queue')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id)

          if (!updateError) {
            processed++
          }
        } catch (error) {
          console.error('Error processing notification:', notification.id, error)
        }
      }

      return { success: true, processed, retried: 0 }
    } catch (error: unknown) {
      console.error('Error in processPendingNotifications:', error)
      return { success: false, processed: 0, retried: 0, error: error.message }
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          notification_preferences: preferences
        })
        .eq('user_id', userId)
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      return { success: true }
    } catch (error: unknown) {
      console.error('Error updating notification preferences:', error)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(
    userId: string
  ): Promise<{ success: boolean; data?: NotificationPreferences; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('notification_preferences')
        .eq('user_id', userId)
        .single()
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      return { success: true, data: data?.notification_preferences }
    } catch (error: unknown) {
      console.error('Error getting notification preferences:', error)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Get notification statistics
   */
  async getNotificationStats(
    userId?: string,
    days: number = 30
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      let query = this.supabase
        .from('notification_queue')
        .select('status, notification_type, priority, created_at')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      // Calculate basic statistics
      const stats = {
        total_sent: data?.filter(n => n.status === 'sent').length || 0,
        total_failed: data?.filter(n => n.status === 'failed').length || 0,
        total_pending: data?.filter(n => n.status === 'pending').length || 0,
        by_type: {},
        by_priority: {},
        by_channel: {},
        success_rate: 0
      }
      
      if (data && data.length > 0) {
        stats.success_rate = (stats.total_sent / data.length) * 100
      }
      
      return { success: true, data: stats }
    } catch (error: unknown) {
      console.error('Error getting notification stats:', error)
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService()

// Export getter function for consistency with other services
export const getNotificationService = () => notificationService