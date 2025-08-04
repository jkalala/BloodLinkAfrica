import { analyticsService, type AnalyticsData } from './analytics-service'

export interface RealTimeMetrics {
  active_requests: number
  available_donors: number
  emergency_alerts: number
  avg_match_time: number
  success_rate_today: number
  requests_last_hour: number
  responses_last_hour: number
  system_load: number
}

export interface RealTimeUpdate {
  type: 'metrics_update' | 'new_request' | 'new_response' | 'emergency_alert' | 'completion'
  data: unknown
  timestamp: string
}

export class RealTimeAnalyticsService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private updateCallbacks: Set<(update: RealTimeUpdate) => void> = new Set()
  private metricsCallbacks: Set<(metrics: RealTimeMetrics) => void> = new Set()
  private isConnected = false
  private currentMetrics: RealTimeMetrics | null = null
  private metricsInterval: NodeJS.Timeout | null = null

  constructor() {
    this.initializeRealTimeMetrics()
  }

  /**
   * Initialize real-time metrics polling as fallback
   */
  private initializeRealTimeMetrics() {
    // Start metrics polling every 15 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.fetchCurrentMetrics()
        this.currentMetrics = metrics
        this.notifyMetricsCallbacks(metrics)
      } catch (error) {
        console.error('Failed to fetch real-time metrics:', error)
      }
    }, 15000)

    // Initial fetch
    this.fetchCurrentMetrics().then(metrics => {
      this.currentMetrics = metrics
      this.notifyMetricsCallbacks(metrics)
    })
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:3001'
        this.ws = new WebSocket(`${wsUrl}/analytics`)

        this.ws.onopen = () => {
          console.log('🔗 Real-time analytics WebSocket connected')
          this.isConnected = true
          this.reconnectAttempts = 0
          
          // Subscribe to analytics updates
          this.send({
            type: 'subscribe',
            channel: 'analytics-updates'
          })
          
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const update: RealTimeUpdate = JSON.parse(event.data)
            this.handleUpdate(update)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = () => {
          console.log('📡 Real-time analytics WebSocket disconnected')
          this.isConnected = false
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnected = false
          reject(error)
        }

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = null
    }
    this.isConnected = false
  }

  /**
   * Subscribe to real-time updates
   */
  onUpdate(callback: (update: RealTimeUpdate) => void) {
    this.updateCallbacks.add(callback)
    return () => this.updateCallbacks.delete(callback)
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsUpdate(callback: (metrics: RealTimeMetrics) => void) {
    this.metricsCallbacks.add(callback)
    
    // Send current metrics immediately if available
    if (this.currentMetrics) {
      callback(this.currentMetrics)
    }
    
    return () => this.metricsCallbacks.delete(callback)
  }

  /**
   * Get current real-time metrics
   */
  getCurrentMetrics(): RealTimeMetrics | null {
    return this.currentMetrics
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.isConnected
  }

  /**
   * Send message through WebSocket
   */
  private send(message: unknown) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Handle incoming real-time update
   */
  private handleUpdate(update: RealTimeUpdate) {
    console.log('📊 Real-time analytics update:', update)
    
    // Update current metrics if it's a metrics update
    if (update.type === 'metrics_update' && update.data) {
      this.currentMetrics = update.data
      this.notifyMetricsCallbacks(update.data)
    }
    
    // Notify all update callbacks
    this.updateCallbacks.forEach(callback => {
      try {
        callback(update)
      } catch (error) {
        console.error('Error in update callback:', error)
      }
    })
  }

  /**
   * Notify all metrics callbacks
   */
  private notifyMetricsCallbacks(metrics: RealTimeMetrics) {
    this.metricsCallbacks.forEach(callback => {
      try {
        callback(metrics)
      } catch (error) {
        console.error('Error in metrics callback:', error)
      }
    })
  }

  /**
   * Attempt WebSocket reconnection
   */
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error)
        })
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.warn('⚠️ Max reconnection attempts reached. Using polling fallback.')
    }
  }

  /**
   * Fetch current metrics from API
   */
  private async fetchCurrentMetrics(): Promise<RealTimeMetrics> {
    try {
      // Get base analytics data
      const analyticsData = await analyticsService.getAnalyticsData()
      
      // Calculate real-time specific metrics
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      // Fetch recent data for hourly metrics
      const [recentRequests, recentResponses, todayData] = await Promise.all([
        this.getRequestsCount(oneHourAgo),
        this.getResponsesCount(oneHourAgo),
        analyticsService.getAnalyticsData({
          dateRange: {
            start: todayStart.toISOString(),
            end: now.toISOString()
          }
        })
      ])

      // Calculate system load (mock implementation)
      const systemLoad = Math.min(100, Math.max(0, 
        (analyticsData.total_requests / 1000) * 100 + 
        (recentRequests.length * 5)
      ))

      return {
        active_requests: Math.floor(Math.random() * 15) + 5, // Mock active requests
        available_donors: Math.round(analyticsData.total_donors * 0.7),
        emergency_alerts: analyticsData.critical_shortages?.length || 0,
        avg_match_time: analyticsData.avg_response_time,
        success_rate_today: todayData.success_rate,
        requests_last_hour: recentRequests.length,
        responses_last_hour: recentResponses.length,
        system_load: Math.round(systemLoad)
      }
    } catch (error) {
      console.error('Error fetching current metrics:', error)
      
      // Return fallback metrics
      return {
        active_requests: 0,
        available_donors: 0,
        emergency_alerts: 0,
        avg_match_time: 0,
        success_rate_today: 0,
        requests_last_hour: 0,
        responses_last_hour: 0,
        system_load: 0
      }
    }
  }

  /**
   * Get requests count since a specific time
   */
  private async getRequestsCount(since: Date): Promise<unknown[]> {
    // This would query the actual database
    // For now, return mock data
    return Array.from({ length: Math.floor(Math.random() * 10) }, (_, i) => ({
      id: i,
      created_at: new Date(since.getTime() + Math.random() * (Date.now() - since.getTime()))
    }))
  }

  /**
   * Get responses count since a specific time
   */
  private async getResponsesCount(since: Date): Promise<unknown[]> {
    // This would query the actual database
    // For now, return mock data
    return Array.from({ length: Math.floor(Math.random() * 8) }, (_, i) => ({
      id: i,
      created_at: new Date(since.getTime() + Math.random() * (Date.now() - since.getTime()))
    }))
  }

  /**
   * Trigger emergency alert
   */
  async triggerEmergencyAlert(bloodType: string, location: string, urgency: 'high' | 'critical') {
    const alert: RealTimeUpdate = {
      type: 'emergency_alert',
      data: {
        blood_type: bloodType,
        location,
        urgency,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    }

    // Send through WebSocket if connected
    this.send({
      type: 'emergency_alert',
      data: alert.data
    })

    // Notify local callbacks
    this.handleUpdate(alert)
  }

  /**
   * Get performance insights
   */
  async getPerformanceInsights(): Promise<{
    bottlenecks: string[]
    recommendations: string[]
    trends: { metric: string; direction: 'up' | 'down' | 'stable'; percentage: number }[]
  }> {
    const metrics = this.currentMetrics
    if (!metrics) {
      return {
        bottlenecks: [],
        recommendations: [],
        trends: []
      }
    }

    const bottlenecks: string[] = []
    const recommendations: string[] = []

    // Analyze bottlenecks
    if (metrics.avg_match_time > 60) {
      bottlenecks.push('High average matching time')
      recommendations.push('Consider optimizing donor matching algorithm')
    }

    if (metrics.success_rate_today < 70) {
      bottlenecks.push('Low success rate today')
      recommendations.push('Review and improve donor engagement strategies')
    }

    if (metrics.system_load > 80) {
      bottlenecks.push('High system load')
      recommendations.push('Consider scaling infrastructure or optimizing queries')
    }

    if (metrics.emergency_alerts > 3) {
      bottlenecks.push('Multiple critical blood shortages')
      recommendations.push('Launch targeted donor recruitment campaigns')
    }

    // Mock trends (in real implementation, compare with historical data)
    const trends = [
      { metric: 'Requests', direction: 'up' as const, percentage: 12 },
      { metric: 'Response Time', direction: 'down' as const, percentage: 8 },
      { metric: 'Success Rate', direction: 'up' as const, percentage: 5 },
      { metric: 'Active Donors', direction: 'stable' as const, percentage: 2 }
    ]

    return {
      bottlenecks,
      recommendations,
      trends
    }
  }
}

// Export singleton instance
export const realTimeAnalyticsService = new RealTimeAnalyticsService()