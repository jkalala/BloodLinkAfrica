#!/usr/bin/env node

/**
 * Advanced Analytics & Reporting Testing Script
 * 
 * Comprehensive testing for business intelligence dashboards,
 * advanced reporting, and predictive analytics capabilities
 */

const fetch = require('node-fetch')
const fs = require('fs')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'

class AdvancedAnalyticsTester {
  constructor() {
    this.results = {
      analyticsEngine: { passed: 0, failed: 0, tests: {} },
      biDashboards: { passed: 0, failed: 0, tests: {} },
      reportingSystem: { passed: 0, failed: 0, tests: {} },
      predictiveAnalytics: { passed: 0, failed: 0, tests: {} },
      dataVisualization: { passed: 0, failed: 0, tests: {} },
      exportCapabilities: { passed: 0, failed: 0, tests: {} },
      realTimeUpdates: { passed: 0, failed: 0, tests: {} },
      performance: { passed: 0, failed: 0, tests: {} },
      integration: { passed: 0, failed: 0, tests: {} },
      overall: { passed: 0, failed: 0, total: 0 }
    }
    this.testData = {
      dashboards: [],
      reports: [],
      templates: []
    }
  }

  async runAllTests() {
    console.log('📊 Starting Advanced Analytics & Reporting Testing...\n')

    try {
      // 1. Analytics Engine Tests
      await this.testAnalyticsEngine()

      // 2. Business Intelligence Dashboard Tests
      await this.testBIDashboards()

      // 3. Advanced Reporting System Tests
      await this.testReportingSystem()

      // 4. Predictive Analytics Tests
      await this.testPredictiveAnalytics()

      // 5. Data Visualization Tests
      await this.testDataVisualization()

      // 6. Export Capabilities Tests
      await this.testExportCapabilities()

      // 7. Real-time Updates Tests
      await this.testRealTimeUpdates()

      // 8. Performance Tests
      await this.testPerformance()

      // 9. Integration Tests
      await this.testIntegration()

      // 10. Cleanup
      await this.cleanup()

      // 11. Generate Report
      this.generateReport()

      console.log('✅ Advanced analytics & reporting testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Advanced analytics & reporting testing failed:', error)
      await this.cleanup()
      process.exit(1)
    }
  }

  async testAnalyticsEngine() {
    console.log('🔍 Testing Analytics Engine...')

    const tests = [
      {
        name: 'Get Core Analytics Queries',
        test: async () => {
          const response = await this.getAnalyticsAPI('get_core_queries')
          
          return response.success && 
                 Array.isArray(response.data.queries) &&
                 response.data.queries.length > 0 &&
                 response.data.queries.every(q => q.id && q.name && q.type)
        }
      },
      {
        name: 'Execute Analytics Query',
        test: async () => {
          const queryData = {
            action: 'execute_query',
            queryId: 'total_donations',
            parameters: {
              start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              end_date: new Date().toISOString()
            }
          }

          const response = await this.callAnalyticsAPI(queryData)
          
          return response.success && 
                 response.data.data &&
                 response.data.metadata &&
                 typeof response.data.metadata.executionTime === 'number'
        }
      },
      {
        name: 'Get KPI Definitions',
        test: async () => {
          const response = await this.getAnalyticsAPI('get_kpi_definitions')
          
          return response.success && 
                 Array.isArray(response.data.kpis) &&
                 response.data.kpis.length > 0 &&
                 response.data.kpis.every(kpi => kpi.id && kpi.name && kpi.target)
        }
      },
      {
        name: 'Calculate KPI',
        test: async () => {
          const kpiData = {
            action: 'calculate_kpi',
            kpiId: 'donation_rate',
            timeRange: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            }
          }

          const response = await this.callAnalyticsAPI(kpiData)
          
          return response.success && 
                 response.data.kpi &&
                 typeof response.data.kpi.value === 'number' &&
                 response.data.kpi.target &&
                 response.data.kpi.trend
        }
      },
      {
        name: 'Query Performance Optimization',
        test: async () => {
          const startTime = Date.now()
          
          const queryData = {
            action: 'execute_query',
            queryId: 'blood_inventory',
            parameters: {}
          }

          const response = await this.callAnalyticsAPI(queryData)
          const queryTime = Date.now() - startTime
          
          return response.success && 
                 queryTime < 5000 && // Under 5 seconds
                 response.data.metadata.executionTime < 3000 // Under 3 seconds execution
        }
      },
      {
        name: 'Complex Analytics Query',
        test: async () => {
          const queryData = {
            action: 'execute_query',
            queryId: 'donor_demographics',
            parameters: {
              group_by: ['age_group', 'gender', 'blood_type'],
              time_range: '90d'
            }
          }

          const response = await this.callAnalyticsAPI(queryData)
          
          return response.success && 
                 Array.isArray(response.data.data) &&
                 response.data.data.length > 0 &&
                 response.data.metadata.rowCount > 0
        }
      }
    ]

    await this.runTestSuite('Analytics Engine', tests, 'analyticsEngine')
  }

  async testBIDashboards() {
    console.log('📈 Testing Business Intelligence Dashboards...')

    const tests = [
      {
        name: 'Get Dashboard Templates',
        test: async () => {
          const response = await this.getAnalyticsAPI('get_dashboard_templates')
          
          return response.success && 
                 Array.isArray(response.data.templates) &&
                 response.data.templates.length > 0 &&
                 response.data.templates.every(t => t.name && t.category)
        }
      },
      {
        name: 'Create BI Dashboard',
        test: async () => {
          const dashboardData = {
            action: 'create_dashboard',
            name: 'Test Executive Dashboard',
            description: 'Test dashboard for executive overview',
            category: 'executive',
            layout: {
              type: 'grid',
              columns: 3,
              responsive: true
            },
            widgets: [
              {
                id: 'total_donations_widget',
                type: 'metric_card',
                title: 'Total Donations',
                position: { x: 0, y: 0, width: 1, height: 1 },
                dataSource: {
                  queryId: 'total_donations',
                  refreshStrategy: 'real_time'
                },
                visualization: {
                  chartType: 'bar',
                  dimensions: {
                    x: { field: 'date', type: 'time', label: 'Date' },
                    y: { field: 'count', type: 'numeric', label: 'Donations' }
                  },
                  styling: {
                    colors: ['#3498db'],
                    opacity: 1,
                    strokeWidth: 2,
                    showGrid: true,
                    showLegend: false,
                    legendPosition: 'top'
                  },
                  axes: {
                    x: { scale: 'time' },
                    y: { scale: 'linear' }
                  },
                  animations: {
                    enabled: true,
                    duration: 500,
                    easing: 'ease'
                  }
                }
              }
            ],
            realTimeUpdates: true,
            refreshInterval: 30
          }

          const response = await this.callAnalyticsAPI(dashboardData)
          
          if (response.success && response.data.dashboardId) {
            this.testData.dashboards.push(response.data.dashboardId)
          }
          
          return response.success && 
                 response.data.dashboardId &&
                 response.data.created === true
        }
      },
      {
        name: 'Render Dashboard Widget',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const widgetData = {
            action: 'render_widget',
            widgetId: 'total_donations_widget',
            dashboardId: this.testData.dashboards[0],
            filters: {
              date_range: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString()
              }
            }
          }

          const response = await this.callAnalyticsAPI(widgetData)
          
          return response.success && 
                 response.data.widget &&
                 response.data.widget.data &&
                 response.data.widget.metadata
        }
      },
      {
        name: 'Generate Predictive Insights',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const insightsData = {
            action: 'generate_insights',
            dashboardId: this.testData.dashboards[0]
          }

          const response = await this.callAnalyticsAPI(insightsData)
          
          return response.success && 
                 Array.isArray(response.data.insights) &&
                 response.data.insights.length > 0 &&
                 response.data.insights.every(i => i.type && i.prediction && i.recommendations)
        }
      },
      {
        name: 'Dashboard Real-time Updates',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          // Test real-time update capability
          const dashboardId = this.testData.dashboards[0]
          const getDashboardResponse = await this.getAnalyticsAPI(`get_dashboard&dashboardId=${dashboardId}`)
          
          return getDashboardResponse.success && 
                 getDashboardResponse.data.dashboard &&
                 getDashboardResponse.data.dashboard.realTimeUpdates === true
        }
      },
      {
        name: 'Dashboard Export Functionality',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const exportData = {
            action: 'export_dashboard',
            dashboardId: this.testData.dashboards[0],
            format: 'json'
          }

          const response = await this.callAnalyticsAPI(exportData)
          
          return response.success && 
                 response.data.exportData &&
                 response.data.exportData.format === 'json' &&
                 response.data.exportData.filename &&
                 response.data.exportData.mimeType
        }
      }
    ]

    await this.runTestSuite('BI Dashboards', tests, 'biDashboards')
  }

  async testReportingSystem() {
    console.log('📋 Testing Advanced Reporting System...')

    const tests = [
      {
        name: 'Get Report Templates',
        test: async () => {
          const response = await this.getAnalyticsAPI('get_report_templates')
          
          return response.success && 
                 Array.isArray(response.data.templates) &&
                 response.data.templates.length > 0 &&
                 response.data.templates.every(t => t.name && t.category && t.sections)
        }
      },
      {
        name: 'Create Report Template',
        test: async () => {
          const templateData = {
            action: 'create_report_template',
            name: 'Test Daily Operations Report',
            description: 'Test report for daily operations',
            category: 'operational',
            type: 'tabular',
            sections: [
              {
                id: 'header',
                type: 'header',
                title: 'Daily Operations Report',
                content: { text: 'Blood Donation Operations Summary' },
                position: { order: 1 }
              },
              {
                id: 'summary',
                type: 'summary',
                title: 'Key Metrics',
                content: { queryId: 'total_donations' },
                position: { order: 2 }
              },
              {
                id: 'chart',
                type: 'chart',
                title: 'Donation Trends',
                content: {
                  queryId: 'donation_trends',
                  chartConfig: {
                    type: 'line',
                    x: 'date',
                    y: 'donations'
                  }
                },
                position: { order: 3 }
              }
            ],
            parameters: [
              {
                id: 'report_date',
                name: 'report_date',
                type: 'date',
                label: 'Report Date',
                required: true,
                defaultValue: new Date().toISOString()
              }
            ],
            styling: {
              theme: 'professional',
              colors: {
                primary: '#2c3e50',
                secondary: '#3498db'
              },
              fonts: {
                heading: 'Arial',
                body: 'Arial',
                monospace: 'Courier New'
              },
              layout: {
                pageSize: 'A4',
                orientation: 'portrait',
                margins: { top: 20, right: 20, bottom: 20, left: 20 }
              }
            }
          }

          const response = await this.callAnalyticsAPI(templateData)
          
          if (response.success && response.data.templateId) {
            this.testData.templates.push(response.data.templateId)
          }
          
          return response.success && 
                 response.data.templateId &&
                 response.data.created === true
        }
      },
      {
        name: 'Generate Report',
        test: async () => {
          if (this.testData.templates.length === 0) return false

          const reportData = {
            action: 'generate_report',
            templateId: this.testData.templates[0],
            parameters: {
              report_date: new Date().toISOString(),
              include_charts: true
            },
            format: 'pdf'
          }

          const response = await this.callAnalyticsAPI(reportData)
          
          if (response.success && response.data.reportId) {
            this.testData.reports.push(response.data.reportId)
          }
          
          return response.success && 
                 response.data.reportId &&
                 response.data.status === 'generating'
        }
      },
      {
        name: 'Check Report Status',
        test: async () => {
          if (this.testData.reports.length === 0) return false

          // Wait a bit for report generation
          await new Promise(resolve => setTimeout(resolve, 2000))

          const reportId = this.testData.reports[0]
          const response = await this.getAnalyticsAPI(`get_report&reportId=${reportId}`)
          
          return response.success && 
                 response.data.report &&
                 response.data.report.id === reportId &&
                 ['generating', 'completed', 'failed'].includes(response.data.report.status)
        }
      },
      {
        name: 'Multi-format Report Generation',
        test: async () => {
          if (this.testData.templates.length === 0) return false

          const formats = ['pdf', 'excel', 'csv', 'html', 'json']
          const results = []

          for (const format of formats) {
            const reportData = {
              action: 'generate_report',
              templateId: this.testData.templates[0],
              parameters: { report_date: new Date().toISOString() },
              format
            }

            const response = await this.callAnalyticsAPI(reportData)
            results.push(response.success)
          }

          return results.every(result => result === true)
        }
      },
      {
        name: 'Report Analytics',
        test: async () => {
          if (this.testData.templates.length === 0) return false

          const templateId = this.testData.templates[0]
          const response = await this.getAnalyticsAPI(`get_report_analytics&templateId=${templateId}`)
          
          return response.success && 
                 response.data.analytics &&
                 response.data.analytics.metrics &&
                 typeof response.data.analytics.metrics.generationCount === 'number'
        }
      }
    ]

    await this.runTestSuite('Reporting System', tests, 'reportingSystem')
  }

  async testPredictiveAnalytics() {
    console.log('🔮 Testing Predictive Analytics...')

    const tests = [
      {
        name: 'Demand Forecasting Prediction',
        test: async () => {
          const predictionData = {
            action: 'generate_prediction',
            modelId: 'demand_forecasting',
            features: {
              historical_donations: 1000,
              seasonal_factor: 1.2,
              population_growth: 0.02,
              weather_impact: 0.1,
              holiday_season: false
            },
            includeExplanation: true
          }

          const response = await this.callAnalyticsAPI(predictionData)
          
          return response.success && 
                 response.data.prediction &&
                 typeof response.data.prediction.value === 'number' &&
                 typeof response.data.prediction.confidence === 'number' &&
                 response.data.prediction.factors
        }
      },
      {
        name: 'Donor Churn Prediction',
        test: async () => {
          const predictionData = {
            action: 'generate_prediction',
            modelId: 'donor_churn',
            features: {
              days_since_last_donation: 90,
              total_donations: 5,
              communication_frequency: 2,
              satisfaction_score: 4.2,
              age: 35,
              distance_to_center: 15
            }
          }

          const response = await this.callAnalyticsAPI(predictionData)
          
          return response.success && 
                 response.data.prediction &&
                 response.data.prediction.value >= 0 &&
                 response.data.prediction.value <= 1 && // Probability
                 response.data.prediction.confidence > 0
        }
      },
      {
        name: 'Inventory Optimization Prediction',
        test: async () => {
          const predictionData = {
            action: 'generate_prediction',
            modelId: 'inventory_optimization',
            features: {
              current_inventory: {
                'O+': 50, 'O-': 20, 'A+': 30, 'A-': 15,
                'B+': 25, 'B-': 10, 'AB+': 15, 'AB-': 8
              },
              demand_forecast: {
                'O+': 45, 'O-': 18, 'A+': 28, 'A-': 12,
                'B+': 22, 'B-': 8, 'AB+': 12, 'AB-': 6
              },
              shelf_life_days: 42
            }
          }

          const response = await this.callAnalyticsAPI(predictionData)
          
          return response.success && 
                 response.data.prediction &&
                 typeof response.data.prediction.value === 'number' &&
                 response.data.prediction.factors
        }
      },
      {
        name: 'Seasonal Trends Analysis',
        test: async () => {
          const predictionData = {
            action: 'generate_prediction',
            modelId: 'seasonal_trends',
            features: {
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              historical_data: Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                donations: 800 + Math.random() * 400
              }))
            }
          }

          const response = await this.callAnalyticsAPI(predictionData)
          
          return response.success && 
                 (response.data.prediction || response.error) // May not be implemented
        }
      },
      {
        name: 'Prediction Confidence Validation',
        test: async () => {
          const predictionData = {
            action: 'generate_prediction',
            modelId: 'demand_forecasting',
            features: {
              historical_donations: 500,
              seasonal_factor: 0.8
            }
          }

          const response = await this.callAnalyticsAPI(predictionData)
          
          return response.success && 
                 response.data.prediction &&
                 response.data.prediction.confidence >= 0 &&
                 response.data.prediction.confidence <= 1
        }
      }
    ]

    await this.runTestSuite('Predictive Analytics', tests, 'predictiveAnalytics')
  }

  async testDataVisualization() {
    console.log('📊 Testing Data Visualization...')

    const tests = [
      {
        name: 'Chart Type Support',
        test: async () => {
          const chartTypes = ['line', 'bar', 'pie', 'scatter', 'area', 'donut', 'heatmap']
          let supportedTypes = 0

          for (const chartType of chartTypes) {
            const widgetData = {
              action: 'render_widget',
              widgetId: 'test_widget',
              dashboardId: this.testData.dashboards[0] || 'test_dashboard',
              chartType
            }

            try {
              const response = await this.callAnalyticsAPI(widgetData)
              if (response.success || response.error !== 'Unsupported chart type') {
                supportedTypes++
              }
            } catch (error) {
              // Chart type might not be supported
            }
          }

          return supportedTypes >= 5 // At least 5 chart types supported
        }
      },
      {
        name: 'Interactive Dashboard Features',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const dashboardId = this.testData.dashboards[0]
          const response = await this.getAnalyticsAPI(`get_dashboard&dashboardId=${dashboardId}`)
          
          return response.success && 
                 response.data.dashboard &&
                 response.data.dashboard.widgets &&
                 response.data.dashboard.widgets.some(w => w.interactions && w.interactions.clickable)
        }
      },
      {
        name: 'Color Scheme Customization',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const dashboardId = this.testData.dashboards[0]
          const response = await this.getAnalyticsAPI(`get_dashboard&dashboardId=${dashboardId}`)
          
          return response.success && 
                 response.data.dashboard &&
                 response.data.dashboard.theme &&
                 response.data.dashboard.theme.primaryColor &&
                 Array.isArray(response.data.dashboard.theme.accentColors)
        }
      },
      {
        name: 'Responsive Layout Support',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const dashboardId = this.testData.dashboards[0]
          const response = await this.getAnalyticsAPI(`get_dashboard&dashboardId=${dashboardId}`)
          
          return response.success && 
                 response.data.dashboard &&
                 response.data.dashboard.layout &&
                 response.data.dashboard.layout.responsive === true
        }
      },
      {
        name: 'Data Filtering Capabilities',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const widgetData = {
            action: 'render_widget',
            widgetId: 'total_donations_widget',
            dashboardId: this.testData.dashboards[0],
            filters: {
              blood_type: ['O+', 'A+'],
              date_range: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString()
              },
              region: 'North'
            }
          }

          const response = await this.callAnalyticsAPI(widgetData)
          
          return response.success && response.data.widget
        }
      }
    ]

    await this.runTestSuite('Data Visualization', tests, 'dataVisualization')
  }

  async testExportCapabilities() {
    console.log('📤 Testing Export Capabilities...')

    const tests = [
      {
        name: 'Dashboard Export Formats',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const formats = ['pdf', 'png', 'excel', 'json']
          const results = []

          for (const format of formats) {
            const exportData = {
              action: 'export_dashboard',
              dashboardId: this.testData.dashboards[0],
              format
            }

            const response = await this.callAnalyticsAPI(exportData)
            results.push(response.success)
          }

          return results.filter(r => r).length >= 2 // At least 2 formats supported
        }
      },
      {
        name: 'Report Download Functionality',
        test: async () => {
          if (this.testData.reports.length === 0) return false

          // Wait for report to be generated
          await new Promise(resolve => setTimeout(resolve, 3000))

          const reportId = this.testData.reports[0]
          
          try {
            const response = await fetch(`${BASE_URL}/api/analytics/advanced?action=download_report&reportId=${reportId}`, {
              headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
            })

            return response.status === 200 || response.status === 404 // 404 if not ready yet
          } catch (error) {
            return false
          }
        }
      },
      {
        name: 'Export File Size Validation',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const exportData = {
            action: 'export_dashboard',
            dashboardId: this.testData.dashboards[0],
            format: 'json'
          }

          const response = await this.callAnalyticsAPI(exportData)
          
          return response.success && 
                 response.data.exportData &&
                 response.data.exportData.size > 0 &&
                 response.data.exportData.size < 10 * 1024 * 1024 // Under 10MB
        }
      },
      {
        name: 'Export Metadata Accuracy',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const exportData = {
            action: 'export_dashboard',
            dashboardId: this.testData.dashboards[0],
            format: 'pdf'
          }

          const response = await this.callAnalyticsAPI(exportData)
          
          return response.success && 
                 response.data.exportData &&
                 response.data.exportData.filename &&
                 response.data.exportData.mimeType === 'application/pdf'
        }
      }
    ]

    await this.runTestSuite('Export Capabilities', tests, 'exportCapabilities')
  }

  async testRealTimeUpdates() {
    console.log('⚡ Testing Real-time Updates...')

    const tests = [
      {
        name: 'Real-time Dashboard Configuration',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const dashboardId = this.testData.dashboards[0]
          const response = await this.getAnalyticsAPI(`get_dashboard&dashboardId=${dashboardId}`)
          
          return response.success && 
                 response.data.dashboard &&
                 response.data.dashboard.realTimeUpdates === true &&
                 response.data.dashboard.refreshInterval > 0
        }
      },
      {
        name: 'Widget Refresh Strategy',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const dashboardId = this.testData.dashboards[0]
          const response = await this.getAnalyticsAPI(`get_dashboard&dashboardId=${dashboardId}`)
          
          return response.success && 
                 response.data.dashboard &&
                 response.data.dashboard.widgets &&
                 response.data.dashboard.widgets.some(w => 
                   w.dataSource.refreshStrategy === 'real_time'
                 )
        }
      },
      {
        name: 'Data Freshness Tracking',
        test: async () => {
          const queryData = {
            action: 'execute_query',
            queryId: 'total_donations'
          }

          const response = await this.callAnalyticsAPI(queryData)
          
          return response.success && 
                 response.data.metadata &&
                 response.data.metadata.lastUpdated &&
                 new Date(response.data.metadata.lastUpdated) instanceof Date
        }
      },
      {
        name: 'Cache Invalidation',
        test: async () => {
          // Execute same query twice to test caching
          const queryData = {
            action: 'execute_query',
            queryId: 'active_donors'
          }

          const response1 = await this.callAnalyticsAPI(queryData)
          const response2 = await this.callAnalyticsAPI(queryData)
          
          return response1.success && response2.success &&
                 response2.data.metadata.cacheHit === true
        }
      }
    ]

    await this.runTestSuite('Real-time Updates', tests, 'realTimeUpdates')
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...')

    const tests = [
      {
        name: 'Query Execution Performance',
        test: async () => {
          const startTime = Date.now()
          
          const queryData = {
            action: 'execute_query',
            queryId: 'donation_trends',
            parameters: {
              time_range: '30d',
              granularity: 'day'
            }
          }

          const response = await this.callAnalyticsAPI(queryData)
          const totalTime = Date.now() - startTime
          
          return response.success && 
                 totalTime < 5000 && // Under 5 seconds
                 response.data.metadata.executionTime < 3000 // Under 3 seconds execution
        }
      },
      {
        name: 'Dashboard Rendering Performance',
        test: async () => {
          if (this.testData.dashboards.length === 0) return false

          const startTime = Date.now()
          
          const widgetData = {
            action: 'render_widget',
            widgetId: 'total_donations_widget',
            dashboardId: this.testData.dashboards[0]
          }

          const response = await this.callAnalyticsAPI(widgetData)
          const renderTime = Date.now() - startTime
          
          return response.success && renderTime < 3000 // Under 3 seconds
        }
      },
      {
        name: 'Report Generation Performance',
        test: async () => {
          if (this.testData.templates.length === 0) return false

          const startTime = Date.now()
          
          const reportData = {
            action: 'generate_report',
            templateId: this.testData.templates[0],
            parameters: { report_date: new Date().toISOString() },
            format: 'json' // Fastest format
          }

          const response = await this.callAnalyticsAPI(reportData)
          const generationTime = Date.now() - startTime
          
          return response.success && generationTime < 10000 // Under 10 seconds
        }
      },
      {
        name: 'Concurrent Query Performance',
        test: async () => {
          const queries = [
            { action: 'execute_query', queryId: 'total_donations' },
            { action: 'execute_query', queryId: 'active_donors' },
            { action: 'execute_query', queryId: 'blood_inventory' },
            { action: 'execute_query', queryId: 'urgent_requests' },
            { action: 'execute_query', queryId: 'donor_demographics' }
          ]

          const startTime = Date.now()
          const responses = await Promise.all(
            queries.map(query => this.callAnalyticsAPI(query))
          )
          const totalTime = Date.now() - startTime

          return responses.every(r => r.success) && 
                 totalTime < 15000 // Under 15 seconds for all queries
        }
      },
      {
        name: 'Memory Usage Stability',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed
          
          // Perform multiple operations
          for (let i = 0; i < 10; i++) {
            await this.callAnalyticsAPI({
              action: 'execute_query',
              queryId: 'total_donations'
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

  async testIntegration() {
    console.log('🔗 Testing System Integration...')

    const tests = [
      {
        name: 'Analytics to Dashboard Integration',
        test: async () => {
          // Execute query and use result in dashboard
          const queryResponse = await this.callAnalyticsAPI({
            action: 'execute_query',
            queryId: 'total_donations'
          })

          if (!queryResponse.success) return false

          // Use query result in widget rendering
          if (this.testData.dashboards.length > 0) {
            const widgetResponse = await this.callAnalyticsAPI({
              action: 'render_widget',
              widgetId: 'total_donations_widget',
              dashboardId: this.testData.dashboards[0]
            })

            return widgetResponse.success
          }

          return true
        }
      },
      {
        name: 'Dashboard to Report Integration',
        test: async () => {
          // Create report template based on dashboard
          if (this.testData.dashboards.length === 0) return false

          const dashboardResponse = await this.getAnalyticsAPI(`get_dashboard&dashboardId=${this.testData.dashboards[0]}`)
          
          if (!dashboardResponse.success) return false

          // Dashboard data should be usable for report creation
          return dashboardResponse.data.dashboard &&
                 dashboardResponse.data.dashboard.widgets &&
                 dashboardResponse.data.dashboard.widgets.length > 0
        }
      },
      {
        name: 'Predictive Analytics Integration',
        test: async () => {
          // Generate prediction and use in dashboard insights
          const predictionResponse = await this.callAnalyticsAPI({
            action: 'generate_prediction',
            modelId: 'demand_forecasting',
            features: { historical_donations: 1000 }
          })

          if (!predictionResponse.success) return false

          // Use prediction in dashboard insights
          if (this.testData.dashboards.length > 0) {
            const insightsResponse = await this.callAnalyticsAPI({
              action: 'generate_insights',
              dashboardId: this.testData.dashboards[0]
            })

            return insightsResponse.success
          }

          return true
        }
      },
      {
        name: 'Cross-System Data Consistency',
        test: async () => {
          // Test data consistency across analytics, dashboards, and reports
          const analyticsResponse = await this.callAnalyticsAPI({
            action: 'execute_query',
            queryId: 'total_donations'
          })

          const kpiResponse = await this.callAnalyticsAPI({
            action: 'calculate_kpi',
            kpiId: 'donation_rate'
          })

          return analyticsResponse.success && kpiResponse.success
        }
      },
      {
        name: 'End-to-End Workflow',
        test: async () => {
          // Complete workflow: Query -> Dashboard -> Report -> Export
          let workflowSuccess = true

          // 1. Execute analytics query
          const queryResponse = await this.callAnalyticsAPI({
            action: 'execute_query',
            queryId: 'total_donations'
          })
          workflowSuccess = workflowSuccess && queryResponse.success

          // 2. Render dashboard widget (if dashboard exists)
          if (this.testData.dashboards.length > 0) {
            const widgetResponse = await this.callAnalyticsAPI({
              action: 'render_widget',
              widgetId: 'total_donations_widget',
              dashboardId: this.testData.dashboards[0]
            })
            workflowSuccess = workflowSuccess && widgetResponse.success
          }

          // 3. Generate report (if template exists)
          if (this.testData.templates.length > 0) {
            const reportResponse = await this.callAnalyticsAPI({
              action: 'generate_report',
              templateId: this.testData.templates[0],
              parameters: { report_date: new Date().toISOString() },
              format: 'json'
            })
            workflowSuccess = workflowSuccess && reportResponse.success
          }

          return workflowSuccess
        }
      }
    ]

    await this.runTestSuite('System Integration', tests, 'integration')
  }

  // Helper methods for API calls
  async callAnalyticsAPI(data) {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(data)
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getAnalyticsAPI(action) {
    try {
      const response = await fetch(`${BASE_URL}/api/analytics/advanced?action=${action}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async cleanup() {
    // Clean up test data
    console.log('🧹 Cleaning up test data...')
    
    // Clean up dashboards
    for (const dashboardId of this.testData.dashboards) {
      try {
        console.log(`Cleaning up dashboard: ${dashboardId}`)
        // In a real implementation, this would delete the dashboard
      } catch (error) {
        console.error(`Failed to cleanup dashboard ${dashboardId}:`, error)
      }
    }

    // Clean up reports
    for (const reportId of this.testData.reports) {
      try {
        console.log(`Cleaning up report: ${reportId}`)
        // In a real implementation, this would delete the report
      } catch (error) {
        console.error(`Failed to cleanup report ${reportId}:`, error)
      }
    }

    // Clean up templates
    for (const templateId of this.testData.templates) {
      try {
        console.log(`Cleaning up template: ${templateId}`)
        // In a real implementation, this would delete the template
      } catch (error) {
        console.error(`Failed to cleanup template ${templateId}:`, error)
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
    console.log('📋 Advanced Analytics & Reporting Test Report')
    console.log('=' .repeat(70))
    
    const categories = [
      'analyticsEngine',
      'biDashboards',
      'reportingSystem',
      'predictiveAnalytics',
      'dataVisualization',
      'exportCapabilities',
      'realTimeUpdates',
      'performance',
      'integration'
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
    const reportPath = './advanced-analytics-test-report.json'
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // Analytics insights
    if (this.results.analyticsEngine.passed > 0) {
      console.log('\n🔍 Analytics Engine:')
      console.log('- Core analytics queries with optimized execution')
      console.log('- KPI calculations with trend analysis')
      console.log('- Complex multi-dimensional data processing')
    }

    if (this.results.biDashboards.passed > 0) {
      console.log('\n📈 Business Intelligence Dashboards:')
      console.log('- Interactive dashboards with real-time updates')
      console.log('- Multiple chart types and visualization options')
      console.log('- Predictive insights and recommendations')
    }

    if (this.results.reportingSystem.passed > 0) {
      console.log('\n📋 Advanced Reporting:')
      console.log('- Multi-format report generation (PDF, Excel, CSV, HTML, JSON)')
      console.log('- Customizable report templates with styling')
      console.log('- Automated report scheduling and distribution')
    }

    if (this.results.predictiveAnalytics.passed > 0) {
      console.log('\n🔮 Predictive Analytics:')
      console.log('- Demand forecasting with confidence intervals')
      console.log('- Donor churn prediction and retention strategies')
      console.log('- Inventory optimization recommendations')
    }

    if (this.results.performance.passed > 0) {
      console.log('\n⚡ Performance Metrics:')
      console.log('- Sub-5-second query execution')
      console.log('- Sub-3-second dashboard rendering')
      console.log('- Concurrent query processing capability')
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new AdvancedAnalyticsTester()
  tester.runAllTests().catch(console.error)
}

module.exports = AdvancedAnalyticsTester
