/**
 * Comprehensive Security Framework Tests
 * 
 * Complete test suite for security systems including HIPAA compliance,
 * threat detection, audit trails, and data protection
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals')
const { ComprehensiveSecurityFramework } = require('../../lib/security')
const crypto = require('crypto')

describe('Comprehensive Security Framework', () => {
  let securityFramework
  let testConfig

  beforeAll(async () => {
    testConfig = {
      configPath: './tests/security/test-security-config.json',
      hipaa: {
        enabled: true,
        auditRetentionDays: 2555,
        encryptionRequired: true
      },
      authentication: {
        jwtSecret: crypto.randomBytes(64).toString('hex'),
        bcryptRounds: 4, // Lower for faster tests
        sessionTimeout: 30 * 60 * 1000
      },
      dataProtection: {
        encryptionAlgorithm: 'aes-256-gcm',
        fieldLevelEncryption: true,
        tokenizationEnabled: true
      },
      threatDetection: {
        enabled: true,
        realTimeMonitoring: false, // Disable for tests
        anomalyThreshold: 0.8
      },
      audit: {
        enabled: true,
        retentionPeriodDays: 2555,
        encryptionEnabled: true
      }
    }

    securityFramework = new ComprehensiveSecurityFramework(testConfig)
    await securityFramework.initialize()
  })

  afterAll(async () => {
    if (securityFramework) {
      await securityFramework.shutdown()
    }
  })

  describe('Framework Initialization', () => {
    test('should initialize all security systems', () => {
      expect(securityFramework.isInitialized()).toBe(true)
      expect(securityFramework.hasSystem('hipaaCompliance')).toBe(true)
      expect(securityFramework.hasSystem('threatDetection')).toBe(true)
      expect(securityFramework.hasSystem('auditTrail')).toBe(true)
      expect(securityFramework.hasSystem('dataProtection')).toBe(true)
      expect(securityFramework.hasSystem('securityMiddleware')).toBe(true)
    })

    test('should have healthy system status', async () => {
      const systemHealth = await securityFramework.getSystemHealth()
      expect(systemHealth.overall).toBe('healthy')
      expect(Object.keys(systemHealth.systems)).toHaveLength(5)
    })

    test('should provide system status information', () => {
      const status = securityFramework.getSystemStatus()
      expect(status.initialized).toBe(true)
      expect(status.systems).toContain('hipaaCompliance')
      expect(status.systems).toContain('threatDetection')
      expect(status.systems).toContain('auditTrail')
      expect(status.systems).toContain('dataProtection')
      expect(status.systems).toContain('securityMiddleware')
    })
  })

  describe('Authentication & Authorization', () => {
    const testCredentials = {
      email: 'test@bloodlink.africa',
      password: 'TestPassword123!',
      userId: 'test-user-123'
    }

    const testContext = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      source: 'test'
    }

    test('should authenticate valid user credentials', async () => {
      const authResult = await securityFramework.authenticateUser(testCredentials, testContext)
      
      expect(authResult.success).toBe(true)
      expect(authResult.user).toBeDefined()
      expect(authResult.session).toBeDefined()
      expect(authResult.session.sessionId).toBeDefined()
    })

    test('should reject invalid credentials', async () => {
      const invalidCredentials = {
        ...testCredentials,
        password: 'wrongpassword'
      }

      await expect(
        securityFramework.authenticateUser(invalidCredentials, testContext)
      ).rejects.toThrow()
    })

    test('should provide authentication middleware', () => {
      const authMiddleware = securityFramework.getAuthenticationMiddleware()
      expect(typeof authMiddleware).toBe('function')
    })

    test('should provide authorization middleware', () => {
      const authzMiddleware = securityFramework.getAuthorizationMiddleware(['read:donors'])
      expect(typeof authzMiddleware).toBe('function')
    })
  })

  describe('Data Protection', () => {
    const testData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      ssn: '123-45-6789',
      bloodType: 'O+',
      medicalHistory: ['No significant medical history'],
      phone: '(555) 123-4567'
    }

    const protectionContext = {
      userId: 'test-user-123',
      classification: 'phi',
      fieldLevel: true
    }

    test('should encrypt sensitive data', async () => {
      const protectedData = await securityFramework.protectData(testData, {
        classification: 'phi',
        context: protectionContext
      })

      expect(protectedData).toBeDefined()
      expect(protectedData._encrypted).toBeDefined()
      expect(protectedData._encrypted.fields).toBeInstanceOf(Array)
      expect(protectedData._encrypted.fields.length).toBeGreaterThan(0)
    })

    test('should decrypt protected data', async () => {
      const protectedData = await securityFramework.protectData(testData, {
        classification: 'phi',
        context: protectionContext
      })

      const decryptedData = await securityFramework.accessPHI(protectedData, {
        ...protectionContext,
        purpose: 'treatment',
        resourceType: 'donor',
        resourceId: 'donor-123'
      })

      expect(decryptedData.firstName).toBe(testData.firstName)
      expect(decryptedData.ssn).toBe(testData.ssn)
      expect(decryptedData.bloodType).toBe(testData.bloodType)
    })

    test('should classify data fields correctly', () => {
      const dataProtection = securityFramework.getSystem('dataProtection')
      
      expect(dataProtection.getFieldClassification('ssn')).toBe('phi')
      expect(dataProtection.getFieldClassification('firstName')).toBe('pii')
      expect(dataProtection.getFieldClassification('email')).toBe('pii')
      expect(dataProtection.getFieldClassification('bloodType')).toBe('phi')
      expect(dataProtection.getFieldClassification('randomField')).toBe('general')
    })

    test('should mask sensitive data', () => {
      const dataProtection = securityFramework.getSystem('dataProtection')
      
      expect(dataProtection.maskEmail('john.doe@example.com')).toBe('j***e@example.com')
      expect(dataProtection.maskPhone('(555) 123-4567')).toBe('(555) ***-4567')
      expect(dataProtection.maskSSN('123-45-6789')).toBe('***-**-6789')
      expect(dataProtection.maskCreditCard('1234-5678-9012-3456')).toBe('****-****-****-3456')
    })
  })

  describe('Threat Detection', () => {
    const mockRequest = {
      method: 'POST',
      path: '/api/donors',
      ip: '192.168.1.100',
      headers: {
        'user-agent': 'Mozilla/5.0 (Test Browser)',
        'content-type': 'application/json'
      },
      body: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      }
    }

    const requestContext = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      userId: 'test-user-123',
      sessionId: 'test-session-123'
    }

    test('should analyze legitimate requests', async () => {
      const analysis = await securityFramework.analyzeRequest(mockRequest, requestContext)
      
      expect(analysis).toBeDefined()
      expect(analysis.requestId).toBeDefined()
      expect(analysis.riskScore).toBeDefined()
      expect(analysis.action).toBeDefined()
      expect(analysis.threats).toBeInstanceOf(Array)
    })

    test('should detect SQL injection attempts', async () => {
      const maliciousRequest = {
        ...mockRequest,
        body: {
          email: "'; DROP TABLE users; --",
          firstName: 'John'
        }
      }

      const analysis = await securityFramework.analyzeRequest(maliciousRequest, requestContext)
      
      expect(analysis.riskScore).toBeGreaterThan(50)
      expect(analysis.threats.some(threat => threat.type === 'malicious_payload')).toBe(true)
    })

    test('should detect XSS attempts', async () => {
      const xssRequest = {
        ...mockRequest,
        body: {
          firstName: '<script>alert("xss")</script>',
          lastName: 'Doe'
        }
      }

      const analysis = await securityFramework.analyzeRequest(xssRequest, requestContext)
      
      expect(analysis.riskScore).toBeGreaterThan(50)
      expect(analysis.threats.some(threat => threat.type === 'suspicious_pattern')).toBe(true)
    })

    test('should handle rate limiting', async () => {
      const threatDetection = securityFramework.getSystem('threatDetection')
      
      // Simulate multiple rapid requests
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(threatDetection.checkRateLimit('192.168.1.100', requestContext))
      }
      
      const results = await Promise.all(promises)
      const lastResult = results[results.length - 1]
      
      expect(lastResult.count).toBe(10)
      expect(lastResult.limit).toBeDefined()
    })
  })

  describe('Audit Trail', () => {
    const auditContext = {
      userId: 'test-user-123',
      sessionId: 'test-session-123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      source: 'test'
    }

    test('should log authentication events', async () => {
      const auditTrail = securityFramework.getSystem('auditTrail')
      
      const auditId = await auditTrail.logAuthentication({
        action: 'login',
        userId: 'test-user-123',
        success: true,
        method: 'password',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)'
      })
      
      expect(auditId).toBeDefined()
      expect(typeof auditId).toBe('string')
    })

    test('should log PHI access events', async () => {
      const auditTrail = securityFramework.getSystem('auditTrail')
      
      const auditId = await auditTrail.logPHIAccess({
        action: 'view',
        resourceType: 'donor',
        resourceId: 'donor-123',
        userId: 'test-user-123',
        purpose: 'treatment',
        success: true,
        minimumNecessary: true
      })
      
      expect(auditId).toBeDefined()
    })

    test('should log data modification events', async () => {
      const auditTrail = securityFramework.getSystem('auditTrail')
      
      const auditId = await auditTrail.logDataModification({
        action: 'update',
        table: 'donors',
        recordId: 'donor-123',
        userId: 'test-user-123',
        changes: {
          before: { phone: '(555) 123-4567' },
          after: { phone: '(555) 987-6543' }
        },
        success: true
      })
      
      expect(auditId).toBeDefined()
    })

    test('should generate audit reports', async () => {
      const auditTrail = securityFramework.getSystem('auditTrail')
      
      const report = await auditTrail.generateAuditReport({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        eventType: 'authentication'
      })
      
      expect(report).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.events).toBeInstanceOf(Array)
      expect(report.integrity).toBeDefined()
    })

    test('should verify audit integrity', async () => {
      const auditTrail = securityFramework.getSystem('auditTrail')
      
      const verification = await auditTrail.verifyAuditIntegrity()
      
      expect(verification).toBeDefined()
      expect(verification.verified).toBe(true)
      expect(verification.totalEntries).toBeGreaterThanOrEqual(0)
      expect(verification.corruptedEntries).toBeInstanceOf(Array)
    })
  })

  describe('HIPAA Compliance', () => {
    test('should validate HIPAA compliance', async () => {
      const hipaaCompliance = securityFramework.getSystem('hipaaCompliance')
      
      const validation = await hipaaCompliance.validateCompliance()
      
      expect(validation).toBeDefined()
      expect(validation.overallScore).toBeGreaterThanOrEqual(0)
      expect(validation.overallScore).toBeLessThanOrEqual(100)
      expect(validation.checks).toBeDefined()
      expect(validation.issues).toBeInstanceOf(Array)
      expect(validation.recommendations).toBeInstanceOf(Array)
    })

    test('should get compliance status', async () => {
      const hipaaCompliance = securityFramework.getSystem('hipaaCompliance')
      
      const status = await hipaaCompliance.getComplianceStatus()
      
      expect(status).toBeDefined()
      expect(status.initialized).toBe(true)
      expect(status.auditLogger).toBeDefined()
      expect(status.accessController).toBeDefined()
      expect(status.dataProtector).toBeDefined()
    })

    test('should handle data subject requests', async () => {
      const hipaaCompliance = securityFramework.getSystem('hipaaCompliance')
      
      const request = {
        type: 'access',
        userId: 'test-user-123',
        requestedBy: 'test-user-123',
        purpose: 'patient_rights'
      }
      
      const result = await hipaaCompliance.handleDataSubjectRequest(request)
      
      expect(result).toBeDefined()
    })
  })

  describe('Security Middleware', () => {
    test('should provide security middleware stack', () => {
      const middleware = securityFramework.getSecurityMiddleware()
      
      expect(middleware).toBeInstanceOf(Array)
      expect(middleware.length).toBeGreaterThan(0)
      
      // Each middleware should be a function
      middleware.forEach(mw => {
        expect(typeof mw).toBe('function')
      })
    })

    test('should provide PHI access middleware', () => {
      const phiMiddleware = securityFramework.getPHIAccessMiddleware('treatment')
      expect(typeof phiMiddleware).toBe('function')
    })

    test('should provide error handling middleware', () => {
      const errorMiddleware = securityFramework.getErrorHandlingMiddleware()
      expect(typeof errorMiddleware).toBe('function')
    })
  })

  describe('Configuration Management', () => {
    test('should get configuration values', () => {
      const config = securityFramework.getConfiguration()
      expect(config).toBeDefined()
      expect(config.hipaa).toBeDefined()
      expect(config.authentication).toBeDefined()
      expect(config.dataProtection).toBeDefined()
    })

    test('should get nested configuration values', () => {
      const jwtSecret = securityFramework.getConfiguration('authentication.jwtSecret')
      expect(jwtSecret).toBeDefined()
      expect(typeof jwtSecret).toBe('string')
    })

    test('should update configuration', async () => {
      const updates = {
        authentication: {
          sessionTimeout: 45 * 60 * 1000 // 45 minutes
        }
      }
      
      const result = await securityFramework.updateConfiguration(updates, {
        save: false, // Don't save during tests
        notify: false
      })
      
      expect(result).toBe(true)
      
      const updatedTimeout = securityFramework.getConfiguration('authentication.sessionTimeout')
      expect(updatedTimeout).toBe(45 * 60 * 1000)
    })
  })

  describe('System Health and Monitoring', () => {
    test('should perform health checks', async () => {
      const healthResults = await securityFramework.performHealthCheck()
      
      expect(healthResults).toBeDefined()
      expect(Object.keys(healthResults)).toContain('hipaaCompliance')
      expect(Object.keys(healthResults)).toContain('threatDetection')
      expect(Object.keys(healthResults)).toContain('auditTrail')
      expect(Object.keys(healthResults)).toContain('dataProtection')
      expect(Object.keys(healthResults)).toContain('securityMiddleware')
    })

    test('should generate security reports', async () => {
      const report = await securityFramework.generateSecurityReport()
      
      expect(report).toBeDefined()
      expect(report.timestamp).toBeDefined()
      expect(report.systemHealth).toBeDefined()
      expect(report.complianceStatus).toBeDefined()
    })

    test('should check compliance status', async () => {
      const complianceStatus = await securityFramework.checkComplianceStatus()
      
      expect(complianceStatus).toBeDefined()
      expect(complianceStatus.overallScore).toBeGreaterThanOrEqual(0)
      expect(complianceStatus.checks).toBeDefined()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle system errors gracefully', async () => {
      // Test with invalid data
      await expect(
        securityFramework.protectData(null, { classification: 'phi' })
      ).resolves.toBe(null)
    })

    test('should handle missing context gracefully', async () => {
      const mockRequest = {
        method: 'GET',
        path: '/api/health',
        ip: '127.0.0.1'
      }
      
      const analysis = await securityFramework.analyzeRequest(mockRequest)
      expect(analysis).toBeDefined()
      expect(analysis.action).toBeDefined()
    })

    test('should handle configuration errors', async () => {
      const invalidUpdates = {
        authentication: {
          bcryptRounds: 'invalid' // Should be a number
        }
      }
      
      await expect(
        securityFramework.updateConfiguration(invalidUpdates, { validate: true })
      ).rejects.toThrow()
    })
  })
})

describe('Security Framework Integration', () => {
  test('should integrate with Express.js applications', () => {
    // This would test actual Express.js integration
    // For now, we'll just verify middleware functions are available
    const framework = new ComprehensiveSecurityFramework()
    
    expect(typeof framework.getSecurityMiddleware).toBe('function')
    expect(typeof framework.getAuthenticationMiddleware).toBe('function')
    expect(typeof framework.getAuthorizationMiddleware).toBe('function')
  })

  test('should handle concurrent operations', async () => {
    const framework = new ComprehensiveSecurityFramework()
    await framework.initialize()
    
    const testData = { test: 'data' }
    const promises = []
    
    // Test concurrent data protection operations
    for (let i = 0; i < 10; i++) {
      promises.push(
        framework.protectData(testData, {
          classification: 'general',
          context: { userId: `user-${i}` }
        })
      )
    }
    
    const results = await Promise.all(promises)
    expect(results).toHaveLength(10)
    
    await framework.shutdown()
  })
})
