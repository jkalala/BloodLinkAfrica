/**
 * Comprehensive Performance System Tests
 * 
 * Complete test suite for performance monitoring, caching,
 * code splitting, and optimization systems
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals')
const { ComprehensivePerformanceSystem } = require('../../lib/performance')

describe('Comprehensive Performance System', () => {
  let performanceSystem
  let testConfig

  beforeAll(async () => {
    testConfig = {
      enableMonitoring: true,
      enableCaching: true,
      enableCodeSplitting: true,
      enableMiddleware: true,
      
      performanceTargets: {
        responseTime: 500,
        throughput: 100,
        errorRate: 0.05,
        cacheHitRate: 0.7,
        bundleSize: 500000
      },
      
      monitoring: {
        metricsInterval: 1000, // Faster for tests
        retentionPeriod: 60000 // 1 minute for tests
      },
      
      caching: {
        enableMemoryCache: true,
        enableRedisCache: false, // Disable Redis for tests
        enableCDNCache: false,
        defaultTTL: 30000 // 30 seconds for tests
      }
    }

    performanceSystem = new ComprehensivePerformanceSystem(testConfig)
    await performanceSystem.initialize()
  })

  afterAll(async () => {
    if (performanceSystem) {
      await performanceSystem.shutdown()
    }
  })

  describe('System Initialization', () => {
    test('should initialize all performance systems', () => {
      const status = performanceSystem.getSystemStatus()
      
      expect(status.active).toBe(true)
      expect(status.systems.monitor).toBeDefined()
      expect(status.systems.cache).toBeDefined()
      expect(status.systems.codeSplitting).toBeDefined()
      expect(status.systems.middleware).toBeDefined()
    })

    test('should have correct configuration', () => {
      expect(performanceSystem.config.performanceTargets.responseTime).toBe(500)
      expect(performanceSystem.config.enableMonitoring).toBe(true)
      expect(performanceSystem.config.enableCaching).toBe(true)
    })
  })

  describe('Performance Monitoring', () => {
    test('should record and complete requests', async () => {
      const requestId = await performanceSystem.recordRequest('test-request-1', {
        method: 'GET',
        path: '/api/donors',
        userId: 'test-user'
      })
      
      expect(requestId).toBeDefined()
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const metrics = await performanceSystem.completeRequest(requestId, {
        statusCode: 200,
        size: 1024
      })
      
      expect(metrics).toBeDefined()
      expect(metrics.duration).toBeGreaterThan(90)
      expect(metrics.response.statusCode).toBe(200)
    })

    test('should track multiple concurrent requests', async () => {
      const requests = []
      
      // Start multiple requests
      for (let i = 0; i < 5; i++) {
        const requestId = await performanceSystem.recordRequest(`concurrent-${i}`, {
          method: 'GET',
          path: `/api/test/${i}`,
          userId: 'test-user'
        })
        requests.push(requestId)
      }
      
      expect(requests).toHaveLength(5)
      
      // Complete all requests
      const completions = await Promise.all(
        requests.map(id => performanceSystem.completeRequest(id, { statusCode: 200 }))
      )
      
      expect(completions).toHaveLength(5)
      completions.forEach(completion => {
        expect(completion.duration).toBeGreaterThan(0)
      })
    })

    test('should generate performance analysis', async () => {
      // Record some test requests first
      for (let i = 0; i < 3; i++) {
        const requestId = await performanceSystem.recordRequest(`analysis-${i}`, {
          method: 'GET',
          path: '/api/analysis'
        })
        await performanceSystem.completeRequest(requestId, { statusCode: 200 })
      }
      
      const analysis = await performanceSystem.analyzePerformance()
      
      expect(analysis).toBeDefined()
      expect(analysis.timestamp).toBeDefined()
      expect(analysis.monitoring).toBeDefined()
      expect(analysis.overall).toBeDefined()
      expect(analysis.overall.score).toBeGreaterThanOrEqual(0)
      expect(analysis.overall.score).toBeLessThanOrEqual(100)
    })
  })

  describe('Caching System', () => {
    test('should cache and retrieve data', async () => {
      const testData = { id: 1, name: 'Test Data', timestamp: Date.now() }
      const cacheKey = 'test-cache-key'
      
      // Cache data
      const cacheResult = await performanceSystem.cacheData(cacheKey, testData, {
        strategy: 'api-response'
      })
      
      expect(cacheResult).toBeDefined()
      
      // Retrieve cached data
      const cachedData = await performanceSystem.getCachedData(cacheKey)
      
      expect(cachedData).toEqual(testData)
    })

    test('should handle cache misses', async () => {
      const nonExistentKey = 'non-existent-key-' + Date.now()
      
      const cachedData = await performanceSystem.getCachedData(nonExistentKey)
      
      expect(cachedData).toBeNull()
    })

    test('should cache with different strategies', async () => {
      const strategies = ['user-profile', 'donor-list', 'blood-inventory']
      
      for (const strategy of strategies) {
        const data = { strategy, data: `test-data-${strategy}` }
        const key = `test-${strategy}`
        
        await performanceSystem.cacheData(key, data, { strategy })
        const retrieved = await performanceSystem.getCachedData(key, { strategy })
        
        expect(retrieved).toEqual(data)
      }
    })

    test('should track cache statistics', async () => {
      const cache = performanceSystem.systems.get('cache')
      const initialStats = cache.getStatistics()
      
      // Perform cache operations
      await performanceSystem.cacheData('stats-test-1', { data: 'test1' })
      await performanceSystem.getCachedData('stats-test-1')
      await performanceSystem.getCachedData('non-existent-stats')
      
      const finalStats = cache.getStatistics()
      
      expect(finalStats.sets.memory).toBeGreaterThan(initialStats.sets.memory)
      expect(finalStats.hits.memory).toBeGreaterThan(initialStats.hits.memory)
      expect(finalStats.misses.memory).toBeGreaterThan(initialStats.misses.memory)
    })
  })

  describe('Performance Middleware', () => {
    test('should provide middleware stack', () => {
      const middleware = performanceSystem.getPerformanceMiddleware()
      
      expect(middleware).toBeInstanceOf(Array)
      expect(middleware.length).toBeGreaterThan(0)
      
      // Each middleware should be a function
      middleware.forEach(mw => {
        expect(typeof mw).toBe('function')
      })
    })

    test('should handle middleware configuration', () => {
      const middlewareSystem = performanceSystem.systems.get('middleware')
      
      expect(middlewareSystem).toBeDefined()
      expect(middlewareSystem.config).toBeDefined()
      expect(middlewareSystem.config.compression.enabled).toBeDefined()
    })
  })

  describe('Code Splitting Optimization', () => {
    test('should generate route splitting configuration', () => {
      const codeSplitting = performanceSystem.systems.get('codeSplitting')
      
      expect(codeSplitting).toBeDefined()
      
      const routeSplitting = codeSplitting.generateRouteSplitting()
      
      expect(routeSplitting).toBeDefined()
      expect(typeof routeSplitting).toBe('object')
    })

    test('should generate component splitting strategies', () => {
      const codeSplitting = performanceSystem.systems.get('codeSplitting')
      
      const componentSplitting = codeSplitting.generateComponentSplitting()
      
      expect(componentSplitting).toBeDefined()
      expect(typeof componentSplitting).toBe('object')
    })

    test('should generate vendor splitting configuration', () => {
      const codeSplitting = performanceSystem.systems.get('codeSplitting')
      
      const vendorSplitting = codeSplitting.generateVendorSplitting()
      
      expect(vendorSplitting).toBeDefined()
      expect(vendorSplitting.optimization).toBeDefined()
      expect(vendorSplitting.optimization.splitChunks).toBeDefined()
    })

    test('should generate optimization report', () => {
      const codeSplitting = performanceSystem.systems.get('codeSplitting')
      
      const report = codeSplitting.getOptimizationReport()
      
      expect(report).toBeDefined()
      expect(report.bundleAnalysis).toBeDefined()
      expect(report.performanceMetrics).toBeDefined()
      expect(report.timestamp).toBeDefined()
    })
  })

  describe('Performance Targets and Alerts', () => {
    test('should check performance targets', async () => {
      const violations = await performanceSystem.checkPerformanceTargets()
      
      expect(violations).toBeInstanceOf(Array)
      // Violations array can be empty if all targets are met
    })

    test('should handle performance alerts', (done) => {
      performanceSystem.once('performance:alert', (alert) => {
        expect(alert).toBeDefined()
        expect(alert.id).toBeDefined()
        expect(alert.type).toBeDefined()
        expect(alert.severity).toBeDefined()
        expect(alert.timestamp).toBeDefined()
        done()
      })
      
      // Trigger an alert
      performanceSystem.handlePerformanceAlert('test_alert', {
        severity: 'warning',
        message: 'Test alert message',
        data: { test: true }
      })
    })

    test('should generate optimization recommendations', async () => {
      const recommendations = await performanceSystem.generateOptimizationRecommendations()
      
      expect(recommendations).toBeInstanceOf(Array)
      
      // If there are recommendations, they should have the correct structure
      recommendations.forEach(rec => {
        expect(rec.category).toBeDefined()
        expect(rec.priority).toBeDefined()
        expect(rec.title).toBeDefined()
        expect(rec.description).toBeDefined()
        expect(rec.suggestions).toBeInstanceOf(Array)
      })
    })
  })

  describe('System Integration', () => {
    test('should integrate monitoring with caching', async () => {
      // Record a request that should trigger caching logic
      const requestId = await performanceSystem.recordRequest('integration-test', {
        method: 'GET',
        path: '/api/integration',
        userId: 'test-user'
      })
      
      await performanceSystem.completeRequest(requestId, {
        statusCode: 200,
        size: 512
      })
      
      // The integration should work without errors
      expect(requestId).toBeDefined()
    })

    test('should record custom metrics', () => {
      performanceSystem.recordMetric('test_metric', 42, { tag: 'test' })
      performanceSystem.recordMetric('test_metric', 84, { tag: 'test2' })
      
      const metrics = performanceSystem.metrics.get('test_metric')
      
      expect(metrics).toBeDefined()
      expect(metrics).toHaveLength(2)
      expect(metrics[0].value).toBe(42)
      expect(metrics[1].value).toBe(84)
    })

    test('should maintain system status', () => {
      const status = performanceSystem.getSystemStatus()
      
      expect(status.active).toBe(true)
      expect(status.systems).toBeDefined()
      expect(status.metrics).toBeGreaterThanOrEqual(0)
      expect(status.uptime).toBeGreaterThan(0)
    })
  })

  describe('Performance Reporting', () => {
    test('should generate comprehensive performance report', async () => {
      const report = await performanceSystem.generatePerformanceReport()
      
      expect(report).toBeDefined()
      expect(report.timestamp).toBeDefined()
      expect(report.analysis).toBeDefined()
      expect(report.recommendations).toBeDefined()
      expect(report.systemStatus).toBeDefined()
      expect(report.performanceTargets).toBeDefined()
    })

    test('should include performance analysis in report', async () => {
      const report = await performanceSystem.generatePerformanceReport()
      
      expect(report.analysis.overall).toBeDefined()
      expect(report.analysis.overall.score).toBeGreaterThanOrEqual(0)
      expect(report.analysis.overall.score).toBeLessThanOrEqual(100)
      expect(report.analysis.overall.grade).toMatch(/[A-F]/)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid request IDs gracefully', async () => {
      const result = await performanceSystem.completeRequest('invalid-request-id', {
        statusCode: 200
      })
      
      // Should not throw an error, might return undefined or handle gracefully
      expect(result).toBeDefined()
    })

    test('should handle cache errors gracefully', async () => {
      // Try to cache invalid data
      const result = await performanceSystem.cacheData('test-key', undefined)
      
      // Should handle gracefully without throwing
      expect(result).toBeDefined()
    })

    test('should handle system shutdown gracefully', async () => {
      // Create a temporary system for shutdown testing
      const tempSystem = new ComprehensivePerformanceSystem({
        enableMonitoring: true,
        enableCaching: true,
        enableCodeSplitting: false,
        enableMiddleware: false
      })
      
      await tempSystem.initialize()
      
      // Should shutdown without errors
      await expect(tempSystem.shutdown()).resolves.not.toThrow()
    })
  })

  describe('Performance Benchmarks', () => {
    test('should handle high request volume', async () => {
      const startTime = Date.now()
      const requestCount = 100
      const requests = []
      
      // Start many requests
      for (let i = 0; i < requestCount; i++) {
        const requestId = await performanceSystem.recordRequest(`benchmark-${i}`, {
          method: 'GET',
          path: `/api/benchmark/${i}`
        })
        requests.push(requestId)
      }
      
      // Complete all requests
      await Promise.all(
        requests.map(id => performanceSystem.completeRequest(id, { statusCode: 200 }))
      )
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should handle 100 requests reasonably quickly
      expect(duration).toBeLessThan(5000) // 5 seconds
      expect(requests).toHaveLength(requestCount)
    })

    test('should maintain performance under cache load', async () => {
      const cacheOperations = 50
      const startTime = Date.now()
      
      // Perform many cache operations
      const operations = []
      for (let i = 0; i < cacheOperations; i++) {
        operations.push(
          performanceSystem.cacheData(`load-test-${i}`, { data: `test-${i}` })
        )
      }
      
      await Promise.all(operations)
      
      // Retrieve all cached data
      const retrievals = []
      for (let i = 0; i < cacheOperations; i++) {
        retrievals.push(
          performanceSystem.getCachedData(`load-test-${i}`)
        )
      }
      
      const results = await Promise.all(retrievals)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should handle cache operations efficiently
      expect(duration).toBeLessThan(2000) // 2 seconds
      expect(results).toHaveLength(cacheOperations)
      expect(results.every(result => result !== null)).toBe(true)
    })
  })
})

describe('Performance System Integration', () => {
  test('should work with Express.js applications', () => {
    // Mock Express app
    const mockApp = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn()
    }
    
    const performanceSystem = new ComprehensivePerformanceSystem()
    const middleware = performanceSystem.getPerformanceMiddleware()
    
    // Should be able to apply middleware to Express app
    middleware.forEach(mw => {
      mockApp.use(mw)
    })
    
    expect(mockApp.use).toHaveBeenCalledTimes(middleware.length)
  })

  test('should integrate with monitoring systems', async () => {
    const performanceSystem = new ComprehensivePerformanceSystem({
      enableMonitoring: true,
      enableCaching: false,
      enableCodeSplitting: false,
      enableMiddleware: false
    })
    
    await performanceSystem.initialize()
    
    let alertReceived = false
    performanceSystem.on('performance:alert', () => {
      alertReceived = true
    })
    
    // Trigger an alert
    performanceSystem.handlePerformanceAlert('integration_test', {
      severity: 'warning',
      message: 'Integration test alert'
    })
    
    expect(alertReceived).toBe(true)
    
    await performanceSystem.shutdown()
  })
})
