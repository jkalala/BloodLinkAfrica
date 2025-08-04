/**
 * Redis-based Rate Limiting System
 * Provides scalable, distributed rate limiting with sliding window algorithms
 */

import { getFeatureFlags } from './env-validation'
import Redis from 'ioredis'

// Rate limiting configuration types
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (identifier: string) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  message?: string
}

// Rate limiting result
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
  totalHits: number
}

// Rate limiting strategies
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket'
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // Authentication endpoints
  LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
  SIGNUP: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 signups per hour
  PASSWORD_RESET: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 resets per hour
  
  // API endpoints
  API_GENERAL: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  API_STRICT: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 requests per minute
  API_SENSITIVE: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
  
  // Messaging endpoints
  SMS_SEND: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 SMS per minute
  WHATSAPP_SEND: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 WhatsApp per minute
  EMAIL_SEND: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 emails per minute
  
  // File operations
  FILE_UPLOAD: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 uploads per minute
  FILE_DOWNLOAD: { windowMs: 60 * 1000, maxRequests: 50 }, // 50 downloads per minute
  
  // Verification codes
  VERIFY_CODE_REQUEST: { windowMs: 60 * 1000, maxRequests: 3 }, // 3 codes per minute
  VERIFY_CODE_ATTEMPT: { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 attempts per 15 min
  
  // Search and data access
  SEARCH: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 searches per minute
  DATA_EXPORT: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 exports per hour
} as const

// In-memory fallback store (when Redis is not available)
class MemoryStore {
  private store = new Map<string, { count: number; resetTime: number; requests: number[] }>()

  async get(key: string): Promise<{ count: number; resetTime: number; requests: number[] } | null> {
    return this.store.get(key) || null
  }

  async set(key: string, value: { count: number; resetTime: number; requests: number[] }, ttlMs: number): Promise<void> {
    this.store.set(key, value)
    
    // Clean up expired entries
    setTimeout(() => {
      this.store.delete(key)
    }, ttlMs)
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    const existing = this.store.get(key)
    
    if (!existing || now > existing.resetTime) {
      const newEntry = {
        count: 1,
        resetTime: now + windowMs,
        requests: [now]
      }
      this.store.set(key, newEntry)
      return 1
    }
    
    existing.count++
    existing.requests.push(now)
    return existing.count
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key)
      }
    }
  }
}

// Redis store (when available)
class RedisStore {
  private redis: Redis | null

  constructor() {
    // Dynamically import Redis only if available
    this.initializeRedis()
  }

  private async initializeRedis() {
    try {
      const { hasRedis } = getFeatureFlags()
      if (!hasRedis) {
        console.info('Redis not configured, falling back to memory store')
        return
      }

      // Dynamic import to avoid dependency when Redis is not available
      const Redis = await import('ioredis')
      this.redis = new Redis.default(process.env.REDIS_URL!, {
        retryDelayOnFailure: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      })

      this.redis.on('error', (error: unknown) => {
        console.error('Redis connection error:', error)
        this.redis = null // Fall back to memory store
      })

      this.redis.on('connect', () => {
        console.info('Redis connected for rate limiting')
      })

    } catch (error) {
      console.warn('Redis not available, using memory store for rate limiting:', error)
      this.redis = null
    }
  }

  async get(key: string): Promise<{ count: number; resetTime: number; requests: number[] } | null> {
    if (!this.redis) return null

    try {
      const data = await this.redis.hgetall(key)
      if (!data.count) return null

      return {
        count: parseInt(data.count),
        resetTime: parseInt(data.resetTime),
        requests: data.requests ? JSON.parse(data.requests) : []
      }
    } catch (error) {
      console.error('Redis get error:', error)
      return null
    }
  }

  async set(key: string, value: { count: number; resetTime: number; requests: number[] }, ttlMs: number): Promise<void> {
    if (!this.redis) return

    try {
      const pipeline = this.redis.pipeline()
      pipeline.hset(key, {
        count: value.count,
        resetTime: value.resetTime,
        requests: JSON.stringify(value.requests)
      })
      pipeline.pexpire(key, ttlMs)
      await pipeline.exec()
    } catch (error) {
      console.error('Redis set error:', error)
    }
  }

  async increment(key: string, windowMs: number): Promise<number> {
    if (!this.redis) return 0

    try {
      const now = Date.now()
      const resetTime = now + windowMs

      // Use Lua script for atomic increment
      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local windowMs = tonumber(ARGV[2])
        local resetTime = now + windowMs

        local current = redis.call('HGETALL', key)
        local count = 0
        local existingResetTime = 0

        if #current > 0 then
          for i = 1, #current, 2 do
            if current[i] == 'count' then
              count = tonumber(current[i + 1])
            elseif current[i] == 'resetTime' then
              existingResetTime = tonumber(current[i + 1])
            end
          end
        end

        if existingResetTime == 0 or now > existingResetTime then
          count = 1
          redis.call('HSET', key, 'count', count, 'resetTime', resetTime)
          redis.call('PEXPIRE', key, windowMs)
        else
          count = count + 1
          redis.call('HSET', key, 'count', count)
        end

        return count
      `

      const result = await this.redis.eval(luaScript, 1, key, now, windowMs)
      return parseInt(result)
    } catch (error) {
      console.error('Redis increment error:', error)
      return 0
    }
  }
}

// Rate limiter class
export class RateLimiter {
  private store: MemoryStore | RedisStore
  private memoryFallback: MemoryStore

  constructor() {
    this.memoryFallback = new MemoryStore()
    this.store = new RedisStore()

    // Cleanup memory store periodically
    setInterval(() => {
      this.memoryFallback.cleanup()
    }, 60000) // Cleanup every minute
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig,
    strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW
  ): Promise<RateLimitResult> {
    const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier
    const now = Date.now()

    try {
      switch (strategy) {
        case RateLimitStrategy.SLIDING_WINDOW:
          return await this.slidingWindowCheck(key, config, now)
        case RateLimitStrategy.FIXED_WINDOW:
          return await this.fixedWindowCheck(key, config, now)
        case RateLimitStrategy.TOKEN_BUCKET:
          return await this.tokenBucketCheck(key, config, now)
        default:
          return await this.slidingWindowCheck(key, config, now)
      }
    } catch (error) {
      console.error('Rate limit check error:', error)
      
      // Fallback to memory store
      return await this.fallbackCheck(key, config, now)
    }
  }

  /**
   * Sliding window rate limiting
   */
  private async slidingWindowCheck(key: string, config: RateLimitConfig, now: number): Promise<RateLimitResult> {
    const windowStart = now - config.windowMs
    const store = this.store instanceof RedisStore ? this.store : this.memoryFallback

    // Get current data
    let data = await store.get(key)
    
    if (!data) {
      data = { count: 0, resetTime: now + config.windowMs, requests: [] }
    }

    // Filter requests within current window
    const requestsInWindow = data.requests.filter(timestamp => timestamp > windowStart)
    const currentCount = requestsInWindow.length

    // Check if limit exceeded
    if (currentCount >= config.maxRequests) {
      const oldestRequest = Math.min(...requestsInWindow)
      const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000)

      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: oldestRequest + config.windowMs,
        retryAfter,
        totalHits: currentCount + 1
      }
    }

    // Add current request
    requestsInWindow.push(now)
    const newData = {
      count: requestsInWindow.length,
      resetTime: now + config.windowMs,
      requests: requestsInWindow
    }

    await store.set(key, newData, config.windowMs)

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - requestsInWindow.length,
      resetTime: now + config.windowMs,
      totalHits: requestsInWindow.length
    }
  }

  /**
   * Fixed window rate limiting
   */
  private async fixedWindowCheck(key: string, config: RateLimitConfig, now: number): Promise<RateLimitResult> {
    const store = this.store instanceof RedisStore ? this.store : this.memoryFallback
    const count = await store.increment(key, config.windowMs)

    if (count > config.maxRequests) {
      const data = await store.get(key)
      const retryAfter = data ? Math.ceil((data.resetTime - now) / 1000) : Math.ceil(config.windowMs / 1000)

      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: data?.resetTime || now + config.windowMs,
        retryAfter,
        totalHits: count
      }
    }

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - count,
      resetTime: now + config.windowMs,
      totalHits: count
    }
  }

  /**
   * Token bucket rate limiting
   */
  private async tokenBucketCheck(key: string, config: RateLimitConfig, now: number): Promise<RateLimitResult> {
    const store = this.store instanceof RedisStore ? this.store : this.memoryFallback
    
    let data = await store.get(key)
    
    if (!data) {
      data = { 
        count: config.maxRequests - 1, // Start with max tokens minus one (for current request)
        resetTime: now + config.windowMs,
        requests: [now]
      }
      await store.set(key, data, config.windowMs)
      
      return {
        success: true,
        limit: config.maxRequests,
        remaining: data.count,
        resetTime: data.resetTime,
        totalHits: 1
      }
    }

    // Calculate tokens to add based on time passed
    const timePassed = now - (data.resetTime - config.windowMs)
    const tokensToAdd = Math.floor(timePassed / (config.windowMs / config.maxRequests))
    const currentTokens = Math.min(config.maxRequests, data.count + tokensToAdd)

    if (currentTokens <= 0) {
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: data.resetTime,
        retryAfter: Math.ceil((config.windowMs / config.maxRequests) / 1000),
        totalHits: data.requests.length + 1
      }
    }

    // Consume one token
    const newData = {
      count: currentTokens - 1,
      resetTime: now + config.windowMs,
      requests: [...data.requests.slice(-9), now] // Keep last 10 requests
    }

    await store.set(key, newData, config.windowMs)

    return {
      success: true,
      limit: config.maxRequests,
      remaining: newData.count,
      resetTime: newData.resetTime,
      totalHits: newData.requests.length
    }
  }

  /**
   * Fallback check using memory store
   */
  private async fallbackCheck(key: string, config: RateLimitConfig, now: number): Promise<RateLimitResult> {
    const count = await this.memoryFallback.increment(key, config.windowMs)

    if (count > config.maxRequests) {
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: now + config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000),
        totalHits: count
      }
    }

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - count,
      resetTime: now + config.windowMs,
      totalHits: count
    }
  }

  /**
   * Get current usage for an identifier
   */
  async getUsage(identifier: string, config: RateLimitConfig): Promise<{
    count: number
    limit: number
    remaining: number
    resetTime: number
  }> {
    const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier
    const store = this.store instanceof RedisStore ? this.store : this.memoryFallback
    
    const data = await store.get(key)
    
    if (!data) {
      return {
        count: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs
      }
    }

    return {
      count: data.count,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - data.count),
      resetTime: data.resetTime
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, config: RateLimitConfig): Promise<void> {
    const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier
    
    try {
      if (this.store instanceof RedisStore && this.store.redis) {
        await this.store.redis.del(key)
      } else {
        this.memoryFallback.store.delete(key)
      }
    } catch (error) {
      console.error('Rate limit reset error:', error)
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()

// Convenience functions
export const checkRateLimit = (identifier: string, config: RateLimitConfig, strategy?: RateLimitStrategy) =>
  rateLimiter.checkLimit(identifier, config, strategy)

export const getRateLimitUsage = (identifier: string, config: RateLimitConfig) =>
  rateLimiter.getUsage(identifier, config)

export const resetRateLimit = (identifier: string, config: RateLimitConfig) =>
  rateLimiter.reset(identifier, config)

// Key generators for different use cases
export const keyGenerators = {
  byIP: (ip: string) => `ip:${ip}`,
  byUser: (userId: string) => `user:${userId}`,
  byUserAndIP: (userId: string, ip: string) => `user:${userId}:ip:${ip}`,
  byEndpoint: (endpoint: string, identifier: string) => `endpoint:${endpoint}:${identifier}`,
  byAction: (action: string, identifier: string) => `action:${action}:${identifier}`
}

// Rate limit middleware helper
export const createRateLimitKey = (req: Request, userId?: string): string => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
            req.headers.get('x-real-ip') || 
            'unknown'
  
  if (userId) {
    return keyGenerators.byUserAndIP(userId, ip)
  }
  
  return keyGenerators.byIP(ip)
}