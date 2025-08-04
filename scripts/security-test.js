#!/usr/bin/env node

/**
 * Comprehensive Security Testing Script
 * 
 * Tests all security features including:
 * - Authentication and authorization
 * - Threat detection
 * - Rate limiting
 * - Data encryption
 * - Security headers
 */

const { execSync } = require('child_process')
const fetch = require('node-fetch')
const crypto = require('crypto')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

class SecurityTester {
  constructor() {
    this.results = {
      authentication: {},
      authorization: {},
      threatDetection: {},
      rateLimit: {},
      encryption: {},
      headers: {},
      overall: { passed: 0, failed: 0, total: 0 }
    }
  }

  async runAllTests() {
    console.log('🔒 Starting comprehensive security testing...\n')

    try {
      // 1. Authentication Tests
      await this.testAuthentication()

      // 2. Authorization Tests
      await this.testAuthorization()

      // 3. Threat Detection Tests
      await this.testThreatDetection()

      // 4. Rate Limiting Tests
      await this.testRateLimit()

      // 5. Data Encryption Tests
      await this.testEncryption()

      // 6. Security Headers Tests
      await this.testSecurityHeaders()

      // 7. Generate Report
      this.generateReport()

      console.log('✅ Security testing completed!')
      
      // Exit with error code if any tests failed
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Security testing failed:', error)
      process.exit(1)
    }
  }

  async testAuthentication() {
    console.log('🔐 Testing Authentication...')

    const tests = [
      {
        name: 'Valid Login',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'TestPassword123!'
            })
          })
          return response.status === 200
        }
      },
      {
        name: 'Invalid Credentials',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
          })
          return response.status === 401
        }
      },
      {
        name: 'Missing Credentials',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })
          return response.status === 400
        }
      },
      {
        name: 'JWT Token Validation',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/profile`, {
            headers: { 'Authorization': 'Bearer invalid-token' }
          })
          return response.status === 401
        }
      }
    ]

    this.results.authentication = await this.runTestSuite('Authentication', tests)
  }

  async testAuthorization() {
    console.log('🛡️ Testing Authorization...')

    const tests = [
      {
        name: 'Admin Endpoint Access (No Auth)',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/admin/users`)
          return response.status === 401
        }
      },
      {
        name: 'Admin Endpoint Access (Wrong Role)',
        test: async () => {
          // This would require a valid donor token
          const response = await fetch(`${BASE_URL}/api/admin/users`, {
            headers: { 'Authorization': 'Bearer donor-token' }
          })
          return response.status === 403
        }
      },
      {
        name: 'Resource Owner Access',
        test: async () => {
          // Test accessing own profile vs others
          const response = await fetch(`${BASE_URL}/api/profile/other-user-id`, {
            headers: { 'Authorization': 'Bearer user-token' }
          })
          return response.status === 403
        }
      }
    ]

    this.results.authorization = await this.runTestSuite('Authorization', tests)
  }

  async testThreatDetection() {
    console.log('🚨 Testing Threat Detection...')

    const tests = [
      {
        name: 'SQL Injection Detection',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/blood-requests?search=' OR 1=1--`)
          return response.status === 403
        }
      },
      {
        name: 'XSS Attack Detection',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: '<script>alert("xss")</script>'
            })
          })
          return response.status === 403
        }
      },
      {
        name: 'Bot Detection',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/blood-requests`, {
            headers: { 'User-Agent': 'curl/7.68.0' }
          })
          return response.status === 403
        }
      },
      {
        name: 'Brute Force Detection',
        test: async () => {
          // Simulate multiple failed login attempts
          const promises = Array.from({ length: 6 }, () =>
            fetch(`${BASE_URL}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: 'test@example.com',
                password: 'wrongpassword'
              })
            })
          )
          
          await Promise.all(promises)
          
          // Next attempt should be blocked
          const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
          })
          
          return response.status === 403
        }
      }
    ]

    this.results.threatDetection = await this.runTestSuite('Threat Detection', tests)
  }

  async testRateLimit() {
    console.log('⏱️ Testing Rate Limiting...')

    const tests = [
      {
        name: 'API Rate Limit',
        test: async () => {
          // Make many requests quickly
          const promises = Array.from({ length: 150 }, () =>
            fetch(`${BASE_URL}/api/health`)
          )
          
          const responses = await Promise.all(promises)
          const rateLimited = responses.some(r => r.status === 429)
          
          return rateLimited
        }
      },
      {
        name: 'Login Rate Limit',
        test: async () => {
          // Multiple login attempts
          const promises = Array.from({ length: 10 }, () =>
            fetch(`${BASE_URL}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: 'test@example.com',
                password: 'password'
              })
            })
          )
          
          const responses = await Promise.all(promises)
          const rateLimited = responses.some(r => r.status === 429)
          
          return rateLimited
        }
      }
    ]

    this.results.rateLimit = await this.runTestSuite('Rate Limiting', tests)
  }

  async testEncryption() {
    console.log('🔐 Testing Data Encryption...')

    const tests = [
      {
        name: 'Password Hashing',
        test: async () => {
          // Test that passwords are properly hashed
          const response = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'encryption-test@example.com',
              password: 'TestPassword123!',
              name: 'Test User'
            })
          })
          
          // Check that password is not returned in response
          if (response.ok) {
            const data = await response.json()
            return !data.user?.password
          }
          
          return false
        }
      },
      {
        name: 'Sensitive Data Masking',
        test: async () => {
          // Test that sensitive data is masked in responses
          const response = await fetch(`${BASE_URL}/api/profile`, {
            headers: { 'Authorization': 'Bearer valid-token' }
          })
          
          if (response.ok) {
            const data = await response.json()
            // Check if email is masked (contains *)
            return data.user?.email?.includes('*')
          }
          
          return false
        }
      }
    ]

    this.results.encryption = await this.runTestSuite('Data Encryption', tests)
  }

  async testSecurityHeaders() {
    console.log('🛡️ Testing Security Headers...')

    const tests = [
      {
        name: 'Content Security Policy',
        test: async () => {
          const response = await fetch(`${BASE_URL}/`)
          return response.headers.get('content-security-policy') !== null
        }
      },
      {
        name: 'X-Frame-Options',
        test: async () => {
          const response = await fetch(`${BASE_URL}/`)
          const header = response.headers.get('x-frame-options')
          return header === 'DENY' || header === 'SAMEORIGIN'
        }
      },
      {
        name: 'X-Content-Type-Options',
        test: async () => {
          const response = await fetch(`${BASE_URL}/`)
          return response.headers.get('x-content-type-options') === 'nosniff'
        }
      },
      {
        name: 'Strict-Transport-Security',
        test: async () => {
          const response = await fetch(`${BASE_URL}/`)
          return response.headers.get('strict-transport-security') !== null
        }
      },
      {
        name: 'X-XSS-Protection',
        test: async () => {
          const response = await fetch(`${BASE_URL}/`)
          return response.headers.get('x-xss-protection') === '1; mode=block'
        }
      },
      {
        name: 'Referrer-Policy',
        test: async () => {
          const response = await fetch(`${BASE_URL}/`)
          return response.headers.get('referrer-policy') !== null
        }
      }
    ]

    this.results.headers = await this.runTestSuite('Security Headers', tests)
  }

  async runTestSuite(suiteName, tests) {
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

    this.results.overall.passed += results.passed
    this.results.overall.failed += results.failed
    this.results.overall.total += results.total

    console.log(`  📊 ${suiteName}: ${results.passed}/${results.total} passed\n`)
    
    return results
  }

  generateReport() {
    console.log('📋 Security Test Report')
    console.log('=' .repeat(50))
    
    const categories = [
      'authentication',
      'authorization', 
      'threatDetection',
      'rateLimit',
      'encryption',
      'headers'
    ]

    categories.forEach(category => {
      const result = this.results[category]
      const percentage = ((result.passed / result.total) * 100).toFixed(1)
      console.log(`${category.padEnd(20)}: ${result.passed}/${result.total} (${percentage}%)`)
    })

    console.log('=' .repeat(50))
    const overallPercentage = ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1)
    console.log(`Overall Security Score: ${this.results.overall.passed}/${this.results.overall.total} (${overallPercentage}%)`)

    // Save detailed report
    const reportPath = './security-test-report.json'
    require('fs').writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // Security recommendations
    if (this.results.overall.failed > 0) {
      console.log('\n🚨 Security Issues Found:')
      categories.forEach(category => {
        const result = this.results[category]
        if (result.failed > 0) {
          console.log(`\n${category.toUpperCase()}:`)
          Object.entries(result.tests).forEach(([testName, testResult]) => {
            if (!testResult.passed) {
              console.log(`  - ${testName}${testResult.error ? `: ${testResult.error}` : ''}`)
            }
          })
        }
      })
    }
  }
}

// Run security tests
if (require.main === module) {
  const tester = new SecurityTester()
  tester.runAllTests().catch(console.error)
}

module.exports = SecurityTester
