/**
 * Notification Background Processor
 * Handles automated notification processing and scheduling
 */

import { notificationService } from './notification-service'
import { performanceMonitor } from './performance-monitoring'

export class NotificationProcessor {
  private isRunning = false
  private interval: NodeJS.Timeout | null = null
  private readonly processingInterval = 30000 // 30 seconds
  
  /**
   * Start the background notification processor
   */
  start() {
    if (this.isRunning) {
      console.log('📱 Notification processor is already running')
      return
    }
    
    console.log('📱 Starting notification processor...')
    this.isRunning = true
    
    // Process immediately on start
    this.processNotifications()
    
    // Set up recurring processing
    this.interval = setInterval(() => {
      this.processNotifications()
    }, this.processingInterval)
    
    console.log(`✅ Notification processor started (interval: ${this.processingInterval}ms)`)
  }
  
  /**
   * Stop the background notification processor
   */
  stop() {
    if (!this.isRunning) {
      console.log('📱 Notification processor is not running')
      return
    }
    
    console.log('📱 Stopping notification processor...')
    this.isRunning = false
    
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    
    console.log('✅ Notification processor stopped')
  }
  
  /**
   * Process pending notifications
   */
  private async processNotifications() {
    if (!this.isRunning) return
    
    const tracker = performanceMonitor.startTracking('notification-processor', 'BACKGROUND')
    
    try {
      console.log('🔄 Processing notification queue...')
      
      const result = await notificationService.processPendingNotifications()
      
      if (result.success) {
        if (result.processed > 0 || result.retried > 0) {
          console.log(`✅ Processed ${result.processed} notifications, retried ${result.retried}`)
        }
      } else {
        console.error('❌ Failed to process notifications:', result.error)
      }
      
      tracker.end(200)
      
    } catch (error: unknown) {
      console.error('❌ Error in notification processor:', error)
      tracker.end(500)
    }
  }
  
  /**
   * Process notifications immediately (manual trigger)
   */
  async processImmediately(): Promise<{ success: boolean; processed: number; retried: number; error?: string }> {
    console.log('⚡ Manual notification processing triggered')
    
    try {
      const result = await notificationService.processPendingNotifications()
      
      if (result.success) {
        console.log(`⚡ Manual processing completed: ${result.processed} processed, ${result.retried} retried`)
      }
      
      return result
    } catch (error: unknown) {
      console.error('❌ Error in manual notification processing:', error)
      return {
        success: false,
        processed: 0,
        retried: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processingInterval: this.processingInterval,
      nextProcessingIn: this.interval ? this.processingInterval : null
    }
  }
}

// Export singleton instance
export const notificationProcessor = new NotificationProcessor()

// Auto-start in production environments
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_PROCESSOR === 'true') {
  // Start after a brief delay to ensure all services are initialized
  setTimeout(() => {
    notificationProcessor.start()
  }, 5000)
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📱 Received SIGTERM, stopping notification processor...')
  notificationProcessor.stop()
})

process.on('SIGINT', () => {
  console.log('📱 Received SIGINT, stopping notification processor...')
  notificationProcessor.stop()
})