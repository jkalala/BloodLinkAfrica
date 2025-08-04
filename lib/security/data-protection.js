/**
 * Advanced Data Protection System
 * 
 * Comprehensive data encryption, tokenization, and protection
 * with HIPAA compliance and field-level security
 */

const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { EventEmitter } = require('events')

class DataProtectionSystem extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivationAlgorithm: 'pbkdf2',
      keyDerivationIterations: 100000,
      saltLength: 32,
      ivLength: 16,
      tagLength: 16,
      bcryptRounds: 12,
      tokenizationEnabled: true,
      fieldLevelEncryption: true,
      keyRotationEnabled: true,
      keyRotationIntervalDays: 90,
      auditEncryption: true,
      ...config
    }
    
    this.masterKey = this.deriveMasterKey()
    this.encryptionKeys = new Map()
    this.tokenVault = new Map()
    this.fieldClassifications = new Map()
    
    this.initializeFieldClassifications()
    this.initialize()
  }

  async initialize() {
    console.log('🔐 Initializing Advanced Data Protection System...')
    
    try {
      // Initialize encryption keys
      await this.initializeEncryptionKeys()
      
      // Setup key rotation if enabled
      if (this.config.keyRotationEnabled) {
        this.setupKeyRotation()
      }
      
      // Initialize tokenization vault
      await this.initializeTokenizationVault()
      
      console.log('✅ Data Protection System initialized')
      this.emit('protection:initialized')
    } catch (error) {
      console.error('❌ Data Protection System initialization failed:', error)
      throw error
    }
  }

  // Master Key Management
  deriveMasterKey() {
    const password = process.env.MASTER_KEY_PASSWORD || 'default-master-key-change-in-production'
    const salt = process.env.MASTER_KEY_SALT || crypto.randomBytes(this.config.saltLength)
    
    return crypto.pbkdf2Sync(
      password,
      salt,
      this.config.keyDerivationIterations,
      32, // 256 bits
      'sha256'
    )
  }

  async initializeEncryptionKeys() {
    // Generate data encryption keys for different data types
    const keyTypes = ['phi', 'pii', 'financial', 'general']
    
    for (const keyType of keyTypes) {
      const key = crypto.randomBytes(32) // 256-bit key
      this.encryptionKeys.set(keyType, {
        key,
        createdAt: new Date(),
        version: 1,
        rotationCount: 0
      })
    }
    
    console.log(`🔑 Initialized ${keyTypes.length} encryption keys`)
  }

  // Field-Level Classification
  initializeFieldClassifications() {
    // PHI (Protected Health Information) fields
    const phiFields = [
      'ssn', 'socialSecurityNumber', 'medicalRecordNumber', 'healthPlanNumber',
      'accountNumber', 'certificateNumber', 'licenseNumber', 'vehicleNumber',
      'deviceNumber', 'biometricIdentifier', 'fullFacePhoto', 'fingerprint',
      'voiceprint', 'retinaScan', 'irisScan', 'dnaProfile', 'bloodType',
      'medicalHistory', 'diagnosis', 'treatment', 'medication', 'allergies',
      'labResults', 'vitalSigns', 'immunizations', 'surgeries'
    ]
    
    // PII (Personally Identifiable Information) fields
    const piiFields = [
      'firstName', 'lastName', 'fullName', 'email', 'phone', 'address',
      'dateOfBirth', 'birthDate', 'age', 'gender', 'race', 'ethnicity',
      'maritalStatus', 'occupation', 'employer', 'income', 'education'
    ]
    
    // Financial fields
    const financialFields = [
      'creditCardNumber', 'bankAccountNumber', 'routingNumber', 'iban',
      'swiftCode', 'paypalAccount', 'bitcoinAddress', 'salary', 'netWorth'
    ]
    
    // Classify fields
    phiFields.forEach(field => this.fieldClassifications.set(field, 'phi'))
    piiFields.forEach(field => this.fieldClassifications.set(field, 'pii'))
    financialFields.forEach(field => this.fieldClassifications.set(field, 'financial'))
  }

  getFieldClassification(fieldName) {
    // Check exact match first
    if (this.fieldClassifications.has(fieldName)) {
      return this.fieldClassifications.get(fieldName)
    }
    
    // Check partial matches
    for (const [classifiedField, classification] of this.fieldClassifications.entries()) {
      if (fieldName.toLowerCase().includes(classifiedField.toLowerCase()) ||
          classifiedField.toLowerCase().includes(fieldName.toLowerCase())) {
        return classification
      }
    }
    
    return 'general'
  }

  // Data Encryption
  async encryptData(data, options = {}) {
    const {
      classification = 'general',
      fieldLevel = this.config.fieldLevelEncryption,
      context = {}
    } = options

    if (typeof data === 'object' && data !== null && fieldLevel) {
      return await this.encryptObjectFields(data, context)
    } else {
      return await this.encryptValue(data, classification, context)
    }
  }

  async encryptObjectFields(obj, context = {}) {
    const encrypted = {}
    const encryptedFields = []
    
    for (const [key, value] of Object.entries(obj)) {
      const classification = this.getFieldClassification(key)
      
      if (classification !== 'general' && value !== null && value !== undefined) {
        encrypted[key] = await this.encryptValue(value, classification, {
          ...context,
          fieldName: key
        })
        encryptedFields.push({ field: key, classification })
      } else {
        encrypted[key] = value
      }
    }
    
    // Add metadata about encrypted fields
    if (encryptedFields.length > 0) {
      encrypted._encrypted = {
        fields: encryptedFields,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    }
    
    return encrypted
  }

  async encryptValue(value, classification = 'general', context = {}) {
    if (value === null || value === undefined) {
      return value
    }
    
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    const encryptionKey = this.getEncryptionKey(classification)
    
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(this.config.ivLength)
    
    // Create cipher
    const cipher = crypto.createCipherGCM(this.config.encryptionAlgorithm, encryptionKey.key, iv)
    cipher.setAAD(Buffer.from(JSON.stringify(context))) // Additional authenticated data
    
    // Encrypt data
    let encrypted = cipher.update(stringValue, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Get authentication tag
    const tag = cipher.getAuthTag()
    
    const result = {
      encrypted: true,
      data: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.config.encryptionAlgorithm,
      classification,
      keyVersion: encryptionKey.version,
      timestamp: new Date().toISOString()
    }
    
    // Emit encryption event for audit
    if (this.config.auditEncryption) {
      this.emit('data:encrypted', {
        classification,
        fieldName: context.fieldName,
        userId: context.userId,
        timestamp: result.timestamp
      })
    }
    
    return result
  }

  // Data Decryption
  async decryptData(encryptedData, options = {}) {
    const { context = {} } = options

    if (typeof encryptedData === 'object' && encryptedData !== null) {
      if (encryptedData.encrypted === true) {
        // Single encrypted value
        return await this.decryptValue(encryptedData, context)
      } else if (encryptedData._encrypted) {
        // Object with encrypted fields
        return await this.decryptObjectFields(encryptedData, context)
      }
    }
    
    return encryptedData
  }

  async decryptObjectFields(obj, context = {}) {
    const decrypted = { ...obj }
    const encryptedFields = obj._encrypted?.fields || []
    
    for (const { field, classification } of encryptedFields) {
      if (obj[field] && typeof obj[field] === 'object' && obj[field].encrypted) {
        decrypted[field] = await this.decryptValue(obj[field], {
          ...context,
          fieldName: field,
          classification
        })
      }
    }
    
    // Remove encryption metadata
    delete decrypted._encrypted
    
    return decrypted
  }

  async decryptValue(encryptedValue, context = {}) {
    if (!encryptedValue || !encryptedValue.encrypted) {
      return encryptedValue
    }
    
    const {
      data,
      iv,
      tag,
      algorithm,
      classification,
      keyVersion
    } = encryptedValue
    
    // Get decryption key
    const encryptionKey = this.getEncryptionKey(classification, keyVersion)
    
    try {
      // Create decipher
      const decipher = crypto.createDecipherGCM(algorithm, encryptionKey.key, Buffer.from(iv, 'hex'))
      decipher.setAAD(Buffer.from(JSON.stringify(context)))
      decipher.setAuthTag(Buffer.from(tag, 'hex'))
      
      // Decrypt data
      let decrypted = decipher.update(data, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decrypted)
      } catch {
        return decrypted
      }
    } catch (error) {
      // Emit decryption failure event
      this.emit('data:decryption_failed', {
        classification,
        fieldName: context.fieldName,
        userId: context.userId,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      
      throw new Error(`Decryption failed: ${error.message}`)
    }
  }

  // Data Tokenization
  async tokenizeData(data, options = {}) {
    const {
      classification = 'general',
      preserveFormat = false,
      context = {}
    } = options

    if (!this.config.tokenizationEnabled) {
      return data
    }

    const token = this.generateToken(data, preserveFormat)
    
    // Store in token vault
    this.tokenVault.set(token, {
      originalData: data,
      classification,
      createdAt: new Date().toISOString(),
      context,
      accessCount: 0
    })
    
    // Emit tokenization event
    this.emit('data:tokenized', {
      token,
      classification,
      preserveFormat,
      userId: context.userId,
      timestamp: new Date().toISOString()
    })
    
    return token
  }

  async detokenizeData(token, context = {}) {
    if (!this.tokenVault.has(token)) {
      throw new Error('Invalid token')
    }
    
    const tokenData = this.tokenVault.get(token)
    tokenData.accessCount++
    tokenData.lastAccessed = new Date().toISOString()
    
    // Emit detokenization event
    this.emit('data:detokenized', {
      token,
      classification: tokenData.classification,
      userId: context.userId,
      timestamp: new Date().toISOString()
    })
    
    return tokenData.originalData
  }

  generateToken(data, preserveFormat = false) {
    if (preserveFormat && typeof data === 'string') {
      // Preserve format for specific data types
      if (/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(data)) {
        // Credit card format
        return `${crypto.randomInt(1000, 9999)}-${crypto.randomInt(1000, 9999)}-${crypto.randomInt(1000, 9999)}-${crypto.randomInt(1000, 9999)}`
      } else if (/^\d{3}-\d{2}-\d{4}$/.test(data)) {
        // SSN format
        return `${crypto.randomInt(100, 999)}-${crypto.randomInt(10, 99)}-${crypto.randomInt(1000, 9999)}`
      } else if (/^\(\d{3}\) \d{3}-\d{4}$/.test(data)) {
        // Phone format
        return `(${crypto.randomInt(100, 999)}) ${crypto.randomInt(100, 999)}-${crypto.randomInt(1000, 9999)}`
      }
    }
    
    // Generate random token
    return `tok_${crypto.randomBytes(16).toString('hex')}`
  }

  // Password Hashing
  async hashPassword(password, options = {}) {
    const { rounds = this.config.bcryptRounds } = options
    
    const salt = await bcrypt.genSalt(rounds)
    const hash = await bcrypt.hash(password, salt)
    
    return {
      hash,
      salt,
      rounds,
      algorithm: 'bcrypt',
      createdAt: new Date().toISOString()
    }
  }

  async verifyPassword(password, hashedPassword) {
    if (typeof hashedPassword === 'object' && hashedPassword.hash) {
      return await bcrypt.compare(password, hashedPassword.hash)
    } else if (typeof hashedPassword === 'string') {
      return await bcrypt.compare(password, hashedPassword)
    }
    
    return false
  }

  // Data Masking
  maskData(data, options = {}) {
    const {
      maskChar = '*',
      preserveLength = true,
      showFirst = 0,
      showLast = 0
    } = options

    if (typeof data !== 'string') {
      return data
    }

    const length = data.length
    
    if (length <= showFirst + showLast) {
      return preserveLength ? maskChar.repeat(length) : maskChar.repeat(4)
    }
    
    const firstPart = data.substring(0, showFirst)
    const lastPart = data.substring(length - showLast)
    const maskLength = preserveLength ? length - showFirst - showLast : 4
    
    return firstPart + maskChar.repeat(maskLength) + lastPart
  }

  // Specialized masking methods
  maskEmail(email) {
    const [username, domain] = email.split('@')
    if (!domain) return this.maskData(email, { showFirst: 1, showLast: 1 })
    
    const maskedUsername = this.maskData(username, { showFirst: 1, showLast: 1 })
    return `${maskedUsername}@${domain}`
  }

  maskPhone(phone) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ***-${digits.substring(6)}`
    }
    return this.maskData(phone, { showLast: 4 })
  }

  maskCreditCard(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '')
    return `****-****-****-${digits.substring(digits.length - 4)}`
  }

  maskSSN(ssn) {
    return `***-**-${ssn.substring(ssn.length - 4)}`
  }

  // Key Management
  getEncryptionKey(classification, version = null) {
    const keyData = this.encryptionKeys.get(classification)
    
    if (!keyData) {
      throw new Error(`No encryption key found for classification: ${classification}`)
    }
    
    // If specific version requested, implement key versioning logic
    if (version && version !== keyData.version) {
      // In a real implementation, you'd retrieve the specific key version
      console.warn(`Key version ${version} requested, but current version is ${keyData.version}`)
    }
    
    return keyData
  }

  async rotateKeys() {
    console.log('🔄 Starting key rotation...')
    
    const rotatedKeys = []
    
    for (const [classification, keyData] of this.encryptionKeys.entries()) {
      const newKey = crypto.randomBytes(32)
      const oldVersion = keyData.version
      
      // Update key data
      keyData.key = newKey
      keyData.version = oldVersion + 1
      keyData.rotationCount++
      keyData.rotatedAt = new Date()
      
      rotatedKeys.push({ classification, oldVersion, newVersion: keyData.version })
    }
    
    // Emit key rotation event
    this.emit('keys:rotated', {
      rotatedKeys,
      timestamp: new Date().toISOString()
    })
    
    console.log(`🔑 Rotated ${rotatedKeys.length} encryption keys`)
    return rotatedKeys
  }

  setupKeyRotation() {
    const rotationInterval = this.config.keyRotationIntervalDays * 24 * 60 * 60 * 1000
    
    setInterval(async () => {
      try {
        await this.rotateKeys()
      } catch (error) {
        console.error('Key rotation failed:', error)
        this.emit('keys:rotation_failed', error)
      }
    }, rotationInterval)
    
    console.log(`🔄 Key rotation scheduled every ${this.config.keyRotationIntervalDays} days`)
  }

  // Token Vault Management
  async initializeTokenizationVault() {
    // In a real implementation, this would load existing tokens from secure storage
    console.log('🏦 Initializing tokenization vault')
  }

  async cleanupTokenVault() {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30) // Remove tokens older than 30 days
    
    let removedCount = 0
    
    for (const [token, tokenData] of this.tokenVault.entries()) {
      if (new Date(tokenData.createdAt) < cutoffDate) {
        this.tokenVault.delete(token)
        removedCount++
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired tokens`)
    }
  }

  // System Status and Monitoring
  async getSystemStatus() {
    return {
      active: true,
      encryptionKeys: this.encryptionKeys.size,
      tokenVault: this.tokenVault.size,
      fieldClassifications: this.fieldClassifications.size,
      keyRotationEnabled: this.config.keyRotationEnabled,
      tokenizationEnabled: this.config.tokenizationEnabled,
      fieldLevelEncryption: this.config.fieldLevelEncryption,
      lastKeyRotation: this.getLastKeyRotation()
    }
  }

  getLastKeyRotation() {
    let lastRotation = null
    
    for (const keyData of this.encryptionKeys.values()) {
      if (keyData.rotatedAt && (!lastRotation || keyData.rotatedAt > lastRotation)) {
        lastRotation = keyData.rotatedAt
      }
    }
    
    return lastRotation
  }

  async shutdown() {
    console.log('🔐 Shutting down Data Protection System...')
    
    // Clear sensitive data from memory
    this.encryptionKeys.clear()
    this.tokenVault.clear()
    
    this.emit('protection:shutdown')
  }
}

module.exports = {
  DataProtectionSystem
}
