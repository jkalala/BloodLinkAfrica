/**
 * Biometric Authentication System
 * 
 * Cross-platform biometric authentication with Face ID, Touch ID, 
 * fingerprint, and voice recognition support
 */

import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'
import { getSecurityEngine } from '../../security/security-engine'
import { performanceMonitor } from '../../performance/metrics'
import { getRealTimeEventSystem } from '../../realtime/event-system'

export interface BiometricCapabilities {
  faceId: boolean
  touchId: boolean
  fingerprint: boolean
  voice: boolean
  iris: boolean
  deviceSupported: boolean
  enrolled: boolean
  available: boolean
}

export interface BiometricAuthRequest {
  userId: string
  method: 'face_id' | 'touch_id' | 'fingerprint' | 'voice' | 'iris' | 'any'
  reason: string
  fallbackTitle?: string
  cancelTitle?: string
  timeout?: number // seconds
  allowDeviceCredentials?: boolean
}

export interface BiometricAuthResult {
  success: boolean
  method?: 'face_id' | 'touch_id' | 'fingerprint' | 'voice' | 'iris'
  error?: {
    code: string
    message: string
    type: 'user_cancel' | 'user_fallback' | 'system_cancel' | 'authentication_failed' | 'biometry_not_available' | 'biometry_not_enrolled' | 'biometry_lockout' | 'unknown'
  }
  biometricData?: {
    quality: number
    confidence: number
    template?: string // Encrypted biometric template
    metadata: Record<string, any>
  }
  timestamp: Date
  deviceInfo: {
    platform: 'ios' | 'android' | 'web'
    model: string
    osVersion: string
    appVersion: string
  }
}

export interface BiometricTemplate {
  id: string
  userId: string
  type: 'face' | 'fingerprint' | 'voice' | 'iris'
  template: string // Encrypted biometric template
  quality: number
  createdAt: Date
  lastUsed: Date
  usageCount: number
  isActive: boolean
  deviceId: string
  metadata: {
    enrollmentConditions: Record<string, any>
    securityLevel: 'low' | 'medium' | 'high'
    algorithm: string
    version: string
  }
}

export interface BiometricSecurityPolicy {
  maxAttempts: number
  lockoutDuration: number // seconds
  templateExpiry: number // days
  qualityThreshold: number
  confidenceThreshold: number
  allowFallback: boolean
  requireLiveness: boolean
  antiSpoofing: boolean
  encryptionRequired: boolean
  auditLogging: boolean
}

export interface VoiceBiometric {
  userId: string
  voiceprint: string // Encrypted voice template
  phrases: string[] // Enrollment phrases
  quality: number
  language: string
  characteristics: {
    pitch: number
    tone: number
    cadence: number
    accent: string
  }
  enrollmentDate: Date
  lastVerification: Date
}

class BiometricAuthentication {
  private db = getOptimizedDB()
  private cache = getCache()
  private securityEngine = getSecurityEngine()
  private eventSystem = getRealTimeEventSystem()

  // Security policies for different biometric methods
  private readonly SECURITY_POLICIES: Record<string, BiometricSecurityPolicy> = {
    face_id: {
      maxAttempts: 5,
      lockoutDuration: 300, // 5 minutes
      templateExpiry: 90, // 90 days
      qualityThreshold: 0.8,
      confidenceThreshold: 0.9,
      allowFallback: true,
      requireLiveness: true,
      antiSpoofing: true,
      encryptionRequired: true,
      auditLogging: true
    },
    touch_id: {
      maxAttempts: 5,
      lockoutDuration: 300,
      templateExpiry: 90,
      qualityThreshold: 0.7,
      confidenceThreshold: 0.85,
      allowFallback: true,
      requireLiveness: false,
      antiSpoofing: true,
      encryptionRequired: true,
      auditLogging: true
    },
    fingerprint: {
      maxAttempts: 5,
      lockoutDuration: 300,
      templateExpiry: 90,
      qualityThreshold: 0.75,
      confidenceThreshold: 0.8,
      allowFallback: true,
      requireLiveness: false,
      antiSpoofing: true,
      encryptionRequired: true,
      auditLogging: true
    },
    voice: {
      maxAttempts: 3,
      lockoutDuration: 600, // 10 minutes
      templateExpiry: 60, // 60 days
      qualityThreshold: 0.7,
      confidenceThreshold: 0.8,
      allowFallback: true,
      requireLiveness: true,
      antiSpoofing: true,
      encryptionRequired: true,
      auditLogging: true
    },
    iris: {
      maxAttempts: 3,
      lockoutDuration: 300,
      templateExpiry: 120, // 120 days
      qualityThreshold: 0.9,
      confidenceThreshold: 0.95,
      allowFallback: true,
      requireLiveness: true,
      antiSpoofing: true,
      encryptionRequired: true,
      auditLogging: true
    }
  }

  // Voice enrollment phrases for different languages
  private readonly VOICE_ENROLLMENT_PHRASES = {
    en: [
      'My voice is my passport, verify me',
      'BloodLink Africa keeps my data secure',
      'I am donating blood to save lives',
      'Biometric authentication protects my health data',
      'Voice recognition ensures my privacy'
    ],
    fr: [
      'Ma voix est mon passeport, vérifiez-moi',
      'BloodLink Africa sécurise mes données',
      'Je donne du sang pour sauver des vies'
    ],
    ar: [
      'صوتي هو جواز سفري، تحقق مني',
      'بلودلينك أفريقيا يحمي بياناتي',
      'أتبرع بالدم لإنقاذ الأرواح'
    ],
    sw: [
      'Sauti yangu ni pasi yangu, nithibitishe',
      'BloodLink Africa inalinda data yangu',
      'Ninachangia damu kuokoa maisha'
    ]
  }

  constructor() {
    this.initializeBiometricAuth()
  }

  async checkBiometricCapabilities(): Promise<BiometricCapabilities> {
    try {
      // This would interface with native platform APIs
      // For simulation, we'll return mock capabilities
      
      const capabilities: BiometricCapabilities = {
        faceId: Math.random() > 0.3, // 70% have Face ID
        touchId: Math.random() > 0.4, // 60% have Touch ID
        fingerprint: Math.random() > 0.2, // 80% have fingerprint
        voice: true, // Voice is software-based
        iris: Math.random() > 0.8, // 20% have iris scanner
        deviceSupported: true,
        enrolled: Math.random() > 0.3, // 70% have enrolled biometrics
        available: true
      }

      // Cache capabilities
      await this.cache.set('biometric_capabilities', capabilities, {
        ttl: 3600, // 1 hour
        tags: ['biometric', 'capabilities']
      })

      return capabilities

    } catch (error) {
      return {
        faceId: false,
        touchId: false,
        fingerprint: false,
        voice: false,
        iris: false,
        deviceSupported: false,
        enrolled: false,
        available: false
      }
    }
  }

  async authenticateWithBiometric(request: BiometricAuthRequest): Promise<BiometricAuthResult> {
    const startTime = performance.now()

    try {
      // Check if user is locked out
      const lockoutKey = `biometric_lockout:${request.userId}`
      const lockoutData = await this.cache.get<any>(lockoutKey)
      
      if (lockoutData && lockoutData.lockedUntil > Date.now()) {
        return {
          success: false,
          error: {
            code: 'BIOMETRY_LOCKOUT',
            message: 'Too many failed attempts. Please try again later.',
            type: 'biometry_lockout'
          },
          timestamp: new Date(),
          deviceInfo: await this.getDeviceInfo()
        }
      }

      // Check capabilities
      const capabilities = await this.checkBiometricCapabilities()
      
      if (!capabilities.available || !capabilities.enrolled) {
        return {
          success: false,
          error: {
            code: 'BIOMETRY_NOT_AVAILABLE',
            message: 'Biometric authentication is not available or not enrolled',
            type: 'biometry_not_available'
          },
          timestamp: new Date(),
          deviceInfo: await this.getDeviceInfo()
        }
      }

      // Determine authentication method
      let authMethod = request.method
      if (authMethod === 'any') {
        authMethod = this.selectBestAvailableMethod(capabilities)
      }

      // Check if requested method is available
      if (!this.isMethodAvailable(authMethod, capabilities)) {
        return {
          success: false,
          error: {
            code: 'METHOD_NOT_AVAILABLE',
            message: `${authMethod} is not available on this device`,
            type: 'biometry_not_available'
          },
          timestamp: new Date(),
          deviceInfo: await this.getDeviceInfo()
        }
      }

      // Perform biometric authentication
      const authResult = await this.performBiometricAuth(request.userId, authMethod, request.reason)

      // Handle authentication result
      if (authResult.success) {
        // Clear any lockout
        await this.cache.delete(lockoutKey)

        // Update usage statistics
        await this.updateBiometricUsage(request.userId, authMethod)

        // Log successful authentication
        await this.logBiometricEvent(request.userId, authMethod, 'success', authResult)

      } else {
        // Handle failed authentication
        await this.handleFailedAuthentication(request.userId, authMethod)

        // Log failed authentication
        await this.logBiometricEvent(request.userId, authMethod, 'failure', authResult)
      }

      // Record performance metrics
      performanceMonitor.recordCustomMetric({
        name: 'biometric_authentication_duration',
        value: performance.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          user_id: request.userId,
          method: authMethod,
          success: authResult.success.toString(),
          platform: authResult.deviceInfo.platform
        }
      })

      return authResult

    } catch (error) {
      const authResult: BiometricAuthResult = {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: (error as Error).message,
          type: 'unknown'
        },
        timestamp: new Date(),
        deviceInfo: await this.getDeviceInfo()
      }

      // Log error
      await this.logBiometricEvent(request.userId, request.method, 'error', authResult)

      return authResult
    }
  }

  async enrollBiometric(userId: string, type: 'face' | 'fingerprint' | 'voice' | 'iris', options?: {
    language?: string
    phrases?: string[]
  }): Promise<{
    success: boolean
    templateId?: string
    quality?: number
    error?: string
  }> {
    try {
      // Check if biometric type is supported
      const capabilities = await this.checkBiometricCapabilities()
      
      if (!this.isMethodAvailable(type === 'face' ? 'face_id' : type === 'fingerprint' ? 'fingerprint' : type, capabilities)) {
        return {
          success: false,
          error: `${type} biometric is not supported on this device`
        }
      }

      let template: BiometricTemplate

      if (type === 'voice') {
        // Voice enrollment
        const voiceResult = await this.enrollVoiceBiometric(userId, options?.language || 'en', options?.phrases)
        if (!voiceResult.success) {
          return voiceResult
        }

        template = {
          id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          type: 'voice',
          template: voiceResult.voiceprint!,
          quality: voiceResult.quality!,
          createdAt: new Date(),
          lastUsed: new Date(),
          usageCount: 0,
          isActive: true,
          deviceId: await this.getDeviceId(),
          metadata: {
            enrollmentConditions: {
              language: options?.language || 'en',
              phrases: options?.phrases || this.VOICE_ENROLLMENT_PHRASES[options?.language as keyof typeof this.VOICE_ENROLLMENT_PHRASES] || this.VOICE_ENROLLMENT_PHRASES.en
            },
            securityLevel: 'high',
            algorithm: 'voice_recognition_v2',
            version: '2.0'
          }
        }
      } else {
        // Other biometric types (face, fingerprint, iris)
        const enrollmentResult = await this.performBiometricEnrollment(userId, type)
        
        if (!enrollmentResult.success) {
          return {
            success: false,
            error: enrollmentResult.error
          }
        }

        template = {
          id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          type,
          template: enrollmentResult.template!,
          quality: enrollmentResult.quality!,
          createdAt: new Date(),
          lastUsed: new Date(),
          usageCount: 0,
          isActive: true,
          deviceId: await this.getDeviceId(),
          metadata: {
            enrollmentConditions: enrollmentResult.conditions || {},
            securityLevel: 'high',
            algorithm: `${type}_recognition_v2`,
            version: '2.0'
          }
        }
      }

      // Store biometric template
      await this.db.insert('biometric_templates', template)

      // Cache template for quick access
      await this.cache.set(`biometric_template:${template.id}`, template, {
        ttl: 24 * 3600, // 24 hours
        tags: ['biometric', 'template', userId]
      })

      // Log enrollment
      await this.eventSystem.publishEvent({
        id: `biometric_enrollment_${template.id}`,
        type: 'security_event',
        priority: 'medium',
        source: 'biometric_authentication',
        timestamp: new Date(),
        data: {
          type: 'biometric_enrolled',
          user_id: userId,
          biometric_type: type,
          template_id: template.id,
          quality: template.quality,
          device_id: template.deviceId
        }
      })

      return {
        success: true,
        templateId: template.id,
        quality: template.quality
      }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async enrollVoiceBiometric(userId: string, language: string, customPhrases?: string[]): Promise<{
    success: boolean
    voiceprint?: string
    quality?: number
    error?: string
  }> {
    try {
      const phrases = customPhrases || this.VOICE_ENROLLMENT_PHRASES[language as keyof typeof this.VOICE_ENROLLMENT_PHRASES] || this.VOICE_ENROLLMENT_PHRASES.en

      // Simulate voice enrollment process
      // In real implementation, this would:
      // 1. Record user speaking each phrase multiple times
      // 2. Extract voice features (pitch, tone, cadence, etc.)
      // 3. Create encrypted voice template
      // 4. Validate quality and uniqueness

      const voiceprint = this.generateVoiceprint(userId, phrases, language)
      const quality = 0.8 + Math.random() * 0.2 // 0.8-1.0 quality

      const voiceBiometric: VoiceBiometric = {
        userId,
        voiceprint,
        phrases,
        quality,
        language,
        characteristics: {
          pitch: 100 + Math.random() * 200, // Hz
          tone: Math.random(),
          cadence: 0.5 + Math.random() * 0.5,
          accent: this.detectAccent(language)
        },
        enrollmentDate: new Date(),
        lastVerification: new Date()
      }

      // Store voice biometric
      await this.db.insert('voice_biometrics', voiceBiometric)

      return {
        success: true,
        voiceprint,
        quality
      }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async verifyVoiceBiometric(userId: string, voiceSample: string, spokenPhrase: string): Promise<{
    success: boolean
    confidence?: number
    error?: string
  }> {
    try {
      // Get stored voice biometric
      const voiceResult = await this.db.findOne('voice_biometrics', { userId })
      
      if (!voiceResult.success || !voiceResult.data) {
        return {
          success: false,
          error: 'Voice biometric not enrolled for this user'
        }
      }

      const voiceBiometric = voiceResult.data as VoiceBiometric

      // Verify spoken phrase matches enrolled phrases
      if (!voiceBiometric.phrases.includes(spokenPhrase)) {
        return {
          success: false,
          error: 'Spoken phrase does not match enrolled phrases'
        }
      }

      // Simulate voice verification
      // In real implementation, this would:
      // 1. Extract features from voice sample
      // 2. Compare against stored voiceprint
      // 3. Calculate similarity score
      // 4. Apply anti-spoofing measures

      const confidence = this.calculateVoiceConfidence(voiceSample, voiceBiometric.voiceprint)
      const policy = this.SECURITY_POLICIES.voice

      const success = confidence >= policy.confidenceThreshold

      if (success) {
        // Update last verification
        await this.db.update('voice_biometrics', { userId }, {
          lastVerification: new Date()
        })
      }

      return {
        success,
        confidence
      }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async getBiometricTemplates(userId: string): Promise<{
    success: boolean
    templates?: BiometricTemplate[]
    error?: string
  }> {
    try {
      const templatesResult = await this.db.findMany('biometric_templates', 
        { userId, isActive: true },
        { orderBy: { createdAt: 'desc' } }
      )

      if (!templatesResult.success) {
        return {
          success: false,
          error: 'Failed to retrieve biometric templates'
        }
      }

      return {
        success: true,
        templates: templatesResult.data as BiometricTemplate[]
      }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async deleteBiometricTemplate(userId: string, templateId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Verify template belongs to user
      const templateResult = await this.db.findOne('biometric_templates', { id: templateId, userId })
      
      if (!templateResult.success || !templateResult.data) {
        return {
          success: false,
          error: 'Biometric template not found or access denied'
        }
      }

      // Soft delete template
      await this.db.update('biometric_templates', { id: templateId }, { isActive: false })

      // Remove from cache
      await this.cache.delete(`biometric_template:${templateId}`)

      // Log deletion
      await this.eventSystem.publishEvent({
        id: `biometric_deletion_${templateId}`,
        type: 'security_event',
        priority: 'medium',
        source: 'biometric_authentication',
        timestamp: new Date(),
        data: {
          type: 'biometric_deleted',
          user_id: userId,
          template_id: templateId,
          biometric_type: (templateResult.data as BiometricTemplate).type
        }
      })

      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  // Private helper methods
  private selectBestAvailableMethod(capabilities: BiometricCapabilities): 'face_id' | 'touch_id' | 'fingerprint' | 'voice' | 'iris' {
    // Priority order: Face ID > Touch ID > Fingerprint > Iris > Voice
    if (capabilities.faceId) return 'face_id'
    if (capabilities.touchId) return 'touch_id'
    if (capabilities.fingerprint) return 'fingerprint'
    if (capabilities.iris) return 'iris'
    return 'voice'
  }

  private isMethodAvailable(method: string, capabilities: BiometricCapabilities): boolean {
    switch (method) {
      case 'face_id': return capabilities.faceId
      case 'touch_id': return capabilities.touchId
      case 'fingerprint': return capabilities.fingerprint
      case 'voice': return capabilities.voice
      case 'iris': return capabilities.iris
      default: return false
    }
  }

  private async performBiometricAuth(userId: string, method: string, reason: string): Promise<BiometricAuthResult> {
    // Simulate biometric authentication
    // In real implementation, this would call native platform APIs
    
    const success = Math.random() > 0.1 // 90% success rate simulation
    const quality = 0.7 + Math.random() * 0.3 // 0.7-1.0 quality
    const confidence = 0.8 + Math.random() * 0.2 // 0.8-1.0 confidence

    return {
      success,
      method: method as any,
      biometricData: success ? {
        quality,
        confidence,
        template: `encrypted_template_${Date.now()}`,
        metadata: {
          reason,
          timestamp: new Date(),
          deviceId: await this.getDeviceId()
        }
      } : undefined,
      error: success ? undefined : {
        code: 'AUTHENTICATION_FAILED',
        message: 'Biometric authentication failed',
        type: 'authentication_failed'
      },
      timestamp: new Date(),
      deviceInfo: await this.getDeviceInfo()
    }
  }

  private async performBiometricEnrollment(userId: string, type: string): Promise<{
    success: boolean
    template?: string
    quality?: number
    conditions?: Record<string, any>
    error?: string
  }> {
    // Simulate biometric enrollment
    const success = Math.random() > 0.05 // 95% success rate
    
    if (!success) {
      return {
        success: false,
        error: 'Biometric enrollment failed - please try again'
      }
    }

    return {
      success: true,
      template: `encrypted_${type}_template_${Date.now()}_${userId}`,
      quality: 0.8 + Math.random() * 0.2,
      conditions: {
        lighting: 'good',
        angle: 'optimal',
        distance: 'appropriate',
        environment: 'quiet'
      }
    }
  }

  private generateVoiceprint(userId: string, phrases: string[], language: string): string {
    // Simulate voice template generation
    return `voice_template_${userId}_${language}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private detectAccent(language: string): string {
    const accents: Record<string, string[]> = {
      en: ['american', 'british', 'australian', 'canadian', 'south_african'],
      fr: ['parisian', 'canadian', 'african', 'belgian'],
      ar: ['egyptian', 'levantine', 'gulf', 'maghrebi'],
      sw: ['kenyan', 'tanzanian', 'ugandan']
    }
    
    const languageAccents = accents[language] || ['neutral']
    return languageAccents[Math.floor(Math.random() * languageAccents.length)]
  }

  private calculateVoiceConfidence(voiceSample: string, storedVoiceprint: string): number {
    // Simulate voice matching confidence calculation
    return 0.7 + Math.random() * 0.3 // 0.7-1.0 confidence
  }

  private async handleFailedAuthentication(userId: string, method: string): Promise<void> {
    const attemptKey = `biometric_attempts:${userId}:${method}`
    const policy = this.SECURITY_POLICIES[method]
    
    // Increment attempt counter
    const attempts = await this.cache.get<number>(attemptKey) || 0
    const newAttempts = attempts + 1
    
    await this.cache.set(attemptKey, newAttempts, {
      ttl: policy.lockoutDuration,
      tags: ['biometric', 'attempts', userId]
    })

    // Check if lockout threshold reached
    if (newAttempts >= policy.maxAttempts) {
      const lockoutKey = `biometric_lockout:${userId}`
      await this.cache.set(lockoutKey, {
        lockedUntil: Date.now() + (policy.lockoutDuration * 1000),
        attempts: newAttempts,
        method
      }, {
        ttl: policy.lockoutDuration,
        tags: ['biometric', 'lockout', userId]
      })

      // Log lockout event
      await this.eventSystem.publishEvent({
        id: `biometric_lockout_${Date.now()}`,
        type: 'security_event',
        priority: 'high',
        source: 'biometric_authentication',
        timestamp: new Date(),
        data: {
          type: 'biometric_lockout',
          user_id: userId,
          method,
          attempts: newAttempts,
          lockout_duration: policy.lockoutDuration
        }
      })
    }
  }

  private async updateBiometricUsage(userId: string, method: string): Promise<void> {
    // Update template usage statistics
    const templatesResult = await this.getBiometricTemplates(userId)
    
    if (templatesResult.success && templatesResult.templates) {
      const template = templatesResult.templates.find(t => 
        (method === 'face_id' && t.type === 'face') ||
        (method === 'fingerprint' && t.type === 'fingerprint') ||
        (method === 'touch_id' && t.type === 'fingerprint') ||
        (method === 'voice' && t.type === 'voice') ||
        (method === 'iris' && t.type === 'iris')
      )

      if (template) {
        await this.db.update('biometric_templates', { id: template.id }, {
          lastUsed: new Date(),
          usageCount: template.usageCount + 1
        })
      }
    }
  }

  private async logBiometricEvent(userId: string, method: string, result: 'success' | 'failure' | 'error', authResult: BiometricAuthResult): Promise<void> {
    await this.securityEngine.logSecurityEvent({
      type: 'biometric_authentication',
      severity: result === 'success' ? 'info' : result === 'failure' ? 'warning' : 'error',
      source: {
        ipAddress: 'device_local',
        userAgent: `BiometricAuth/${authResult.deviceInfo.platform}`
      },
      target: {
        resource: 'biometric_auth',
        action: method
      },
      details: {
        description: `Biometric authentication ${result}`,
        evidence: {
          user_id: userId,
          method,
          result,
          confidence: authResult.biometricData?.confidence,
          quality: authResult.biometricData?.quality,
          device_info: authResult.deviceInfo,
          error_code: authResult.error?.code
        },
        riskScore: result === 'success' ? 10 : result === 'failure' ? 60 : 80,
        mitigationActions: result !== 'success' ? ['monitor_user', 'require_additional_auth'] : []
      }
    })
  }

  private async getDeviceInfo(): Promise<BiometricAuthResult['deviceInfo']> {
    // This would get actual device information from native APIs
    return {
      platform: Math.random() > 0.5 ? 'ios' : 'android',
      model: 'Simulated Device',
      osVersion: '14.0',
      appVersion: '1.0.0'
    }
  }

  private async getDeviceId(): Promise<string> {
    // This would get actual device ID from native APIs
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeBiometricAuth(): void {
    console.log('Biometric authentication system initialized')
  }

  // Public API methods
  public getSecurityPolicies() {
    return this.SECURITY_POLICIES
  }

  public getVoiceEnrollmentPhrases(language: string = 'en') {
    return this.VOICE_ENROLLMENT_PHRASES[language as keyof typeof this.VOICE_ENROLLMENT_PHRASES] || this.VOICE_ENROLLMENT_PHRASES.en
  }

  public async getSystemStats() {
    const capabilities = await this.checkBiometricCapabilities()
    
    return {
      supportedMethods: Object.keys(this.SECURITY_POLICIES).length,
      deviceCapabilities: capabilities,
      securityPolicies: Object.keys(this.SECURITY_POLICIES).length,
      voiceLanguages: Object.keys(this.VOICE_ENROLLMENT_PHRASES).length
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const capabilities = await this.checkBiometricCapabilities()
    const stats = await this.getSystemStats()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (!capabilities.deviceSupported) {
      status = 'unhealthy'
    } else if (!capabilities.enrolled || !capabilities.available) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        ...stats,
        deviceSupported: capabilities.deviceSupported,
        biometricsEnrolled: capabilities.enrolled,
        biometricsAvailable: capabilities.available
      }
    }
  }
}

// Singleton instance
let biometricAuthInstance: BiometricAuthentication | null = null

export function getBiometricAuthentication(): BiometricAuthentication {
  if (!biometricAuthInstance) {
    biometricAuthInstance = new BiometricAuthentication()
  }
  return biometricAuthInstance
}

export default BiometricAuthentication
