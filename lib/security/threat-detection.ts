/**
 * Advanced Threat Detection & Security Monitoring System
 * 
 * Real-time security monitoring, anomaly detection, and automated
 * threat response for the BloodLink Africa platform
 */

import { NextRequest } from 'next/server'
import { getCache } from '../cache/redis-cache'
import { performanceMonitor } from '../performance/metrics'

export interface SecurityThreat {
  id: string
  type: ThreatType
  severity: ThreatSeverity
  source: string
  target?: string
  description: string
  evidence: Record<string, any>
  timestamp: Date
  resolved: boolean
  actions: SecurityAction[]
}

export type ThreatType = 
  | 'brute_force'
  | 'sql_injection'
  | 'xss_attempt'
  | 'csrf_attack'
  | 'rate_limit_exceeded'
  | 'suspicious_login'
  | 'data_exfiltration'
  | 'privilege_escalation'
  | 'malicious_payload'
  | 'bot_activity'
  | 'geo_anomaly'
  | 'time_anomaly'
  | 'device_anomaly'

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface SecurityAction {
  type: 'block_ip' | 'rate_limit' | 'require_mfa' | 'alert_admin' | 'log_event' | 'quarantine_user'
  timestamp: Date
  details: Record<string, any>
}

export interface SecurityMetrics {
  totalThreats: number
  threatsBlocked: number
  falsePositives: number
  responseTime: number
  threatsByType: Record<ThreatType, number>
  threatsBySeverity: Record<ThreatSeverity, number>
}

export interface AnomalyPattern {
  pattern: string
  threshold: number
  timeWindow: number
  severity: ThreatSeverity
  actions: SecurityAction['type'][]
}

class ThreatDetectionSystem {
  private threats: SecurityThreat[] = []
  private blockedIPs = new Set<string>()
  private suspiciousUsers = new Set<string>()
  private metrics: SecurityMetrics = {
    totalThreats: 0,
    threatsBlocked: 0,
    falsePositives: 0,
    responseTime: 0,
    threatsByType: {} as Record<ThreatType, number>,
    threatsBySeverity: {} as Record<ThreatSeverity, number>
  }

  // Threat detection patterns
  private readonly THREAT_PATTERNS: Record<ThreatType, AnomalyPattern> = {
    brute_force: {
      pattern: 'failed_login_attempts',
      threshold: 5,
      timeWindow: 300000, // 5 minutes
      severity: 'high',
      actions: ['block_ip', 'alert_admin']
    },
    sql_injection: {
      pattern: 'sql_injection_keywords',
      threshold: 1,
      timeWindow: 60000, // 1 minute
      severity: 'critical',
      actions: ['block_ip', 'alert_admin', 'log_event']
    },
    xss_attempt: {
      pattern: 'xss_payload_detected',
      threshold: 1,
      timeWindow: 60000,
      severity: 'high',
      actions: ['block_ip', 'alert_admin']
    },
    rate_limit_exceeded: {
      pattern: 'excessive_requests',
      threshold: 100,
      timeWindow: 60000, // 1 minute
      severity: 'medium',
      actions: ['rate_limit', 'log_event']
    },
    suspicious_login: {
      pattern: 'unusual_login_pattern',
      threshold: 1,
      timeWindow: 300000,
      severity: 'medium',
      actions: ['require_mfa', 'log_event']
    },
    bot_activity: {
      pattern: 'automated_behavior',
      threshold: 10,
      timeWindow: 60000,
      severity: 'medium',
      actions: ['rate_limit', 'log_event']
    },
    geo_anomaly: {
      pattern: 'unusual_location',
      threshold: 1,
      timeWindow: 3600000, // 1 hour
      severity: 'medium',
      actions: ['require_mfa', 'alert_admin']
    },
    time_anomaly: {
      pattern: 'unusual_time_access',
      threshold: 1,
      timeWindow: 3600000,
      severity: 'low',
      actions: ['log_event']
    },
    device_anomaly: {
      pattern: 'new_device_login',
      threshold: 1,
      timeWindow: 86400000, // 24 hours
      severity: 'low',
      actions: ['require_mfa', 'log_event']
    },
    data_exfiltration: {
      pattern: 'large_data_download',
      threshold: 1,
      timeWindow: 300000,
      severity: 'critical',
      actions: ['block_ip', 'quarantine_user', 'alert_admin']
    },
    privilege_escalation: {
      pattern: 'unauthorized_access_attempt',
      threshold: 1,
      timeWindow: 300000,
      severity: 'critical',
      actions: ['quarantine_user', 'alert_admin', 'log_event']
    },
    malicious_payload: {
      pattern: 'malicious_content_detected',
      threshold: 1,
      timeWindow: 60000,
      severity: 'high',
      actions: ['block_ip', 'alert_admin']
    },
    csrf_attack: {
      pattern: 'csrf_token_mismatch',
      threshold: 3,
      timeWindow: 300000,
      severity: 'high',
      actions: ['block_ip', 'alert_admin']
    }
  }

  // SQL injection patterns
  private readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /('|(\\')|(;)|(--)|(\s*(or|and)\s*\w+\s*=\s*\w+))/i,
    /(UNION\s+SELECT)/i,
    /(\bINTO\s+OUTFILE\b)/i
  ]

  // XSS patterns
  private readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi
  ]

  // Bot detection patterns
  private readonly BOT_PATTERNS = [
    /bot|crawler|spider|scraper/i,
    /curl|wget|python|java/i,
    /automated|headless/i
  ]

  constructor() {
    this.initializeMetrics()
  }

  private initializeMetrics(): void {
    // Initialize threat counters
    Object.keys(this.THREAT_PATTERNS).forEach(type => {
      this.metrics.threatsByType[type as ThreatType] = 0
    })

    const severities: ThreatSeverity[] = ['low', 'medium', 'high', 'critical']
    severities.forEach(severity => {
      this.metrics.threatsBySeverity[severity] = 0
    })
  }

  // Main threat detection method
  async analyzeRequest(request: NextRequest): Promise<{
    threats: SecurityThreat[]
    shouldBlock: boolean
    actions: SecurityAction[]
  }> {
    const startTime = performance.now()
    const threats: SecurityThreat[] = []
    const actions: SecurityAction[] = []

    try {
      const clientIP = this.getClientIP(request)
      const userAgent = request.headers.get('user-agent') || ''
      const url = request.url
      const method = request.method

      // Check if IP is already blocked
      if (this.blockedIPs.has(clientIP)) {
        return {
          threats: [],
          shouldBlock: true,
          actions: [{ type: 'block_ip', timestamp: new Date(), details: { reason: 'blocked_ip' } }]
        }
      }

      // Analyze different threat vectors
      const detectionResults = await Promise.all([
        this.detectSQLInjection(request),
        this.detectXSS(request),
        this.detectBotActivity(request),
        this.detectRateLimitViolation(clientIP),
        this.detectGeoAnomaly(clientIP, request),
        this.detectTimeAnomaly(request),
        this.detectBruteForce(clientIP),
        this.detectCSRFAttack(request),
        this.detectMaliciousPayload(request)
      ])

      // Collect all detected threats
      detectionResults.forEach(result => {
        if (result) {
          threats.push(result)
          this.recordThreat(result)
        }
      })

      // Determine actions based on threats
      let shouldBlock = false
      for (const threat of threats) {
        const pattern = this.THREAT_PATTERNS[threat.type]
        if (pattern) {
          for (const actionType of pattern.actions) {
            const action: SecurityAction = {
              type: actionType,
              timestamp: new Date(),
              details: { threatId: threat.id, severity: threat.severity }
            }
            actions.push(action)

            if (actionType === 'block_ip') {
              shouldBlock = true
              this.blockedIPs.add(clientIP)
            }
          }
        }
      }

      // Record performance metrics
      const responseTime = performance.now() - startTime
      this.metrics.responseTime = responseTime

      performanceMonitor.recordCustomMetric({
        name: 'security_analysis_duration',
        value: responseTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          threats_detected: threats.length.toString(),
          should_block: shouldBlock.toString()
        }
      })

      return { threats, shouldBlock, actions }

    } catch (error) {
      console.error('Threat detection error:', error)
      return { threats: [], shouldBlock: false, actions: [] }
    }
  }

  // Individual threat detection methods
  private async detectSQLInjection(request: NextRequest): Promise<SecurityThreat | null> {
    const url = new URL(request.url)
    const queryParams = url.searchParams.toString()
    const body = await this.getRequestBody(request)
    const content = queryParams + ' ' + body

    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        return this.createThreat({
          type: 'sql_injection',
          severity: 'critical',
          source: this.getClientIP(request),
          description: 'SQL injection attempt detected',
          evidence: {
            pattern: pattern.source,
            content: content.substring(0, 200),
            url: request.url,
            method: request.method
          }
        })
      }
    }

    return null
  }

  private async detectXSS(request: NextRequest): Promise<SecurityThreat | null> {
    const url = new URL(request.url)
    const queryParams = url.searchParams.toString()
    const body = await this.getRequestBody(request)
    const content = queryParams + ' ' + body

    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(content)) {
        return this.createThreat({
          type: 'xss_attempt',
          severity: 'high',
          source: this.getClientIP(request),
          description: 'XSS attempt detected',
          evidence: {
            pattern: pattern.source,
            content: content.substring(0, 200),
            url: request.url
          }
        })
      }
    }

    return null
  }

  private async detectBotActivity(request: NextRequest): Promise<SecurityThreat | null> {
    const userAgent = request.headers.get('user-agent') || ''
    
    // Check user agent patterns
    for (const pattern of this.BOT_PATTERNS) {
      if (pattern.test(userAgent)) {
        return this.createThreat({
          type: 'bot_activity',
          severity: 'medium',
          source: this.getClientIP(request),
          description: 'Bot activity detected',
          evidence: {
            userAgent,
            pattern: pattern.source
          }
        })
      }
    }

    // Check for missing common headers
    const commonHeaders = ['accept', 'accept-language', 'accept-encoding']
    const missingHeaders = commonHeaders.filter(header => !request.headers.get(header))
    
    if (missingHeaders.length >= 2) {
      return this.createThreat({
        type: 'bot_activity',
        severity: 'low',
        source: this.getClientIP(request),
        description: 'Suspicious request headers',
        evidence: {
          missingHeaders,
          userAgent
        }
      })
    }

    return null
  }

  private async detectRateLimitViolation(clientIP: string): Promise<SecurityThreat | null> {
    const cache = getCache()
    const key = `rate_limit:${clientIP}`
    
    try {
      const requests = await cache.get<number>(key) || 0
      
      if (requests > 100) { // 100 requests per minute
        return this.createThreat({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          source: clientIP,
          description: 'Rate limit exceeded',
          evidence: {
            requestCount: requests,
            timeWindow: '1 minute'
          }
        })
      }
    } catch (error) {
      console.error('Rate limit detection error:', error)
    }

    return null
  }

  private async detectGeoAnomaly(clientIP: string, request: NextRequest): Promise<SecurityThreat | null> {
    // This would integrate with a GeoIP service
    // For now, we'll simulate the detection
    const suspiciousCountries = ['CN', 'RU', 'KP'] // Example suspicious countries
    
    // In a real implementation, you would:
    // 1. Get the country from IP geolocation
    // 2. Compare with user's usual locations
    // 3. Flag if accessing from unusual location
    
    return null // Placeholder
  }

  private async detectTimeAnomaly(request: NextRequest): Promise<SecurityThreat | null> {
    const currentHour = new Date().getHours()
    
    // Flag access during unusual hours (2 AM - 5 AM)
    if (currentHour >= 2 && currentHour <= 5) {
      return this.createThreat({
        type: 'time_anomaly',
        severity: 'low',
        source: this.getClientIP(request),
        description: 'Access during unusual hours',
        evidence: {
          accessTime: new Date().toISOString(),
          hour: currentHour
        }
      })
    }

    return null
  }

  private async detectBruteForce(clientIP: string): Promise<SecurityThreat | null> {
    const cache = getCache()
    const key = `failed_logins:${clientIP}`
    
    try {
      const failedAttempts = await cache.get<number>(key) || 0
      
      if (failedAttempts >= 5) {
        return this.createThreat({
          type: 'brute_force',
          severity: 'high',
          source: clientIP,
          description: 'Brute force attack detected',
          evidence: {
            failedAttempts,
            timeWindow: '5 minutes'
          }
        })
      }
    } catch (error) {
      console.error('Brute force detection error:', error)
    }

    return null
  }

  private async detectCSRFAttack(request: NextRequest): Promise<SecurityThreat | null> {
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      const csrfToken = request.headers.get('x-csrf-token')
      const referer = request.headers.get('referer')
      const origin = request.headers.get('origin')
      
      // Check for missing CSRF token
      if (!csrfToken) {
        return this.createThreat({
          type: 'csrf_attack',
          severity: 'medium',
          source: this.getClientIP(request),
          description: 'Missing CSRF token',
          evidence: {
            method: request.method,
            referer,
            origin
          }
        })
      }
    }

    return null
  }

  private async detectMaliciousPayload(request: NextRequest): Promise<SecurityThreat | null> {
    const body = await this.getRequestBody(request)
    
    // Check for common malicious patterns
    const maliciousPatterns = [
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /shell_exec/gi,
      /base64_decode/gi,
      /file_get_contents/gi
    ]

    for (const pattern of maliciousPatterns) {
      if (pattern.test(body)) {
        return this.createThreat({
          type: 'malicious_payload',
          severity: 'high',
          source: this.getClientIP(request),
          description: 'Malicious payload detected',
          evidence: {
            pattern: pattern.source,
            content: body.substring(0, 200)
          }
        })
      }
    }

    return null
  }

  // Utility methods
  private createThreat(params: {
    type: ThreatType
    severity: ThreatSeverity
    source: string
    target?: string
    description: string
    evidence: Record<string, any>
  }): SecurityThreat {
    return {
      id: this.generateThreatId(),
      type: params.type,
      severity: params.severity,
      source: params.source,
      target: params.target,
      description: params.description,
      evidence: params.evidence,
      timestamp: new Date(),
      resolved: false,
      actions: []
    }
  }

  private generateThreatId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0] ||
           request.headers.get('x-real-ip') ||
           request.ip ||
           'unknown'
  }

  private async getRequestBody(request: NextRequest): Promise<string> {
    try {
      if (request.method === 'GET' || request.method === 'HEAD') {
        return ''
      }
      
      const body = await request.text()
      return body || ''
    } catch (error) {
      return ''
    }
  }

  private recordThreat(threat: SecurityThreat): void {
    this.threats.push(threat)
    this.metrics.totalThreats++
    this.metrics.threatsByType[threat.type]++
    this.metrics.threatsBySeverity[threat.severity]++

    // Log to external security system
    this.logThreatToExternalSystem(threat)
  }

  private async logThreatToExternalSystem(threat: SecurityThreat): Promise<void> {
    // In a real implementation, this would send to SIEM, security dashboard, etc.
    console.log('Security Threat Detected:', {
      id: threat.id,
      type: threat.type,
      severity: threat.severity,
      source: threat.source,
      timestamp: threat.timestamp
    })
  }

  // Public methods for security monitoring
  getThreats(limit = 100): SecurityThreat[] {
    return this.threats
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  getThreatsByType(type: ThreatType): SecurityThreat[] {
    return this.threats.filter(threat => threat.type === type)
  }

  getThreatsBySeverity(severity: ThreatSeverity): SecurityThreat[] {
    return this.threats.filter(threat => threat.severity === severity)
  }

  getMetrics(): SecurityMetrics {
    return { ...this.metrics }
  }

  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs)
  }

  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip)
  }

  // Threat resolution
  resolveThreat(threatId: string, resolution: string): void {
    const threat = this.threats.find(t => t.id === threatId)
    if (threat) {
      threat.resolved = true
      threat.evidence.resolution = resolution
      threat.evidence.resolvedAt = new Date().toISOString()
    }
  }

  // Security dashboard data
  getSecurityDashboardData(): {
    recentThreats: SecurityThreat[]
    metrics: SecurityMetrics
    blockedIPs: string[]
    topThreatTypes: Array<{ type: ThreatType; count: number }>
  } {
    const recentThreats = this.getThreats(10)
    const topThreatTypes = Object.entries(this.metrics.threatsByType)
      .map(([type, count]) => ({ type: type as ThreatType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      recentThreats,
      metrics: this.metrics,
      blockedIPs: this.getBlockedIPs(),
      topThreatTypes
    }
  }
}

// Singleton instance
let threatDetectionInstance: ThreatDetectionSystem | null = null

export function getThreatDetectionSystem(): ThreatDetectionSystem {
  if (!threatDetectionInstance) {
    threatDetectionInstance = new ThreatDetectionSystem()
  }
  return threatDetectionInstance
}

export default ThreatDetectionSystem
