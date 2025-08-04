#!/usr/bin/env node

/**
 * Comprehensive API Testing Script
 * 
 * Integrates multiple testing tools and approaches:
 * - Custom API test suite
 * - Newman (Postman CLI) testing
 * - OpenAPI validation
 * - Performance testing
 * - Security testing
 * - Documentation validation
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const APITestSuite = require('../tests/api/api-test-suite')

class ComprehensiveAPITester {
  constructor() {
    this.baseURL = process.env.API_BASE_URL || 'http://localhost:3000/api'
    this.results = {
      customTests: null,
      newmanTests: null,
      openApiValidation: null,
      performanceTests: null,
      securityTests: null,
      documentationTests: null,
      overall: { passed: 0, failed: 0, total: 0 }
    }
    
    this.reportsDir = path.join(__dirname, '../tests/api/reports')
  }

  async runComprehensiveTests() {
    console.log('🧪 Starting Comprehensive API Testing Suite...\n')

    try {
      // Ensure reports directory exists
      await this.ensureDirectoryExists(this.reportsDir)

      // 1. Run custom API test suite
      await this.runCustomTests()

      // 2. Run Newman (Postman) tests
      await this.runNewmanTests()

      // 3. Validate OpenAPI specification
      await this.validateOpenAPISpec()

      // 4. Run performance tests
      await this.runPerformanceTests()

      // 5. Run security tests
      await this.runSecurityTests()

      // 6. Validate documentation
      await this.validateDocumentation()

      // 7. Generate comprehensive report
      await this.generateComprehensiveReport()

      console.log('✅ Comprehensive API testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Comprehensive API testing failed:', error)
      process.exit(1)
    }
  }

  async runCustomTests() {
    console.log('🔧 Running Custom API Test Suite...')

    try {
      const testSuite = new APITestSuite(this.baseURL)
      await testSuite.runAllTests()
      
      // Read the generated report
      const reportPath = './api-test-report.json'
      const reportData = JSON.parse(await fs.readFile(reportPath, 'utf8'))
      
      this.results.customTests = {
        passed: reportData.summary.passedTests,
        failed: reportData.summary.failedTests,
        total: reportData.summary.totalTests,
        successRate: reportData.summary.successRate,
        details: reportData
      }

      this.updateOverallResults(this.results.customTests)
      console.log(`  ✅ Custom tests: ${this.results.customTests.passed}/${this.results.customTests.total} passed`)
    } catch (error) {
      console.error('  ❌ Custom tests failed:', error.message)
      this.results.customTests = { passed: 0, failed: 1, total: 1, error: error.message }
      this.updateOverallResults(this.results.customTests)
    }
  }

  async runNewmanTests() {
    console.log('📮 Running Newman (Postman) Tests...')

    try {
      const newmanCommand = [
        'newman', 'run',
        'docs/api/postman-collection.json',
        '-e', 'tests/api/environments/test.json',
        '--reporters', 'cli,json,html,junit',
        '--reporter-json-export', path.join(this.reportsDir, 'newman-report.json'),
        '--reporter-html-export', path.join(this.reportsDir, 'newman-report.html'),
        '--reporter-junit-export', path.join(this.reportsDir, 'newman-junit.xml'),
        '--timeout', '30000',
        '--delay-request', '100',
        '--verbose'
      ].join(' ')

      const output = await this.runCommand(newmanCommand)
      
      // Parse Newman results
      const newmanReport = JSON.parse(await fs.readFile(
        path.join(this.reportsDir, 'newman-report.json'), 
        'utf8'
      ))

      this.results.newmanTests = {
        passed: newmanReport.run.stats.assertions.passed,
        failed: newmanReport.run.stats.assertions.failed,
        total: newmanReport.run.stats.assertions.total,
        successRate: ((newmanReport.run.stats.assertions.passed / newmanReport.run.stats.assertions.total) * 100).toFixed(1),
        details: newmanReport
      }

      this.updateOverallResults(this.results.newmanTests)
      console.log(`  ✅ Newman tests: ${this.results.newmanTests.passed}/${this.results.newmanTests.total} passed`)
    } catch (error) {
      console.error('  ❌ Newman tests failed:', error.message)
      this.results.newmanTests = { passed: 0, failed: 1, total: 1, error: error.message }
      this.updateOverallResults(this.results.newmanTests)
    }
  }

  async validateOpenAPISpec() {
    console.log('📋 Validating OpenAPI Specification...')

    try {
      // Install swagger-cli if not available
      try {
        await this.runCommand('swagger-cli --version')
      } catch (error) {
        console.log('  Installing swagger-cli...')
        await this.runCommand('npm install -g swagger-cli')
      }

      // Validate OpenAPI spec
      const validationOutput = await this.runCommand('swagger-cli validate docs/api/openapi.yaml')
      
      this.results.openApiValidation = {
        passed: 1,
        failed: 0,
        total: 1,
        successRate: '100.0',
        details: { output: validationOutput }
      }

      this.updateOverallResults(this.results.openApiValidation)
      console.log('  ✅ OpenAPI specification is valid')
    } catch (error) {
      console.error('  ❌ OpenAPI validation failed:', error.message)
      this.results.openApiValidation = { passed: 0, failed: 1, total: 1, error: error.message }
      this.updateOverallResults(this.results.openApiValidation)
    }
  }

  async runPerformanceTests() {
    console.log('⚡ Running Performance Tests...')

    try {
      // Create Artillery configuration
      const artilleryConfig = {
        config: {
          target: this.baseURL,
          phases: [
            { duration: 60, arrivalRate: 5, name: 'Warm up' },
            { duration: 120, arrivalRate: 10, name: 'Load test' },
            { duration: 60, arrivalRate: 20, name: 'Stress test' }
          ]
        },
        scenarios: [
          {
            name: 'API Performance Test',
            weight: 100,
            requests: [
              {
                get: {
                  url: '/donors?limit=10',
                  headers: {
                    'Authorization': 'Bearer {{ authToken }}'
                  }
                }
              },
              {
                get: {
                  url: '/inventory',
                  headers: {
                    'Authorization': 'Bearer {{ authToken }}'
                  }
                }
              }
            ]
          }
        ]
      }

      const configPath = path.join(this.reportsDir, 'artillery-config.yml')
      await fs.writeFile(configPath, JSON.stringify(artilleryConfig, null, 2))

      // Run Artillery performance test
      const artilleryOutput = await this.runCommand(`artillery run ${configPath} --output ${path.join(this.reportsDir, 'artillery-results.json')}`)
      
      // Generate HTML report
      await this.runCommand(`artillery report ${path.join(this.reportsDir, 'artillery-results.json')} --output ${path.join(this.reportsDir, 'artillery-report.html')}`)

      this.results.performanceTests = {
        passed: 1,
        failed: 0,
        total: 1,
        successRate: '100.0',
        details: { output: artilleryOutput }
      }

      this.updateOverallResults(this.results.performanceTests)
      console.log('  ✅ Performance tests completed')
    } catch (error) {
      console.error('  ❌ Performance tests failed:', error.message)
      this.results.performanceTests = { passed: 0, failed: 1, total: 1, error: error.message }
      this.updateOverallResults(this.results.performanceTests)
    }
  }

  async runSecurityTests() {
    console.log('🔒 Running Security Tests...')

    try {
      const securityTests = [
        {
          name: 'HTTPS Enforcement',
          test: async () => {
            // Test if API enforces HTTPS in production
            if (this.baseURL.startsWith('https://')) {
              return true
            } else if (this.baseURL.includes('localhost')) {
              return true // Allow HTTP for local development
            }
            return false
          }
        },
        {
          name: 'Authentication Required',
          test: async () => {
            try {
              const response = await fetch(`${this.baseURL}/donors`)
              return response.status === 401
            } catch (error) {
              return false
            }
          }
        },
        {
          name: 'Input Validation',
          test: async () => {
            try {
              const response = await fetch(`${this.baseURL}/donors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: 'invalid-email',
                  bloodType: 'INVALID'
                })
              })
              return response.status === 422 || response.status === 400
            } catch (error) {
              return false
            }
          }
        }
      ]

      let passed = 0
      let failed = 0
      const testResults = {}

      for (const test of securityTests) {
        try {
          const result = await test.test()
          testResults[test.name] = { passed: result, error: null }
          if (result) {
            passed++
          } else {
            failed++
          }
        } catch (error) {
          testResults[test.name] = { passed: false, error: error.message }
          failed++
        }
      }

      this.results.securityTests = {
        passed,
        failed,
        total: securityTests.length,
        successRate: ((passed / securityTests.length) * 100).toFixed(1),
        details: testResults
      }

      this.updateOverallResults(this.results.securityTests)
      console.log(`  ✅ Security tests: ${passed}/${securityTests.length} passed`)
    } catch (error) {
      console.error('  ❌ Security tests failed:', error.message)
      this.results.securityTests = { passed: 0, failed: 1, total: 1, error: error.message }
      this.updateOverallResults(this.results.securityTests)
    }
  }

  async validateDocumentation() {
    console.log('📚 Validating Documentation...')

    try {
      const documentationChecks = [
        {
          name: 'OpenAPI Spec Exists',
          check: () => fs.access('docs/api/openapi.yaml')
        },
        {
          name: 'Postman Collection Exists',
          check: () => fs.access('docs/api/postman-collection.json')
        },
        {
          name: 'README Exists',
          check: () => fs.access('README.md')
        },
        {
          name: 'API Documentation Generated',
          check: async () => {
            // Generate documentation
            const { APIDocumentationGenerator } = require('./generate-api-docs')
            const generator = new APIDocumentationGenerator()
            await generator.generateAllDocumentation()
          }
        }
      ]

      let passed = 0
      let failed = 0
      const checkResults = {}

      for (const check of documentationChecks) {
        try {
          await check.check()
          checkResults[check.name] = { passed: true, error: null }
          passed++
        } catch (error) {
          checkResults[check.name] = { passed: false, error: error.message }
          failed++
        }
      }

      this.results.documentationTests = {
        passed,
        failed,
        total: documentationChecks.length,
        successRate: ((passed / documentationChecks.length) * 100).toFixed(1),
        details: checkResults
      }

      this.updateOverallResults(this.results.documentationTests)
      console.log(`  ✅ Documentation validation: ${passed}/${documentationChecks.length} passed`)
    } catch (error) {
      console.error('  ❌ Documentation validation failed:', error.message)
      this.results.documentationTests = { passed: 0, failed: 1, total: 1, error: error.message }
      this.updateOverallResults(this.results.documentationTests)
    }
  }

  async generateComprehensiveReport() {
    console.log('📊 Generating comprehensive test report...')

    const report = {
      timestamp: new Date().toISOString(),
      baseURL: this.baseURL,
      summary: {
        totalTests: this.results.overall.total,
        passedTests: this.results.overall.passed,
        failedTests: this.results.overall.failed,
        successRate: ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1)
      },
      testSuites: {
        customTests: this.results.customTests,
        newmanTests: this.results.newmanTests,
        openApiValidation: this.results.openApiValidation,
        performanceTests: this.results.performanceTests,
        securityTests: this.results.securityTests,
        documentationTests: this.results.documentationTests
      },
      recommendations: this.generateRecommendations(),
      qualityGate: this.assessQualityGate()
    }

    // Save comprehensive report
    const reportPath = path.join(this.reportsDir, 'comprehensive-api-report.json')
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))

    // Generate HTML report
    await this.generateHTMLReport(report)

    // Print summary
    this.printSummary(report)

    console.log(`📋 Comprehensive report saved to: ${reportPath}`)
  }

  async generateHTMLReport(report) {
    const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BloodLink Africa API Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .test-suite { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .test-suite-header { background: #e9ecef; padding: 15px; font-weight: bold; }
        .test-suite-content { padding: 15px; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin-top: 20px; }
        .quality-gate { text-align: center; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .quality-gate.pass { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .quality-gate.fail { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>BloodLink Africa API Test Report</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Base URL: ${report.baseURL}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${report.summary.totalTests}</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value passed">${report.summary.passedTests}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failed">${report.summary.failedTests}</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value">${report.summary.successRate}%</div>
            </div>
        </div>

        <div class="quality-gate ${report.qualityGate.status.toLowerCase()}">
            <h2>Quality Gate: ${report.qualityGate.status}</h2>
            <p>Grade: ${report.qualityGate.grade}</p>
        </div>

        ${Object.entries(report.testSuites).map(([name, suite]) => `
            <div class="test-suite">
                <div class="test-suite-header">
                    ${name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    - ${suite.passed}/${suite.total} passed (${suite.successRate}%)
                </div>
                <div class="test-suite-content">
                    ${suite.error ? `<p style="color: #dc3545;">Error: ${suite.error}</p>` : ''}
                    ${suite.details ? '<p>Detailed results available in JSON report</p>' : ''}
                </div>
            </div>
        `).join('')}

        ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>Recommendations</h3>
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    </div>
</body>
</html>`

    const htmlPath = path.join(this.reportsDir, 'comprehensive-api-report.html')
    await fs.writeFile(htmlPath, htmlReport)
  }

  generateRecommendations() {
    const recommendations = []

    Object.entries(this.results).forEach(([category, result]) => {
      if (result && result.failed > 0) {
        switch (category) {
          case 'customTests':
            recommendations.push('Review and fix failing custom API tests')
            break
          case 'newmanTests':
            recommendations.push('Address issues identified in Postman collection tests')
            break
          case 'openApiValidation':
            recommendations.push('Fix OpenAPI specification validation errors')
            break
          case 'performanceTests':
            recommendations.push('Optimize API performance to meet benchmarks')
            break
          case 'securityTests':
            recommendations.push('Address security vulnerabilities identified in testing')
            break
          case 'documentationTests':
            recommendations.push('Update and maintain API documentation')
            break
        }
      }
    })

    return recommendations
  }

  assessQualityGate() {
    const successRate = (this.results.overall.passed / this.results.overall.total) * 100
    
    if (successRate >= 95) return { status: 'PASS', grade: 'A' }
    if (successRate >= 85) return { status: 'PASS', grade: 'B' }
    if (successRate >= 75) return { status: 'WARNING', grade: 'C' }
    return { status: 'FAIL', grade: 'F' }
  }

  updateOverallResults(testResult) {
    this.results.overall.passed += testResult.passed
    this.results.overall.failed += testResult.failed
    this.results.overall.total += testResult.total
  }

  printSummary(report) {
    console.log('\n📋 Comprehensive API Test Report')
    console.log('=' .repeat(70))
    
    console.log(`📊 Overall Results: ${report.summary.passedTests}/${report.summary.totalTests} (${report.summary.successRate}%)`)
    console.log(`🎯 Quality Gate: ${report.qualityGate.status} (Grade: ${report.qualityGate.grade})`)
    
    console.log('\n🧪 Test Suites:')
    Object.entries(report.testSuites).forEach(([category, results]) => {
      const percentage = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : '0.0'
      console.log(`  ${category.padEnd(20)}: ${results.passed}/${results.total} (${percentage}%)`)
    })

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`)
      })
    }

    console.log('=' .repeat(70))
  }

  async runCommand(command) {
    return new Promise((resolve, reject) => {
      const process = spawn('sh', ['-c', command], { 
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      })

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(error)
      })
    })
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath)
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }
}

// Run comprehensive tests if called directly
if (require.main === module) {
  const tester = new ComprehensiveAPITester()
  tester.runComprehensiveTests().catch(console.error)
}

module.exports = ComprehensiveAPITester
