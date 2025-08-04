/**
 * Security Monitoring and Logging System
 * Comprehensive security event tracking and threat detection
 */

import { createServerSupabaseClient } from './supabase'
import { ErrorSeverity } from './error-handling'

// Security event types
export enum SecurityEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  ACCOUNT_LOCKED = 'account_locked',
  
  // Authorization Events
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  
  // Data Access Events
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  BULK_DATA_EXPORT = 'bulk_data_export',
  UNAUTHORIZED_DATA_ACCESS = 'unauthorized_data_access',
  
  // Security Violations
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  MALICIOUS_INPUT_DETECTED = 'malicious_input_detected',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  
  // System Events
  CONFIGURATION_CHANGE = 'configuration_change',
  SYSTEM_ERROR = 'system_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  
  // API Events
  API_KEY_MISUSE = 'api_key_misuse',
  INVALID_API_REQUEST = 'invalid_api_request',
  API_RATE_LIMIT_HIT = 'api_rate_limit_hit',
  
  // File Operations
  FILE_UPLOAD = 'file_upload',
  FILE_DOWNLOAD = 'file_download',
  MALWARE_DETECTED = 'malware_detected',
  
  // Business Logic Events
  PAYMENT_FRAUD_ATTEMPT = 'payment_fraud_attempt',
  VERIFICATION_CODE_ABUSE = 'verification_code_abuse',
  ACCOUNT_CREATION_ANOMALY = 'account_creation_anomaly'
}

// Risk levels for security events
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Security event interface
export interface SecurityEvent {
  id?: string
  event_type: SecurityEventType
  risk_level: RiskLevel
  user_id?: string
  session_id?: string
  ip_address?: string
  user_agent?: string
  endpoint?: string
  method?: string
  request_id?: string
  details: Record<string, unknown>
  timestamp: string
  resolved: boolean
  resolved_at?: string
  resolved_by?: string
  notes?: string
}

// Threat detection patterns
interface ThreatPattern {
  name: string
  pattern: RegExp | ((data: unknown) => boolean)
  riskLevel: RiskLevel
  description: string
}

// Common threat patterns
const THREAT_PATTERNS: ThreatPattern[] = [
  {
    name: 'SQL Injection',
    pattern: /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bUPDATE\b).*(\bFROM\b|\bWHERE\b|\bINTO\b)/i,
    riskLevel: RiskLevel.HIGH,
    description: 'Potential SQL injection attempt detected'
  },
  {
    name: 'XSS Attempt',
    pattern: /<script[^>]*>.*?<\/script>|javascript:|on\w+\s*=/i,
    riskLevel: RiskLevel.MEDIUM,
    description: 'Potential XSS attack detected'
  },
  {
    name: 'Path Traversal',
    pattern: /(\.\.[\/\\]){2,}|(\.\.[\/\\].*){3,}/,
    riskLevel: RiskLevel.HIGH,
    description: 'Potential path traversal attack detected'
  },
  {
    name: 'Command Injection',
    pattern: /[;&|`$(){}[\]]/,
    riskLevel: RiskLevel.HIGH,
    description: 'Potential command injection attempt detected'
  },
  {
    name: 'Suspicious User Agent',
    pattern: /(bot|crawler|spider|scan|hack|exploit)/i,
    riskLevel: RiskLevel.LOW,
    description: 'Suspicious user agent detected'
  }
]

// Rate limiting tracking
const rateLimitTracking = new Map<string, { count: number; resetTime: number; violations: number }>()

// Security monitoring class
export class SecurityMonitor {
  private supabase = createServerSupabaseClient()

  /**
   * Log a security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        ...event,
        timestamp: new Date().toISOString(),
        resolved: false
      }

      // Store in database
      const { error } = await this.supabase
        .from('security_events')
        .insert([securityEvent])

      if (error) {
        console.error('Failed to log security event:', error)
        // Fallback to console logging
        console.warn('SECURITY EVENT:', securityEvent)
      }

      // Alert for high-risk events
      if (event.risk_level === RiskLevel.CRITICAL || event.risk_level === RiskLevel.HIGH) {
        await this.sendSecurityAlert(securityEvent)
      }

    } catch (error) {
      console.error('Security logging error:', error)
      // Always log to console as fallback
      console.warn('SECURITY EVENT (FALLBACK):', event)
    }
  }

  /**
   * Analyze input for potential threats
   */
  analyzeInput(input: string, context: string = ''): { threats: string[]; riskLevel: RiskLevel } {
    const threats: string[] = []
    let maxRiskLevel = RiskLevel.LOW

    for (const pattern of THREAT_PATTERNS) {
      const isMatch = pattern.pattern instanceof RegExp 
        ? pattern.pattern.test(input)
        : pattern.pattern(input)

      if (isMatch) {
        threats.push(pattern.name)
        if (this.getRiskLevelValue(pattern.riskLevel) > this.getRiskLevelValue(maxRiskLevel)) {
          maxRiskLevel = pattern.riskLevel
        }
      }
    }

    // Log threats if found
    if (threats.length > 0) {
      this.logSecurityEvent({
        event_type: SecurityEventType.MALICIOUS_INPUT_DETECTED,
        risk_level: maxRiskLevel,
        details: {
          input: input.substring(0, 500), // Limit logged input size
          threats,
          context
        }
      })
    }

    return { threats, riskLevel: maxRiskLevel }
  }

  /**
   * Track and detect suspicious activity patterns
   */
  async trackUserActivity(userId: string, activity: string, details: Record<string, unknown> = {}): Promise<void> {
    const activityKey = `${userId}:${activity}`
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window

    // Get current tracking data
    const current = rateLimitTracking.get(activityKey) || { 
      count: 0, 
      resetTime: now + windowMs, 
      violations: 0 
    }

    // Reset if window expired
    if (now > current.resetTime) {
      current.count = 0
      current.resetTime = now + windowMs
    }

    current.count++

    // Define suspicious activity thresholds
    const thresholds: Record<string, number> = {
      'login_attempt': 5,
      'password_reset': 3,
      'api_call': 100,
      'data_access': 50,
      'file_upload': 10
    }

    const threshold = thresholds[activity] || 20

    if (current.count > threshold) {
      current.violations++
      
      await this.logSecurityEvent({
        event_type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        risk_level: current.violations > 3 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        user_id: userId,
        details: {
          activity,
          count: current.count,
          threshold,
          violations: current.violations,
          ...details
        }
      })
    }

    rateLimitTracking.set(activityKey, current)
  }

  /**
   * Monitor failed authentication attempts
   */
  async trackFailedLogin(identifier: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const key = `failed_login:${identifier}:${ipAddress}`
    const now = Date.now()
    const windowMs = 15 * 60 * 1000 // 15 minutes

    const current = rateLimitTracking.get(key) || { 
      count: 0, 
      resetTime: now + windowMs, 
      violations: 0 
    }

    if (now > current.resetTime) {
      current.count = 0
      current.resetTime = now + windowMs
    }

    current.count++

    // Log failed attempt
    await this.logSecurityEvent({
      event_type: SecurityEventType.LOGIN_FAILURE,
      risk_level: current.count > 5 ? RiskLevel.HIGH : RiskLevel.LOW,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: {
        identifier,
        attempt_count: current.count,
        window_start: new Date(current.resetTime - windowMs).toISOString()
      }
    })

    // Lock account after multiple failures
    if (current.count >= 10) {
      await this.logSecurityEvent({
        event_type: SecurityEventType.ACCOUNT_LOCKED,
        risk_level: RiskLevel.HIGH,
        ip_address: ipAddress,
        details: {
          identifier,
          reason: 'Multiple failed login attempts',
          attempt_count: current.count
        }
      })
    }

    rateLimitTracking.set(key, current)
  }

  /**
   * Log successful authentication
   */
  async trackSuccessfulLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logSecurityEvent({
      event_type: SecurityEventType.LOGIN_SUCCESS,
      risk_level: RiskLevel.LOW,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: {
        login_time: new Date().toISOString()
      }
    })

    // Clear failed login attempts for this user
    const keys = Array.from(rateLimitTracking.keys()).filter(key => 
      key.includes(`failed_login:${userId}:`) || key.includes(`failed_login:${ipAddress}:`)
    )
    keys.forEach(key => rateLimitTracking.delete(key))
  }

  /**
   * Monitor API usage patterns
   */
  async trackApiUsage(endpoint: string, method: string, userId?: string, ipAddress?: string): Promise<void> {
    const key = `api:${endpoint}:${userId || ipAddress}`
    
    await this.trackUserActivity(userId || 'anonymous', 'api_call', {
      endpoint,
      method,
      ip_address: ipAddress
    })

    // Log high-risk API access
    const highRiskEndpoints = ['/api/admin', '/api/users', '/api/payment', '/api/export']
    
    if (highRiskEndpoints.some(risky => endpoint.startsWith(risky))) {
      await this.logSecurityEvent({
        event_type: SecurityEventType.SENSITIVE_DATA_ACCESS,
        risk_level: RiskLevel.MEDIUM,
        user_id: userId,
        ip_address: ipAddress,
        endpoint,
        method,
        details: {
          endpoint,
          method,
          access_time: new Date().toISOString()
        }
      })
    }
  }

  /**
   * Send security alerts for critical events
   */
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // In production, this would send alerts via email, Slack, SMS, etc.
    console.error('🚨 SECURITY ALERT:', {
      type: event.event_type,
      risk: event.risk_level,
      user: event.user_id,
      ip: event.ip_address,
      details: event.details,
      timestamp: event.timestamp
    })

    // Could integrate with services like:
    // - PagerDuty for incident management
    // - Slack for team notifications  
    // - Email for security team alerts
    // - SIEM systems for enterprise monitoring
  }

  /**
   * Get numeric value for risk level comparison
   */
  private getRiskLevelValue(level: RiskLevel): number {
    switch (level) {
      case RiskLevel.LOW: return 1
      case RiskLevel.MEDIUM: return 2
      case RiskLevel.HIGH: return 3
      case RiskLevel.CRITICAL: return 4
      default: return 1
    }
  }

  /**
   * Get security metrics for monitoring dashboard
   */
  async getSecurityMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<{
    totalEvents: number
    eventsByType: Record<string, number>
    eventsByRisk: Record<string, number>
    topThreats: Array<{ type: string; count: number }>
    suspiciousIPs: Array<{ ip: string; events: number }>
  }> {
    try {
      const timeRangeHours = {
        '1h': 1,
        '24h': 24,
        '7d': 168,
        '30d': 720
      }

      const hoursAgo = timeRangeHours[timeRange]
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

      const { data: events, error } = await this.supabase
        .from('security_events')
        .select('event_type, risk_level, ip_address')
        .gte('timestamp', cutoffTime)

      if (error || !events) {
        console.error('Failed to fetch security metrics:', error)
        return {
          totalEvents: 0,
          eventsByType: {},
          eventsByRisk: {},
          topThreats: [],
          suspiciousIPs: []
        }
      }

      // Calculate metrics
      const eventsByType: Record<string, number> = {}
      const eventsByRisk: Record<string, number> = {}
      const ipCounts: Record<string, number> = {}

      events.forEach(event => {
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1
        eventsByRisk[event.risk_level] = (eventsByRisk[event.risk_level] || 0) + 1
        
        if (event.ip_address) {
          ipCounts[event.ip_address] = (ipCounts[event.ip_address] || 0) + 1
        }
      })

      const topThreats = Object.entries(eventsByType)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }))

      const suspiciousIPs = Object.entries(ipCounts)
        .filter(([, count]) => count > 5) // IPs with more than 5 events
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([ip, events]) => ({ ip, events }))

      return {
        totalEvents: events.length,
        eventsByType,
        eventsByRisk,
        topThreats,
        suspiciousIPs
      }

    } catch (error) {
      console.error('Error fetching security metrics:', error)
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsByRisk: {},
        topThreats: [],
        suspiciousIPs: []
      }
    }
  }
}

// Singleton instance
export const securityMonitor = new SecurityMonitor()

// Convenience functions
export const logSecurityEvent = (event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>) => 
  securityMonitor.logSecurityEvent(event)

export const analyzeInput = (input: string, context?: string) => 
  securityMonitor.analyzeInput(input, context)

export const trackUserActivity = (userId: string, activity: string, details?: Record<string, unknown>) => 
  securityMonitor.trackUserActivity(userId, activity, details)

export const trackFailedLogin = (identifier: string, ipAddress?: string, userAgent?: string) => 
  securityMonitor.trackFailedLogin(identifier, ipAddress, userAgent)

export const trackSuccessfulLogin = (userId: string, ipAddress?: string, userAgent?: string) => 
  securityMonitor.trackSuccessfulLogin(userId, ipAddress, userAgent)

export const trackApiUsage = (endpoint: string, method: string, userId?: string, ipAddress?: string) => 
  securityMonitor.trackApiUsage(endpoint, method, userId, ipAddress)