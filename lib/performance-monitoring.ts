/**
 * Performance Monitoring and Optimization
 * Provides performance tracking, metrics collection, and optimization utilities
 */

// Performance metrics interface
export interface PerformanceMetrics {
  timestamp: number
  route: string
  method: string
  duration: number
  memoryUsage: NodeJS.MemoryUsage
  cpuUsage?: NodeJS.CpuUsage
  statusCode?: number
  userId?: string
  userAgent?: string
  responseSize?: number
}

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_REQUEST_MS: 1000,
  VERY_SLOW_REQUEST_MS: 3000,
  HIGH_MEMORY_MB: 100,
  CRITICAL_MEMORY_MB: 200
} as const

// Performance monitoring class
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics in memory

  /**
   * Start tracking performance for a request
   */
  startTracking(route: string, method: string): PerformanceTracker {
    return new PerformanceTracker(route, method, this)
  }

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics)
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log performance issues
    this.checkPerformanceThresholds(metrics)
  }

  /**
   * Check if metrics exceed performance thresholds
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const { duration, memoryUsage, route, method } = metrics
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024

    // Check slow requests
    if (duration > PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST_MS) {
      console.warn('🐌 VERY SLOW REQUEST:', {
        route,
        method,
        duration: `${duration}ms`,
        threshold: `${PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST_MS}ms`
      })
    } else if (duration > PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS) {
      console.info('🐢 Slow request:', {
        route,
        method,
        duration: `${duration}ms`
      })
    }

    // Check memory usage
    if (memoryMB > PERFORMANCE_THRESHOLDS.CRITICAL_MEMORY_MB) {
      console.error('🚨 CRITICAL MEMORY USAGE:', {
        route,
        method,
        memoryMB: `${Math.round(memoryMB)}MB`,
        threshold: `${PERFORMANCE_THRESHOLDS.CRITICAL_MEMORY_MB}MB`
      })
    } else if (memoryMB > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_MB) {
      console.warn('⚠️ High memory usage:', {
        route,
        method,
        memoryMB: `${Math.round(memoryMB)}MB`
      })
    }
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalRequests: number
    averageResponseTime: number
    slowRequests: number
    verySlowRequests: number
    averageMemoryUsage: number
    routeStats: Record<string, {
      count: number
      averageResponseTime: number
      slowCount: number
    }>
  } {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        verySlowRequests: 0,
        averageMemoryUsage: 0,
        routeStats: {}
      }
    }

    const totalRequests = this.metrics.length
    const totalResponseTime = this.metrics.reduce((sum, m) => sum + m.duration, 0)
    const averageResponseTime = totalResponseTime / totalRequests

    const slowRequests = this.metrics.filter(
      m => m.duration > PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS
    ).length

    const verySlowRequests = this.metrics.filter(
      m => m.duration > PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST_MS
    ).length

    const totalMemory = this.metrics.reduce(
      (sum, m) => sum + m.memoryUsage.heapUsed, 0
    )
    const averageMemoryUsage = (totalMemory / totalRequests) / 1024 / 1024

    // Route-specific stats
    const routeStats: Record<string, {
      count: number
      averageResponseTime: number
      slowCount: number
    }> = {}

    this.metrics.forEach(metric => {
      const routeKey = `${metric.method} ${metric.route}`
      
      if (!routeStats[routeKey]) {
        routeStats[routeKey] = {
          count: 0,
          averageResponseTime: 0,
          slowCount: 0
        }
      }

      const stats = routeStats[routeKey]
      stats.count++
      stats.averageResponseTime = (
        (stats.averageResponseTime * (stats.count - 1) + metric.duration) / stats.count
      )
      
      if (metric.duration > PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS) {
        stats.slowCount++
      }
    })

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      slowRequests,
      verySlowRequests,
      averageMemoryUsage: Math.round(averageMemoryUsage),
      routeStats
    }
  }

  /**
   * Get slow routes that need optimization
   */
  getSlowRoutes(): Array<{
    route: string
    method: string
    averageResponseTime: number
    slowRequestsPercentage: number
    count: number
  }> {
    const routeStats = this.getSummary().routeStats
    
    return Object.entries(routeStats)
      .map(([routeKey, stats]) => {
        const [method, ...routeParts] = routeKey.split(' ')
        const route = routeParts.join(' ')
        
        return {
          route,
          method,
          averageResponseTime: stats.averageResponseTime,
          slowRequestsPercentage: (stats.slowCount / stats.count) * 100,
          count: stats.count
        }
      })
      .filter(route => 
        route.averageResponseTime > PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS ||
        route.slowRequestsPercentage > 20
      )
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
  }

  /**
   * Clear metrics (for memory management)
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }
}

// Performance tracker for individual requests
export class PerformanceTracker {
  private startTime: number
  private startMemory: NodeJS.MemoryUsage
  private startCpuUsage?: NodeJS.CpuUsage

  constructor(
    private route: string,
    private method: string,
    private monitor: PerformanceMonitor
  ) {
    this.startTime = Date.now()
    this.startMemory = process.memoryUsage()
    
    try {
      this.startCpuUsage = process.cpuUsage()
    } catch (error) {
      // cpuUsage might not be available in all environments
    }
  }

  /**
   * End tracking and record metrics
   */
  end(statusCode?: number, userId?: string, userAgent?: string, responseSize?: number): PerformanceMetrics {
    const endTime = Date.now()
    const endMemory = process.memoryUsage()
    const duration = endTime - this.startTime

    let cpuUsage: NodeJS.CpuUsage | undefined
    if (this.startCpuUsage) {
      try {
        cpuUsage = process.cpuUsage(this.startCpuUsage)
      } catch (error) {
        // Ignore CPU usage errors
      }
    }

    const metrics: PerformanceMetrics = {
      timestamp: this.startTime,
      route: this.route,
      method: this.method,
      duration,
      memoryUsage: endMemory,
      cpuUsage,
      statusCode,
      userId,
      userAgent,
      responseSize
    }

    this.monitor.recordMetrics(metrics)
    return metrics
  }
}

// Singleton performance monitor
export const performanceMonitor = new PerformanceMonitor()

// Express-like middleware for automatic performance tracking
export function createPerformanceMiddleware() {
  return (req: unknown, res: unknown, next: unknown) => {
    const route = req.route?.path || req.url || 'unknown'
    const method = req.method || 'unknown'
    const tracker = performanceMonitor.startTracking(route, method)

    // Track response
    const originalSend = res.send
    res.send = function(body: unknown) {
      const responseSize = typeof body === 'string' ? Buffer.byteLength(body) : 0
      tracker.end(res.statusCode, req.user?.id, req.get('user-agent'), responseSize)
      return originalSend.call(this, body)
    }

    next()
  }
}

// React hooks for client-side performance monitoring
export function usePerformanceTracking(componentName: string) {
  const startTime = Date.now()

  return {
    trackRender: () => {
      const renderTime = Date.now() - startTime
      if (renderTime > 100) { // Log slow renders
        console.info(`Slow render: ${componentName} took ${renderTime}ms`)
      }
    },
    trackInteraction: (interactionName: string, callback: () => void) => {
      const interactionStart = Date.now()
      callback()
      const interactionTime = Date.now() - interactionStart
      
      if (interactionTime > 16) { // 60fps threshold
        console.info(`Slow interaction: ${componentName}.${interactionName} took ${interactionTime}ms`)
      }
    }
  }
}

// Database query performance tracking
export function trackDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  
  return queryFn().then(
    result => {
      const duration = Date.now() - startTime
      
      if (duration > 500) { // Log slow queries
        console.warn(`Slow database query: ${queryName} took ${duration}ms`)
      } else if (duration > 100) {
        console.info(`Database query: ${queryName} took ${duration}ms`)
      }
      
      return result
    },
    error => {
      const duration = Date.now() - startTime
      console.error(`Failed database query: ${queryName} took ${duration}ms`, error)
      throw error
    }
  )
}

// Memory monitoring utilities
export function getMemoryUsage(): {
  rss: string
  heapTotal: string
  heapUsed: string
  external: string
  arrayBuffers: string
  heapUsedPercentage: number
} {
  const usage = process.memoryUsage()
  
  return {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    arrayBuffers: `${Math.round(usage.arrayBuffers / 1024 / 1024)}MB`,
    heapUsedPercentage: Math.round((usage.heapUsed / usage.heapTotal) * 100)
  }
}

// Garbage collection monitoring
export function forceGarbageCollection(): boolean {
  if (global.gc) {
    global.gc()
    return true
  }
  return false
}

// Performance optimization helpers
export const memoize = <T extends (...args: unknown[]) => unknown>(fn: T): T => {
  const cache = new Map()
  
  return ((...args: unknown[]) => {
    const key = JSON.stringify(args)
    
    if (cache.has(key)) {
      return cache.get(key)
    }
    
    const result = fn(...args)
    cache.set(key, result)
    
    // Prevent memory leaks by limiting cache size
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    
    return result
  }) as T
}

// Debounce function for performance optimization
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(later, wait)
  }
}

// Throttle function for performance optimization
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Bundle size analysis (for build-time use)
export function analyzeBundleSize(filePath: string): {
  size: number
  gzipSize: number
  suggestions: string[]
} {
  // Only run on server-side (Node.js environment)
  if (typeof window !== 'undefined') {
    console.warn('analyzeBundleSize can only be used on the server side')
    return { size: 0, gzipSize: 0, suggestions: ['Client-side analysis not supported'] }
  }
  
  try {
    // Dynamic import for Node.js modules only
    const fs = eval('require')('fs')
    const zlib = eval('require')('zlib')
    
    const fileContent = fs.readFileSync(filePath)
    const size = fileContent.length
    const gzipSize = zlib.gzipSync(fileContent).length
    
    const suggestions: string[] = []
    
    if (size > 1024 * 1024) { // 1MB
      suggestions.push('Consider code splitting - bundle is larger than 1MB')
    }
    
    if (gzipSize > 250 * 1024) { // 250KB
      suggestions.push('Consider dynamic imports - gzipped size is larger than 250KB')
    }
    
    const compressionRatio = gzipSize / size
    if (compressionRatio > 0.7) {
      suggestions.push('Bundle may contain non-compressible content (images, etc.)')
    }
    
    return { size, gzipSize, suggestions }
  } catch (error) {
    throw new Error(`Failed to analyze bundle size: ${error}`)
  }
}

// Performance testing utilities
export async function loadTest(
  testFn: () => Promise<unknown>,
  options: {
    concurrent: number
    duration: number
    warmup?: number
  }
): Promise<{
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  errors: unknown[]
}> {
  const { concurrent, duration, warmup = 1000 } = options
  const results: { success: boolean; duration: number; error?: unknown }[] = []
  const errors: unknown[] = []
  
  // Warmup phase
  if (warmup > 0) {
    console.info(`Warming up for ${warmup}ms...`)
    const warmupEnd = Date.now() + warmup
    while (Date.now() < warmupEnd) {
      try {
        await testFn()
      } catch (error) {
        // Ignore warmup errors
      }
    }
  }
  
  console.info(`Starting load test: ${concurrent} concurrent requests for ${duration}ms`)
  const startTime = Date.now()
  const endTime = startTime + duration
  
  // Run concurrent requests
  const promises: Promise<void>[] = []
  
  for (let i = 0; i < concurrent; i++) {
    promises.push(
      (async () => {
        while (Date.now() < endTime) {
          const requestStart = Date.now()
          
          try {
            await testFn()
            results.push({
              success: true,
              duration: Date.now() - requestStart
            })
          } catch (error) {
            results.push({
              success: false,
              duration: Date.now() - requestStart,
              error
            })
            errors.push(error)
          }
        }
      })()
    )
  }
  
  await Promise.all(promises)
  
  // Calculate statistics
  const totalRequests = results.length
  const successfulRequests = results.filter(r => r.success).length
  const failedRequests = totalRequests - successfulRequests
  
  const responseTimes = results.map(r => r.duration)
  const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
  const minResponseTime = Math.min(...responseTimes)
  const maxResponseTime = Math.max(...responseTimes)
  
  const actualDuration = Date.now() - startTime
  const requestsPerSecond = (totalRequests / actualDuration) * 1000
  
  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime: Math.round(averageResponseTime),
    minResponseTime,
    maxResponseTime,
    requestsPerSecond: Math.round(requestsPerSecond),
    errors
  }
}