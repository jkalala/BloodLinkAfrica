/**
 * Advanced Threat Detection System
 * 
 * Real-time security monitoring, anomaly detection, and threat response
 * for comprehensive cybersecurity protection
 */

const { EventEmitter } = require('events')
const crypto = require('crypto')

class ThreatDetectionSystem extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      anomalyThreshold: 0.8,
      maxFailedAttempts: 5,
      suspiciousActivityWindow: 300000, // 5 minutes
      ipBlockDuration: 3600000, // 1 hour
      rateLimitWindow: 60000, // 1 minute
      maxRequestsPerWindow: 100,
      geoLocationEnabled: true,
      mlModelEnabled: true,
      realTimeMonitoring: true,
      ...config
    }
    
    this.threatIntelligence = new ThreatIntelligence(this.config)
    this.anomalyDetector = new AnomalyDetector(this.config)
    this.behaviorAnalyzer = new BehaviorAnalyzer(this.config)
    this.incidentResponder = new IncidentResponder(this.config)
    
    // Threat tracking
    this.activeSessions = new Map()
    this.suspiciousIPs = new Map()
    this.blockedIPs = new Set()
    this.rateLimitTracker = new Map()
    this.securityEvents = []
    
    this.initialize()
  }

  async initialize() {
    console.log('🛡️  Initializing Advanced Threat Detection System...')
    
    try {
      // Initialize threat intelligence
      await this.threatIntelligence.initialize()
      
      // Initialize ML-based anomaly detection
      await this.anomalyDetector.initialize()
      
      // Initialize behavior analysis
      await this.behaviorAnalyzer.initialize()
      
      // Initialize incident response
      await this.incidentResponder.initialize()
      
      // Start real-time monitoring
      if (this.config.realTimeMonitoring) {
        this.startRealTimeMonitoring()
      }
      
      console.log('✅ Threat Detection System initialized')
      this.emit('system:initialized')
    } catch (error) {
      console.error('❌ Threat Detection System initialization failed:', error)
      throw error
    }
  }

  // Real-time Request Analysis
  async analyzeRequest(request, context = {}) {
    const analysis = {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ipAddress: request.ip || context.ipAddress,
      userAgent: request.headers?.['user-agent'],
      method: request.method,
      path: request.path,
      userId: context.userId,
      sessionId: context.sessionId,
      threats: [],
      riskScore: 0,
      action: 'allow'
    }

    try {
      // 1. Rate limiting check
      const rateLimitResult = await this.checkRateLimit(analysis.ipAddress, context)
      if (rateLimitResult.exceeded) {
        analysis.threats.push({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          details: rateLimitResult
        })
        analysis.riskScore += 30
      }

      // 2. IP reputation check
      const ipReputation = await this.threatIntelligence.checkIPReputation(analysis.ipAddress)
      if (ipReputation.malicious) {
        analysis.threats.push({
          type: 'malicious_ip',
          severity: 'high',
          details: ipReputation
        })
        analysis.riskScore += 70
      }

      // 3. Geolocation analysis
      if (this.config.geoLocationEnabled) {
        const geoAnalysis = await this.analyzeGeolocation(analysis.ipAddress, context)
        if (geoAnalysis.suspicious) {
          analysis.threats.push({
            type: 'suspicious_location',
            severity: 'medium',
            details: geoAnalysis
          })
          analysis.riskScore += 40
        }
      }

      // 4. User behavior analysis
      if (context.userId) {
        const behaviorAnalysis = await this.behaviorAnalyzer.analyzeUserBehavior(context.userId, request)
        if (behaviorAnalysis.anomalous) {
          analysis.threats.push({
            type: 'anomalous_behavior',
            severity: 'medium',
            details: behaviorAnalysis
          })
          analysis.riskScore += 50
        }
      }

      // 5. Request pattern analysis
      const patternAnalysis = await this.analyzeRequestPattern(request, context)
      if (patternAnalysis.suspicious) {
        analysis.threats.push({
          type: 'suspicious_pattern',
          severity: patternAnalysis.severity,
          details: patternAnalysis
        })
        analysis.riskScore += patternAnalysis.riskScore
      }

      // 6. Payload analysis for injection attacks
      const payloadAnalysis = await this.analyzePayload(request)
      if (payloadAnalysis.malicious) {
        analysis.threats.push({
          type: 'malicious_payload',
          severity: 'high',
          details: payloadAnalysis
        })
        analysis.riskScore += 80
      }

      // 7. Session analysis
      if (context.sessionId) {
        const sessionAnalysis = await this.analyzeSession(context.sessionId, request)
        if (sessionAnalysis.suspicious) {
          analysis.threats.push({
            type: 'suspicious_session',
            severity: 'medium',
            details: sessionAnalysis
          })
          analysis.riskScore += 35
        }
      }

      // Determine action based on risk score
      analysis.action = this.determineAction(analysis.riskScore, analysis.threats)

      // Log security event
      await this.logSecurityEvent(analysis)

      // Take action if necessary
      if (analysis.action !== 'allow') {
        await this.takeSecurityAction(analysis)
      }

      return analysis

    } catch (error) {
      console.error('Error in threat analysis:', error)
      analysis.threats.push({
        type: 'analysis_error',
        severity: 'low',
        details: { error: error.message }
      })
      return analysis
    }
  }

  async checkRateLimit(ipAddress, context = {}) {
    const key = `${ipAddress}:${context.userId || 'anonymous'}`
    const now = Date.now()
    const windowStart = now - this.config.rateLimitWindow

    if (!this.rateLimitTracker.has(key)) {
      this.rateLimitTracker.set(key, [])
    }

    const requests = this.rateLimitTracker.get(key)
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart)
    this.rateLimitTracker.set(key, recentRequests)

    // Add current request
    recentRequests.push(now)

    const exceeded = recentRequests.length > this.config.maxRequestsPerWindow

    return {
      exceeded,
      count: recentRequests.length,
      limit: this.config.maxRequestsPerWindow,
      windowStart,
      resetTime: windowStart + this.config.rateLimitWindow
    }
  }

  async analyzeGeolocation(ipAddress, context = {}) {
    try {
      const geoData = await this.threatIntelligence.getGeolocation(ipAddress)
      
      // Check for suspicious patterns
      let suspicious = false
      const reasons = []

      // Check if location is from a high-risk country
      if (this.threatIntelligence.isHighRiskCountry(geoData.country)) {
        suspicious = true
        reasons.push('high_risk_country')
      }

      // Check for VPN/Proxy usage
      if (geoData.isVPN || geoData.isProxy) {
        suspicious = true
        reasons.push('vpn_proxy_usage')
      }

      // Check for rapid location changes (if user context available)
      if (context.userId) {
        const locationHistory = await this.behaviorAnalyzer.getUserLocationHistory(context.userId)
        if (locationHistory.length > 0) {
          const lastLocation = locationHistory[locationHistory.length - 1]
          const distance = this.calculateDistance(geoData, lastLocation)
          const timeDiff = Date.now() - new Date(lastLocation.timestamp).getTime()
          
          // Impossible travel detection (>1000km in <1 hour)
          if (distance > 1000 && timeDiff < 3600000) {
            suspicious = true
            reasons.push('impossible_travel')
          }
        }
      }

      return {
        suspicious,
        reasons,
        geoData,
        riskScore: suspicious ? 40 : 0
      }
    } catch (error) {
      return { suspicious: false, error: error.message }
    }
  }

  async analyzeRequestPattern(request, context = {}) {
    const patterns = []
    let suspicious = false
    let severity = 'low'
    let riskScore = 0

    // SQL Injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
      /(UNION\s+SELECT)/i,
      /(\'\s*OR\s*\'\s*=\s*\')/i,
      /(\'\s*;\s*DROP\s+TABLE)/i
    ]

    // XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi
    ]

    // Command injection patterns
    const cmdPatterns = [
      /(\|\s*\w+)/,
      /(\&\&\s*\w+)/,
      /(;\s*\w+)/,
      /(`.*`)/
    ]

    const requestString = JSON.stringify(request.body || '') + (request.query ? JSON.stringify(request.query) : '')

    // Check for SQL injection
    if (sqlPatterns.some(pattern => pattern.test(requestString))) {
      patterns.push('sql_injection')
      suspicious = true
      severity = 'high'
      riskScore += 70
    }

    // Check for XSS
    if (xssPatterns.some(pattern => pattern.test(requestString))) {
      patterns.push('xss_attempt')
      suspicious = true
      severity = 'high'
      riskScore += 60
    }

    // Check for command injection
    if (cmdPatterns.some(pattern => pattern.test(requestString))) {
      patterns.push('command_injection')
      suspicious = true
      severity = 'high'
      riskScore += 80
    }

    // Check for directory traversal
    if (/\.\.\//.test(request.path) || /\.\.\\/.test(request.path)) {
      patterns.push('directory_traversal')
      suspicious = true
      severity = 'medium'
      riskScore += 50
    }

    // Check for suspicious user agents
    const suspiciousUserAgents = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /burp/i,
      /nmap/i
    ]

    if (request.headers?.['user-agent'] && 
        suspiciousUserAgents.some(pattern => pattern.test(request.headers['user-agent']))) {
      patterns.push('suspicious_user_agent')
      suspicious = true
      severity = 'medium'
      riskScore += 40
    }

    return {
      suspicious,
      severity,
      riskScore,
      patterns,
      details: {
        detectedPatterns: patterns,
        userAgent: request.headers?.['user-agent'],
        requestSize: requestString.length
      }
    }
  }

  async analyzePayload(request) {
    if (!request.body) {
      return { malicious: false }
    }

    const payload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    const threats = []
    let malicious = false

    // Check payload size (potential DoS)
    if (payload.length > 1000000) { // 1MB
      threats.push('oversized_payload')
      malicious = true
    }

    // Check for encoded payloads
    if (this.containsEncodedContent(payload)) {
      threats.push('encoded_content')
      malicious = true
    }

    // Check for suspicious file uploads
    if (request.files && request.files.length > 0) {
      const fileAnalysis = await this.analyzeFileUploads(request.files)
      if (fileAnalysis.malicious) {
        threats.push(...fileAnalysis.threats)
        malicious = true
      }
    }

    return {
      malicious,
      threats,
      payloadSize: payload.length,
      analysis: {
        hasEncodedContent: this.containsEncodedContent(payload),
        hasFileUploads: !!(request.files && request.files.length > 0)
      }
    }
  }

  async analyzeSession(sessionId, request) {
    const session = this.activeSessions.get(sessionId)
    
    if (!session) {
      return {
        suspicious: true,
        reason: 'session_not_found',
        riskScore: 30
      }
    }

    const now = Date.now()
    const timeSinceLastActivity = now - new Date(session.lastActivity).getTime()

    // Check for session hijacking indicators
    const ipChanged = session.ipAddress !== request.ip
    const userAgentChanged = session.userAgent !== request.headers?.['user-agent']
    const unusualActivity = timeSinceLastActivity > 3600000 // 1 hour

    let suspicious = false
    const reasons = []

    if (ipChanged) {
      suspicious = true
      reasons.push('ip_address_changed')
    }

    if (userAgentChanged) {
      suspicious = true
      reasons.push('user_agent_changed')
    }

    if (unusualActivity) {
      suspicious = true
      reasons.push('unusual_activity_pattern')
    }

    return {
      suspicious,
      reasons,
      riskScore: suspicious ? 35 : 0,
      details: {
        ipChanged,
        userAgentChanged,
        timeSinceLastActivity
      }
    }
  }

  determineAction(riskScore, threats) {
    // Critical threats - immediate block
    const criticalThreats = threats.filter(t => t.severity === 'critical')
    if (criticalThreats.length > 0 || riskScore >= 100) {
      return 'block'
    }

    // High risk - require additional verification
    if (riskScore >= 70) {
      return 'challenge'
    }

    // Medium risk - monitor closely
    if (riskScore >= 40) {
      return 'monitor'
    }

    // Low risk - allow with logging
    return 'allow'
  }

  async takeSecurityAction(analysis) {
    switch (analysis.action) {
      case 'block':
        await this.blockRequest(analysis)
        break
      case 'challenge':
        await this.challengeRequest(analysis)
        break
      case 'monitor':
        await this.monitorRequest(analysis)
        break
      default:
        // Allow - no additional action needed
        break
    }
  }

  async blockRequest(analysis) {
    // Add IP to blocked list
    this.blockedIPs.add(analysis.ipAddress)
    
    // Set automatic unblock timer
    setTimeout(() => {
      this.blockedIPs.delete(analysis.ipAddress)
    }, this.config.ipBlockDuration)

    // Log security incident
    await this.incidentResponder.logSecurityIncident({
      type: 'request_blocked',
      severity: 'high',
      details: analysis,
      timestamp: new Date().toISOString()
    })

    // Emit security event
    this.emit('security:request_blocked', analysis)

    console.log(`🚫 Blocked request from ${analysis.ipAddress} - Risk Score: ${analysis.riskScore}`)
  }

  async challengeRequest(analysis) {
    // Require additional authentication
    await this.incidentResponder.logSecurityIncident({
      type: 'request_challenged',
      severity: 'medium',
      details: analysis,
      timestamp: new Date().toISOString()
    })

    this.emit('security:request_challenged', analysis)

    console.log(`⚠️  Challenged request from ${analysis.ipAddress} - Risk Score: ${analysis.riskScore}`)
  }

  async monitorRequest(analysis) {
    // Add to monitoring list
    if (!this.suspiciousIPs.has(analysis.ipAddress)) {
      this.suspiciousIPs.set(analysis.ipAddress, {
        firstSeen: new Date().toISOString(),
        requestCount: 0,
        riskEvents: []
      })
    }

    const suspiciousData = this.suspiciousIPs.get(analysis.ipAddress)
    suspiciousData.requestCount++
    suspiciousData.riskEvents.push({
      timestamp: analysis.timestamp,
      riskScore: analysis.riskScore,
      threats: analysis.threats
    })

    this.emit('security:request_monitored', analysis)
  }

  async logSecurityEvent(analysis) {
    const event = {
      id: analysis.requestId,
      timestamp: analysis.timestamp,
      type: 'request_analysis',
      ipAddress: analysis.ipAddress,
      userId: analysis.userId,
      riskScore: analysis.riskScore,
      threats: analysis.threats,
      action: analysis.action
    }

    this.securityEvents.push(event)

    // Keep only recent events (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    this.securityEvents = this.securityEvents.filter(
      e => new Date(e.timestamp).getTime() > oneDayAgo
    )

    // Emit for external logging systems
    this.emit('security:event_logged', event)
  }

  startRealTimeMonitoring() {
    console.log('📊 Starting real-time security monitoring...')

    // Monitor suspicious IPs
    setInterval(() => {
      this.reviewSuspiciousIPs()
    }, 60000) // Every minute

    // Clean up old rate limit data
    setInterval(() => {
      this.cleanupRateLimitData()
    }, 300000) // Every 5 minutes

    // Generate security reports
    setInterval(() => {
      this.generateSecurityReport()
    }, 3600000) // Every hour

    // Update threat intelligence
    setInterval(() => {
      this.threatIntelligence.updateThreatFeeds()
    }, 1800000) // Every 30 minutes
  }

  async reviewSuspiciousIPs() {
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      const recentEvents = data.riskEvents.filter(
        event => Date.now() - new Date(event.timestamp).getTime() < this.config.suspiciousActivityWindow
      )

      if (recentEvents.length >= this.config.maxFailedAttempts) {
        const avgRiskScore = recentEvents.reduce((sum, event) => sum + event.riskScore, 0) / recentEvents.length

        if (avgRiskScore > 50) {
          // Escalate to blocking
          this.blockedIPs.add(ip)
          this.suspiciousIPs.delete(ip)

          await this.incidentResponder.logSecurityIncident({
            type: 'ip_auto_blocked',
            severity: 'medium',
            details: { ip, avgRiskScore, eventCount: recentEvents.length },
            timestamp: new Date().toISOString()
          })

          console.log(`🚫 Auto-blocked suspicious IP: ${ip} (Avg Risk: ${avgRiskScore})`)
        }
      }
    }
  }

  cleanupRateLimitData() {
    const now = Date.now()
    const cutoff = now - this.config.rateLimitWindow

    for (const [key, requests] of this.rateLimitTracker.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > cutoff)
      
      if (recentRequests.length === 0) {
        this.rateLimitTracker.delete(key)
      } else {
        this.rateLimitTracker.set(key, recentRequests)
      }
    }
  }

  async generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      period: '1_hour',
      summary: {
        totalRequests: this.securityEvents.length,
        blockedRequests: this.securityEvents.filter(e => e.action === 'block').length,
        challengedRequests: this.securityEvents.filter(e => e.action === 'challenge').length,
        monitoredRequests: this.securityEvents.filter(e => e.action === 'monitor').length,
        averageRiskScore: this.securityEvents.reduce((sum, e) => sum + e.riskScore, 0) / this.securityEvents.length || 0
      },
      topThreats: this.getTopThreats(),
      suspiciousIPs: Array.from(this.suspiciousIPs.keys()),
      blockedIPs: Array.from(this.blockedIPs)
    }

    this.emit('security:hourly_report', report)
    return report
  }

  getTopThreats() {
    const threatCounts = {}
    
    this.securityEvents.forEach(event => {
      event.threats.forEach(threat => {
        threatCounts[threat.type] = (threatCounts[threat.type] || 0) + 1
      })
    })

    return Object.entries(threatCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }))
  }

  // Utility methods
  containsEncodedContent(payload) {
    // Check for base64, URL encoding, etc.
    const encodingPatterns = [
      /[A-Za-z0-9+\/]{20,}={0,2}/, // Base64
      /%[0-9A-Fa-f]{2}/, // URL encoding
      /\\u[0-9A-Fa-f]{4}/, // Unicode encoding
      /\\x[0-9A-Fa-f]{2}/ // Hex encoding
    ]

    return encodingPatterns.some(pattern => pattern.test(payload))
  }

  calculateDistance(geo1, geo2) {
    // Haversine formula for calculating distance between two points
    const R = 6371 // Earth's radius in kilometers
    const dLat = (geo2.latitude - geo1.latitude) * Math.PI / 180
    const dLon = (geo2.longitude - geo1.longitude) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(geo1.latitude * Math.PI / 180) * Math.cos(geo2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  async getSystemStatus() {
    return {
      active: true,
      activeSessions: this.activeSessions.size,
      suspiciousIPs: this.suspiciousIPs.size,
      blockedIPs: this.blockedIPs.size,
      recentEvents: this.securityEvents.length,
      threatIntelligence: await this.threatIntelligence.getStatus(),
      anomalyDetector: await this.anomalyDetector.getStatus(),
      behaviorAnalyzer: await this.behaviorAnalyzer.getStatus()
    }
  }

  async shutdown() {
    console.log('🛡️  Shutting down Threat Detection System...')
    
    await this.threatIntelligence.shutdown()
    await this.anomalyDetector.shutdown()
    await this.behaviorAnalyzer.shutdown()
    await this.incidentResponder.shutdown()
    
    this.emit('system:shutdown')
  }
}

// Supporting classes (simplified - full implementations would be in separate files)
class ThreatIntelligence {
  constructor(config) { this.config = config }
  async initialize() {}
  async checkIPReputation(ip) { return { malicious: false } }
  async getGeolocation(ip) { return { country: 'US', isVPN: false, isProxy: false } }
  isHighRiskCountry(country) { return false }
  async updateThreatFeeds() {}
  async getStatus() { return { active: true } }
  async shutdown() {}
}

class AnomalyDetector {
  constructor(config) { this.config = config }
  async initialize() {}
  async getStatus() { return { active: true } }
  async shutdown() {}
}

class BehaviorAnalyzer {
  constructor(config) { this.config = config }
  async initialize() {}
  async analyzeUserBehavior(userId, request) { return { anomalous: false } }
  async getUserLocationHistory(userId) { return [] }
  async getStatus() { return { active: true } }
  async shutdown() {}
}

class IncidentResponder {
  constructor(config) { this.config = config }
  async initialize() {}
  async logSecurityIncident(incident) {}
  async getStatus() { return { active: true } }
  async shutdown() {}
}

module.exports = {
  ThreatDetectionSystem,
  ThreatIntelligence,
  AnomalyDetector,
  BehaviorAnalyzer,
  IncidentResponder
}
