/**
 * Comprehensive Security Configuration System
 * 
 * Centralized security configuration management with environment-specific
 * settings, compliance validation, and dynamic configuration updates
 */

const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const { EventEmitter } = require('events')

class SecurityConfigurationSystem extends EventEmitter {
  constructor(configPath = null) {
    super()
    
    this.configPath = configPath || path.join(__dirname, '../config/security.json')
    this.environment = process.env.NODE_ENV || 'development'
    
    // Default security configuration
    this.defaultConfig = {
      // Environment settings
      environment: this.environment,
      debug: this.environment === 'development',
      
      // HIPAA Compliance
      hipaa: {
        enabled: true,
        auditRetentionDays: 2555, // 7 years
        encryptionRequired: true,
        accessLoggingRequired: true,
        minimumNecessaryPrinciple: true,
        patientRightsEnabled: true,
        breachNotificationEnabled: true,
        businessAssociateAgreementRequired: true
      },
      
      // Authentication & Authorization
      authentication: {
        jwtSecret: process.env.JWT_SECRET || this.generateSecureSecret(),
        jwtExpiresIn: '1h',
        refreshTokenExpiresIn: '7d',
        bcryptRounds: 12,
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        maxLoginAttempts: 5,
        lockoutDuration: 30 * 60 * 1000, // 30 minutes
        mfaRequired: this.environment === 'production',
        mfaGracePeriod: 24 * 60 * 60 * 1000, // 24 hours
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          preventReuse: 5,
          maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
        }
      },
      
      // Data Protection
      dataProtection: {
        encryptionAlgorithm: 'aes-256-gcm',
        keyDerivationAlgorithm: 'pbkdf2',
        keyDerivationIterations: 100000,
        fieldLevelEncryption: true,
        tokenizationEnabled: true,
        keyRotationEnabled: true,
        keyRotationIntervalDays: 90,
        dataClassification: {
          phi: ['ssn', 'medicalRecordNumber', 'bloodType', 'medicalHistory'],
          pii: ['firstName', 'lastName', 'email', 'phone', 'address'],
          financial: ['creditCardNumber', 'bankAccountNumber', 'salary'],
          general: []
        },
        masking: {
          enabled: true,
          maskChar: '*',
          preserveFormat: true,
          showFirst: 1,
          showLast: 4
        }
      },
      
      // Network Security
      network: {
        cors: {
          origins: this.getCorsOrigins(),
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: this.environment === 'production' ? 100 : 1000,
          skipSuccessfulRequests: false,
          skipFailedRequests: false
        },
        helmet: {
          contentSecurityPolicy: {
            enabled: true,
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "https:"],
              scriptSrc: ["'self'"],
              connectSrc: ["'self'", "https://api.bloodlink.africa"],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"]
            }
          },
          hsts: {
            enabled: this.environment === 'production',
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
          }
        }
      },
      
      // Threat Detection
      threatDetection: {
        enabled: true,
        realTimeMonitoring: true,
        anomalyThreshold: 0.8,
        maxFailedAttempts: 5,
        suspiciousActivityWindow: 300000, // 5 minutes
        ipBlockDuration: 3600000, // 1 hour
        geoLocationEnabled: true,
        mlModelEnabled: this.environment === 'production',
        threatIntelligence: {
          enabled: true,
          updateInterval: 1800000, // 30 minutes
          sources: ['internal', 'external']
        }
      },
      
      // Audit & Logging
      audit: {
        enabled: true,
        retentionPeriodDays: 2555, // 7 years for HIPAA
        encryptionEnabled: true,
        tamperProofing: true,
        realTimeAlerts: true,
        batchSize: 1000,
        flushInterval: 30000, // 30 seconds
        compressionEnabled: true,
        backupEnabled: true,
        eventTypes: {
          authentication: true,
          authorization: true,
          dataAccess: true,
          dataModification: true,
          phiAccess: true,
          systemAccess: true,
          configurationChange: true,
          securityEvent: true,
          complianceEvent: true,
          errorEvent: true
        }
      },
      
      // Compliance
      compliance: {
        frameworks: ['hipaa', 'gdpr', 'ccpa'],
        assessmentInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
        reportingEnabled: true,
        automatedRemediation: false,
        notifications: {
          enabled: true,
          channels: ['email', 'slack', 'webhook'],
          severity: ['high', 'critical']
        }
      },
      
      // Monitoring & Alerting
      monitoring: {
        enabled: true,
        healthCheckInterval: 60000, // 1 minute
        performanceMonitoring: true,
        securityMonitoring: true,
        complianceMonitoring: true,
        alerts: {
          enabled: true,
          channels: ['email', 'slack', 'webhook'],
          thresholds: {
            failedLogins: 10,
            suspiciousActivity: 5,
            dataBreaches: 1,
            complianceViolations: 1,
            systemErrors: 50
          }
        }
      },
      
      // Backup & Recovery
      backup: {
        enabled: true,
        interval: 24 * 60 * 60 * 1000, // 24 hours
        retention: 30, // 30 backups
        encryption: true,
        compression: true,
        verification: true
      }
    }
    
    this.config = { ...this.defaultConfig }
    this.configValidators = new Map()
    this.configWatchers = new Map()
    
    this.initializeValidators()
    this.initialize()
  }

  async initialize() {
    console.log('⚙️  Initializing Security Configuration System...')
    
    try {
      // Load configuration from file
      await this.loadConfiguration()
      
      // Validate configuration
      await this.validateConfiguration()
      
      // Setup configuration watching
      this.setupConfigurationWatching()
      
      // Apply environment-specific overrides
      this.applyEnvironmentOverrides()
      
      console.log('✅ Security Configuration System initialized')
      this.emit('config:initialized', this.config)
    } catch (error) {
      console.error('❌ Security Configuration initialization failed:', error)
      throw error
    }
  }

  // Configuration Loading
  async loadConfiguration() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8')
      const loadedConfig = JSON.parse(configData)
      
      // Merge with default configuration
      this.config = this.deepMerge(this.defaultConfig, loadedConfig)
      
      console.log(`📂 Loaded security configuration from ${this.configPath}`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📝 Creating default security configuration file...')
        await this.saveConfiguration()
      } else {
        console.error('Failed to load security configuration:', error)
        throw error
      }
    }
  }

  async saveConfiguration() {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath)
      await fs.mkdir(configDir, { recursive: true })
      
      // Save configuration
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      )
      
      console.log(`💾 Saved security configuration to ${this.configPath}`)
      this.emit('config:saved', this.configPath)
    } catch (error) {
      console.error('Failed to save security configuration:', error)
      throw error
    }
  }

  // Configuration Validation
  initializeValidators() {
    // HIPAA compliance validator
    this.configValidators.set('hipaa', (config) => {
      const errors = []
      
      if (!config.hipaa.enabled) {
        errors.push('HIPAA compliance must be enabled for healthcare applications')
      }
      
      if (config.hipaa.auditRetentionDays < 2555) {
        errors.push('HIPAA requires audit logs to be retained for at least 7 years (2555 days)')
      }
      
      if (!config.hipaa.encryptionRequired) {
        errors.push('HIPAA requires encryption of PHI data')
      }
      
      return errors
    })
    
    // Authentication validator
    this.configValidators.set('authentication', (config) => {
      const errors = []
      
      if (!config.authentication.jwtSecret || config.authentication.jwtSecret.length < 32) {
        errors.push('JWT secret must be at least 32 characters long')
      }
      
      if (config.authentication.bcryptRounds < 10) {
        errors.push('BCrypt rounds should be at least 10 for security')
      }
      
      if (this.environment === 'production' && !config.authentication.mfaRequired) {
        errors.push('MFA should be required in production environment')
      }
      
      return errors
    })
    
    // Data protection validator
    this.configValidators.set('dataProtection', (config) => {
      const errors = []
      
      if (!config.dataProtection.fieldLevelEncryption) {
        errors.push('Field-level encryption should be enabled for PHI protection')
      }
      
      if (config.dataProtection.keyDerivationIterations < 100000) {
        errors.push('Key derivation iterations should be at least 100,000')
      }
      
      return errors
    })
  }

  async validateConfiguration() {
    const allErrors = []
    
    for (const [validatorName, validator] of this.configValidators.entries()) {
      try {
        const errors = validator(this.config)
        if (errors.length > 0) {
          allErrors.push(...errors.map(error => `${validatorName}: ${error}`))
        }
      } catch (error) {
        allErrors.push(`${validatorName}: Validation failed - ${error.message}`)
      }
    }
    
    if (allErrors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${allErrors.join('\n')}`
      
      if (this.environment === 'production') {
        throw new Error(errorMessage)
      } else {
        console.warn('⚠️  Configuration validation warnings:')
        allErrors.forEach(error => console.warn(`  - ${error}`))
      }
    }
    
    this.emit('config:validated', { errors: allErrors })
  }

  // Environment-specific Configuration
  applyEnvironmentOverrides() {
    const overrides = {
      development: {
        debug: true,
        authentication: {
          mfaRequired: false,
          sessionTimeout: 60 * 60 * 1000 // 1 hour
        },
        network: {
          rateLimit: {
            max: 1000
          }
        },
        threatDetection: {
          mlModelEnabled: false
        }
      },
      
      test: {
        debug: false,
        authentication: {
          bcryptRounds: 4, // Faster for tests
          sessionTimeout: 10 * 60 * 1000 // 10 minutes
        },
        audit: {
          enabled: false
        },
        threatDetection: {
          enabled: false
        }
      },
      
      production: {
        debug: false,
        authentication: {
          mfaRequired: true,
          sessionTimeout: 15 * 60 * 1000 // 15 minutes
        },
        network: {
          helmet: {
            hsts: {
              enabled: true
            }
          }
        },
        threatDetection: {
          mlModelEnabled: true
        }
      }
    }
    
    const envOverride = overrides[this.environment]
    if (envOverride) {
      this.config = this.deepMerge(this.config, envOverride)
      console.log(`🌍 Applied ${this.environment} environment overrides`)
    }
  }

  // Configuration Management
  async updateConfiguration(updates, options = {}) {
    const { validate = true, save = true, notify = true } = options
    
    // Create backup of current configuration
    const backup = JSON.parse(JSON.stringify(this.config))
    
    try {
      // Apply updates
      this.config = this.deepMerge(this.config, updates)
      
      // Validate if requested
      if (validate) {
        await this.validateConfiguration()
      }
      
      // Save if requested
      if (save) {
        await this.saveConfiguration()
      }
      
      // Notify if requested
      if (notify) {
        this.emit('config:updated', { updates, config: this.config })
      }
      
      console.log('⚙️  Security configuration updated successfully')
      return true
    } catch (error) {
      // Restore backup on failure
      this.config = backup
      console.error('Failed to update security configuration:', error)
      throw error
    }
  }

  getConfiguration(path = null) {
    if (!path) {
      return this.config
    }
    
    return this.getNestedValue(this.config, path)
  }

  setConfiguration(path, value, options = {}) {
    const updates = this.setNestedValue({}, path, value)
    return this.updateConfiguration(updates, options)
  }

  // Configuration Watching
  setupConfigurationWatching() {
    if (this.environment === 'development') {
      // Watch configuration file for changes
      const watcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          try {
            console.log('📁 Configuration file changed, reloading...')
            await this.loadConfiguration()
            await this.validateConfiguration()
            this.emit('config:reloaded', this.config)
          } catch (error) {
            console.error('Failed to reload configuration:', error)
          }
        }
      })
      
      this.configWatchers.set('file', watcher)
    }
  }

  // Utility Methods
  generateSecureSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex')
  }

  getCorsOrigins() {
    const origins = process.env.CORS_ORIGINS?.split(',') || []
    
    // Add default origins based on environment
    switch (this.environment) {
      case 'development':
        origins.push('http://localhost:3000', 'http://localhost:3001')
        break
      case 'test':
        origins.push('http://localhost:3000')
        break
      case 'production':
        origins.push('https://bloodlink.africa', 'https://app.bloodlink.africa')
        break
    }
    
    return [...new Set(origins)] // Remove duplicates
  }

  deepMerge(target, source) {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.')
    const lastKey = keys.pop()
    const target = keys.reduce((current, key) => {
      current[key] = current[key] || {}
      return current[key]
    }, obj)
    
    target[lastKey] = value
    return obj
  }

  // System Status
  getSystemStatus() {
    return {
      active: true,
      environment: this.environment,
      configPath: this.configPath,
      lastLoaded: this.lastLoaded,
      lastValidated: this.lastValidated,
      watchers: this.configWatchers.size,
      validators: this.configValidators.size
    }
  }

  async shutdown() {
    console.log('⚙️  Shutting down Security Configuration System...')
    
    // Close file watchers
    for (const watcher of this.configWatchers.values()) {
      watcher.close()
    }
    this.configWatchers.clear()
    
    this.emit('config:shutdown')
  }
}

module.exports = {
  SecurityConfigurationSystem
}
