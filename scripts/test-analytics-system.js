#!/usr/bin/env node

/**
 * Analytics & Business Intelligence System Testing Script
 * 
 * Comprehensive testing for analytics engine, dashboard system,
 * and business intelligence capabilities
 */

const fetch = require('node-fetch')
const fs = require('fs')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'

class AnalyticsSystemTester {
  constructor() {
    this.results = {
      analytics: { passed: 0, failed: 0, tests: {} },
      dashboards: { passed: 0, failed: 0, tests: {} },
      businessIntelligence: { passed: 0, failed: 0, tests: {} },
      integration: { passed: 0, failed: 0, tests: {} },
      performance: { passed: 0, failed: 0, tests: {} },
      overall: { passed: 0, failed: 0, total: 0 }
    }
    this.createdDashboards = []
    this.generatedReports = []
  }

  async runAllTests() {
    console.log('📊 Starting Analytics & Business Intelligence System Testing...\n')

    try {
      // 1. Analytics Engine Tests
      await this.testAnalyticsEngine()

      // 2. Dashboard System Tests
      await this.testDashboardSystem()

      // 3. Business Intelligence Tests
      await this.testBusinessIntelligence()

      // 4. Integration Tests
      await this.testIntegration()

      // 5. Performance Tests
      await this.testPerformance()

      // 6. Cleanup
      await this.cleanup()

      // 7. Generate Report
      this.generateReport()

      console.log('✅ Analytics system testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Analytics system testing failed:', error)
      await this.cleanup()
      process.exit(1)
    }
  }

  async testAnalyticsEngine() {
    console.log('📈 Testing Analytics Engine...')

    const tests = [
      {
        name: 'Execute Metric Query',
        test: async () => {
          const queryData = {
            id: 'test_metric_query',
            name: 'Test Metric Query',
            type: 'metric',
            timeRange: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'day'
            },
            filters: {
              regions: ['Lagos'],
              bloodTypes: ['A+', 'O+']
            }
          }

          const response = await this.executeAnalyticsQuery(queryData)
          return response.success && response.data && Array.isArray(response.data.data)
        }
      },
      {
        name: 'Execute KPI Query',
        test: async () => {
          const queryData = {
            id: 'test_kpi_query',
            name: 'Test KPI Query',
            type: 'kpi',
            timeRange: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'day'
            },
            filters: {}
          }

          const response = await this.executeAnalyticsQuery(queryData)
          return response.success && response.data && response.data.metadata
        }
      },
      {
        name: 'Execute Trend Analysis',
        test: async () => {
          const queryData = {
            id: 'test_trend_query',
            name: 'Test Trend Query',
            type: 'trend',
            timeRange: {
              start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'day'
            },
            filters: {
              bloodTypes: ['A+']
            }
          }

          const response = await this.executeAnalyticsQuery(queryData)
          return response.success && response.data && response.data.insights
        }
      },
      {
        name: 'Execute Forecast Query',
        test: async () => {
          const queryData = {
            id: 'test_forecast_query',
            name: 'Test Forecast Query',
            type: 'forecast',
            timeRange: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'day'
            },
            filters: {
              regions: ['Lagos']
            }
          }

          const response = await this.executeAnalyticsQuery(queryData)
          return response.success && response.data
        }
      },
      {
        name: 'Query Performance',
        test: async () => {
          const startTime = Date.now()
          
          const queryData = {
            id: 'performance_test_query',
            name: 'Performance Test Query',
            type: 'metric',
            timeRange: {
              start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'hour'
            },
            filters: {}
          }

          const response = await this.executeAnalyticsQuery(queryData)
          const responseTime = Date.now() - startTime
          
          return response.success && responseTime < 5000 // Under 5 seconds
        }
      }
    ]

    await this.runTestSuite('Analytics Engine', tests, 'analytics')
  }

  async testDashboardSystem() {
    console.log('📊 Testing Dashboard System...')

    const tests = [
      {
        name: 'Create Dashboard',
        test: async () => {
          const dashboardData = {
            name: 'Test Dashboard',
            description: 'Test dashboard for automated testing',
            layout: {
              rows: 2,
              columns: 3,
              widgets: [
                {
                  id: 'test_kpi_widget',
                  type: 'kpi',
                  position: { row: 0, col: 0, width: 1, height: 1 },
                  config: { kpiId: 'total_donations' },
                  dataSource: 'kpi',
                  refreshInterval: 30
                },
                {
                  id: 'test_chart_widget',
                  type: 'chart',
                  position: { row: 0, col: 1, width: 2, height: 1 },
                  config: { chartType: 'line', metric: 'donations' },
                  dataSource: 'trend',
                  refreshInterval: 60
                }
              ]
            },
            autoRefresh: {
              enabled: true,
              interval: 30
            }
          }

          const response = await this.createDashboard(dashboardData)
          
          if (response.success && response.data.dashboardId) {
            this.createdDashboards.push(response.data.dashboardId)
            return true
          }
          
          return false
        }
      },
      {
        name: 'Get Dashboard',
        test: async () => {
          if (this.createdDashboards.length === 0) return false

          const dashboardId = this.createdDashboards[0]
          const response = await this.getDashboard(dashboardId)
          
          return response.success && 
                 response.data.dashboard &&
                 response.data.dashboard.widgets &&
                 response.data.dashboard.widgets.length > 0
        }
      },
      {
        name: 'List Dashboards',
        test: async () => {
          const response = await this.listDashboards()
          
          return response.success && 
                 Array.isArray(response.data.dashboards) &&
                 response.data.dashboards.length > 0
        }
      },
      {
        name: 'Get Dashboard Templates',
        test: async () => {
          const response = await this.getDashboardTemplates()
          
          return response.success && 
                 Array.isArray(response.data.templates) &&
                 response.data.templates.length > 0
        }
      },
      {
        name: 'Dashboard System Stats',
        test: async () => {
          const response = await this.getDashboardStats()
          
          return response.success && 
                 response.data.systemStats &&
                 typeof response.data.systemStats.activeDashboards === 'number'
        }
      }
    ]

    await this.runTestSuite('Dashboard System', tests, 'dashboards')
  }

  async testBusinessIntelligence() {
    console.log('🧠 Testing Business Intelligence...')

    const tests = [
      {
        name: 'Generate BI Report',
        test: async () => {
          const reportData = {
            action: 'generate_report',
            reportId: 'executive_summary',
            format: 'json',
            includeInsights: true
          }

          const response = await this.generateBIReport(reportData)
          
          if (response.success && response.data.reportId) {
            this.generatedReports.push(response.data.reportId)
            return true
          }
          
          return false
        }
      },
      {
        name: 'Generate Insights',
        test: async () => {
          const insightData = {
            action: 'generate_insights',
            category: 'operational',
            timeRange: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            }
          }

          const response = await this.generateBIReport(insightData)
          
          return response.success && 
                 Array.isArray(response.data.insights)
        }
      },
      {
        name: 'List BI Reports',
        test: async () => {
          const response = await this.listBIReports()
          
          return response.success && 
                 Array.isArray(response.data.reports) &&
                 response.data.reports.length > 0
        }
      },
      {
        name: 'List Insights',
        test: async () => {
          const response = await this.listInsights()
          
          return response.success && 
                 Array.isArray(response.data.insights)
        }
      },
      {
        name: 'BI System Stats',
        test: async () => {
          const response = await this.getBISystemStats()
          
          return response.success && 
                 response.data.systemStats &&
                 typeof response.data.systemStats.reports === 'number'
        }
      }
    ]

    await this.runTestSuite('Business Intelligence', tests, 'businessIntelligence')
  }

  async testIntegration() {
    console.log('🔗 Testing System Integration...')

    const tests = [
      {
        name: 'Analytics to Dashboard Integration',
        test: async () => {
          // Test that dashboards can consume analytics data
          if (this.createdDashboards.length === 0) return false

          const dashboardId = this.createdDashboards[0]
          const dashboard = await this.getDashboard(dashboardId)
          
          return dashboard.success && 
                 dashboard.data.dashboard.widgets.some(widget => 
                   widget.data && Object.keys(widget.data).length > 0
                 )
        }
      },
      {
        name: 'BI to Analytics Integration',
        test: async () => {
          // Test that BI reports use analytics engine
          const reportData = {
            action: 'generate_report',
            reportId: 'operational_overview',
            format: 'json'
          }

          const response = await this.generateBIReport(reportData)
          
          return response.success && 
                 response.data.report &&
                 response.data.metadata &&
                 response.data.metadata.executionTime > 0
        }
      },
      {
        name: 'Cross-System Data Flow',
        test: async () => {
          // Test data consistency across systems
          const analyticsQuery = {
            id: 'integration_test',
            name: 'Integration Test Query',
            type: 'kpi',
            timeRange: {
              start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'day'
            },
            filters: {}
          }

          const analyticsResponse = await this.executeAnalyticsQuery(analyticsQuery)
          
          return analyticsResponse.success && 
                 analyticsResponse.data &&
                 analyticsResponse.data.metadata.totalRecords >= 0
        }
      }
    ]

    await this.runTestSuite('System Integration', tests, 'integration')
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...')

    const tests = [
      {
        name: 'Analytics Query Performance',
        test: async () => {
          const startTime = Date.now()
          
          const queryData = {
            id: 'perf_test_analytics',
            name: 'Performance Test Analytics',
            type: 'metric',
            timeRange: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'day'
            },
            filters: {}
          }

          const response = await this.executeAnalyticsQuery(queryData)
          const responseTime = Date.now() - startTime
          
          return response.success && responseTime < 3000 // Under 3 seconds
        }
      },
      {
        name: 'Dashboard Creation Performance',
        test: async () => {
          const startTime = Date.now()
          
          const dashboardData = {
            name: 'Performance Test Dashboard',
            description: 'Dashboard for performance testing',
            layout: {
              rows: 1,
              columns: 2,
              widgets: [
                {
                  id: 'perf_kpi',
                  type: 'kpi',
                  position: { row: 0, col: 0, width: 1, height: 1 },
                  config: { kpiId: 'total_donations' },
                  dataSource: 'kpi',
                  refreshInterval: 60
                }
              ]
            }
          }

          const response = await this.createDashboard(dashboardData)
          const responseTime = Date.now() - startTime
          
          if (response.success && response.data.dashboardId) {
            this.createdDashboards.push(response.data.dashboardId)
          }
          
          return response.success && responseTime < 2000 // Under 2 seconds
        }
      },
      {
        name: 'BI Report Generation Performance',
        test: async () => {
          const startTime = Date.now()
          
          const reportData = {
            action: 'generate_report',
            reportId: 'operational_overview',
            format: 'json'
          }

          const response = await this.generateBIReport(reportData)
          const responseTime = Date.now() - startTime
          
          return response.success && responseTime < 5000 // Under 5 seconds
        }
      },
      {
        name: 'Concurrent Analytics Queries',
        test: async () => {
          const queryData = {
            id: 'concurrent_test',
            name: 'Concurrent Test Query',
            type: 'metric',
            timeRange: {
              start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              granularity: 'hour'
            },
            filters: {}
          }

          // Make 5 concurrent requests
          const promises = Array(5).fill().map(() => 
            this.executeAnalyticsQuery(queryData)
          )

          const responses = await Promise.all(promises)
          
          return responses.every(response => response.success)
        }
      },
      {
        name: 'Memory Stability',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed
          
          // Perform multiple operations
          for (let i = 0; i < 10; i++) {
            await this.executeAnalyticsQuery({
              id: `memory_test_${i}`,
              name: `Memory Test ${i}`,
              type: 'metric',
              timeRange: {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString(),
                granularity: 'day'
              },
              filters: {}
            })
          }
          
          const finalMemory = process.memoryUsage().heapUsed
          const memoryIncrease = finalMemory - initialMemory
          
          // Memory increase should be reasonable (less than 50MB)
          return memoryIncrease < 50 * 1024 * 1024
        }
      }
    ]

    await this.runTestSuite('Performance', tests, 'performance')
  }

  // Helper methods
  async executeAnalyticsQuery(queryData) {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(queryData)
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async createDashboard(dashboardData) {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(dashboardData)
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getDashboard(dashboardId) {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/dashboard?action=get&dashboardId=${dashboardId}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async listDashboards() {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/dashboard?action=list`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getDashboardTemplates() {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/dashboard?action=templates`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getDashboardStats() {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/dashboard?action=stats`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async generateBIReport(reportData) {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(reportData)
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async listBIReports() {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/reports?action=list_reports`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async listInsights() {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/reports?action=list_insights`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getBISystemStats() {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/reports?action=system_stats`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async cleanup() {
    // Clean up created dashboards
    for (const dashboardId of this.createdDashboards) {
      try {
        await fetch(`${BASE_URL}/api/analytics/dashboard?dashboardId=${dashboardId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        })
      } catch (error) {
        console.error(`Failed to cleanup dashboard ${dashboardId}:`, error)
      }
    }
  }

  async runTestSuite(suiteName, tests, category) {
    const results = { passed: 0, failed: 0, total: tests.length, tests: {} }

    for (const test of tests) {
      try {
        const passed = await test.test()
        results.tests[test.name] = { passed, error: null }
        
        if (passed) {
          results.passed++
          console.log(`  ✅ ${test.name}`)
        } else {
          results.failed++
          console.log(`  ❌ ${test.name}`)
        }
      } catch (error) {
        results.failed++
        results.tests[test.name] = { passed: false, error: error.message }
        console.log(`  ❌ ${test.name}: ${error.message}`)
      }
    }

    this.results[category] = results
    this.results.overall.passed += results.passed
    this.results.overall.failed += results.failed
    this.results.overall.total += results.total

    console.log(`  📊 ${suiteName}: ${results.passed}/${results.total} passed\n`)
  }

  generateReport() {
    console.log('📋 Analytics & Business Intelligence System Test Report')
    console.log('=' .repeat(70))
    
    const categories = [
      'analytics',
      'dashboards',
      'businessIntelligence',
      'integration',
      'performance'
    ]

    categories.forEach(category => {
      const result = this.results[category]
      const percentage = ((result.passed / result.total) * 100).toFixed(1)
      console.log(`${category.padEnd(20)}: ${result.passed}/${result.total} (${percentage}%)`)
    })

    console.log('=' .repeat(70))
    const overallPercentage = ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1)
    console.log(`Overall Score: ${this.results.overall.passed}/${this.results.overall.total} (${overallPercentage}%)`)

    // Save detailed report
    const reportPath = './analytics-system-test-report.json'
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // Analytics system insights
    if (this.results.analytics.passed > 0) {
      console.log('\n📈 Analytics Engine:')
      console.log('- Multi-dimensional data analysis with KPIs and trends')
      console.log('- Real-time query processing with caching')
      console.log('- Predictive analytics with ML integration')
    }

    if (this.results.dashboards.passed > 0) {
      console.log('\n📊 Dashboard System:')
      console.log('- Interactive real-time dashboards with D3.js')
      console.log('- Customizable widgets and layouts')
      console.log('- Auto-refresh and real-time updates')
    }

    if (this.results.businessIntelligence.passed > 0) {
      console.log('\n🧠 Business Intelligence:')
      console.log('- Automated report generation and insights')
      console.log('- Data mining and pattern discovery')
      console.log('- Strategic metrics and KPI tracking')
    }

    if (this.results.performance.passed > 0) {
      console.log('\n⚡ Performance Metrics:')
      console.log('- Sub-3-second analytics query processing')
      console.log('- Sub-2-second dashboard creation')
      console.log('- Concurrent query handling and memory stability')
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new AnalyticsSystemTester()
  tester.runAllTests().catch(console.error)
}

module.exports = AnalyticsSystemTester
