/**
 * Comprehensive Security & Compliance Framework
 * 
 * Main integration point for all security systems including HIPAA compliance,
 * threat detection, audit trails, data protection, and security middleware
 */

const { EventEmitter } = require('events')
const { SecurityConfigurationSystem } = require('./security-config')
const { HIPAAComplianceFramework } = require('./hipaa-compliance')
const { ThreatDetectionSystem } = require('./threat-detection')
const { AuditTrailSystem } = require('./audit-trail')
const { DataProtectionSystem } = require('./data-protection')
const { SecurityMiddlewareSystem } = require('./security-middleware')

class ComprehensiveSecurityFramework extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.initialized = false
    this.systems = new Map()
    this.healthStatus = new Map()
    
    // Initialize configuration system first
    this.configSystem = new SecurityConfigurationSystem(config.configPath)
    
    this.initialize()
  }

  async initialize() {
    console.log('🛡️  Initializing Comprehensive Security & Compliance Framework...')
    
    try {
      // Initialize configuration system
      await this.configSystem.initialize()
      const securityConfig = this.configSystem.getConfiguration()
      
      // Initialize core security systems
      await this.initializeSecuritySystems(securityConfig)
      
      // Setup system monitoring
      this.setupSystemMonitoring()
      
      // Setup event handling
      this.setupEventHandling()
      
      // Start health monitoring
      this.startHealthMonitoring()
      
      this.initialized = true
      console.log('✅ Comprehensive Security Framework initialized successfully')
      this.emit('framework:initialized')
      
    } catch (error) {
      console.error('❌ Security Framework initialization failed:', error)
      this.emit('framework:error', error)
      throw error
    }
  }

  async initializeSecuritySystems(config) {
    const systems = [
      {
        name: 'hipaaCompliance',
        class: HIPAAComplianceFramework,
        config: config.hipaa,
        description: 'HIPAA Compliance Framework'
      },
      {
        name: 'threatDetection',
        class: ThreatDetectionSystem,
        config: config.threatDetection,
        description: 'Threat Detection System'
      },
      {
        name: 'auditTrail',
        class: AuditTrailSystem,
        config: config.audit,
        description: 'Audit Trail System'
      },
      {
        name: 'dataProtection',
        class: DataProtectionSystem,
        config: config.dataProtection,
        description: 'Data Protection System'
      },
      {
        name: 'securityMiddleware',
        class: SecurityMiddlewareSystem,
        config: {
          ...config.authentication,
          ...config.network,
          ...config.monitoring
        },
        description: 'Security Middleware System'
      }
    ]

    for (const systemConfig of systems) {
      try {
        console.log(`🔧 Initializing ${systemConfig.description}...`)
        
        const system = new systemConfig.class(systemConfig.config)
        await system.initialize()
        
        this.systems.set(systemConfig.name, system)
        this.healthStatus.set(systemConfig.name, { status: 'healthy', lastCheck: new Date() })
        
        console.log(`✅ ${systemConfig.description} initialized`)
      } catch (error) {
        console.error(`❌ Failed to initialize ${systemConfig.description}:`, error)
        this.healthStatus.set(systemConfig.name, { 
          status: 'error', 
          error: error.message, 
          lastCheck: new Date() 
        })
        throw error
      }
    }
  }

  setupEventHandling() {
    // Forward events from subsystems
    for (const [systemName, system] of this.systems.entries()) {
      system.on('error', (error) => {
        this.emit('system:error', { system: systemName, error })
        this.healthStatus.set(systemName, { 
          status: 'error', 
          error: error.message, 
          lastCheck: new Date() 
        })
      })
      
      // Forward specific security events
      if (system.eventNames) {
        system.eventNames().forEach(eventName => {
          system.on(eventName, (data) => {
            this.emit(`${systemName}:${eventName}`, data)
          })
        })
      }
    }

    // Handle configuration changes
    this.configSystem.on('config:updated', async (data) => {
      console.log('⚙️  Security configuration updated, applying changes...')
      await this.applyConfigurationChanges(data.updates)
    })
  }

  setupSystemMonitoring() {
    // Monitor system health
    setInterval(async () => {
      await this.performHealthCheck()
    }, 60000) // Every minute

    // Monitor security events
    setInterval(async () => {
      await this.generateSecurityReport()
    }, 3600000) // Every hour

    // Monitor compliance status
    setInterval(async () => {
      await this.checkComplianceStatus()
    }, 24 * 60 * 60 * 1000) // Daily
  }

  // Core Security Operations
  async authenticateUser(credentials, context = {}) {
    const hipaaCompliance = this.systems.get('hipaaCompliance')
    const auditTrail = this.systems.get('auditTrail')
    
    try {
      // Perform authentication through HIPAA compliance system
      const authResult = await hipaaCompliance.authenticateUser(credentials, context)
      
      // Log authentication event
      await auditTrail.logAuthentication({
        action: 'login',
        userId: credentials.userId || credentials.email,
        success: authResult.success,
        method: authResult.method,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: authResult.session?.sessionId,
        mfaUsed: authResult.mfaUsed,
        riskScore: context.riskScore
      })
      
      return authResult
    } catch (error) {
      // Log failed authentication
      await auditTrail.logAuthentication({
        action: 'login_failed',
        userId: credentials.userId || credentials.email,
        success: false,
        failureReason: error.message,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      })
      
      throw error
    }
  }

  async protectData(data, options = {}) {
    const dataProtection = this.systems.get('dataProtection')
    const auditTrail = this.systems.get('auditTrail')
    
    try {
      // Encrypt sensitive data
      const protectedData = await dataProtection.encryptData(data, options)
      
      // Log data protection event
      await auditTrail.logEvent('data_protection', {
        action: 'encrypt',
        classification: options.classification,
        fieldCount: Object.keys(data).length,
        success: true
      }, options.context)
      
      return protectedData
    } catch (error) {
      await auditTrail.logEvent('data_protection', {
        action: 'encrypt_failed',
        error: error.message,
        success: false
      }, options.context)
      
      throw error
    }
  }

  async accessPHI(phiData, context = {}) {
    const hipaaCompliance = this.systems.get('hipaaCompliance')
    const auditTrail = this.systems.get('auditTrail')
    
    try {
      // Decrypt PHI data through HIPAA compliance system
      const decryptedData = await hipaaCompliance.decryptPHI(phiData, context)
      
      // Log PHI access
      await auditTrail.logPHIAccess({
        action: 'access',
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        userId: context.userId,
        purpose: context.purpose || 'treatment',
        success: true,
        minimumNecessary: true,
        authorization: context.authorization || 'user_consent'
      })
      
      return decryptedData
    } catch (error) {
      await auditTrail.logPHIAccess({
        action: 'access_denied',
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        userId: context.userId,
        success: false,
        denialReason: error.message
      })
      
      throw error
    }
  }

  async analyzeRequest(request, context = {}) {
    const threatDetection = this.systems.get('threatDetection')
    
    return await threatDetection.analyzeRequest(request, context)
  }

  // Middleware Integration
  getSecurityMiddleware() {
    const securityMiddleware = this.systems.get('securityMiddleware')
    return securityMiddleware.getSecurityMiddleware()
  }

  getAuthenticationMiddleware() {
    const securityMiddleware = this.systems.get('securityMiddleware')
    return securityMiddleware.authenticationMiddleware()
  }

  getAuthorizationMiddleware(permissions = []) {
    const securityMiddleware = this.systems.get('securityMiddleware')
    return securityMiddleware.authorizationMiddleware(permissions)
  }

  getPHIAccessMiddleware(purpose = 'treatment') {
    const securityMiddleware = this.systems.get('securityMiddleware')
    return securityMiddleware.phiAccessMiddleware(purpose)
  }

  getErrorHandlingMiddleware() {
    const securityMiddleware = this.systems.get('securityMiddleware')
    return securityMiddleware.errorHandlingMiddleware()
  }

  // Health Monitoring
  async performHealthCheck() {
    const healthResults = {}
    
    for (const [systemName, system] of this.systems.entries()) {
      try {
        const status = await system.getSystemStatus()
        healthResults[systemName] = {
          status: 'healthy',
          details: status,
          lastCheck: new Date()
        }
        this.healthStatus.set(systemName, healthResults[systemName])
      } catch (error) {
        healthResults[systemName] = {
          status: 'error',
          error: error.message,
          lastCheck: new Date()
        }
        this.healthStatus.set(systemName, healthResults[systemName])
      }
    }
    
    this.emit('health:check_completed', healthResults)
    return healthResults
  }

  startHealthMonitoring() {
    console.log('📊 Starting security system health monitoring...')
    
    // Perform initial health check
    setImmediate(() => this.performHealthCheck())
    
    // Setup periodic health checks
    setInterval(async () => {
      const healthResults = await this.performHealthCheck()
      
      // Check for unhealthy systems
      const unhealthySystems = Object.entries(healthResults)
        .filter(([, status]) => status.status !== 'healthy')
      
      if (unhealthySystems.length > 0) {
        this.emit('health:systems_unhealthy', unhealthySystems)
        console.warn(`⚠️  ${unhealthySystems.length} security systems are unhealthy`)
      }
    }, 60000) // Every minute
  }

  // Reporting and Compliance
  async generateSecurityReport() {
    const auditTrail = this.systems.get('auditTrail')
    const threatDetection = this.systems.get('threatDetection')
    const hipaaCompliance = this.systems.get('hipaaCompliance')
    
    const report = {
      timestamp: new Date().toISOString(),
      period: 'hourly',
      systemHealth: await this.getSystemHealth(),
      securityEvents: await threatDetection.generateSecurityReport(),
      auditSummary: await auditTrail.generateAuditReport({
        startDate: new Date(Date.now() - 3600000).toISOString() // Last hour
      }),
      complianceStatus: await hipaaCompliance.getComplianceStatus()
    }
    
    this.emit('security:report_generated', report)
    return report
  }

  async checkComplianceStatus() {
    const hipaaCompliance = this.systems.get('hipaaCompliance')
    
    try {
      const complianceValidation = await hipaaCompliance.validateCompliance()
      
      if (complianceValidation.overallScore < 80) {
        this.emit('compliance:score_low', complianceValidation)
        console.warn(`⚠️  Compliance score is low: ${complianceValidation.overallScore}%`)
      }
      
      if (complianceValidation.issues.length > 0) {
        this.emit('compliance:issues_found', complianceValidation.issues)
      }
      
      return complianceValidation
    } catch (error) {
      this.emit('compliance:check_failed', error)
      throw error
    }
  }

  // Configuration Management
  async applyConfigurationChanges(updates) {
    // Apply configuration changes to relevant systems
    for (const [systemName, system] of this.systems.entries()) {
      if (system.updateConfiguration && typeof system.updateConfiguration === 'function') {
        try {
          await system.updateConfiguration(updates)
          console.log(`✅ Applied configuration changes to ${systemName}`)
        } catch (error) {
          console.error(`❌ Failed to apply configuration changes to ${systemName}:`, error)
        }
      }
    }
  }

  getConfiguration(path = null) {
    return this.configSystem.getConfiguration(path)
  }

  async updateConfiguration(updates, options = {}) {
    return await this.configSystem.updateConfiguration(updates, options)
  }

  // System Status and Information
  async getSystemHealth() {
    const health = {}
    
    for (const [systemName, status] of this.healthStatus.entries()) {
      health[systemName] = status
    }
    
    return {
      overall: this.calculateOverallHealth(health),
      systems: health,
      lastCheck: new Date()
    }
  }

  calculateOverallHealth(systemHealth) {
    const systems = Object.values(systemHealth)
    const healthyCount = systems.filter(s => s.status === 'healthy').length
    const totalCount = systems.length
    
    if (totalCount === 0) return 'unknown'
    if (healthyCount === totalCount) return 'healthy'
    if (healthyCount === 0) return 'critical'
    return 'degraded'
  }

  getSystemStatus() {
    return {
      initialized: this.initialized,
      systems: Array.from(this.systems.keys()),
      health: this.calculateOverallHealth(Object.fromEntries(this.healthStatus)),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      configuration: this.configSystem.getSystemStatus()
    }
  }

  // Utility Methods
  isInitialized() {
    return this.initialized
  }

  getSystem(systemName) {
    return this.systems.get(systemName)
  }

  hasSystem(systemName) {
    return this.systems.has(systemName)
  }

  // Shutdown
  async shutdown() {
    console.log('🛡️  Shutting down Comprehensive Security Framework...')
    
    // Shutdown all systems
    for (const [systemName, system] of this.systems.entries()) {
      try {
        if (system.shutdown && typeof system.shutdown === 'function') {
          await system.shutdown()
          console.log(`✅ ${systemName} shutdown complete`)
        }
      } catch (error) {
        console.error(`❌ Error shutting down ${systemName}:`, error)
      }
    }
    
    // Shutdown configuration system
    await this.configSystem.shutdown()
    
    this.initialized = false
    this.emit('framework:shutdown')
    console.log('✅ Security Framework shutdown complete')
  }
}

// Export main framework and individual components
module.exports = {
  ComprehensiveSecurityFramework,
  SecurityConfigurationSystem,
  HIPAAComplianceFramework,
  ThreatDetectionSystem,
  AuditTrailSystem,
  DataProtectionSystem,
  SecurityMiddlewareSystem
}
