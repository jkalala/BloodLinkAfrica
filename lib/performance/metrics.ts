/**
 * Performance Metrics Collection and Monitoring
 * 
 * Comprehensive performance monitoring system for BloodLink Africa
 * Tracks Web Vitals, API performance, and custom metrics
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

export interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
  url?: string
  userId?: string
  sessionId?: string
}

export interface APIPerformanceMetric {
  endpoint: string
  method: string
  duration: number
  status: number
  timestamp: number
  userId?: string
  cacheHit?: boolean
  dbQueryTime?: number
  mlProcessingTime?: number
}

export interface CustomMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags?: Record<string, string>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private apiMetrics: APIPerformanceMetric[] = []
  private customMetrics: CustomMetric[] = []
  private sessionId: string
  private userId?: string
  private isEnabled: boolean

  constructor() {
    this.sessionId = this.generateSessionId()
    this.isEnabled = typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
    
    if (this.isEnabled) {
      this.initializeWebVitals()
      this.initializeNavigationTiming()
      this.initializeResourceTiming()
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  setUserId(userId: string): void {
    this.userId = userId
  }

  private initializeWebVitals(): void {
    // Cumulative Layout Shift
    getCLS((metric) => {
      this.recordMetric({
        name: 'CLS',
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId
      })
    })

    // First Input Delay
    getFID((metric) => {
      this.recordMetric({
        name: 'FID',
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId
      })
    })

    // First Contentful Paint
    getFCP((metric) => {
      this.recordMetric({
        name: 'FCP',
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId
      })
    })

    // Largest Contentful Paint
    getLCP((metric) => {
      this.recordMetric({
        name: 'LCP',
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId
      })
    })

    // Time to First Byte
    getTTFB((metric) => {
      this.recordMetric({
        name: 'TTFB',
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId
      })
    })
  }

  private initializeNavigationTiming(): void {
    if (typeof window === 'undefined' || !window.performance) return

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      if (navigation) {
        // DNS Lookup Time
        this.recordCustomMetric({
          name: 'dns_lookup_time',
          value: navigation.domainLookupEnd - navigation.domainLookupStart,
          unit: 'ms',
          timestamp: Date.now(),
          tags: { type: 'navigation' }
        })

        // TCP Connection Time
        this.recordCustomMetric({
          name: 'tcp_connection_time',
          value: navigation.connectEnd - navigation.connectStart,
          unit: 'ms',
          timestamp: Date.now(),
          tags: { type: 'navigation' }
        })

        // Server Response Time
        this.recordCustomMetric({
          name: 'server_response_time',
          value: navigation.responseStart - navigation.requestStart,
          unit: 'ms',
          timestamp: Date.now(),
          tags: { type: 'navigation' }
        })

        // DOM Content Loaded
        this.recordCustomMetric({
          name: 'dom_content_loaded',
          value: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          unit: 'ms',
          timestamp: Date.now(),
          tags: { type: 'navigation' }
        })

        // Page Load Complete
        this.recordCustomMetric({
          name: 'page_load_complete',
          value: navigation.loadEventEnd - navigation.navigationStart,
          unit: 'ms',
          timestamp: Date.now(),
          tags: { type: 'navigation' }
        })
      }
    })
  }

  private initializeResourceTiming(): void {
    if (typeof window === 'undefined' || !window.performance) return

    // Monitor resource loading performance
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming
          
          this.recordCustomMetric({
            name: 'resource_load_time',
            value: resource.responseEnd - resource.startTime,
            unit: 'ms',
            timestamp: Date.now(),
            tags: {
              type: 'resource',
              name: resource.name,
              initiatorType: resource.initiatorType
            }
          })
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)
    this.sendMetricToAnalytics(metric)
  }

  recordAPIMetric(metric: APIPerformanceMetric): void {
    this.apiMetrics.push(metric)
    this.sendAPIMetricToAnalytics(metric)
  }

  recordCustomMetric(metric: CustomMetric): void {
    this.customMetrics.push(metric)
    this.sendCustomMetricToAnalytics(metric)
  }

  // API Performance Tracking
  trackAPICall<T>(
    endpoint: string,
    method: string,
    apiCall: () => Promise<T>,
    options?: {
      cacheHit?: boolean
      dbQueryTime?: number
      mlProcessingTime?: number
    }
  ): Promise<T> {
    const startTime = performance.now()
    
    return apiCall()
      .then((result) => {
        const duration = performance.now() - startTime
        
        this.recordAPIMetric({
          endpoint,
          method,
          duration,
          status: 200,
          timestamp: Date.now(),
          userId: this.userId,
          ...options
        })
        
        return result
      })
      .catch((error) => {
        const duration = performance.now() - startTime
        
        this.recordAPIMetric({
          endpoint,
          method,
          duration,
          status: error.status || 500,
          timestamp: Date.now(),
          userId: this.userId,
          ...options
        })
        
        throw error
      })
  }

  // Component Performance Tracking
  trackComponentRender(componentName: string, renderTime: number): void {
    this.recordCustomMetric({
      name: 'component_render_time',
      value: renderTime,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        component: componentName,
        type: 'render'
      }
    })
  }

  // Database Query Performance
  trackDatabaseQuery(query: string, duration: number, recordCount?: number): void {
    this.recordCustomMetric({
      name: 'database_query_time',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        query: query.substring(0, 100), // Truncate for privacy
        recordCount: recordCount?.toString(),
        type: 'database'
      }
    })
  }

  // ML Model Performance
  trackMLInference(modelName: string, duration: number, accuracy?: number): void {
    this.recordCustomMetric({
      name: 'ml_inference_time',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        model: modelName,
        accuracy: accuracy?.toString(),
        type: 'ml'
      }
    })
  }

  // Cache Performance
  trackCacheOperation(operation: 'hit' | 'miss' | 'set', key: string, duration?: number): void {
    this.recordCustomMetric({
      name: 'cache_operation',
      value: duration || 0,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        operation,
        key: key.substring(0, 50), // Truncate for privacy
        type: 'cache'
      }
    })
  }

  private sendMetricToAnalytics(metric: PerformanceMetric): void {
    if (!this.isEnabled) return

    // Send to analytics service (e.g., Google Analytics, DataDog, etc.)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'web_vital', {
        event_category: 'Performance',
        event_label: metric.name,
        value: Math.round(metric.value),
        custom_map: {
          metric_rating: metric.rating,
          session_id: this.sessionId,
          user_id: this.userId
        }
      })
    }

    // Send to custom analytics endpoint
    this.sendToAnalyticsEndpoint('/api/analytics/performance', {
      type: 'web_vital',
      ...metric
    })
  }

  private sendAPIMetricToAnalytics(metric: APIPerformanceMetric): void {
    if (!this.isEnabled) return

    this.sendToAnalyticsEndpoint('/api/analytics/performance', {
      type: 'api_performance',
      ...metric
    })
  }

  private sendCustomMetricToAnalytics(metric: CustomMetric): void {
    if (!this.isEnabled) return

    this.sendToAnalyticsEndpoint('/api/analytics/performance', {
      type: 'custom_metric',
      ...metric
    })
  }

  private sendToAnalyticsEndpoint(endpoint: string, data: any): void {
    // Use navigator.sendBeacon for reliability
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(data))
    } else {
      // Fallback to fetch
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(() => {
        // Silently fail - don't impact user experience
      })
    }
  }

  // Performance Report Generation
  generatePerformanceReport(): {
    webVitals: PerformanceMetric[]
    apiMetrics: APIPerformanceMetric[]
    customMetrics: CustomMetric[]
    summary: {
      avgPageLoadTime: number
      avgAPIResponseTime: number
      slowestEndpoints: APIPerformanceMetric[]
      performanceScore: number
    }
  } {
    const avgPageLoadTime = this.customMetrics
      .filter(m => m.name === 'page_load_complete')
      .reduce((sum, m) => sum + m.value, 0) / 
      this.customMetrics.filter(m => m.name === 'page_load_complete').length || 0

    const avgAPIResponseTime = this.apiMetrics.length > 0 
      ? this.apiMetrics.reduce((sum, m) => sum + m.duration, 0) / this.apiMetrics.length
      : 0

    const slowestEndpoints = this.apiMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)

    // Calculate performance score based on Web Vitals
    const performanceScore = this.calculatePerformanceScore()

    return {
      webVitals: this.metrics,
      apiMetrics: this.apiMetrics,
      customMetrics: this.customMetrics,
      summary: {
        avgPageLoadTime,
        avgAPIResponseTime,
        slowestEndpoints,
        performanceScore
      }
    }
  }

  private calculatePerformanceScore(): number {
    const vitals = this.metrics.reduce((acc, metric) => {
      acc[metric.name] = metric.rating
      return acc
    }, {} as Record<string, string>)

    let score = 100
    
    // Deduct points based on poor ratings
    Object.values(vitals).forEach(rating => {
      if (rating === 'poor') score -= 20
      else if (rating === 'needs-improvement') score -= 10
    })

    return Math.max(0, score)
  }

  // Cleanup
  destroy(): void {
    this.metrics = []
    this.apiMetrics = []
    this.customMetrics = []
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// React Hook for component performance tracking
export function usePerformanceTracking(componentName: string) {
  const startTime = performance.now()

  return {
    trackRender: () => {
      const renderTime = performance.now() - startTime
      performanceMonitor.trackComponentRender(componentName, renderTime)
    }
  }
}

// Higher-order component for automatic performance tracking
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name

  return function PerformanceTrackedComponent(props: P) {
    const { trackRender } = usePerformanceTracking(displayName)

    React.useEffect(() => {
      trackRender()
    })

    return React.createElement(WrappedComponent, props)
  }
}

// API call wrapper with automatic performance tracking
export async function performanceTrackedFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const method = options?.method || 'GET'
  
  return performanceMonitor.trackAPICall(
    url,
    method,
    async () => {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return response.json()
    }
  )
}

// Export types for external use
export type { PerformanceMetric, APIPerformanceMetric, CustomMetric }
