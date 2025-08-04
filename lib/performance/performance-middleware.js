/**
 * Performance Optimization Middleware
 * 
 * Express.js middleware for performance optimization including
 * compression, caching, response optimization, and monitoring
 */

const compression = require('compression')
const { PerformanceMonitor } = require('./performance-monitor')
const { CacheManager } = require('./cache-manager')

class PerformanceMiddleware {
  constructor(config = {}) {
    this.config = {
      // Compression settings
      compression: {
        enabled: true,
        level: 6, // Compression level (1-9)
        threshold: 1024, // Minimum size to compress (bytes)
        filter: (req, res) => {
          // Don't compress if client doesn't support it
          if (req.headers['x-no-compression']) {
            return false
          }
          // Use compression filter
          return compression.filter(req, res)
        }
      },
      
      // Response optimization
      responseOptimization: {
        enableETag: true,
        enableLastModified: true,
        enableConditionalRequests: true,
        maxAge: 3600, // 1 hour default cache
        staleWhileRevalidate: 86400 // 24 hours
      },
      
      // Request optimization
      requestOptimization: {
        enableRequestId: true,
        enableTiming: true,
        enableMetrics: true,
        slowRequestThreshold: 1000 // 1 second
      },
      
      // Static asset optimization
      staticAssets: {
        enableCaching: true,
        maxAge: 31536000, // 1 year for static assets
        enableGzip: true,
        enableBrotli: true
      },
      
      // API response optimization
      apiOptimization: {
        enablePagination: true,
        defaultPageSize: 20,
        maxPageSize: 100,
        enableFieldSelection: true,
        enableResponseCompression: true
      },
      
      ...config
    }
    
    this.performanceMonitor = new PerformanceMonitor()
    this.cacheManager = new CacheManager()
    
    this.initialize()
  }

  async initialize() {
    console.log('⚡ Initializing Performance Middleware...')
    
    try {
      await this.performanceMonitor.initialize()
      await this.cacheManager.initialize()
      
      console.log('✅ Performance Middleware initialized')
    } catch (error) {
      console.error('❌ Performance Middleware initialization failed:', error)
      throw error
    }
  }

  // Main middleware stack
  getMiddlewareStack() {
    const middleware = []
    
    // Request timing and monitoring
    middleware.push(this.requestTimingMiddleware())
    
    // Compression middleware
    if (this.config.compression.enabled) {
      middleware.push(this.compressionMiddleware())
    }
    
    // Cache middleware
    middleware.push(this.cacheMiddleware())
    
    // Response optimization
    middleware.push(this.responseOptimizationMiddleware())
    
    // Static asset optimization
    middleware.push(this.staticAssetMiddleware())
    
    // API optimization
    middleware.push(this.apiOptimizationMiddleware())
    
    return middleware
  }

  // Request timing and monitoring middleware
  requestTimingMiddleware() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint()
      
      // Generate request ID
      if (this.config.requestOptimization.enableRequestId) {
        req.requestId = req.headers['x-request-id'] || 
                       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        res.setHeader('X-Request-ID', req.requestId)
      }
      
      // Start performance monitoring
      if (this.config.requestOptimization.enableMetrics) {
        this.performanceMonitor.startRequest(req.requestId, {
          method: req.method,
          path: req.path,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          userId: req.user?.id
        })
      }
      
      // Override res.end to capture response metrics
      const originalEnd = res.end
      res.end = function(chunk, encoding) {
        const endTime = process.hrtime.bigint()
        const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds
        
        // Add timing headers
        if (this.config.requestOptimization.enableTiming) {
          res.setHeader('X-Response-Time', `${duration}ms`)
          res.setHeader('Server-Timing', `total;dur=${duration}`)
        }
        
        // Record performance metrics
        if (this.config.requestOptimization.enableMetrics) {
          this.performanceMonitor.endRequest(req.requestId, {
            statusCode: res.statusCode,
            size: res.get('Content-Length') || (chunk ? chunk.length : 0),
            cached: res.get('X-Cache-Status') === 'HIT'
          })
        }
        
        // Log slow requests
        if (duration > this.config.requestOptimization.slowRequestThreshold) {
          console.warn(`⚠️  Slow request: ${req.method} ${req.path} - ${duration}ms`)
          this.performanceMonitor.emit('slow_request', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode
          })
        }
        
        originalEnd.call(this, chunk, encoding)
      }.bind(this)
      
      next()
    }
  }

  // Compression middleware
  compressionMiddleware() {
    return compression({
      level: this.config.compression.level,
      threshold: this.config.compression.threshold,
      filter: this.config.compression.filter,
      
      // Custom compression for different content types
      chunkSize: 16 * 1024, // 16KB chunks
      windowBits: 15,
      memLevel: 8,
      
      // Brotli compression for modern browsers
      brotli: {
        enabled: true,
        quality: 6,
        lgwin: 22
      }
    })
  }

  // Cache middleware
  cacheMiddleware() {
    return async (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next()
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(req)
      
      try {
        // Try to get cached response
        const cachedResponse = await this.cacheManager.get(cacheKey, {
          strategy: this.getCacheStrategy(req.path)
        })
        
        if (cachedResponse) {
          // Set cache headers
          res.setHeader('X-Cache-Status', 'HIT')
          res.setHeader('Cache-Control', `max-age=${this.config.responseOptimization.maxAge}`)
          
          // Set content type if available
          if (cachedResponse.contentType) {
            res.setHeader('Content-Type', cachedResponse.contentType)
          }
          
          // Set ETag if available
          if (cachedResponse.etag) {
            res.setHeader('ETag', cachedResponse.etag)
          }
          
          return res.json(cachedResponse.data)
        }
        
        // Cache miss - continue to route handler
        res.setHeader('X-Cache-Status', 'MISS')
        
        // Override res.json to cache the response
        const originalJson = res.json
        res.json = function(data) {
          // Cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const responseToCache = {
              data,
              contentType: res.get('Content-Type'),
              etag: res.get('ETag'),
              timestamp: new Date().toISOString()
            }
            
            // Cache asynchronously
            setImmediate(async () => {
              await this.cacheManager.set(cacheKey, responseToCache, {
                strategy: this.getCacheStrategy(req.path),
                dependencies: this.getCacheDependencies(req.path, data)
              })
            })
          }
          
          return originalJson.call(this, data)
        }.bind(this)
        
        next()
      } catch (error) {
        console.error('Cache middleware error:', error)
        next()
      }
    }
  }

  // Response optimization middleware
  responseOptimizationMiddleware() {
    return (req, res, next) => {
      // Enable ETag
      if (this.config.responseOptimization.enableETag) {
        res.setHeader('ETag', this.generateETag(req))
      }
      
      // Enable conditional requests
      if (this.config.responseOptimization.enableConditionalRequests) {
        const ifNoneMatch = req.headers['if-none-match']
        const etag = res.get('ETag')
        
        if (ifNoneMatch && etag && ifNoneMatch === etag) {
          return res.status(304).end()
        }
      }
      
      // Set cache control headers
      const cacheControl = this.getCacheControlHeader(req.path)
      if (cacheControl) {
        res.setHeader('Cache-Control', cacheControl)
      }
      
      // Set security headers for performance
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Frame-Options', 'DENY')
      
      next()
    }
  }

  // Static asset middleware
  staticAssetMiddleware() {
    return (req, res, next) => {
      // Check if request is for static assets
      const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(req.path)
      
      if (isStaticAsset && this.config.staticAssets.enableCaching) {
        // Set long-term caching for static assets
        res.setHeader('Cache-Control', `public, max-age=${this.config.staticAssets.maxAge}, immutable`)
        
        // Enable compression for compressible assets
        const compressibleAssets = /\.(js|css|svg)$/i.test(req.path)
        if (compressibleAssets) {
          res.setHeader('Vary', 'Accept-Encoding')
        }
        
        // Set CORS headers for fonts and other assets
        const fontAssets = /\.(woff|woff2|ttf|eot)$/i.test(req.path)
        if (fontAssets) {
          res.setHeader('Access-Control-Allow-Origin', '*')
        }
      }
      
      next()
    }
  }

  // API optimization middleware
  apiOptimizationMiddleware() {
    return (req, res, next) => {
      // Skip for non-API requests
      if (!req.path.startsWith('/api/')) {
        return next()
      }
      
      // Handle pagination
      if (this.config.apiOptimization.enablePagination && req.method === 'GET') {
        req.pagination = this.parsePaginationParams(req.query)
      }
      
      // Handle field selection
      if (this.config.apiOptimization.enableFieldSelection && req.query.fields) {
        req.fieldSelection = req.query.fields.split(',').map(field => field.trim())
      }
      
      // Override res.json for API response optimization
      const originalJson = res.json
      res.json = function(data) {
        let optimizedData = data
        
        // Apply field selection
        if (req.fieldSelection && typeof data === 'object') {
          optimizedData = this.applyFieldSelection(data, req.fieldSelection)
        }
        
        // Add pagination metadata
        if (req.pagination && Array.isArray(optimizedData)) {
          const paginatedData = this.applyPagination(optimizedData, req.pagination)
          optimizedData = {
            data: paginatedData.items,
            pagination: paginatedData.metadata
          }
        }
        
        // Add performance headers
        res.setHeader('X-API-Version', '2.0')
        res.setHeader('X-RateLimit-Remaining', '999') // Would be actual rate limit
        
        return originalJson.call(this, optimizedData)
      }.bind(this)
      
      next()
    }
  }

  // Utility methods
  generateCacheKey(req) {
    const baseKey = `${req.method}:${req.path}`
    const queryString = Object.keys(req.query).length > 0 ? 
                       JSON.stringify(req.query) : ''
    const userContext = req.user?.id || 'anonymous'
    
    return `${baseKey}:${queryString}:${userContext}`
  }

  getCacheStrategy(path) {
    if (path.startsWith('/api/donors')) return 'donor-list'
    if (path.startsWith('/api/inventory')) return 'blood-inventory'
    if (path.startsWith('/api/analytics')) return 'analytics-data'
    if (path.startsWith('/api/user')) return 'user-profile'
    return 'api-response'
  }

  getCacheDependencies(path, data) {
    const dependencies = []
    
    if (path.includes('/donors')) {
      dependencies.push('donors')
      if (data.id) dependencies.push(`donor:${data.id}`)
    }
    
    if (path.includes('/inventory')) {
      dependencies.push('inventory')
    }
    
    if (path.includes('/appointments')) {
      dependencies.push('appointments')
      if (data.donorId) dependencies.push(`donor:${data.donorId}`)
    }
    
    return dependencies
  }

  generateETag(req) {
    const crypto = require('crypto')
    const hash = crypto.createHash('md5')
    hash.update(`${req.method}${req.path}${JSON.stringify(req.query)}`)
    return `"${hash.digest('hex')}"`
  }

  getCacheControlHeader(path) {
    if (path.startsWith('/api/')) {
      return `public, max-age=${this.config.responseOptimization.maxAge}, stale-while-revalidate=${this.config.responseOptimization.staleWhileRevalidate}`
    }
    
    if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      return `public, max-age=${this.config.staticAssets.maxAge}, immutable`
    }
    
    return 'no-cache'
  }

  parsePaginationParams(query) {
    const page = Math.max(1, parseInt(query.page) || 1)
    const limit = Math.min(
      this.config.apiOptimization.maxPageSize,
      Math.max(1, parseInt(query.limit) || this.config.apiOptimization.defaultPageSize)
    )
    const offset = (page - 1) * limit
    
    return { page, limit, offset }
  }

  applyFieldSelection(data, fields) {
    if (Array.isArray(data)) {
      return data.map(item => this.selectFields(item, fields))
    } else if (typeof data === 'object' && data !== null) {
      return this.selectFields(data, fields)
    }
    
    return data
  }

  selectFields(obj, fields) {
    const selected = {}
    
    fields.forEach(field => {
      if (field.includes('.')) {
        // Handle nested fields
        const [parent, ...nested] = field.split('.')
        if (obj[parent]) {
          if (!selected[parent]) selected[parent] = {}
          selected[parent][nested.join('.')] = obj[parent][nested.join('.')]
        }
      } else if (obj.hasOwnProperty(field)) {
        selected[field] = obj[field]
      }
    })
    
    return selected
  }

  applyPagination(data, pagination) {
    const { offset, limit, page } = pagination
    const total = data.length
    const totalPages = Math.ceil(total / limit)
    const items = data.slice(offset, offset + limit)
    
    return {
      items,
      metadata: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  }

  // Performance monitoring methods
  getPerformanceMetrics() {
    return this.performanceMonitor.getMetricsSummary()
  }

  getCacheStatistics() {
    return this.cacheManager.getStatistics()
  }

  // Health check endpoint
  healthCheckMiddleware() {
    return async (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        performance: {
          monitor: this.performanceMonitor.getSystemStatus(),
          cache: this.cacheManager.getStatistics()
        }
      }
      
      res.json(health)
    }
  }

  async shutdown() {
    console.log('⚡ Shutting down Performance Middleware...')
    
    await this.performanceMonitor.shutdown()
    await this.cacheManager.shutdown()
  }
}

module.exports = {
  PerformanceMiddleware
}
