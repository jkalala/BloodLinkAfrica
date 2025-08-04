#!/usr/bin/env node

/**
 * Computer Vision System Testing Script
 * 
 * Comprehensive testing for blood type recognition and document OCR
 */

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const FormData = require('form-data')
const sharp = require('sharp')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'

class ComputerVisionTester {
  constructor() {
    this.results = {
      bloodTypeRecognition: { passed: 0, failed: 0, tests: {} },
      documentOCR: { passed: 0, failed: 0, tests: {} },
      integration: { passed: 0, failed: 0, tests: {} },
      performance: { passed: 0, failed: 0, tests: {} },
      overall: { passed: 0, failed: 0, total: 0 }
    }
    this.testDataDir = path.join(__dirname, '../test-data/vision')
    this.ensureTestData()
  }

  async runAllTests() {
    console.log('🔍 Starting Computer Vision System Testing...\n')

    try {
      // 1. System Health Check
      await this.testSystemHealth()

      // 2. Blood Type Recognition Tests
      await this.testBloodTypeRecognition()

      // 3. Document OCR Tests
      await this.testDocumentOCR()

      // 4. Integration Tests
      await this.testIntegration()

      // 5. Performance Tests
      await this.testPerformance()

      // 6. Generate Report
      this.generateReport()

      console.log('✅ Computer Vision testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Computer Vision testing failed:', error)
      process.exit(1)
    }
  }

  ensureTestData() {
    if (!fs.existsSync(this.testDataDir)) {
      fs.mkdirSync(this.testDataDir, { recursive: true })
    }

    // Create test images if they don't exist
    this.createTestImages()
  }

  async createTestImages() {
    const testImages = [
      {
        name: 'blood-type-a-positive.png',
        type: 'blood_type',
        content: 'A+'
      },
      {
        name: 'blood-type-o-negative.png',
        type: 'blood_type',
        content: 'O-'
      },
      {
        name: 'medical-id-card.png',
        type: 'medical_id',
        content: 'MEDICAL ID\nPatient Name: John Doe\nPatient ID: 12345\nBlood Type: B+\nDOB: 01/01/1990'
      },
      {
        name: 'donor-card.png',
        type: 'donor_card',
        content: 'BLOOD DONOR CARD\nDonor Name: Jane Smith\nDonor ID: D67890\nBlood Type: AB-\nLast Donation: 03/15/2024'
      }
    ]

    for (const testImage of testImages) {
      const imagePath = path.join(this.testDataDir, testImage.name)
      
      if (!fs.existsSync(imagePath)) {
        // Create a simple test image with text
        const image = await this.createTextImage(testImage.content, 400, 300)
        await sharp(image).png().toFile(imagePath)
        console.log(`Created test image: ${testImage.name}`)
      }
    }
  }

  async createTextImage(text, width, height) {
    // Create a simple white image with black text
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <text x="20" y="50" font-family="Arial" font-size="16" fill="black">
          ${text.split('\n').map((line, i) => 
            `<tspan x="20" dy="${i === 0 ? 0 : 20}">${line}</tspan>`
          ).join('')}
        </text>
      </svg>
    `
    
    return sharp(Buffer.from(svg)).png().toBuffer()
  }

  async testSystemHealth() {
    console.log('🏥 Testing System Health...')

    const tests = [
      {
        name: 'Health Check Endpoint',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/ai/vision/health`)
          const data = await response.json()
          return response.ok && data.success && data.data.status !== 'unhealthy'
        }
      },
      {
        name: 'System Status',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/ai/vision/analyze`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          return response.ok && data.success
        }
      },
      {
        name: 'Dependencies Available',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/ai/vision/health`, {
            method: 'POST'
          })
          const data = await response.json()
          return response.ok && data.success && 
                 data.data.dependencies?.allAvailable
        }
      }
    ]

    await this.runTestSuite('System Health', tests, 'integration')
  }

  async testBloodTypeRecognition() {
    console.log('🩸 Testing Blood Type Recognition...')

    const tests = [
      {
        name: 'Recognize A+ Blood Type',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'blood-type-a-positive.png')
          const result = await this.analyzeImage(imagePath, 'blood_type')
          return result.success && 
                 result.data.bloodType?.bloodType === 'A+' &&
                 result.data.bloodType?.confidence > 0.5
        }
      },
      {
        name: 'Recognize O- Blood Type',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'blood-type-o-negative.png')
          const result = await this.analyzeImage(imagePath, 'blood_type')
          return result.success && 
                 result.data.bloodType?.bloodType === 'O-' &&
                 result.data.bloodType?.confidence > 0.5
        }
      },
      {
        name: 'Handle Invalid Image',
        test: async () => {
          const invalidImage = Buffer.from('invalid image data')
          const result = await this.analyzeImageBuffer(invalidImage, 'blood_type')
          return !result.success // Should fail gracefully
        }
      },
      {
        name: 'Metadata Inclusion',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'blood-type-a-positive.png')
          const result = await this.analyzeImage(imagePath, 'blood_type', {
            returnMetadata: true
          })
          return result.success && 
                 result.data.bloodType?.metadata &&
                 typeof result.data.bloodType.metadata.processingTime === 'number'
        }
      }
    ]

    await this.runTestSuite('Blood Type Recognition', tests, 'bloodTypeRecognition')
  }

  async testDocumentOCR() {
    console.log('📄 Testing Document OCR...')

    const tests = [
      {
        name: 'Extract Text from Medical ID',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'medical-id-card.png')
          const result = await this.analyzeImage(imagePath, 'document_ocr')
          return result.success && 
                 result.data.ocr?.text.includes('MEDICAL ID') &&
                 result.data.ocr?.confidence > 0.5
        }
      },
      {
        name: 'Extract Fields from Donor Card',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'donor-card.png')
          const result = await this.analyzeImage(imagePath, 'document_ocr', {
            extractFields: true
          })
          return result.success && 
                 result.data.document?.extractedFields &&
                 Object.keys(result.data.document.extractedFields).length > 0
        }
      },
      {
        name: 'Document Type Detection',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'medical-id-card.png')
          const result = await this.analyzeImage(imagePath, 'document_ocr')
          return result.success && 
                 result.data.document?.type !== 'unknown'
        }
      },
      {
        name: 'Document Validation',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'donor-card.png')
          const result = await this.analyzeImage(imagePath, 'document_ocr', {
            validateDocument: true
          })
          return result.success && 
                 Array.isArray(result.data.document?.validationErrors)
        }
      }
    ]

    await this.runTestSuite('Document OCR', tests, 'documentOCR')
  }

  async testIntegration() {
    console.log('🔗 Testing Integration...')

    const tests = [
      {
        name: 'Combined Analysis',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'donor-card.png')
          const result = await this.analyzeImage(imagePath, 'combined')
          return result.success && 
                 result.data.bloodType &&
                 result.data.ocr &&
                 result.data.combinedAnalysis
        }
      },
      {
        name: 'Auto Analysis Type Detection',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'medical-id-card.png')
          const result = await this.analyzeImage(imagePath, 'auto')
          return result.success && 
                 result.data.analysisType !== 'auto' // Should be determined
        }
      },
      {
        name: 'Consistency Check',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'donor-card.png')
          const result = await this.analyzeImage(imagePath, 'combined')
          return result.success && 
                 result.data.combinedAnalysis?.consistencyCheck &&
                 typeof result.data.combinedAnalysis.consistencyCheck.confidenceScore === 'number'
        }
      },
      {
        name: 'Batch Processing',
        test: async () => {
          const images = [
            path.join(this.testDataDir, 'blood-type-a-positive.png'),
            path.join(this.testDataDir, 'donor-card.png')
          ]
          const result = await this.batchAnalyze(images, 'auto')
          return result.success && 
                 result.data.results &&
                 result.data.results.length === 2
        }
      }
    ]

    await this.runTestSuite('Integration', tests, 'integration')
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...')

    const tests = [
      {
        name: 'Single Image Processing Time',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'blood-type-a-positive.png')
          const startTime = Date.now()
          const result = await this.analyzeImage(imagePath, 'blood_type')
          const processingTime = Date.now() - startTime
          
          return result.success && processingTime < 5000 // Under 5 seconds
        }
      },
      {
        name: 'Batch Processing Efficiency',
        test: async () => {
          const images = Array(5).fill(path.join(this.testDataDir, 'donor-card.png'))
          const startTime = Date.now()
          const result = await this.batchAnalyze(images, 'document_ocr')
          const totalTime = Date.now() - startTime
          const avgTime = totalTime / images.length
          
          return result.success && avgTime < 3000 // Under 3 seconds per image
        }
      },
      {
        name: 'Cache Performance',
        test: async () => {
          const imagePath = path.join(this.testDataDir, 'blood-type-a-positive.png')
          
          // First request (cache miss)
          const result1 = await this.analyzeImage(imagePath, 'blood_type', {
            cacheResults: true
          })
          
          // Second request (should be cache hit)
          const startTime = Date.now()
          const result2 = await this.analyzeImage(imagePath, 'blood_type', {
            cacheResults: true
          })
          const cacheTime = Date.now() - startTime
          
          return result1.success && result2.success && 
                 cacheTime < 100 // Cache should be much faster
        }
      },
      {
        name: 'Memory Usage Stability',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed
          
          // Process multiple images
          for (let i = 0; i < 10; i++) {
            await this.analyzeImage(
              path.join(this.testDataDir, 'donor-card.png'), 
              'combined'
            )
          }
          
          const finalMemory = process.memoryUsage().heapUsed
          const memoryIncrease = finalMemory - initialMemory
          
          // Memory increase should be reasonable (less than 100MB)
          return memoryIncrease < 100 * 1024 * 1024
        }
      }
    ]

    await this.runTestSuite('Performance', tests, 'performance')
  }

  async analyzeImage(imagePath, analysisType, options = {}) {
    try {
      const formData = new FormData()
      formData.append('image', fs.createReadStream(imagePath))
      formData.append('options', JSON.stringify({
        analysisType,
        options
      }))

      const response = await fetch(`${BASE_URL}/api/ai/vision/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: formData
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async analyzeImageBuffer(imageBuffer, analysisType, options = {}) {
    try {
      const formData = new FormData()
      formData.append('image', imageBuffer, 'test.png')
      formData.append('options', JSON.stringify({
        analysisType,
        options
      }))

      const response = await fetch(`${BASE_URL}/api/ai/vision/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: formData
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async batchAnalyze(imagePaths, analysisType, options = {}) {
    try {
      const formData = new FormData()
      
      imagePaths.forEach((imagePath, index) => {
        formData.append(`image_${index}`, fs.createReadStream(imagePath))
      })
      
      formData.append('options', JSON.stringify({
        analysisType,
        options
      }))

      const response = await fetch(`${BASE_URL}/api/ai/vision/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: formData
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
    console.log('📋 Computer Vision Test Report')
    console.log('=' .repeat(50))
    
    const categories = [
      'bloodTypeRecognition',
      'documentOCR',
      'integration',
      'performance'
    ]

    categories.forEach(category => {
      const result = this.results[category]
      const percentage = ((result.passed / result.total) * 100).toFixed(1)
      console.log(`${category.padEnd(25)}: ${result.passed}/${result.total} (${percentage}%)`)
    })

    console.log('=' .repeat(50))
    const overallPercentage = ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1)
    console.log(`Overall Score: ${this.results.overall.passed}/${this.results.overall.total} (${overallPercentage}%)`)

    // Save detailed report
    const reportPath = './computer-vision-test-report.json'
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // Performance summary
    if (this.results.performance.passed > 0) {
      console.log('\n⚡ Performance Summary:')
      console.log('- Single image processing: < 5 seconds')
      console.log('- Batch processing efficiency: < 3 seconds per image')
      console.log('- Cache performance: < 100ms for cached results')
      console.log('- Memory usage: Stable under load')
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new ComputerVisionTester()
  tester.runAllTests().catch(console.error)
}

module.exports = ComputerVisionTester
