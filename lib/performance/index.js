/**
 * Comprehensive Performance Optimization & Monitoring System
 * 
 * Main integration point for all performance optimization systems including
 * monitoring, caching, code splitting, and middleware optimization
 */

const { EventEmitter } = require('events')
const { PerformanceMonitor } = require('./performance-monitor')
const { CacheManager } = require('./cache-manager')
const { CodeSplittingOptimizer } = require('./code-splitting')
const { PerformanceMiddleware } = require('./performance-middleware')

class ComprehensivePerformanceSystem extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      // System-wide performance settings
      enableMonitoring: true,
      enableCaching: true,
      enableCodeSplitting: true,
      enableMiddleware: true,
      
      // Performance targets
      performanceTargets: {
        responseTime: 500, // 500ms
        throughput: 1000, // requests per second
        errorRate: 0.01, // 1%
        cacheHitRate: 0.8, // 80%
        bundleSize: 500000, // 500KB
        firstContentfulPaint: 1500, // 1.5s
        largestContentfulPaint: 2500, // 2.5s
        cumulativeLayoutShift: 0.1 // 0.1
      },
      
      // Monitoring configuration
      monitoring: {
        metricsInterval: 5000,
        alertThresholds: {
          responseTime: 1000,
          memoryUsage: 0.8,
          cpuUsage: 0.8,
          errorRate: 0.05
        },
        retentionPeriod: 24 * 60 * 60 * 1000 // 24 hours
      },
      
      // Caching configuration
      caching: {
        enableMemoryCache: true,
        enableRedisCache: true,
        enableCDNCache: false,
        defaultTTL: 300000 // 5 minutes
      },
      
      // Code splitting configuration
      codeSplitting: {
        enableRouteSplitting: true,
        enableComponentSplitting: true,
        enableVendorSplitting: true,
        minChunkSize: 20000,
        maxChunkSize: 244000
      },
      
      // Middleware configuration
      middleware: {
        enableCompression: true,
        enableCaching: true,
        enableOptimization: true
      },
      
      ...config
    }
    
    this.systems = new Map()
    this.metrics = new Map()
    this.alerts = []
    this.optimizations = []
    
    this.initialize()
  }

  async initialize() {
    console.log('🚀 Initializing Comprehensive Performance System...')
    
    try {
      // Initialize performance monitoring
      if (this.config.enableMonitoring) {
        await this.initializeMonitoring()
      }
      
      // Initialize caching system
      if (this.config.enableCaching) {
        await this.initializeCaching()
      }
      
      // Initialize code splitting optimizer
      if (this.config.enableCodeSplitting) {
        await this.initializeCodeSplitting()
      }
      
      // Initialize performance middleware
      if (this.config.enableMiddleware) {
        await this.initializeMiddleware()
      }
      
      // Setup system integration
      this.setupSystemIntegration()
      
      // Start performance analysis
      this.startPerformanceAnalysis()
      
      console.log('✅ Comprehensive Performance System initialized')
      this.emit('system:initialized')
      
    } catch (error) {
      console.error('❌ Performance System initialization failed:', error)
      throw error
    }
  }

  async initializeMonitoring() {
    console.log('📊 Initializing performance monitoring...')
    
    const monitor = new PerformanceMonitor(this.config.monitoring)
    await monitor.initialize()
    
    this.systems.set('monitor', monitor)
    
    // Setup monitoring event handlers
    monitor.on('alert:slow_response', (alert) => {
      this.handlePerformanceAlert('slow_response', alert)
    })
    
    monitor.on('alert:high_error_rate', (alert) => {
      this.handlePerformanceAlert('high_error_rate', alert)
    })
    
    monitor.on('alert:high_memory', (alert) => {
      this.handlePerformanceAlert('high_memory', alert)
    })
    
    console.log('✅ Performance monitoring initialized')
  }

  async initializeCaching() {
    console.log('🗄️  Initializing caching system...')
    
    const cache = new CacheManager(this.config.caching)
    await cache.initialize()
    
    this.systems.set('cache', cache)
    
    // Setup caching event handlers
    cache.on('cache:hit', (event) => {
      this.recordMetric('cache_hits', 1, { tier: event.tier })
    })
    
    cache.on('cache:miss', (event) => {
      this.recordMetric('cache_misses', 1, { tier: event.tier })
    })
    
    console.log('✅ Caching system initialized')
  }

  async initializeCodeSplitting() {
    console.log('⚡ Initializing code splitting optimizer...')
    
    const optimizer = new CodeSplittingOptimizer(this.config.codeSplitting)
    await optimizer.initialize()
    
    this.systems.set('codeSplitting', optimizer)
    
    // Setup code splitting event handlers
    optimizer.on('chunk:loaded', (event) => {
      this.recordMetric('chunk_load_time', event.duration, { chunk: event.chunkName })
    })
    
    optimizer.on('recommendations:generated', (recommendations) => {
      this.processOptimizationRecommendations(recommendations)
    })
    
    console.log('✅ Code splitting optimizer initialized')
  }

  async initializeMiddleware() {
    console.log('⚡ Initializing performance middleware...')
    
    const middleware = new PerformanceMiddleware(this.config.middleware)
    await middleware.initialize()
    
    this.systems.set('middleware', middleware)
    
    console.log('✅ Performance middleware initialized')
  }

  setupSystemIntegration() {
    console.log('🔗 Setting up system integration...')
    
    // Integrate monitoring with caching
    const monitor = this.systems.get('monitor')
    const cache = this.systems.get('cache')
    
    if (monitor && cache) {
      monitor.on('request:completed', async (metrics) => {
        // Cache frequently accessed endpoints
        if (metrics.metadata.method === 'GET' && metrics.duration < 100) {
          const cacheKey = `${metrics.metadata.path}:${metrics.metadata.userId || 'anonymous'}`
          // This would cache the response in a real implementation
        }
      })
    }
    
    // Integrate code splitting with monitoring
    const codeSplitting = this.systems.get('codeSplitting')
    
    if (monitor && codeSplitting) {
      monitor.on('request:completed', (metrics) => {
        // Track route performance for code splitting optimization
        if (metrics.metadata.path) {
          codeSplitting.emit('route:performance', {
            path: metrics.metadata.path,
            duration: metrics.duration,
            size: metrics.response.size
          })
        }
      })
    }
    
    console.log('✅ System integration complete')
  }

  startPerformanceAnalysis() {
    console.log('📈 Starting performance analysis...')
    
    // Analyze performance every 5 minutes
    setInterval(async () => {
      await this.analyzePerformance()
    }, 300000)
    
    // Generate optimization recommendations every hour
    setInterval(async () => {
      await this.generateOptimizationRecommendations()
    }, 3600000)
    
    // Check performance targets every 10 minutes
    setInterval(async () => {
      await this.checkPerformanceTargets()
    }, 600000)
    
    console.log('✅ Performance analysis started')
  }

  // Core Performance Operations
  async recordRequest(requestId, metadata = {}) {
    const monitor = this.systems.get('monitor')
    if (monitor) {
      return monitor.startRequest(requestId, metadata)
    }
  }

  async completeRequest(requestId, response = {}) {
    const monitor = this.systems.get('monitor')
    if (monitor) {
      return monitor.endRequest(requestId, response)
    }
  }

  async cacheData(key, data, options = {}) {
    const cache = this.systems.get('cache')
    if (cache) {
      return await cache.set(key, data, options)
    }
  }

  async getCachedData(key, options = {}) {
    const cache = this.systems.get('cache')
    if (cache) {
      return await cache.get(key, options)
    }
    return null
  }

  getPerformanceMiddleware() {
    const middleware = this.systems.get('middleware')
    if (middleware) {
      return middleware.getMiddlewareStack()
    }
    return []
  }

  // Performance Analysis
  async analyzePerformance() {
    console.log('📊 Analyzing system performance...')
    
    const analysis = {
      timestamp: new Date().toISOString(),
      monitoring: await this.analyzeMonitoringMetrics(),
      caching: await this.analyzeCachingPerformance(),
      codeSplitting: await this.analyzeCodeSplittingEffectiveness(),
      overall: {}
    }
    
    // Calculate overall performance score
    analysis.overall = this.calculateOverallPerformanceScore(analysis)
    
    // Store analysis results
    this.metrics.set('performance_analysis', analysis)
    
    // Emit analysis event
    this.emit('performance:analyzed', analysis)
    
    return analysis
  }

  async analyzeMonitoringMetrics() {
    const monitor = this.systems.get('monitor')
    if (!monitor) return null
    
    const summary = monitor.getMetricsSummary()
    
    return {
      responseTime: {
        average: summary.requests.averageResponseTime,
        target: this.config.performanceTargets.responseTime,
        status: summary.requests.averageResponseTime <= this.config.performanceTargets.responseTime ? 'good' : 'poor'
      },
      throughput: {
        current: summary.requests.requestsPerSecond,
        target: this.config.performanceTargets.throughput,
        status: summary.requests.requestsPerSecond >= this.config.performanceTargets.throughput ? 'good' : 'poor'
      },
      errorRate: {
        current: summary.errors.errorRate,
        target: this.config.performanceTargets.errorRate,
        status: summary.errors.errorRate <= this.config.performanceTargets.errorRate ? 'good' : 'poor'
      }
    }
  }

  async analyzeCachingPerformance() {
    const cache = this.systems.get('cache')
    if (!cache) return null
    
    const stats = cache.getStatistics()
    
    return {
      hitRate: {
        current: stats.hitRate / 100,
        target: this.config.performanceTargets.cacheHitRate,
        status: (stats.hitRate / 100) >= this.config.performanceTargets.cacheHitRate ? 'good' : 'poor'
      },
      memoryUsage: stats.memoryCache,
      redisStatus: stats.redisCache
    }
  }

  async analyzeCodeSplittingEffectiveness() {
    const codeSplitting = this.systems.get('codeSplitting')
    if (!codeSplitting) return null
    
    const report = codeSplitting.getOptimizationReport()
    
    return {
      bundleSize: {
        current: Object.values(report.bundleAnalysis).reduce((sum, chunk) => sum + chunk.size, 0),
        target: this.config.performanceTargets.bundleSize,
        status: 'good' // Would be calculated based on actual bundle size
      },
      chunkLoadTimes: report.performanceMetrics,
      recommendations: report.recommendations
    }
  }

  calculateOverallPerformanceScore(analysis) {
    let score = 100
    let factors = []
    
    // Response time factor (25% weight)
    if (analysis.monitoring?.responseTime?.status === 'poor') {
      score -= 25
      factors.push('slow_response_time')
    }
    
    // Throughput factor (20% weight)
    if (analysis.monitoring?.throughput?.status === 'poor') {
      score -= 20
      factors.push('low_throughput')
    }
    
    // Error rate factor (25% weight)
    if (analysis.monitoring?.errorRate?.status === 'poor') {
      score -= 25
      factors.push('high_error_rate')
    }
    
    // Cache hit rate factor (15% weight)
    if (analysis.caching?.hitRate?.status === 'poor') {
      score -= 15
      factors.push('low_cache_hit_rate')
    }
    
    // Bundle size factor (15% weight)
    if (analysis.codeSplitting?.bundleSize?.status === 'poor') {
      score -= 15
      factors.push('large_bundle_size')
    }
    
    return {
      score: Math.max(0, score),
      grade: this.getPerformanceGrade(score),
      factors
    }
  }

  getPerformanceGrade(score) {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  // Performance Targets and Alerts
  async checkPerformanceTargets() {
    console.log('🎯 Checking performance targets...')
    
    const analysis = await this.analyzePerformance()
    const violations = []
    
    // Check each target
    Object.entries(this.config.performanceTargets).forEach(([metric, target]) => {
      const current = this.getCurrentMetricValue(metric, analysis)
      if (current !== null && !this.meetsTarget(metric, current, target)) {
        violations.push({
          metric,
          current,
          target,
          severity: this.getViolationSeverity(metric, current, target)
        })
      }
    })
    
    if (violations.length > 0) {
      this.emit('performance:targets_violated', violations)
      console.warn(`⚠️  ${violations.length} performance targets violated`)
    }
    
    return violations
  }

  getCurrentMetricValue(metric, analysis) {
    switch (metric) {
      case 'responseTime':
        return analysis.monitoring?.responseTime?.current
      case 'throughput':
        return analysis.monitoring?.throughput?.current
      case 'errorRate':
        return analysis.monitoring?.errorRate?.current
      case 'cacheHitRate':
        return analysis.caching?.hitRate?.current
      case 'bundleSize':
        return analysis.codeSplitting?.bundleSize?.current
      default:
        return null
    }
  }

  meetsTarget(metric, current, target) {
    // For metrics where lower is better
    const lowerIsBetter = ['responseTime', 'errorRate', 'bundleSize']
    
    if (lowerIsBetter.includes(metric)) {
      return current <= target
    } else {
      return current >= target
    }
  }

  getViolationSeverity(metric, current, target) {
    const ratio = current / target
    
    if (ratio > 2 || ratio < 0.5) return 'critical'
    if (ratio > 1.5 || ratio < 0.75) return 'high'
    return 'medium'
  }

  // Optimization Recommendations
  async generateOptimizationRecommendations() {
    console.log('💡 Generating optimization recommendations...')
    
    const recommendations = []
    const analysis = await this.analyzePerformance()
    
    // Response time optimizations
    if (analysis.monitoring?.responseTime?.status === 'poor') {
      recommendations.push({
        category: 'response_time',
        priority: 'high',
        title: 'Optimize Response Time',
        description: 'Response times are above target threshold',
        suggestions: [
          'Enable database query optimization',
          'Implement response caching',
          'Optimize API endpoints',
          'Consider CDN for static assets'
        ]
      })
    }
    
    // Caching optimizations
    if (analysis.caching?.hitRate?.status === 'poor') {
      recommendations.push({
        category: 'caching',
        priority: 'medium',
        title: 'Improve Cache Hit Rate',
        description: 'Cache hit rate is below target',
        suggestions: [
          'Increase cache TTL for stable data',
          'Implement cache warming strategies',
          'Optimize cache key generation',
          'Add more cache layers'
        ]
      })
    }
    
    // Bundle size optimizations
    if (analysis.codeSplitting?.bundleSize?.status === 'poor') {
      recommendations.push({
        category: 'bundle_size',
        priority: 'medium',
        title: 'Reduce Bundle Size',
        description: 'Bundle size exceeds target',
        suggestions: [
          'Implement tree shaking',
          'Remove unused dependencies',
          'Optimize images and assets',
          'Enable better code splitting'
        ]
      })
    }
    
    this.optimizations = recommendations
    this.emit('optimization:recommendations', recommendations)
    
    return recommendations
  }

  // Alert Handling
  handlePerformanceAlert(type, alert) {
    const alertData = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: alert.severity,
      message: alert.message,
      data: alert,
      timestamp: new Date().toISOString(),
      acknowledged: false
    }
    
    this.alerts.push(alertData)
    
    // Keep only recent alerts
    this.alerts = this.alerts.slice(-100)
    
    this.emit('performance:alert', alertData)
    
    console.warn(`⚠️  Performance Alert [${type}]: ${alert.message}`)
  }

  // Utility Methods
  recordMetric(name, value, tags = {}) {
    const metric = {
      name,
      value,
      tags,
      timestamp: new Date().toISOString()
    }
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    this.metrics.get(name).push(metric)
    
    // Keep only recent metrics
    const recent = this.metrics.get(name).slice(-1000)
    this.metrics.set(name, recent)
  }

  // System Status and Reporting
  getSystemStatus() {
    const systemStatus = {}
    
    for (const [name, system] of this.systems.entries()) {
      systemStatus[name] = system.getSystemStatus ? system.getSystemStatus() : { active: true }
    }
    
    return {
      active: true,
      systems: systemStatus,
      metrics: this.metrics.size,
      alerts: this.alerts.length,
      optimizations: this.optimizations.length,
      uptime: process.uptime()
    }
  }

  async generatePerformanceReport() {
    const analysis = await this.analyzePerformance()
    const recommendations = await this.generateOptimizationRecommendations()
    
    return {
      timestamp: new Date().toISOString(),
      analysis,
      recommendations,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      systemStatus: this.getSystemStatus(),
      performanceTargets: this.config.performanceTargets
    }
  }

  async shutdown() {
    console.log('🚀 Shutting down Comprehensive Performance System...')
    
    // Shutdown all systems
    for (const [name, system] of this.systems.entries()) {
      try {
        if (system.shutdown) {
          await system.shutdown()
        }
        console.log(`✅ ${name} system shutdown complete`)
      } catch (error) {
        console.error(`❌ Error shutting down ${name} system:`, error)
      }
    }
    
    // Clear data
    this.systems.clear()
    this.metrics.clear()
    this.alerts = []
    this.optimizations = []
    
    this.emit('system:shutdown')
    console.log('✅ Performance System shutdown complete')
  }
}

module.exports = {
  ComprehensivePerformanceSystem,
  PerformanceMonitor,
  CacheManager,
  CodeSplittingOptimizer,
  PerformanceMiddleware
}
