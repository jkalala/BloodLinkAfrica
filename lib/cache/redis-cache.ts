/**
 * Advanced Redis Caching System
 * 
 * High-performance caching layer with intelligent TTL management,
 * cache warming, and performance monitoring
 */

import Redis from 'ioredis'
import { performanceMonitor } from '../performance/metrics'

export interface CacheConfig {
  host: string
  port: number
  password?: string
  db?: number
  keyPrefix?: string
  defaultTTL?: number
  maxRetries?: number
  retryDelayOnFailover?: number
}

export interface CacheOptions {
  ttl?: number
  tags?: string[]
  compress?: boolean
  serialize?: boolean
}

export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  hitRate: number
  avgResponseTime: number
}

class RedisCache {
  private client: Redis
  private config: CacheConfig
  private stats: CacheStats
  private isConnected: boolean = false

  constructor(config: CacheConfig) {
    this.config = {
      defaultTTL: 3600, // 1 hour
      maxRetries: 3,
      retryDelayOnFailover: 100,
      keyPrefix: 'bloodlink:',
      ...config
    }

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      avgResponseTime: 0
    }

    this.initializeRedis()
  }

  private initializeRedis(): void {
    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 0,
      keyPrefix: this.config.keyPrefix,
      maxRetriesPerRequest: this.config.maxRetries,
      retryDelayOnFailover: this.config.retryDelayOnFailover,
      lazyConnect: true,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
    })

    this.client.on('connect', () => {
      console.log('Redis cache connected')
      this.isConnected = true
    })

    this.client.on('error', (error) => {
      console.error('Redis cache error:', error)
      this.isConnected = false
    })

    this.client.on('close', () => {
      console.log('Redis cache connection closed')
      this.isConnected = false
    })
  }

  private buildKey(key: string, tags?: string[]): string {
    const baseKey = key.replace(/[^a-zA-Z0-9:_-]/g, '_')
    return tags ? `${baseKey}:${tags.join(':')}` : baseKey
  }

  private serialize(data: any, compress: boolean = false): string {
    const serialized = JSON.stringify(data)
    
    if (compress && serialized.length > 1000) {
      // In a real implementation, you'd use a compression library like zlib
      // For now, we'll just return the serialized data
      return serialized
    }
    
    return serialized
  }

  private deserialize(data: string): any {
    try {
      return JSON.parse(data)
    } catch (error) {
      console.error('Cache deserialization error:', error)
      return null
    }
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    const startTime = performance.now()
    const cacheKey = this.buildKey(key, options?.tags)

    try {
      const cached = await this.client.get(cacheKey)
      const duration = performance.now() - startTime

      if (cached) {
        this.stats.hits++
        performanceMonitor.trackCacheOperation('hit', key, duration)
        
        const data = options?.serialize !== false ? this.deserialize(cached) : cached
        return data as T
      } else {
        this.stats.misses++
        performanceMonitor.trackCacheOperation('miss', key, duration)
        return null
      }
    } catch (error) {
      console.error('Cache get error:', error)
      performanceMonitor.trackCacheOperation('miss', key, performance.now() - startTime)
      return null
    } finally {
      this.updateStats()
    }
  }

  async set(
    key: string, 
    value: any, 
    options?: CacheOptions
  ): Promise<boolean> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    const startTime = performance.now()
    const cacheKey = this.buildKey(key, options?.tags)
    const ttl = options?.ttl || this.config.defaultTTL!

    try {
      const serializedValue = options?.serialize !== false 
        ? this.serialize(value, options?.compress)
        : value

      await this.client.setex(cacheKey, ttl, serializedValue)
      
      // Set tags for cache invalidation
      if (options?.tags) {
        await this.setTags(cacheKey, options.tags)
      }

      this.stats.sets++
      const duration = performance.now() - startTime
      performanceMonitor.trackCacheOperation('set', key, duration)
      
      return true
    } catch (error) {
      console.error('Cache set error:', error)
      return false
    }
  }

  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    const cacheKey = this.buildKey(key, options?.tags)

    try {
      const result = await this.client.del(cacheKey)
      
      if (result > 0) {
        this.stats.deletes++
        return true
      }
      return false
    } catch (error) {
      console.error('Cache delete error:', error)
      return false
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    try {
      const tagKey = `tag:${tag}`
      const keys = await this.client.smembers(tagKey)
      
      if (keys.length === 0) return 0

      const pipeline = this.client.pipeline()
      keys.forEach(key => pipeline.del(key))
      pipeline.del(tagKey)
      
      const results = await pipeline.exec()
      const deletedCount = results?.filter(([err, result]) => !err && result === 1).length || 0
      
      return deletedCount
    } catch (error) {
      console.error('Cache invalidate by tag error:', error)
      return 0
    }
  }

  private async setTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline()
    
    tags.forEach(tag => {
      const tagKey = `tag:${tag}`
      pipeline.sadd(tagKey, key)
      pipeline.expire(tagKey, this.config.defaultTTL! * 2) // Tags live longer than cache
    })
    
    await pipeline.exec()
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    try {
      const cacheKeys = keys.map(key => this.buildKey(key))
      const results = await this.client.mget(...cacheKeys)
      
      return results.map(result => {
        if (result) {
          this.stats.hits++
          return this.deserialize(result) as T
        } else {
          this.stats.misses++
          return null
        }
      })
    } catch (error) {
      console.error('Cache mget error:', error)
      return keys.map(() => null)
    } finally {
      this.updateStats()
    }
  }

  async mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    try {
      const pipeline = this.client.pipeline()
      
      items.forEach(({ key, value, ttl }) => {
        const cacheKey = this.buildKey(key)
        const serializedValue = this.serialize(value)
        const cacheTTL = ttl || this.config.defaultTTL!
        
        pipeline.setex(cacheKey, cacheTTL, serializedValue)
      })
      
      await pipeline.exec()
      this.stats.sets += items.length
      
      return true
    } catch (error) {
      console.error('Cache mset error:', error)
      return false
    }
  }

  // Cache warming for frequently accessed data
  async warmCache(warmingStrategies: Array<{
    key: string
    dataLoader: () => Promise<any>
    ttl?: number
    tags?: string[]
  }>): Promise<void> {
    console.log('Starting cache warming...')
    
    const promises = warmingStrategies.map(async ({ key, dataLoader, ttl, tags }) => {
      try {
        const data = await dataLoader()
        await this.set(key, data, { ttl, tags })
        console.log(`Cache warmed for key: ${key}`)
      } catch (error) {
        console.error(`Cache warming failed for key ${key}:`, error)
      }
    })
    
    await Promise.allSettled(promises)
    console.log('Cache warming completed')
  }

  // Intelligent cache preloading based on usage patterns
  async preloadPopularData(): Promise<void> {
    const popularKeys = [
      'blood_requests:active',
      'donors:available',
      'analytics:dashboard:today',
      'blood_types:compatibility_matrix'
    ]

    const dataLoaders = {
      'blood_requests:active': async () => {
        // Load active blood requests
        const response = await fetch('/api/blood-requests?status=active&limit=50')
        return response.json()
      },
      'donors:available': async () => {
        // Load available donors
        const response = await fetch('/api/donors?available=true&limit=100')
        return response.json()
      },
      'analytics:dashboard:today': async () => {
        // Load today's analytics
        const response = await fetch('/api/analytics/dashboard?period=day')
        return response.json()
      },
      'blood_types:compatibility_matrix': async () => {
        // Load blood type compatibility matrix
        return {
          'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
          'O+': ['O+', 'A+', 'B+', 'AB+'],
          'A-': ['A-', 'A+', 'AB-', 'AB+'],
          'A+': ['A+', 'AB+'],
          'B-': ['B-', 'B+', 'AB-', 'AB+'],
          'B+': ['B+', 'AB+'],
          'AB-': ['AB-', 'AB+'],
          'AB+': ['AB+']
        }
      }
    }

    const warmingStrategies = popularKeys.map(key => ({
      key,
      dataLoader: dataLoaders[key as keyof typeof dataLoaders],
      ttl: 1800, // 30 minutes
      tags: [key.split(':')[0]]
    }))

    await this.warmCache(warmingStrategies)
  }

  // Cache-aside pattern implementation
  async getOrSet<T>(
    key: string,
    dataLoader: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options)
    
    if (cached !== null) {
      return cached
    }

    // Load data and cache it
    try {
      const data = await dataLoader()
      await this.set(key, data, options)
      return data
    } catch (error) {
      console.error('Data loader error:', error)
      throw error
    }
  }

  // Write-through cache pattern
  async setAndPersist<T>(
    key: string,
    value: T,
    persistFunction: (value: T) => Promise<void>,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      // Persist to database first
      await persistFunction(value)
      
      // Then cache the value
      return await this.set(key, value, options)
    } catch (error) {
      console.error('Write-through cache error:', error)
      return false
    }
  }

  // Cache statistics and monitoring
  getStats(): CacheStats {
    return { ...this.stats }
  }

  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
  }

  async getMemoryUsage(): Promise<{
    used_memory: string
    used_memory_human: string
    used_memory_peak: string
    used_memory_peak_human: string
  }> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    try {
      const info = await this.client.info('memory')
      const lines = info.split('\r\n')
      const memoryInfo: any = {}

      lines.forEach(line => {
        const [key, value] = line.split(':')
        if (key && value) {
          memoryInfo[key] = value
        }
      })

      return {
        used_memory: memoryInfo.used_memory || '0',
        used_memory_human: memoryInfo.used_memory_human || '0B',
        used_memory_peak: memoryInfo.used_memory_peak || '0',
        used_memory_peak_human: memoryInfo.used_memory_peak_human || '0B'
      }
    } catch (error) {
      console.error('Memory usage error:', error)
      return {
        used_memory: '0',
        used_memory_human: '0B',
        used_memory_peak: '0',
        used_memory_peak_human: '0B'
      }
    }
  }

  async flush(): Promise<boolean> {
    if (!this.isConnected) {
      await this.client.connect()
    }

    try {
      await this.client.flushdb()
      this.resetStats()
      return true
    } catch (error) {
      console.error('Cache flush error:', error)
      return false
    }
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      avgResponseTime: 0
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.isConnected = false
    }
  }
}

// Singleton cache instance
let cacheInstance: RedisCache | null = null

export function createCache(config: CacheConfig): RedisCache {
  if (!cacheInstance) {
    cacheInstance = new RedisCache(config)
  }
  return cacheInstance
}

export function getCache(): RedisCache {
  if (!cacheInstance) {
    throw new Error('Cache not initialized. Call createCache() first.')
  }
  return cacheInstance
}

// Cache decorators for functions
export function cached(
  keyGenerator: (...args: any[]) => string,
  options?: CacheOptions
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cache = getCache()
      const key = keyGenerator(...args)
      
      return cache.getOrSet(
        key,
        () => method.apply(this, args),
        options
      )
    }
  }
}

// Export types
export type { CacheConfig, CacheOptions, CacheStats }
