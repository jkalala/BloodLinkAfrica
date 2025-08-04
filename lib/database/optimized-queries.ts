/**
 * Optimized Database Query System
 * 
 * High-performance database operations with connection pooling,
 * query optimization, and performance monitoring
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { performanceMonitor } from '../performance/metrics'
import { getCache } from '../cache/redis-cache'

export interface QueryOptions {
  cache?: boolean
  cacheTTL?: number
  cacheKey?: string
  timeout?: number
  retries?: number
  explain?: boolean
}

export interface QueryResult<T> {
  data: T[]
  count?: number
  error?: string
  executionTime: number
  fromCache: boolean
  queryPlan?: any
}

export interface ConnectionPoolConfig {
  maxConnections: number
  idleTimeout: number
  connectionTimeout: number
  retryAttempts: number
}

class OptimizedDatabase {
  private client: SupabaseClient
  private connectionPool: Map<string, SupabaseClient> = new Map()
  private poolConfig: ConnectionPoolConfig
  private queryStats = new Map<string, { count: number; totalTime: number; avgTime: number }>()

  constructor() {
    this.poolConfig = {
      maxConnections: 10,
      idleTimeout: 30000,
      connectionTimeout: 5000,
      retryAttempts: 3
    }

    this.client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      }
    )

    this.initializeConnectionPool()
  }

  private initializeConnectionPool(): void {
    // Create initial connections
    for (let i = 0; i < this.poolConfig.maxConnections; i++) {
      const connectionId = `conn_${i}`
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
      this.connectionPool.set(connectionId, client)
    }
  }

  private getConnection(): SupabaseClient {
    // Simple round-robin connection selection
    const connections = Array.from(this.connectionPool.values())
    const index = Math.floor(Math.random() * connections.length)
    return connections[index] || this.client
  }

  async query<T>(
    tableName: string,
    queryBuilder: (query: any) => any,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = performance.now()
    const cacheKey = options.cacheKey || this.generateCacheKey(tableName, queryBuilder.toString())
    
    // Check cache first
    if (options.cache) {
      const cached = await this.getCachedResult<T>(cacheKey)
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          executionTime: performance.now() - startTime
        }
      }
    }

    const connection = this.getConnection()
    let result: QueryResult<T>

    try {
      // Execute query with timeout
      const queryPromise = this.executeQuery<T>(connection, tableName, queryBuilder, options)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), options.timeout || 30000)
      })

      const queryResult = await Promise.race([queryPromise, timeoutPromise])
      const executionTime = performance.now() - startTime

      result = {
        ...queryResult,
        executionTime,
        fromCache: false
      }

      // Cache successful results
      if (options.cache && !result.error) {
        await this.cacheResult(cacheKey, result, options.cacheTTL || 300)
      }

      // Record performance metrics
      this.recordQueryMetrics(tableName, executionTime, result.data?.length || 0)

    } catch (error) {
      const executionTime = performance.now() - startTime
      
      result = {
        data: [],
        error: (error as Error).message,
        executionTime,
        fromCache: false
      }

      // Record error metrics
      performanceMonitor.recordCustomMetric({
        name: 'database_query_error',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        tags: {
          table: tableName,
          error: (error as Error).message,
          type: 'error'
        }
      })
    }

    return result
  }

  private async executeQuery<T>(
    connection: SupabaseClient,
    tableName: string,
    queryBuilder: (query: any) => any,
    options: QueryOptions
  ): Promise<Omit<QueryResult<T>, 'executionTime' | 'fromCache'>> {
    let query = connection.from(tableName)
    
    // Apply query builder
    query = queryBuilder(query)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      throw new Error(error.message)
    }

    return {
      data: data || [],
      count,
      queryPlan: options.explain ? await this.getQueryPlan(tableName, queryBuilder) : undefined
    }
  }

  private async getQueryPlan(tableName: string, queryBuilder: Function): Promise<any> {
    try {
      // In a real implementation, you would use EXPLAIN ANALYZE
      // For Supabase, this would require a custom function or direct SQL
      return { plan: 'Query plan not available in Supabase client' }
    } catch (error) {
      return { error: 'Failed to get query plan' }
    }
  }

  private generateCacheKey(tableName: string, queryString: string): string {
    const hash = this.simpleHash(queryString)
    return `db_query:${tableName}:${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private async getCachedResult<T>(cacheKey: string): Promise<Omit<QueryResult<T>, 'fromCache' | 'executionTime'> | null> {
    try {
      const cache = getCache()
      return await cache.get(cacheKey)
    } catch (error) {
      console.error('Cache read error:', error)
      return null
    }
  }

  private async cacheResult<T>(
    cacheKey: string, 
    result: QueryResult<T>, 
    ttl: number
  ): Promise<void> {
    try {
      const cache = getCache()
      const cacheData = {
        data: result.data,
        count: result.count,
        queryPlan: result.queryPlan
      }
      await cache.set(cacheKey, cacheData, { ttl })
    } catch (error) {
      console.error('Cache write error:', error)
    }
  }

  private recordQueryMetrics(tableName: string, executionTime: number, recordCount: number): void {
    // Update internal stats
    const key = tableName
    const stats = this.queryStats.get(key) || { count: 0, totalTime: 0, avgTime: 0 }
    stats.count++
    stats.totalTime += executionTime
    stats.avgTime = stats.totalTime / stats.count
    this.queryStats.set(key, stats)

    // Record in performance monitor
    performanceMonitor.trackDatabaseQuery(
      `SELECT from ${tableName}`,
      executionTime,
      recordCount
    )
  }

  // Optimized query methods for common operations
  async findById<T>(
    tableName: string,
    id: string,
    options: QueryOptions = {}
  ): Promise<T | null> {
    const result = await this.query<T>(
      tableName,
      (query) => query.select('*').eq('id', id).single(),
      { cache: true, cacheTTL: 600, ...options }
    )

    return result.data[0] || null
  }

  async findMany<T>(
    tableName: string,
    filters: Record<string, any> = {},
    options: QueryOptions & {
      select?: string
      orderBy?: { column: string; ascending?: boolean }
      limit?: number
      offset?: number
    } = {}
  ): Promise<QueryResult<T>> {
    return this.query<T>(
      tableName,
      (query) => {
        let q = query.select(options.select || '*')

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            q = q.eq(key, value)
          }
        })

        // Apply ordering
        if (options.orderBy) {
          q = q.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true })
        }

        // Apply pagination
        if (options.limit) {
          q = q.limit(options.limit)
        }
        if (options.offset) {
          q = q.range(options.offset, (options.offset + (options.limit || 10)) - 1)
        }

        return q
      },
      options
    )
  }

  async create<T>(
    tableName: string,
    data: Partial<T>,
    options: QueryOptions = {}
  ): Promise<T | null> {
    const result = await this.query<T>(
      tableName,
      (query) => query.insert(data).select().single(),
      options
    )

    // Invalidate related cache entries
    if (result.data[0]) {
      await this.invalidateTableCache(tableName)
    }

    return result.data[0] || null
  }

  async update<T>(
    tableName: string,
    id: string,
    data: Partial<T>,
    options: QueryOptions = {}
  ): Promise<T | null> {
    const result = await this.query<T>(
      tableName,
      (query) => query.update(data).eq('id', id).select().single(),
      options
    )

    // Invalidate related cache entries
    if (result.data[0]) {
      await this.invalidateTableCache(tableName)
      await this.invalidateRecordCache(tableName, id)
    }

    return result.data[0] || null
  }

  async delete(
    tableName: string,
    id: string,
    options: QueryOptions = {}
  ): Promise<boolean> {
    const result = await this.query(
      tableName,
      (query) => query.delete().eq('id', id),
      options
    )

    // Invalidate related cache entries
    if (!result.error) {
      await this.invalidateTableCache(tableName)
      await this.invalidateRecordCache(tableName, id)
    }

    return !result.error
  }

  // Batch operations for better performance
  async batchInsert<T>(
    tableName: string,
    records: Partial<T>[],
    options: QueryOptions = {}
  ): Promise<T[]> {
    const batchSize = 100 // Supabase limit
    const results: T[] = []

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      const result = await this.query<T>(
        tableName,
        (query) => query.insert(batch).select(),
        options
      )

      if (result.data) {
        results.push(...result.data)
      }
    }

    // Invalidate table cache
    await this.invalidateTableCache(tableName)

    return results
  }

  async batchUpdate<T>(
    tableName: string,
    updates: Array<{ id: string; data: Partial<T> }>,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const results: T[] = []

    // Execute updates in parallel (with concurrency limit)
    const concurrency = 5
    for (let i = 0; i < updates.length; i += concurrency) {
      const batch = updates.slice(i, i + concurrency)
      
      const promises = batch.map(({ id, data }) =>
        this.update<T>(tableName, id, data, options)
      )

      const batchResults = await Promise.all(promises)
      results.push(...batchResults.filter(Boolean) as T[])
    }

    return results
  }

  // Cache invalidation
  private async invalidateTableCache(tableName: string): Promise<void> {
    try {
      const cache = getCache()
      await cache.invalidateByTag(tableName)
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  private async invalidateRecordCache(tableName: string, id: string): Promise<void> {
    try {
      const cache = getCache()
      const cacheKey = `db_query:${tableName}:${id}`
      await cache.delete(cacheKey)
    } catch (error) {
      console.error('Record cache invalidation error:', error)
    }
  }

  // Performance monitoring
  getQueryStats(): Map<string, { count: number; totalTime: number; avgTime: number }> {
    return new Map(this.queryStats)
  }

  async getSlowQueries(threshold: number = 1000): Promise<Array<{
    table: string
    avgTime: number
    count: number
  }>> {
    return Array.from(this.queryStats.entries())
      .filter(([_, stats]) => stats.avgTime > threshold)
      .map(([table, stats]) => ({
        table,
        avgTime: stats.avgTime,
        count: stats.count
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
  }

  // Connection pool management
  async closeConnections(): Promise<void> {
    // In a real implementation, you would properly close connections
    this.connectionPool.clear()
  }

  getConnectionPoolStatus(): {
    totalConnections: number
    activeConnections: number
    idleConnections: number
  } {
    return {
      totalConnections: this.connectionPool.size,
      activeConnections: this.connectionPool.size, // Simplified
      idleConnections: 0
    }
  }
}

// Singleton instance
let dbInstance: OptimizedDatabase | null = null

export function getOptimizedDB(): OptimizedDatabase {
  if (!dbInstance) {
    dbInstance = new OptimizedDatabase()
  }
  return dbInstance
}

// Query builder helpers
export const QueryBuilder = {
  bloodRequests: {
    active: () => (query: any) => 
      query.select('*').eq('status', 'active').order('created_at', { ascending: false }),
    
    byBloodType: (bloodType: string) => (query: any) =>
      query.select('*').eq('blood_type', bloodType).eq('status', 'active'),
    
    urgent: () => (query: any) =>
      query.select('*').in('urgency', ['high', 'critical']).eq('status', 'active'),
    
    withLocation: (lat: number, lng: number, radius: number) => (query: any) =>
      query.select('*').rpc('nearby_requests', { lat, lng, radius })
  },

  donors: {
    available: () => (query: any) =>
      query.select('*').eq('available', true).eq('verified', true),
    
    byBloodType: (bloodType: string) => (query: any) =>
      query.select('*').eq('blood_type', bloodType).eq('available', true),
    
    withStats: () => (query: any) =>
      query.select(`
        *,
        donor_responses(count),
        donations(count)
      `)
  }
}

export type { QueryOptions, QueryResult, ConnectionPoolConfig }
