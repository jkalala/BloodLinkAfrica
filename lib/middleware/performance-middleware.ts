/**
 * High-Performance API Middleware
 * 
 * Comprehensive middleware for API performance optimization including
 * caching, compression, rate limiting, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCache } from '../cache/redis-cache'
import { performanceMonitor } from '../performance/metrics'

export interface PerformanceMiddlewareConfig {
  enableCaching?: boolean
  enableCompression?: boolean
  enableRateLimit?: boolean
  enableMetrics?: boolean
  cacheConfig?: {
    defaultTTL?: number
    excludePaths?: string[]
    includePaths?: string[]
    varyHeaders?: string[]
  }
  compressionConfig?: {
    threshold?: number
    level?: number
    excludeTypes?: string[]
  }
  rateLimitConfig?: {
    windowMs?: number
    maxRequests?: number
    skipSuccessfulRequests?: boolean
  }
}

interface RequestContext {
  startTime: number
  requestId: string
  userId?: string
  cacheKey?: string
  cached?: boolean
}

class PerformanceMiddleware {
  private config: Required<PerformanceMiddlewareConfig>
  private requestContexts = new Map<string, RequestContext>()

  constructor(config: PerformanceMiddlewareConfig = {}) {
    this.config = {
      enableCaching: true,
      enableCompression: true,
      enableRateLimit: true,
      enableMetrics: true,
      cacheConfig: {
        defaultTTL: 300, // 5 minutes
        excludePaths: ['/api/auth', '/api/admin'],
        includePaths: [],
        varyHeaders: ['Authorization', 'Accept-Language'],
        ...config.cacheConfig
      },
      compressionConfig: {
        threshold: 1024, // 1KB
        level: 6,
        excludeTypes: ['image/', 'video/', 'audio/'],
        ...config.compressionConfig
      },
      rateLimitConfig: {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
        skipSuccessfulRequests: false,
        ...config.rateLimitConfig
      },
      ...config
    }
  }

  async handleRequest(request: NextRequest): Promise<NextResponse | null> {
    const requestId = this.generateRequestId()
    const startTime = performance.now()
    
    const context: RequestContext = {
      startTime,
      requestId,
      userId: this.extractUserId(request)
    }
    
    this.requestContexts.set(requestId, context)

    try {
      // Rate limiting
      if (this.config.enableRateLimit) {
        const rateLimitResponse = await this.handleRateLimit(request, context)
        if (rateLimitResponse) return rateLimitResponse
      }

      // Cache check for GET requests
      if (this.config.enableCaching && request.method === 'GET') {
        const cachedResponse = await this.handleCacheRead(request, context)
        if (cachedResponse) return cachedResponse
      }

      return null // Continue to next middleware/handler
    } catch (error) {
      console.error('Performance middleware error:', error)
      return null
    }
  }

  async handleResponse(
    request: NextRequest,
    response: NextResponse,
    requestId?: string
  ): Promise<NextResponse> {
    const context = requestId ? this.requestContexts.get(requestId) : null
    
    if (!context) {
      return response
    }

    try {
      const duration = performance.now() - context.startTime

      // Record metrics
      if (this.config.enableMetrics) {
        await this.recordMetrics(request, response, context, duration)
      }

      // Cache response for successful GET requests
      if (
        this.config.enableCaching &&
        request.method === 'GET' &&
        response.status === 200 &&
        !context.cached
      ) {
        await this.handleCacheWrite(request, response, context)
      }

      // Apply compression
      if (this.config.enableCompression) {
        response = await this.handleCompression(request, response)
      }

      // Add performance headers
      response = this.addPerformanceHeaders(response, context, duration)

      return response
    } catch (error) {
      console.error('Response middleware error:', error)
      return response
    } finally {
      this.requestContexts.delete(context.requestId)
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private extractUserId(request: NextRequest): string | undefined {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return undefined

    try {
      // Extract user ID from JWT token (simplified)
      const token = authHeader.replace('Bearer ', '')
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub || payload.userId
    } catch {
      return undefined
    }
  }

  private async handleRateLimit(
    request: NextRequest,
    context: RequestContext
  ): Promise<NextResponse | null> {
    const key = `rate_limit:${context.userId || request.ip || 'anonymous'}`
    const cache = getCache()

    try {
      const current = await cache.get<number>(key) || 0
      
      if (current >= this.config.rateLimitConfig.maxRequests) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests'
            }
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil(this.config.rateLimitConfig.windowMs / 1000).toString(),
              'X-RateLimit-Limit': this.config.rateLimitConfig.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(Date.now() + this.config.rateLimitConfig.windowMs).toISOString()
            }
          }
        )
      }

      // Increment counter
      await cache.set(
        key,
        current + 1,
        { ttl: Math.ceil(this.config.rateLimitConfig.windowMs / 1000) }
      )

      return null
    } catch (error) {
      console.error('Rate limiting error:', error)
      return null
    }
  }

  private async handleCacheRead(
    request: NextRequest,
    context: RequestContext
  ): Promise<NextResponse | null> {
    if (!this.shouldCache(request)) {
      return null
    }

    const cacheKey = this.generateCacheKey(request)
    context.cacheKey = cacheKey

    try {
      const cache = getCache()
      const cached = await cache.get<{
        body: string
        headers: Record<string, string>
        status: number
      }>(cacheKey)

      if (cached) {
        context.cached = true
        
        const response = new NextResponse(cached.body, {
          status: cached.status,
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey
          }
        })

        return response
      }

      return null
    } catch (error) {
      console.error('Cache read error:', error)
      return null
    }
  }

  private async handleCacheWrite(
    request: NextRequest,
    response: NextResponse,
    context: RequestContext
  ): Promise<void> {
    if (!context.cacheKey || !this.shouldCache(request)) {
      return
    }

    try {
      const cache = getCache()
      const body = await response.text()
      
      const cacheData = {
        body,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status
      }

      await cache.set(
        context.cacheKey,
        cacheData,
        {
          ttl: this.config.cacheConfig.defaultTTL,
          tags: [this.extractCacheTag(request.url)]
        }
      )
    } catch (error) {
      console.error('Cache write error:', error)
    }
  }

  private shouldCache(request: NextRequest): boolean {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Check exclude paths
    if (this.config.cacheConfig.excludePaths.some(path => pathname.startsWith(path))) {
      return false
    }

    // Check include paths (if specified)
    if (this.config.cacheConfig.includePaths.length > 0) {
      return this.config.cacheConfig.includePaths.some(path => pathname.startsWith(path))
    }

    // Don't cache requests with authentication by default
    if (request.headers.get('Authorization')) {
      return false
    }

    return true
  }

  private generateCacheKey(request: NextRequest): string {
    const url = new URL(request.url)
    const baseKey = `api_cache:${request.method}:${url.pathname}:${url.search}`
    
    // Add vary headers to cache key
    const varyParts = this.config.cacheConfig.varyHeaders
      .map(header => `${header}:${request.headers.get(header) || ''}`)
      .join(':')
    
    return varyParts ? `${baseKey}:${varyParts}` : baseKey
  }

  private extractCacheTag(url: string): string {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/')
    return parts[2] || 'api' // e.g., /api/blood-requests -> blood-requests
  }

  private async handleCompression(
    request: NextRequest,
    response: NextResponse
  ): Promise<NextResponse> {
    const acceptEncoding = request.headers.get('Accept-Encoding') || ''
    const contentType = response.headers.get('Content-Type') || ''
    
    // Skip compression for excluded types
    if (this.config.compressionConfig.excludeTypes.some(type => contentType.startsWith(type))) {
      return response
    }

    // Check if client supports compression
    if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('br')) {
      return response
    }

    try {
      const body = await response.text()
      
      // Only compress if above threshold
      if (body.length < this.config.compressionConfig.threshold) {
        return response
      }

      // In a real implementation, you would use actual compression libraries
      // For now, we'll just add the headers to indicate compression would happen
      const compressedResponse = new NextResponse(body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'Content-Encoding': acceptEncoding.includes('br') ? 'br' : 'gzip',
          'Vary': 'Accept-Encoding'
        }
      })

      return compressedResponse
    } catch (error) {
      console.error('Compression error:', error)
      return response
    }
  }

  private addPerformanceHeaders(
    response: NextResponse,
    context: RequestContext,
    duration: number
  ): NextResponse {
    response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`)
    response.headers.set('X-Request-ID', context.requestId)
    
    if (context.cached) {
      response.headers.set('X-Cache', 'HIT')
    } else {
      response.headers.set('X-Cache', 'MISS')
    }

    return response
  }

  private async recordMetrics(
    request: NextRequest,
    response: NextResponse,
    context: RequestContext,
    duration: number
  ): Promise<void> {
    const url = new URL(request.url)
    
    performanceMonitor.recordAPIMetric({
      endpoint: url.pathname,
      method: request.method,
      duration,
      status: response.status,
      timestamp: Date.now(),
      userId: context.userId,
      cacheHit: context.cached
    })

    // Record custom metrics
    performanceMonitor.recordCustomMetric({
      name: 'api_request_duration',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        endpoint: url.pathname,
        method: request.method,
        status: response.status.toString(),
        cached: context.cached ? 'true' : 'false'
      }
    })
  }
}

// Singleton instance
let middlewareInstance: PerformanceMiddleware | null = null

export function createPerformanceMiddleware(config?: PerformanceMiddlewareConfig): PerformanceMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new PerformanceMiddleware(config)
  }
  return middlewareInstance
}

export function getPerformanceMiddleware(): PerformanceMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new PerformanceMiddleware()
  }
  return middlewareInstance
}

// Next.js middleware integration
export async function performanceMiddleware(request: NextRequest): Promise<NextResponse> {
  const middleware = getPerformanceMiddleware()
  
  // Handle request
  const earlyResponse = await middleware.handleRequest(request)
  if (earlyResponse) {
    return earlyResponse
  }

  // Continue to next handler
  const response = NextResponse.next()
  
  // Handle response
  return middleware.handleResponse(request, response)
}

// API route wrapper
export function withPerformanceMiddleware(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const middleware = getPerformanceMiddleware()
    
    // Pre-processing
    const earlyResponse = await middleware.handleRequest(request)
    if (earlyResponse) {
      return earlyResponse
    }

    // Execute handler
    const response = await handler(request)
    
    // Post-processing
    return middleware.handleResponse(request, response)
  }
}

export type { PerformanceMiddlewareConfig }
