#!/usr/bin/env node

/**
 * Performance Monitoring Script
 * 
 * Real-time performance monitoring with metrics collection,
 * alerting, and automated optimization recommendations
 */

const { ComprehensivePerformanceSystem } = require('../lib/performance')
const fs = require('fs').promises
const path = require('path')

class PerformanceMonitoringScript {
  constructor() {
    this.performanceSystem = null
    this.monitoring = true
    this.reportInterval = 60000 // 1 minute
    this.alertThresholds = {
      responseTime: 1000, // 1 second
      errorRate: 0.05, // 5%
      memoryUsage: 0.8, // 80%
      cpuUsage: 0.8 // 80%
    }
    
    this.metrics = {
      requests: [],
      errors: [],
      alerts: [],
      optimizations: []
    }
  }

  async start() {
    console.log('🚀 Starting Performance Monitoring...\n')

    try {
      // Initialize performance system
      await this.initializePerformanceSystem()
      
      // Setup monitoring
      this.setupMonitoring()
      
      // Setup reporting
      this.setupReporting()
      
      // Setup graceful shutdown
      this.setupGracefulShutdown()
      
      console.log('✅ Performance monitoring started successfully!')
      console.log('📊 Monitoring dashboard: http://localhost:3000/performance')
      console.log('📈 Real-time metrics will be displayed below...\n')
      
      // Keep the script running
      await this.runMonitoring()
      
    } catch (error) {
      console.error('❌ Performance monitoring failed to start:', error)
      process.exit(1)
    }
  }

  async initializePerformanceSystem() {
    console.log('🔧 Initializing performance system...')
    
    const config = {
      enableMonitoring: true,
      enableCaching: true,
      enableCodeSplitting: false, // Disable for monitoring script
      enableMiddleware: false, // Disable for monitoring script
      
      performanceTargets: {
        responseTime: 500, // 500ms
        throughput: 1000, // requests per second
        errorRate: 0.01, // 1%
        cacheHitRate: 0.8, // 80%
        bundleSize: 500000 // 500KB
      },
      
      monitoring: {
        metricsInterval: 5000, // 5 seconds
        alertThresholds: this.alertThresholds,
        retentionPeriod: 24 * 60 * 60 * 1000 // 24 hours
      }
    }
    
    this.performanceSystem = new ComprehensivePerformanceSystem(config)
    await this.performanceSystem.initialize()
    
    console.log('✅ Performance system initialized')
  }

  setupMonitoring() {
    console.log('📊 Setting up monitoring...')
    
    // Listen for performance events
    this.performanceSystem.on('request:completed', (metrics) => {
      this.handleRequestCompleted(metrics)
    })
    
    this.performanceSystem.on('performance:alert', (alert) => {
      this.handlePerformanceAlert(alert)
    })
    
    this.performanceSystem.on('optimization:recommendations', (recommendations) => {
      this.handleOptimizationRecommendations(recommendations)
    })
    
    this.performanceSystem.on('performance:analyzed', (analysis) => {
      this.handlePerformanceAnalysis(analysis)
    })
    
    console.log('✅ Monitoring setup complete')
  }

  setupReporting() {
    console.log('📈 Setting up reporting...')
    
    // Generate reports periodically
    setInterval(async () => {
      await this.generatePerformanceReport()
    }, this.reportInterval)
    
    // Generate daily summary
    setInterval(async () => {
      await this.generateDailySummary()
    }, 24 * 60 * 60 * 1000) // Daily
    
    console.log('✅ Reporting setup complete')
  }

  async runMonitoring() {
    console.log('🔄 Starting monitoring loop...\n')
    
    // Display initial status
    await this.displaySystemStatus()
    
    // Start monitoring loop
    while (this.monitoring) {
      try {
        // Collect system metrics
        await this.collectSystemMetrics()
        
        // Check performance targets
        await this.checkPerformanceTargets()
        
        // Display real-time metrics
        this.displayRealTimeMetrics()
        
        // Wait before next iteration
        await this.sleep(5000) // 5 seconds
        
      } catch (error) {
        console.error('❌ Monitoring loop error:', error)
        await this.sleep(10000) // Wait longer on error
      }
    }
  }

  async collectSystemMetrics() {
    // Simulate some requests for demonstration
    if (Math.random() < 0.3) { // 30% chance
      await this.simulateRequest()
    }
    
    // Collect actual system metrics
    const systemStatus = this.performanceSystem.getSystemStatus()
    
    this.metrics.systemStatus = {
      timestamp: new Date().toISOString(),
      ...systemStatus
    }
  }

  async simulateRequest() {
    const requestId = await this.performanceSystem.recordRequest(`sim_${Date.now()}`, {
      method: 'GET',
      path: '/api/simulation',
      userId: 'monitor-script'
    })
    
    // Simulate processing time
    const processingTime = Math.random() * 200 + 50 // 50-250ms
    await this.sleep(processingTime)
    
    await this.performanceSystem.completeRequest(requestId, {
      statusCode: Math.random() < 0.95 ? 200 : 500, // 5% error rate
      size: Math.floor(Math.random() * 10000) + 1000 // 1-11KB
    })
  }

  async checkPerformanceTargets() {
    const violations = await this.performanceSystem.checkPerformanceTargets()
    
    if (violations.length > 0) {
      console.log(`⚠️  Performance target violations detected: ${violations.length}`)
      violations.forEach(violation => {
        console.log(`   - ${violation.metric}: ${violation.current} (target: ${violation.target})`)
      })
    }
  }

  handleRequestCompleted(metrics) {
    this.metrics.requests.push({
      timestamp: new Date().toISOString(),
      duration: metrics.duration,
      statusCode: metrics.response.statusCode,
      path: metrics.metadata.path
    })
    
    // Keep only recent requests
    this.metrics.requests = this.metrics.requests.slice(-100)
    
    // Check for slow requests
    if (metrics.duration > this.alertThresholds.responseTime) {
      console.log(`🐌 Slow request detected: ${metrics.metadata.path} - ${metrics.duration}ms`)
    }
  }

  handlePerformanceAlert(alert) {
    this.metrics.alerts.push({
      timestamp: new Date().toISOString(),
      type: alert.type,
      severity: alert.severity,
      message: alert.message
    })
    
    // Keep only recent alerts
    this.metrics.alerts = this.metrics.alerts.slice(-50)
    
    // Display alert
    const severityIcon = {
      low: '💡',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥'
    }
    
    console.log(`${severityIcon[alert.severity] || '⚠️'} ALERT [${alert.type}]: ${alert.message}`)
  }

  handleOptimizationRecommendations(recommendations) {
    this.metrics.optimizations = recommendations
    
    if (recommendations.length > 0) {
      console.log(`💡 ${recommendations.length} optimization recommendations generated`)
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.priority}] ${rec.title}`)
      })
    }
  }

  handlePerformanceAnalysis(analysis) {
    const score = analysis.overall.score
    const grade = analysis.overall.grade
    
    console.log(`📊 Performance Analysis: Score ${score}/100 (Grade: ${grade})`)
    
    if (analysis.overall.factors.length > 0) {
      console.log(`   Issues: ${analysis.overall.factors.join(', ')}`)
    }
  }

  displayRealTimeMetrics() {
    // Clear console for real-time display
    if (process.stdout.isTTY) {
      process.stdout.write('\x1B[2J\x1B[0f') // Clear screen
    }
    
    console.log('🚀 BloodLink Africa - Performance Monitor')
    console.log('=' .repeat(60))
    console.log(`📅 ${new Date().toLocaleString()}`)
    console.log('')
    
    // System metrics
    if (this.metrics.systemStatus) {
      console.log('🖥️  System Status:')
      console.log(`   Uptime: ${Math.floor(this.metrics.systemStatus.uptime / 60)}m`)
      console.log(`   Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`)
      console.log(`   Active Systems: ${Object.keys(this.metrics.systemStatus.systems).length}`)
      console.log('')
    }
    
    // Request metrics
    if (this.metrics.requests.length > 0) {
      const recentRequests = this.metrics.requests.slice(-10)
      const avgResponseTime = recentRequests.reduce((sum, req) => sum + req.duration, 0) / recentRequests.length
      const errorRate = recentRequests.filter(req => req.statusCode >= 400).length / recentRequests.length
      
      console.log('📊 Request Metrics (Last 10 requests):')
      console.log(`   Average Response Time: ${Math.round(avgResponseTime)}ms`)
      console.log(`   Error Rate: ${(errorRate * 100).toFixed(1)}%`)
      console.log(`   Total Requests: ${this.metrics.requests.length}`)
      console.log('')
    }
    
    // Recent alerts
    if (this.metrics.alerts.length > 0) {
      const recentAlerts = this.metrics.alerts.slice(-5)
      console.log('🚨 Recent Alerts:')
      recentAlerts.forEach(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString()
        console.log(`   ${time} [${alert.severity}] ${alert.message}`)
      })
      console.log('')
    }
    
    // Optimization recommendations
    if (this.metrics.optimizations.length > 0) {
      console.log('💡 Active Recommendations:')
      this.metrics.optimizations.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.priority}] ${rec.title}`)
      })
      console.log('')
    }
    
    console.log('Press Ctrl+C to stop monitoring...')
    console.log('=' .repeat(60))
  }

  async displaySystemStatus() {
    const status = this.performanceSystem.getSystemStatus()
    
    console.log('🖥️  System Status:')
    console.log(`   Overall: ${status.active ? '✅ Active' : '❌ Inactive'}`)
    console.log(`   Systems: ${Object.keys(status.systems).length} initialized`)
    console.log(`   Uptime: ${Math.floor(status.uptime / 60)} minutes`)
    console.log('')
  }

  async generatePerformanceReport() {
    try {
      const report = await this.performanceSystem.generatePerformanceReport()
      
      // Save report to file
      const reportPath = path.join(__dirname, '../reports/performance')
      await fs.mkdir(reportPath, { recursive: true })
      
      const filename = `performance-report-${new Date().toISOString().split('T')[0]}.json`
      const filepath = path.join(reportPath, filename)
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2))
      
      console.log(`📋 Performance report saved: ${filepath}`)
      
    } catch (error) {
      console.error('❌ Failed to generate performance report:', error)
    }
  }

  async generateDailySummary() {
    try {
      const summary = {
        date: new Date().toISOString().split('T')[0],
        totalRequests: this.metrics.requests.length,
        totalAlerts: this.metrics.alerts.length,
        optimizationRecommendations: this.metrics.optimizations.length,
        systemUptime: process.uptime(),
        averageResponseTime: this.metrics.requests.length > 0 ? 
          this.metrics.requests.reduce((sum, req) => sum + req.duration, 0) / this.metrics.requests.length : 0
      }
      
      // Save daily summary
      const summaryPath = path.join(__dirname, '../reports/daily-summaries')
      await fs.mkdir(summaryPath, { recursive: true })
      
      const filename = `daily-summary-${summary.date}.json`
      const filepath = path.join(summaryPath, filename)
      
      await fs.writeFile(filepath, JSON.stringify(summary, null, 2))
      
      console.log(`📊 Daily summary saved: ${filepath}`)
      
    } catch (error) {
      console.error('❌ Failed to generate daily summary:', error)
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)
      
      this.monitoring = false
      
      try {
        // Generate final report
        await this.generatePerformanceReport()
        
        // Shutdown performance system
        if (this.performanceSystem) {
          await this.performanceSystem.shutdown()
        }
        
        console.log('✅ Performance monitoring stopped')
        process.exit(0)
      } catch (error) {
        console.error('❌ Error during shutdown:', error)
        process.exit(1)
      }
    }
    
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Run the monitoring script if called directly
if (require.main === module) {
  const monitor = new PerformanceMonitoringScript()
  monitor.start().catch(console.error)
}

module.exports = PerformanceMonitoringScript
