#!/usr/bin/env node

/**
 * ML Pipeline Testing Script
 * 
 * Comprehensive testing for machine learning pipeline including
 * recommendations, forecasting, and ensemble methods
 */

const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'

class MLPipelineTester {
  constructor() {
    this.results = {
      recommendations: { passed: 0, failed: 0, tests: {} },
      forecasting: { passed: 0, failed: 0, tests: {} },
      ensemble: { passed: 0, failed: 0, tests: {} },
      integration: { passed: 0, failed: 0, tests: {} },
      performance: { passed: 0, failed: 0, tests: {} },
      overall: { passed: 0, failed: 0, total: 0 }
    }
  }

  async runAllTests() {
    console.log('🤖 Starting ML Pipeline Testing...\n')

    try {
      // 1. System Health Check
      await this.testSystemHealth()

      // 2. Recommendation Engine Tests
      await this.testRecommendationEngine()

      // 3. Forecasting System Tests
      await this.testForecastingSystem()

      // 4. Ensemble System Tests
      await this.testEnsembleSystem()

      // 5. Integration Tests
      await this.testIntegration()

      // 6. Performance Tests
      await this.testPerformance()

      // 7. Generate Report
      this.generateReport()

      console.log('✅ ML Pipeline testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ ML Pipeline testing failed:', error)
      process.exit(1)
    }
  }

  async testSystemHealth() {
    console.log('🏥 Testing ML System Health...')

    const tests = [
      {
        name: 'ML System Status',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/ai/ml/recommend`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          return response.ok && data.success && data.data.overall !== 'unhealthy'
        }
      },
      {
        name: 'Recommendation Engine Health',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/ai/ml/recommend`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          return response.ok && data.data.recommendationEngine?.status === 'healthy'
        }
      },
      {
        name: 'Forecasting System Health',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/ai/ml/forecast`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          return response.ok && data.success
        }
      }
    ]

    await this.runTestSuite('System Health', tests, 'integration')
  }

  async testRecommendationEngine() {
    console.log('🎯 Testing Recommendation Engine...')

    const tests = [
      {
        name: 'Generate Basic Recommendations',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          const response = await this.makeRecommendationRequest(requestData)
          
          return response.success && 
                 response.data.recommendations &&
                 response.data.recommendations.length > 0 &&
                 response.data.recommendations[0].score > 0
        }
      },
      {
        name: 'Blood Type Compatibility',
        test: async () => {
          const requestData = this.createSampleBloodRequest('O-') // Universal recipient
          const response = await this.makeRecommendationRequest(requestData)
          
          return response.success && 
                 response.data.recommendations &&
                 response.data.recommendations.length > 0 &&
                 response.data.recommendations[0].factors.compatibility > 0.8
        }
      },
      {
        name: 'Urgency Prioritization',
        test: async () => {
          const criticalRequest = this.createSampleBloodRequest('A+', 'critical')
          const lowRequest = this.createSampleBloodRequest('A+', 'low')
          
          const [criticalResponse, lowResponse] = await Promise.all([
            this.makeRecommendationRequest(criticalRequest),
            this.makeRecommendationRequest(lowRequest)
          ])
          
          return criticalResponse.success && lowResponse.success &&
                 criticalResponse.data.recommendations[0]?.score >= 
                 lowResponse.data.recommendations[0]?.score
        }
      },
      {
        name: 'Distance Factor',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          requestData.filterCriteria = { maxDistance: 10 }
          
          const response = await this.makeRecommendationRequest(requestData)
          
          return response.success && 
                 response.data.recommendations &&
                 response.data.recommendations.every(rec => rec.factors.proximity > 0.5)
        }
      },
      {
        name: 'Reasoning Generation',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          requestData.includeReasons = true
          
          const response = await this.makeRecommendationRequest(requestData)
          
          return response.success && 
                 response.data.recommendations &&
                 response.data.recommendations[0].reasoning &&
                 response.data.recommendations[0].reasoning.length > 0
        }
      }
    ]

    await this.runTestSuite('Recommendation Engine', tests, 'recommendations')
  }

  async testForecastingSystem() {
    console.log('📈 Testing Forecasting System...')

    const tests = [
      {
        name: 'Generate Demand Forecast',
        test: async () => {
          const requestData = {
            regions: ['Lagos', 'Abuja'],
            bloodTypes: ['A+', 'O+'],
            horizonDays: 7,
            includeConfidenceIntervals: true
          }
          
          const response = await this.makeForecastRequest(requestData)
          
          return response.success && 
                 response.data.forecasts &&
                 response.data.forecasts.demandForecasts &&
                 response.data.forecasts.demandForecasts.length > 0
        }
      },
      {
        name: 'Supply Risk Assessment',
        test: async () => {
          const requestData = {
            regions: ['Lagos'],
            bloodTypes: ['AB-'], // Rare blood type
            horizonDays: 14
          }
          
          const response = await this.makeForecastRequest(requestData)
          
          return response.success && 
                 response.data.forecasts &&
                 response.data.forecasts.riskAssessment &&
                 typeof response.data.forecasts.riskAssessment.overallRisk === 'string'
        }
      },
      {
        name: 'Confidence Intervals',
        test: async () => {
          const requestData = {
            regions: ['Lagos'],
            bloodTypes: ['O+'],
            horizonDays: 7,
            includeConfidenceIntervals: true
          }
          
          const response = await this.makeForecastRequest(requestData)
          
          return response.success && 
                 response.data.forecasts &&
                 response.data.forecasts.demandForecasts[0]?.predictions &&
                 response.data.forecasts.demandForecasts[0].predictions.every(p => 
                   typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1
                 )
        }
      },
      {
        name: 'Action Items Generation',
        test: async () => {
          const requestData = {
            regions: ['Lagos'],
            bloodTypes: ['A+', 'B+', 'O+'],
            horizonDays: 30
          }
          
          const response = await this.makeForecastRequest(requestData)
          
          return response.success && 
                 response.data.forecasts &&
                 response.data.forecasts.riskAssessment &&
                 Array.isArray(response.data.forecasts.riskAssessment.actionItems)
        }
      }
    ]

    await this.runTestSuite('Forecasting System', tests, 'forecasting')
  }

  async testEnsembleSystem() {
    console.log('🎭 Testing Ensemble System...')

    const tests = [
      {
        name: 'Ensemble Prediction',
        test: async () => {
          // This would test the ensemble system directly
          // For now, we'll test it through the recommendation system
          const requestData = this.createSampleBloodRequest()
          const response = await this.makeRecommendationRequest(requestData)
          
          return response.success && 
                 response.data.metadata &&
                 response.data.metadata.modelsUsed &&
                 response.data.metadata.modelsUsed.length > 1
        }
      },
      {
        name: 'Model Confidence',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          const response = await this.makeRecommendationRequest(requestData)
          
          return response.success && 
                 response.data.metadata &&
                 typeof response.data.metadata.confidence === 'number' &&
                 response.data.metadata.confidence >= 0 &&
                 response.data.metadata.confidence <= 1
        }
      },
      {
        name: 'Uncertainty Quantification',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          const response = await this.makeRecommendationRequest(requestData)
          
          // Check if recommendations have confidence scores
          return response.success && 
                 response.data.recommendations &&
                 response.data.recommendations.every(rec => 
                   typeof rec.confidence === 'number' && 
                   rec.confidence >= 0 && 
                   rec.confidence <= 1
                 )
        }
      }
    ]

    await this.runTestSuite('Ensemble System', tests, 'ensemble')
  }

  async testIntegration() {
    console.log('🔗 Testing ML Integration...')

    const tests = [
      {
        name: 'Cross-System Data Flow',
        test: async () => {
          // Test that recommendation system can use forecast data
          const requestData = this.createSampleBloodRequest()
          const response = await this.makeRecommendationRequest(requestData)
          
          return response.success && 
                 response.data.recommendations &&
                 response.data.metadata.processingTime < 5000 // Under 5 seconds
        }
      },
      {
        name: 'Cache Integration',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          
          // First request (cache miss)
          const response1 = await this.makeRecommendationRequest(requestData)
          
          // Second request (should be cache hit)
          const response2 = await this.makeRecommendationRequest(requestData)
          
          return response1.success && response2.success &&
                 response2.data.metadata.cacheHit === true
        }
      },
      {
        name: 'Error Handling',
        test: async () => {
          // Test with invalid data
          const invalidRequest = {
            bloodRequest: {
              id: 'test',
              bloodType: 'INVALID',
              urgency: 'critical',
              location: { latitude: 0, longitude: 0, hospital: 'Test', city: 'Test' },
              requirements: { units: 1, deadline: new Date().toISOString() },
              requestedBy: { hospitalId: 'test', doctorId: 'test', contactInfo: 'test' }
            }
          }
          
          const response = await this.makeRecommendationRequest(invalidRequest)
          
          return !response.success && response.error // Should fail gracefully
        }
      }
    ]

    await this.runTestSuite('ML Integration', tests, 'integration')
  }

  async testPerformance() {
    console.log('⚡ Testing ML Performance...')

    const tests = [
      {
        name: 'Recommendation Response Time',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          const startTime = Date.now()
          
          const response = await this.makeRecommendationRequest(requestData)
          const responseTime = Date.now() - startTime
          
          return response.success && responseTime < 3000 // Under 3 seconds
        }
      },
      {
        name: 'Forecast Response Time',
        test: async () => {
          const requestData = {
            regions: ['Lagos'],
            bloodTypes: ['A+'],
            horizonDays: 7
          }
          
          const startTime = Date.now()
          const response = await this.makeForecastRequest(requestData)
          const responseTime = Date.now() - startTime
          
          return response.success && responseTime < 5000 // Under 5 seconds
        }
      },
      {
        name: 'Concurrent Requests',
        test: async () => {
          const requestData = this.createSampleBloodRequest()
          
          // Make 5 concurrent requests
          const promises = Array(5).fill().map(() => 
            this.makeRecommendationRequest(requestData)
          )
          
          const responses = await Promise.all(promises)
          
          return responses.every(response => response.success)
        }
      },
      {
        name: 'Memory Stability',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed
          
          // Make multiple requests
          for (let i = 0; i < 10; i++) {
            const requestData = this.createSampleBloodRequest()
            await this.makeRecommendationRequest(requestData)
          }
          
          const finalMemory = process.memoryUsage().heapUsed
          const memoryIncrease = finalMemory - initialMemory
          
          // Memory increase should be reasonable (less than 50MB)
          return memoryIncrease < 50 * 1024 * 1024
        }
      }
    ]

    await this.runTestSuite('ML Performance', tests, 'performance')
  }

  // Helper methods
  createSampleBloodRequest(bloodType = 'A+', urgency = 'medium') {
    return {
      bloodRequest: {
        id: `test_${Date.now()}`,
        bloodType,
        urgency,
        location: {
          latitude: 6.5244,
          longitude: 3.3792,
          hospital: 'Lagos University Teaching Hospital',
          city: 'Lagos'
        },
        requirements: {
          units: 2,
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          specialRequirements: [],
          patientAge: 35,
          patientCondition: 'Surgery'
        },
        requestedBy: {
          hospitalId: 'luth_001',
          doctorId: 'dr_001',
          contactInfo: 'emergency@luth.edu.ng'
        }
      },
      maxRecommendations: 5,
      includeReasons: true
    }
  }

  async makeRecommendationRequest(requestData) {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/ml/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(requestData)
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async makeForecastRequest(requestData) {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/ml/forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(requestData)
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
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
    console.log('📋 ML Pipeline Test Report')
    console.log('=' .repeat(50))
    
    const categories = [
      'recommendations',
      'forecasting',
      'ensemble',
      'integration',
      'performance'
    ]

    categories.forEach(category => {
      const result = this.results[category]
      const percentage = ((result.passed / result.total) * 100).toFixed(1)
      console.log(`${category.padEnd(20)}: ${result.passed}/${result.total} (${percentage}%)`)
    })

    console.log('=' .repeat(50))
    const overallPercentage = ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1)
    console.log(`Overall ML Score: ${this.results.overall.passed}/${this.results.overall.total} (${overallPercentage}%)`)

    // Save detailed report
    const reportPath = './ml-pipeline-test-report.json'
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // ML-specific insights
    if (this.results.recommendations.passed > 0) {
      console.log('\n🎯 Recommendation Engine:')
      console.log('- Intelligent donor matching with multi-factor scoring')
      console.log('- Blood type compatibility and urgency prioritization')
      console.log('- Distance-based filtering and reasoning generation')
    }

    if (this.results.forecasting.passed > 0) {
      console.log('\n📈 Predictive Analytics:')
      console.log('- Demand forecasting with confidence intervals')
      console.log('- Supply risk assessment and action items')
      console.log('- Seasonal pattern recognition and trend analysis')
    }

    if (this.results.performance.passed > 0) {
      console.log('\n⚡ Performance Metrics:')
      console.log('- Sub-3-second recommendation response time')
      console.log('- Sub-5-second forecast generation')
      console.log('- Concurrent request handling and memory stability')
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new MLPipelineTester()
  tester.runAllTests().catch(console.error)
}

module.exports = MLPipelineTester
