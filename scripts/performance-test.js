#!/usr/bin/env node

/**
 * Performance Testing Script
 * 
 * Comprehensive performance testing including:
 * - Lighthouse audits
 * - Bundle size analysis
 * - API performance testing
 * - Load testing
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const lighthouse = require('lighthouse')
const chromeLauncher = require('chrome-launcher')

const PERFORMANCE_THRESHOLDS = {
  lighthouse: {
    performance: 85,
    accessibility: 95,
    bestPractices: 90,
    seo: 90,
    pwa: 80
  },
  bundleSize: {
    maxTotalSize: 500 * 1024, // 500KB
    maxChunkSize: 244 * 1024, // 244KB
    maxAssetSize: 100 * 1024   // 100KB
  },
  api: {
    maxResponseTime: 100, // ms
    maxErrorRate: 1       // %
  }
}

class PerformanceTester {
  constructor() {
    this.results = {
      lighthouse: {},
      bundleSize: {},
      api: {},
      loadTest: {}
    }
    this.reportDir = path.join(process.cwd(), 'performance-reports')
    this.ensureReportDir()
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true })
    }
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive performance testing...\n')

    try {
      // 1. Build the application
      await this.buildApplication()

      // 2. Start the application
      const server = await this.startApplication()

      // 3. Run Lighthouse audits
      await this.runLighthouseAudits()

      // 4. Analyze bundle size
      await this.analyzeBundleSize()

      // 5. Test API performance
      await this.testAPIPerformance()

      // 6. Run load tests
      await this.runLoadTests()

      // 7. Generate comprehensive report
      await this.generateReport()

      // 8. Stop the application
      server.kill()

      console.log('✅ Performance testing completed successfully!')
      
      // Exit with error code if any tests failed
      const hasFailures = this.checkForFailures()
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Performance testing failed:', error)
      process.exit(1)
    }
  }

  async buildApplication() {
    console.log('📦 Building application...')
    
    try {
      execSync('npm run build', { 
        stdio: 'inherit',
        cwd: process.cwd()
      })
      console.log('✅ Application built successfully\n')
    } catch (error) {
      throw new Error('Failed to build application')
    }
  }

  async startApplication() {
    console.log('🚀 Starting application server...')
    
    const server = spawn('npm', ['start'], {
      stdio: 'pipe',
      cwd: process.cwd()
    })

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'))
      }, 30000)

      server.stdout.on('data', (data) => {
        if (data.toString().includes('Ready')) {
          clearTimeout(timeout)
          resolve()
        }
      })
    })

    console.log('✅ Application server started\n')
    return server
  }

  async runLighthouseAudits() {
    console.log('🔍 Running Lighthouse audits...')

    const urls = [
      'http://localhost:3000',
      'http://localhost:3000/dashboard',
      'http://localhost:3000/request',
      'http://localhost:3000/donors'
    ]

    for (const url of urls) {
      console.log(`  Auditing: ${url}`)
      
      const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] })
      
      const options = {
        logLevel: 'info',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
        port: chrome.port
      }

      const runnerResult = await lighthouse(url, options)
      await chrome.kill()

      const scores = {
        performance: Math.round(runnerResult.lhr.categories.performance.score * 100),
        accessibility: Math.round(runnerResult.lhr.categories.accessibility.score * 100),
        bestPractices: Math.round(runnerResult.lhr.categories['best-practices'].score * 100),
        seo: Math.round(runnerResult.lhr.categories.seo.score * 100),
        pwa: Math.round(runnerResult.lhr.categories.pwa.score * 100)
      }

      this.results.lighthouse[url] = {
        scores,
        metrics: {
          fcp: runnerResult.lhr.audits['first-contentful-paint'].numericValue,
          lcp: runnerResult.lhr.audits['largest-contentful-paint'].numericValue,
          tbt: runnerResult.lhr.audits['total-blocking-time'].numericValue,
          cls: runnerResult.lhr.audits['cumulative-layout-shift'].numericValue,
          si: runnerResult.lhr.audits['speed-index'].numericValue
        },
        passed: this.checkLighthouseThresholds(scores)
      }

      // Save detailed report
      const reportPath = path.join(this.reportDir, `lighthouse-${url.replace(/[^a-zA-Z0-9]/g, '-')}.json`)
      fs.writeFileSync(reportPath, JSON.stringify(runnerResult.lhr, null, 2))

      console.log(`    Performance: ${scores.performance}% | Accessibility: ${scores.accessibility}% | Best Practices: ${scores.bestPractices}%`)
    }

    console.log('✅ Lighthouse audits completed\n')
  }

  checkLighthouseThresholds(scores) {
    const thresholds = PERFORMANCE_THRESHOLDS.lighthouse
    return {
      performance: scores.performance >= thresholds.performance,
      accessibility: scores.accessibility >= thresholds.accessibility,
      bestPractices: scores.bestPractices >= thresholds.bestPractices,
      seo: scores.seo >= thresholds.seo,
      pwa: scores.pwa >= thresholds.pwa
    }
  }

  async analyzeBundleSize() {
    console.log('📊 Analyzing bundle size...')

    try {
      // Generate bundle analyzer report
      execSync('npm run analyze', { 
        stdio: 'pipe',
        cwd: process.cwd()
      })

      // Read build manifest
      const buildManifestPath = path.join(process.cwd(), '.next/build-manifest.json')
      if (fs.existsSync(buildManifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'))
        
        // Calculate bundle sizes
        let totalSize = 0
        const chunks = {}

        for (const [page, files] of Object.entries(manifest.pages)) {
          let pageSize = 0
          for (const file of files) {
            const filePath = path.join(process.cwd(), '.next', file)
            if (fs.existsSync(filePath)) {
              const size = fs.statSync(filePath).size
              pageSize += size
              totalSize += size
            }
          }
          chunks[page] = pageSize
        }

        this.results.bundleSize = {
          totalSize,
          chunks,
          passed: {
            totalSize: totalSize <= PERFORMANCE_THRESHOLDS.bundleSize.maxTotalSize,
            maxChunk: Math.max(...Object.values(chunks)) <= PERFORMANCE_THRESHOLDS.bundleSize.maxChunkSize
          }
        }

        console.log(`    Total bundle size: ${(totalSize / 1024).toFixed(2)}KB`)
        console.log(`    Largest chunk: ${(Math.max(...Object.values(chunks)) / 1024).toFixed(2)}KB`)
      }

      console.log('✅ Bundle size analysis completed\n')
    } catch (error) {
      console.warn('⚠️  Bundle size analysis failed:', error.message)
    }
  }

  async testAPIPerformance() {
    console.log('🔌 Testing API performance...')

    const endpoints = [
      '/api/blood-requests',
      '/api/donors',
      '/api/analytics/dashboard'
    ]

    for (const endpoint of endpoints) {
      console.log(`  Testing: ${endpoint}`)
      
      const results = []
      const errors = []

      // Run multiple requests to get average
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now()
        
        try {
          const response = await fetch(`http://localhost:3000${endpoint}`)
          const endTime = Date.now()
          
          results.push({
            responseTime: endTime - startTime,
            status: response.status,
            success: response.ok
          })

          if (!response.ok) {
            errors.push(response.status)
          }
        } catch (error) {
          errors.push(error.message)
        }
      }

      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      const errorRate = (errors.length / 10) * 100

      this.results.api[endpoint] = {
        avgResponseTime,
        errorRate,
        passed: {
          responseTime: avgResponseTime <= PERFORMANCE_THRESHOLDS.api.maxResponseTime,
          errorRate: errorRate <= PERFORMANCE_THRESHOLDS.api.maxErrorRate
        }
      }

      console.log(`    Avg response time: ${avgResponseTime.toFixed(2)}ms | Error rate: ${errorRate.toFixed(1)}%`)
    }

    console.log('✅ API performance testing completed\n')
  }

  async runLoadTests() {
    console.log('⚡ Running load tests...')

    // Simple load test using concurrent requests
    const concurrentUsers = 10
    const requestsPerUser = 5
    const endpoint = 'http://localhost:3000/api/blood-requests'

    const startTime = Date.now()
    const promises = []

    for (let user = 0; user < concurrentUsers; user++) {
      for (let req = 0; req < requestsPerUser; req++) {
        promises.push(
          fetch(endpoint).then(response => ({
            status: response.status,
            responseTime: Date.now() - startTime
          })).catch(error => ({
            error: error.message,
            responseTime: Date.now() - startTime
          }))
        )
      }
    }

    const results = await Promise.all(promises)
    const totalTime = Date.now() - startTime
    const successfulRequests = results.filter(r => r.status === 200).length
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length

    this.results.loadTest = {
      totalRequests: promises.length,
      successfulRequests,
      totalTime,
      avgResponseTime,
      requestsPerSecond: (promises.length / totalTime) * 1000,
      passed: {
        successRate: (successfulRequests / promises.length) >= 0.95,
        avgResponseTime: avgResponseTime <= 1000
      }
    }

    console.log(`    ${promises.length} requests in ${totalTime}ms`)
    console.log(`    Success rate: ${((successfulRequests / promises.length) * 100).toFixed(1)}%`)
    console.log(`    Requests/sec: ${((promises.length / totalTime) * 1000).toFixed(2)}`)

    console.log('✅ Load testing completed\n')
  }

  async generateReport() {
    console.log('📋 Generating performance report...')

    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      results: this.results,
      thresholds: PERFORMANCE_THRESHOLDS
    }

    // Save JSON report
    const jsonReportPath = path.join(this.reportDir, 'performance-report.json')
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2))

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report)
    const htmlReportPath = path.join(this.reportDir, 'performance-report.html')
    fs.writeFileSync(htmlReportPath, htmlReport)

    console.log(`✅ Performance report generated: ${htmlReportPath}\n`)
  }

  generateSummary() {
    const summary = {
      lighthouse: { passed: 0, total: 0 },
      bundleSize: { passed: 0, total: 0 },
      api: { passed: 0, total: 0 },
      loadTest: { passed: 0, total: 0 }
    }

    // Count Lighthouse passes
    Object.values(this.results.lighthouse).forEach(result => {
      Object.values(result.passed).forEach(passed => {
        summary.lighthouse.total++
        if (passed) summary.lighthouse.passed++
      })
    })

    // Count bundle size passes
    if (this.results.bundleSize.passed) {
      Object.values(this.results.bundleSize.passed).forEach(passed => {
        summary.bundleSize.total++
        if (passed) summary.bundleSize.passed++
      })
    }

    // Count API passes
    Object.values(this.results.api).forEach(result => {
      Object.values(result.passed).forEach(passed => {
        summary.api.total++
        if (passed) summary.api.passed++
      })
    })

    // Count load test passes
    if (this.results.loadTest.passed) {
      Object.values(this.results.loadTest.passed).forEach(passed => {
        summary.loadTest.total++
        if (passed) summary.loadTest.passed++
      })
    }

    return summary
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>BloodLink Africa - Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; border-radius: 4px; }
        .pass { background: #d4edda; color: #155724; }
        .fail { background: #f8d7da; color: #721c24; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>BloodLink Africa - Performance Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>
    
    <div class="section">
        <h2>Summary</h2>
        <div class="metric ${report.summary.lighthouse.passed === report.summary.lighthouse.total ? 'pass' : 'fail'}">
            Lighthouse: ${report.summary.lighthouse.passed}/${report.summary.lighthouse.total}
        </div>
        <div class="metric ${report.summary.bundleSize.passed === report.summary.bundleSize.total ? 'pass' : 'fail'}">
            Bundle Size: ${report.summary.bundleSize.passed}/${report.summary.bundleSize.total}
        </div>
        <div class="metric ${report.summary.api.passed === report.summary.api.total ? 'pass' : 'fail'}">
            API Performance: ${report.summary.api.passed}/${report.summary.api.total}
        </div>
        <div class="metric ${report.summary.loadTest.passed === report.summary.loadTest.total ? 'pass' : 'fail'}">
            Load Test: ${report.summary.loadTest.passed}/${report.summary.loadTest.total}
        </div>
    </div>
    
    <div class="section">
        <h2>Detailed Results</h2>
        <pre>${JSON.stringify(report.results, null, 2)}</pre>
    </div>
</body>
</html>`
  }

  checkForFailures() {
    const summary = this.generateSummary()
    return Object.values(summary).some(section => section.passed < section.total)
  }
}

// Run the performance tests
if (require.main === module) {
  const tester = new PerformanceTester()
  tester.runAllTests().catch(console.error)
}

module.exports = PerformanceTester
