/**
 * Comprehensive Performance Monitoring System
 * 
 * Real-time performance monitoring with metrics collection,
 * alerting, and optimization recommendations
 */

const { EventEmitter } = require('events')
const { performance, PerformanceObserver } = require('perf_hooks')
const os = require('os')
const fs = require('fs').promises
const path = require('path')

class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      metricsInterval: 5000, // 5 seconds
      alertThresholds: {
        responseTime: 1000, // 1 second
        memoryUsage: 0.8, // 80% of available memory
        cpuUsage: 0.8, // 80% CPU usage
        errorRate: 0.05, // 5% error rate
        throughput: 100 // requests per second
      },
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      enableRealTimeAlerts: true,
      enableMetricsCollection: true,
      enablePerformanceAPI: true,
      enableResourceMonitoring: true,
      ...config
    }
    
    // Metrics storage
    this.metrics = {
      requests: new Map(),
      responses: new Map(),
      errors: new Map(),
      system: new Map(),
      custom: new Map()
    }
    
    // Performance observers
    this.observers = new Map()
    
    // Request tracking
    this.activeRequests = new Map()
    this.requestCounter = 0
    
    // System monitoring
    this.systemMetrics = {
      cpu: [],
      memory: [],
      disk: [],
      network: []
    }
    
    this.initialize()
  }

  async initialize() {
    console.log('📊 Initializing Performance Monitoring System...')
    
    try {
      // Setup performance observers
      this.setupPerformanceObservers()
      
      // Start system monitoring
      this.startSystemMonitoring()
      
      // Start metrics collection
      if (this.config.enableMetricsCollection) {
        this.startMetricsCollection()
      }
      
      // Setup cleanup
      this.setupCleanup()
      
      console.log('✅ Performance Monitoring System initialized')
      this.emit('monitor:initialized')
    } catch (error) {
      console.error('❌ Performance Monitor initialization failed:', error)
      throw error
    }
  }

  // Request Performance Tracking
  startRequest(requestId, metadata = {}) {
    const startTime = performance.now()
    const request = {
      id: requestId || `req_${++this.requestCounter}`,
      startTime,
      metadata: {
        method: metadata.method,
        path: metadata.path,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        userId: metadata.userId,
        ...metadata
      },
      marks: new Map(),
      measures: new Map()
    }
    
    this.activeRequests.set(request.id, request)
    
    // Create performance mark
    if (this.config.enablePerformanceAPI) {
      performance.mark(`request-start-${request.id}`)
    }
    
    return request.id
  }

  markRequestPhase(requestId, phase, metadata = {}) {
    const request = this.activeRequests.get(requestId)
    if (!request) return
    
    const timestamp = performance.now()
    const duration = timestamp - request.startTime
    
    request.marks.set(phase, {
      timestamp,
      duration,
      metadata
    })
    
    // Create performance mark
    if (this.config.enablePerformanceAPI) {
      performance.mark(`request-${phase}-${requestId}`)
    }
    
    this.emit('request:phase', {
      requestId,
      phase,
      duration,
      metadata
    })
  }

  endRequest(requestId, response = {}) {
    const request = this.activeRequests.get(requestId)
    if (!request) return
    
    const endTime = performance.now()
    const totalDuration = endTime - request.startTime
    
    // Create performance measure
    if (this.config.enablePerformanceAPI) {
      performance.mark(`request-end-${requestId}`)
      performance.measure(
        `request-total-${requestId}`,
        `request-start-${requestId}`,
        `request-end-${requestId}`
      )
    }
    
    const requestMetrics = {
      id: requestId,
      startTime: request.startTime,
      endTime,
      duration: totalDuration,
      metadata: request.metadata,
      response: {
        statusCode: response.statusCode,
        size: response.size,
        cached: response.cached,
        ...response
      },
      marks: Object.fromEntries(request.marks),
      timestamp: new Date().toISOString()
    }
    
    // Store metrics
    this.storeRequestMetrics(requestMetrics)
    
    // Check for performance issues
    this.checkPerformanceThresholds(requestMetrics)
    
    // Clean up
    this.activeRequests.delete(requestId)
    
    this.emit('request:completed', requestMetrics)
    
    return requestMetrics
  }

  // Error Tracking
  recordError(error, context = {}) {
    const errorMetrics = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      context: {
        requestId: context.requestId,
        userId: context.userId,
        path: context.path,
        method: context.method,
        ...context
      },
      timestamp: new Date().toISOString()
    }
    
    this.storeErrorMetrics(errorMetrics)
    
    // Check error rate threshold
    this.checkErrorRateThreshold()
    
    this.emit('error:recorded', errorMetrics)
    
    return errorMetrics.id
  }

  // Custom Metrics
  recordCustomMetric(name, value, tags = {}) {
    const metric = {
      name,
      value,
      tags,
      timestamp: new Date().toISOString()
    }
    
    if (!this.metrics.custom.has(name)) {
      this.metrics.custom.set(name, [])
    }
    
    this.metrics.custom.get(name).push(metric)
    
    this.emit('metric:recorded', metric)
    
    return metric
  }

  // System Monitoring
  startSystemMonitoring() {
    if (!this.config.enableResourceMonitoring) return
    
    setInterval(() => {
      this.collectSystemMetrics()
    }, this.config.metricsInterval)
    
    console.log('📈 System monitoring started')
  }

  async collectSystemMetrics() {
    const timestamp = new Date().toISOString()
    
    // CPU Usage
    const cpuUsage = await this.getCPUUsage()
    this.systemMetrics.cpu.push({ value: cpuUsage, timestamp })
    
    // Memory Usage
    const memoryUsage = this.getMemoryUsage()
    this.systemMetrics.memory.push({ ...memoryUsage, timestamp })
    
    // Disk Usage
    const diskUsage = await this.getDiskUsage()
    this.systemMetrics.disk.push({ ...diskUsage, timestamp })
    
    // Network Usage (if available)
    const networkUsage = this.getNetworkUsage()
    if (networkUsage) {
      this.systemMetrics.network.push({ ...networkUsage, timestamp })
    }
    
    // Store system metrics
    this.storeSystemMetrics({
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkUsage,
      timestamp
    })
    
    // Check system thresholds
    this.checkSystemThresholds({
      cpu: cpuUsage,
      memory: memoryUsage.percentage,
      disk: diskUsage.percentage
    })
  }

  getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage()
      const startTime = process.hrtime()
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage)
        const endTime = process.hrtime(startTime)
        
        const totalTime = endTime[0] * 1000000 + endTime[1] / 1000 // microseconds
        const cpuTime = (endUsage.user + endUsage.system) // microseconds
        
        const cpuPercent = (cpuTime / totalTime) * 100
        resolve(Math.min(100, Math.max(0, cpuPercent)))
      }, 100)
    })
  }

  getMemoryUsage() {
    const usage = process.memoryUsage()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    
    return {
      heap: {
        used: usage.heapUsed,
        total: usage.heapTotal,
        percentage: (usage.heapUsed / usage.heapTotal) * 100
      },
      system: {
        used: usedMemory,
        total: totalMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      process: {
        rss: usage.rss,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers
      }
    }
  }

  async getDiskUsage() {
    try {
      const stats = await fs.stat(process.cwd())
      // This is a simplified disk usage calculation
      // In production, you'd use a more comprehensive method
      return {
        used: 0,
        total: 0,
        free: 0,
        percentage: 0
      }
    } catch (error) {
      return {
        used: 0,
        total: 0,
        free: 0,
        percentage: 0,
        error: error.message
      }
    }
  }

  getNetworkUsage() {
    // Network usage monitoring would require platform-specific implementations
    // This is a placeholder for network metrics
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0
    }
  }

  // Performance Observers
  setupPerformanceObservers() {
    if (!this.config.enablePerformanceAPI) return
    
    // HTTP requests observer
    const httpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processPerformanceEntry(entry)
      }
    })
    
    try {
      httpObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] })
      this.observers.set('http', httpObserver)
    } catch (error) {
      console.warn('HTTP performance observer not supported:', error.message)
    }
    
    // Function timing observer
    const functionObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processFunctionTiming(entry)
      }
    })
    
    try {
      functionObserver.observe({ entryTypes: ['function'] })
      this.observers.set('function', functionObserver)
    } catch (error) {
      console.warn('Function performance observer not supported:', error.message)
    }
  }

  processPerformanceEntry(entry) {
    const metric = {
      name: entry.name,
      type: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
      timestamp: new Date().toISOString()
    }
    
    // Add entry-specific properties
    if (entry.entryType === 'resource') {
      metric.resource = {
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
        initiatorType: entry.initiatorType
      }
    }
    
    this.emit('performance:entry', metric)
  }

  processFunctionTiming(entry) {
    this.emit('performance:function', {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: new Date().toISOString()
    })
  }

  // Metrics Storage
  storeRequestMetrics(metrics) {
    const minute = Math.floor(Date.now() / 60000) * 60000
    
    if (!this.metrics.requests.has(minute)) {
      this.metrics.requests.set(minute, [])
    }
    
    this.metrics.requests.get(minute).push(metrics)
  }

  storeErrorMetrics(metrics) {
    const minute = Math.floor(Date.now() / 60000) * 60000
    
    if (!this.metrics.errors.has(minute)) {
      this.metrics.errors.set(minute, [])
    }
    
    this.metrics.errors.get(minute).push(metrics)
  }

  storeSystemMetrics(metrics) {
    const minute = Math.floor(Date.now() / 60000) * 60000
    
    if (!this.metrics.system.has(minute)) {
      this.metrics.system.set(minute, [])
    }
    
    this.metrics.system.get(minute).push(metrics)
  }

  // Threshold Monitoring
  checkPerformanceThresholds(requestMetrics) {
    const { duration, response } = requestMetrics
    
    // Response time threshold
    if (duration > this.config.alertThresholds.responseTime) {
      this.emit('alert:slow_response', {
        type: 'slow_response',
        severity: 'warning',
        message: `Slow response time: ${duration}ms`,
        threshold: this.config.alertThresholds.responseTime,
        actual: duration,
        requestMetrics
      })
    }
    
    // Error status codes
    if (response.statusCode >= 500) {
      this.emit('alert:server_error', {
        type: 'server_error',
        severity: 'error',
        message: `Server error: ${response.statusCode}`,
        requestMetrics
      })
    }
  }

  checkErrorRateThreshold() {
    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000
    
    let totalRequests = 0
    let totalErrors = 0
    
    // Count requests and errors in the last 5 minutes
    for (const [timestamp, requests] of this.metrics.requests.entries()) {
      if (timestamp >= fiveMinutesAgo) {
        totalRequests += requests.length
      }
    }
    
    for (const [timestamp, errors] of this.metrics.errors.entries()) {
      if (timestamp >= fiveMinutesAgo) {
        totalErrors += errors.length
      }
    }
    
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0
    
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.emit('alert:high_error_rate', {
        type: 'high_error_rate',
        severity: 'error',
        message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
        threshold: this.config.alertThresholds.errorRate,
        actual: errorRate,
        totalRequests,
        totalErrors
      })
    }
  }

  checkSystemThresholds(systemMetrics) {
    const { cpu, memory, disk } = systemMetrics
    
    // CPU threshold
    if (cpu > this.config.alertThresholds.cpuUsage * 100) {
      this.emit('alert:high_cpu', {
        type: 'high_cpu',
        severity: 'warning',
        message: `High CPU usage: ${cpu.toFixed(2)}%`,
        threshold: this.config.alertThresholds.cpuUsage * 100,
        actual: cpu
      })
    }
    
    // Memory threshold
    if (memory > this.config.alertThresholds.memoryUsage * 100) {
      this.emit('alert:high_memory', {
        type: 'high_memory',
        severity: 'warning',
        message: `High memory usage: ${memory.toFixed(2)}%`,
        threshold: this.config.alertThresholds.memoryUsage * 100,
        actual: memory
      })
    }
  }

  // Analytics and Reporting
  getMetricsSummary(timeRange = 3600000) { // 1 hour default
    const now = Date.now()
    const startTime = now - timeRange
    
    const summary = {
      timeRange: {
        start: new Date(startTime).toISOString(),
        end: new Date(now).toISOString(),
        duration: timeRange
      },
      requests: this.getRequestsSummary(startTime, now),
      errors: this.getErrorsSummary(startTime, now),
      system: this.getSystemSummary(startTime, now),
      performance: this.getPerformanceSummary(startTime, now)
    }
    
    return summary
  }

  getRequestsSummary(startTime, endTime) {
    let totalRequests = 0
    let totalDuration = 0
    let statusCodes = {}
    let methods = {}
    let paths = {}
    
    for (const [timestamp, requests] of this.metrics.requests.entries()) {
      if (timestamp >= startTime && timestamp <= endTime) {
        for (const request of requests) {
          totalRequests++
          totalDuration += request.duration
          
          // Status codes
          const status = request.response.statusCode
          statusCodes[status] = (statusCodes[status] || 0) + 1
          
          // Methods
          const method = request.metadata.method
          if (method) {
            methods[method] = (methods[method] || 0) + 1
          }
          
          // Paths
          const path = request.metadata.path
          if (path) {
            paths[path] = (paths[path] || 0) + 1
          }
        }
      }
    }
    
    return {
      total: totalRequests,
      averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
      requestsPerSecond: totalRequests / ((endTime - startTime) / 1000),
      statusCodes,
      methods,
      topPaths: Object.entries(paths)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }))
    }
  }

  getErrorsSummary(startTime, endTime) {
    let totalErrors = 0
    let errorTypes = {}
    let errorPaths = {}
    
    for (const [timestamp, errors] of this.metrics.errors.entries()) {
      if (timestamp >= startTime && timestamp <= endTime) {
        for (const error of errors) {
          totalErrors++
          
          // Error types
          const type = error.name || 'Unknown'
          errorTypes[type] = (errorTypes[type] || 0) + 1
          
          // Error paths
          const path = error.context.path
          if (path) {
            errorPaths[path] = (errorPaths[path] || 0) + 1
          }
        }
      }
    }
    
    return {
      total: totalErrors,
      errorRate: totalErrors / ((endTime - startTime) / 1000),
      types: errorTypes,
      topErrorPaths: Object.entries(errorPaths)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }))
    }
  }

  getSystemSummary(startTime, endTime) {
    const systemData = []
    
    for (const [timestamp, metrics] of this.metrics.system.entries()) {
      if (timestamp >= startTime && timestamp <= endTime) {
        systemData.push(...metrics)
      }
    }
    
    if (systemData.length === 0) {
      return { cpu: 0, memory: 0, disk: 0, samples: 0 }
    }
    
    const avgCpu = systemData.reduce((sum, m) => sum + m.cpu, 0) / systemData.length
    const avgMemory = systemData.reduce((sum, m) => sum + m.memory.system.percentage, 0) / systemData.length
    const avgDisk = systemData.reduce((sum, m) => sum + m.disk.percentage, 0) / systemData.length
    
    return {
      cpu: avgCpu,
      memory: avgMemory,
      disk: avgDisk,
      samples: systemData.length
    }
  }

  getPerformanceSummary(startTime, endTime) {
    // This would include performance-specific metrics
    return {
      slowQueries: 0,
      cacheHitRate: 0,
      databaseConnections: 0
    }
  }

  // Cleanup
  setupCleanup() {
    setInterval(() => {
      this.cleanupOldMetrics()
    }, 60000) // Every minute
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod
    
    // Clean up request metrics
    for (const [timestamp] of this.metrics.requests.entries()) {
      if (timestamp < cutoff) {
        this.metrics.requests.delete(timestamp)
      }
    }
    
    // Clean up error metrics
    for (const [timestamp] of this.metrics.errors.entries()) {
      if (timestamp < cutoff) {
        this.metrics.errors.delete(timestamp)
      }
    }
    
    // Clean up system metrics
    for (const [timestamp] of this.metrics.system.entries()) {
      if (timestamp < cutoff) {
        this.metrics.system.delete(timestamp)
      }
    }
    
    // Clean up system metrics arrays
    const cutoffTime = new Date(cutoff).toISOString()
    Object.keys(this.systemMetrics).forEach(key => {
      this.systemMetrics[key] = this.systemMetrics[key].filter(
        metric => metric.timestamp > cutoffTime
      )
    })
  }

  // Metrics Collection Control
  startMetricsCollection() {
    console.log('📊 Starting metrics collection...')
    this.metricsCollectionActive = true
  }

  stopMetricsCollection() {
    console.log('📊 Stopping metrics collection...')
    this.metricsCollectionActive = false
  }

  // System Status
  getSystemStatus() {
    return {
      active: true,
      metricsCollectionActive: this.metricsCollectionActive,
      activeRequests: this.activeRequests.size,
      observers: this.observers.size,
      metricsStored: {
        requests: Array.from(this.metrics.requests.values()).reduce((sum, arr) => sum + arr.length, 0),
        errors: Array.from(this.metrics.errors.values()).reduce((sum, arr) => sum + arr.length, 0),
        system: Array.from(this.metrics.system.values()).reduce((sum, arr) => sum + arr.length, 0),
        custom: Array.from(this.metrics.custom.values()).reduce((sum, arr) => sum + arr.length, 0)
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  }

  async shutdown() {
    console.log('📊 Shutting down Performance Monitor...')
    
    // Stop metrics collection
    this.stopMetricsCollection()
    
    // Disconnect observers
    for (const observer of this.observers.values()) {
      observer.disconnect()
    }
    this.observers.clear()
    
    // Clear metrics
    this.metrics.requests.clear()
    this.metrics.errors.clear()
    this.metrics.system.clear()
    this.metrics.custom.clear()
    
    this.emit('monitor:shutdown')
  }
}

module.exports = {
  PerformanceMonitor
}
