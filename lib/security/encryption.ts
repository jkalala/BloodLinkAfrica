/**
 * Advanced Data Encryption & Security Utilities
 * 
 * Comprehensive encryption system for sensitive data protection
 * including AES encryption, hashing, key management, and PII protection
 */

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { createHash, createHmac, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export interface EncryptionResult {
  encrypted: string
  iv: string
  tag: string
  algorithm: string
}

export interface DecryptionOptions {
  encrypted: string
  iv: string
  tag: string
  algorithm: string
}

export interface HashOptions {
  algorithm?: 'sha256' | 'sha512' | 'blake2b'
  salt?: string
  iterations?: number
}

export interface PIIField {
  field: string
  value: string
  encrypted: boolean
  hashed: boolean
}

class EncryptionManager {
  private readonly ENCRYPTION_KEY: Buffer
  private readonly HMAC_KEY: Buffer
  private readonly DEFAULT_ALGORITHM = 'aes-256-gcm'
  private readonly KEY_DERIVATION_ITERATIONS = 100000
  private readonly SALT_LENGTH = 32
  private readonly IV_LENGTH = 16
  private readonly TAG_LENGTH = 16

  // PII field patterns for automatic detection
  private readonly PII_PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\+]?[1-9][\d]{0,15}$/,
    ssn: /^\d{3}-?\d{2}-?\d{4}$/,
    creditCard: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
    passport: /^[A-Z]{1,2}\d{6,9}$/,
    nationalId: /^\d{8,12}$/
  }

  constructor() {
    // Initialize encryption keys from environment variables
    const masterKey = process.env.ENCRYPTION_MASTER_KEY
    const hmacKey = process.env.HMAC_SECRET_KEY

    if (!masterKey || !hmacKey) {
      throw new Error('Encryption keys not configured. Set ENCRYPTION_MASTER_KEY and HMAC_SECRET_KEY environment variables.')
    }

    this.ENCRYPTION_KEY = Buffer.from(masterKey, 'hex')
    this.HMAC_KEY = Buffer.from(hmacKey, 'hex')

    // Validate key lengths
    if (this.ENCRYPTION_KEY.length !== 32) {
      throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex characters)')
    }
    if (this.HMAC_KEY.length !== 32) {
      throw new Error('HMAC_SECRET_KEY must be 32 bytes (64 hex characters)')
    }
  }

  // AES Encryption/Decryption
  async encrypt(data: string, algorithm = this.DEFAULT_ALGORITHM): Promise<EncryptionResult> {
    try {
      const iv = randomBytes(this.IV_LENGTH)
      const cipher = crypto.createCipher(algorithm, this.ENCRYPTION_KEY, { iv })
      
      let encrypted = cipher.update(data, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const tag = cipher.getAuthTag()

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm
      }
    } catch (error) {
      throw new Error(`Encryption failed: ${(error as Error).message}`)
    }
  }

  async decrypt(options: DecryptionOptions): Promise<string> {
    try {
      const { encrypted, iv, tag, algorithm } = options
      
      const decipher = crypto.createDecipher(algorithm, this.ENCRYPTION_KEY, {
        iv: Buffer.from(iv, 'hex')
      })
      
      decipher.setAuthTag(Buffer.from(tag, 'hex'))
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`)
    }
  }

  // Key Derivation
  async deriveKey(password: string, salt?: string): Promise<{
    key: Buffer
    salt: string
  }> {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(this.SALT_LENGTH)
    const key = await scryptAsync(password, saltBuffer, 32) as Buffer
    
    return {
      key,
      salt: saltBuffer.toString('hex')
    }
  }

  // Hashing Functions
  hash(data: string, options: HashOptions = {}): string {
    const {
      algorithm = 'sha256',
      salt = '',
      iterations = 1
    } = options

    let hash = data + salt
    
    for (let i = 0; i < iterations; i++) {
      hash = createHash(algorithm).update(hash).digest('hex')
    }
    
    return hash
  }

  hmac(data: string, algorithm = 'sha256'): string {
    return createHmac(algorithm, this.HMAC_KEY)
      .update(data)
      .digest('hex')
  }

  // Password Hashing (bcrypt)
  async hashPassword(password: string, rounds = 12): Promise<string> {
    return bcrypt.hash(password, rounds)
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  // Secure Random Generation
  generateSecureToken(length = 32): string {
    return randomBytes(length).toString('hex')
  }

  generateSecureId(): string {
    return randomBytes(16).toString('hex')
  }

  generateApiKey(): string {
    const prefix = 'blk_'
    const key = randomBytes(32).toString('base64url')
    return prefix + key
  }

  // PII Protection
  async encryptPII(data: Record<string, any>): Promise<Record<string, any>> {
    const result = { ...data }
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && this.isPII(key, value)) {
        const encrypted = await this.encrypt(value)
        result[key] = {
          _encrypted: true,
          data: encrypted
        }
      }
    }
    
    return result
  }

  async decryptPII(data: Record<string, any>): Promise<Record<string, any>> {
    const result = { ...data }
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value._encrypted) {
        const decrypted = await this.decrypt(value.data)
        result[key] = decrypted
      }
    }
    
    return result
  }

  // PII Detection
  private isPII(fieldName: string, value: string): boolean {
    const lowerFieldName = fieldName.toLowerCase()
    
    // Check field name patterns
    const piiFieldNames = [
      'email', 'phone', 'ssn', 'social_security',
      'passport', 'national_id', 'credit_card',
      'address', 'full_name', 'first_name', 'last_name'
    ]
    
    if (piiFieldNames.some(pattern => lowerFieldName.includes(pattern))) {
      return true
    }
    
    // Check value patterns
    return Object.values(this.PII_PATTERNS).some(pattern => pattern.test(value))
  }

  // Data Masking
  maskEmail(email: string): string {
    const [username, domain] = email.split('@')
    if (username.length <= 2) {
      return `${username[0]}***@${domain}`
    }
    return `${username.substring(0, 2)}***@${domain}`
  }

  maskPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length <= 4) {
      return '***-***-' + cleaned
    }
    return '***-***-' + cleaned.slice(-4)
  }

  maskCreditCard(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '')
    if (cleaned.length <= 4) {
      return '**** **** **** ' + cleaned
    }
    return '**** **** **** ' + cleaned.slice(-4)
  }

  maskGeneric(value: string, visibleChars = 2): string {
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length)
    }
    return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars)
  }

  // Secure Comparison
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }
    
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    
    return result === 0
  }

  // Data Sanitization
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[;&|`$]/g, '') // Remove command injection chars
      .trim()
  }

  sanitizeSQL(input: string): string {
    return input
      .replace(/['";\\]/g, '') // Remove SQL injection chars
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL block comments
      .trim()
  }

  // Secure Headers Generation
  generateCSPHeader(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.bloodlink.africa wss://api.bloodlink.africa",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  }

  generateSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': this.generateCSPHeader(),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }
  }

  // Audit Trail
  generateAuditHash(data: Record<string, any>): string {
    const sortedData = Object.keys(data)
      .sort()
      .reduce((result, key) => {
        result[key] = data[key]
        return result
      }, {} as Record<string, any>)
    
    const dataString = JSON.stringify(sortedData)
    return this.hash(dataString, { algorithm: 'sha256' })
  }

  verifyAuditHash(data: Record<string, any>, expectedHash: string): boolean {
    const computedHash = this.generateAuditHash(data)
    return this.secureCompare(computedHash, expectedHash)
  }

  // Key Rotation
  async rotateEncryptionKey(oldKey: Buffer, newKey: Buffer, encryptedData: EncryptionResult): Promise<EncryptionResult> {
    // Decrypt with old key
    const tempKey = this.ENCRYPTION_KEY
    this.ENCRYPTION_KEY = oldKey as any
    
    const decrypted = await this.decrypt(encryptedData)
    
    // Encrypt with new key
    this.ENCRYPTION_KEY = newKey as any
    const reencrypted = await this.encrypt(decrypted)
    
    // Restore current key
    this.ENCRYPTION_KEY = tempKey as any
    
    return reencrypted
  }

  // Secure Storage Utilities
  encryptForStorage(data: any): string {
    const jsonString = JSON.stringify(data)
    const encrypted = this.encrypt(jsonString)
    return Buffer.from(JSON.stringify(encrypted)).toString('base64')
  }

  async decryptFromStorage(encryptedData: string): Promise<any> {
    try {
      const encryptionResult = JSON.parse(Buffer.from(encryptedData, 'base64').toString())
      const decrypted = await this.decrypt(encryptionResult)
      return JSON.parse(decrypted)
    } catch (error) {
      throw new Error(`Storage decryption failed: ${(error as Error).message}`)
    }
  }

  // Zero-knowledge proof utilities
  generateCommitment(secret: string, nonce?: string): {
    commitment: string
    nonce: string
  } {
    const nonceValue = nonce || this.generateSecureToken(16)
    const commitment = this.hash(secret + nonceValue, { algorithm: 'sha256' })
    
    return {
      commitment,
      nonce: nonceValue
    }
  }

  verifyCommitment(secret: string, nonce: string, commitment: string): boolean {
    const computedCommitment = this.hash(secret + nonce, { algorithm: 'sha256' })
    return this.secureCompare(computedCommitment, commitment)
  }
}

// Singleton instance
let encryptionManagerInstance: EncryptionManager | null = null

export function getEncryptionManager(): EncryptionManager {
  if (!encryptionManagerInstance) {
    encryptionManagerInstance = new EncryptionManager()
  }
  return encryptionManagerInstance
}

// Utility functions
export function generateSecurePassword(length = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length)
    password += charset[randomIndex]
  }
  
  return password
}

export function isSecurePassword(password: string): {
  isSecure: boolean
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  if (password.length >= 8) score += 1
  else feedback.push('Password should be at least 8 characters long')

  if (password.length >= 12) score += 1
  else feedback.push('Consider using 12+ characters for better security')

  if (/[a-z]/.test(password)) score += 1
  else feedback.push('Include lowercase letters')

  if (/[A-Z]/.test(password)) score += 1
  else feedback.push('Include uppercase letters')

  if (/\d/.test(password)) score += 1
  else feedback.push('Include numbers')

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1
  else feedback.push('Include special characters')

  if (!/(.)\1{2,}/.test(password)) score += 1
  else feedback.push('Avoid repeating characters')

  return {
    isSecure: score >= 5,
    score,
    feedback
  }
}

export type { EncryptionResult, DecryptionOptions, HashOptions, PIIField }
export default EncryptionManager
