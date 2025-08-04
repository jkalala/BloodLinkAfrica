/**
 * Advanced Threat Protection System
 * 
 * Next-generation threat protection with AI-powered analysis, zero-trust architecture,
 * and automated incident response for comprehensive security coverage
 */

import { getSecurityEngine } from './security-engine'
import { getThreatDetectionSystem } from './threat-detection'
import { getMLPipelineAPI } from '../ai/ml-pipeline/ml-pipeline-api'
import { getOptimizedDB } from '../database/optimized-queries'
import { getCache } from '../cache/redis-cache'
import { performanceMonitor } from '../performance/metrics'
import { getRealTimeEventSystem } from '../realtime/event-system'

export interface ThreatIntelligenceFeed {
  id: string
  name: string
  source: 'commercial' | 'open_source' | 'government' | 'internal'
  type: 'ip_reputation' | 'domain_reputation' | 'malware_signatures' | 'attack_patterns'
  updateFrequency: number // minutes
  reliability: 'high' | 'medium' | 'low'
  lastUpdate: Date
  indicators: Array<{
    value: string
    type: string
    confidence: number
    firstSeen: Date
    lastSeen: Date
    tags: string[]
  }>
  isActive: boolean
}

export interface ZeroTrustPolicy {
  id: string
  name: string
  description: string
  scope: {
    users: string[] // User IDs or roles
    resources: string[] // Resource patterns
    networks: string[] // IP ranges or network segments
    devices: string[] // Device types or IDs
  }
  conditions: Array<{
    type: 'location' | 'time' | 'device' | 'behavior' | 'risk_score'
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in'
    value: any
    weight: number
  }>
  actions: Array<{
    type: 'allow' | 'deny' | 'challenge' | 'monitor' | 'restrict'
    parameters: Record<string, any>
    conditions?: string[]
  }>
  priority: number
  isActive: boolean
  lastModified: Date
}

export interface IncidentResponse {
  id: string
  threatId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'detected' | 'analyzing' | 'containing' | 'eradicating' | 'recovering' | 'resolved'
  timeline: Array<{
    phase: string
    action: string
    timestamp: Date
    performer: 'system' | 'analyst' | 'admin'
    result: 'success' | 'failure' | 'partial'
    details: string
  }>
  affectedSystems: Array<{
    type: 'user' | 'server' | 'database' | 'application' | 'network'
    id: string
    impact: 'none' | 'low' | 'medium' | 'high' | 'critical'
    status: 'normal' | 'compromised' | 'isolated' | 'recovering'
  }>
  containmentActions: Array<{
    action: string
    automated: boolean
    timestamp: Date
    status: 'pending' | 'executing' | 'completed' | 'failed'
    result?: string
  }>
  forensicData: {
    evidenceCollected: string[]
    analysisResults: Record<string, any>
    indicators: string[]
    attribution?: {
      actor: string
      confidence: number
      techniques: string[]
    }
  }
  communicationLog: Array<{
    timestamp: Date
    recipient: string
    channel: 'email' | 'sms' | 'phone' | 'dashboard'
    message: string
    acknowledged: boolean
  }>
}

export interface SecurityOrchestration {
  id: string
  name: string
  trigger: {
    eventType: string
    conditions: Record<string, any>
    severity: string[]
  }
  workflow: Array<{
    step: number
    action: string
    type: 'automated' | 'manual' | 'approval_required'
    timeout: number // seconds
    onSuccess: 'continue' | 'complete' | 'branch'
    onFailure: 'retry' | 'escalate' | 'abort'
    parameters: Record<string, any>
  }>
  approvers: string[] // User IDs who can approve manual steps
  isActive: boolean
  executionHistory: Array<{
    executionId: string
    startTime: Date
    endTime?: Date
    status: 'running' | 'completed' | 'failed' | 'aborted'
    steps: Array<{
      step: number
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
      startTime?: Date
      endTime?: Date
      result?: any
    }>
  }>
}

class AdvancedThreatProtectionSystem {
  private securityEngine = getSecurityEngine()
  private threatDetection = getThreatDetectionSystem()
  private mlPipeline = getMLPipelineAPI()
  private db = getOptimizedDB()
  private cache = getCache()
  private eventSystem = getRealTimeEventSystem()

  private threatIntelligenceFeeds: Map<string, ThreatIntelligenceFeed> = new Map()
  private zeroTrustPolicies: Map<string, ZeroTrustPolicy> = new Map()
  private activeIncidents: Map<string, IncidentResponse> = new Map()
  private securityOrchestrations: Map<string, SecurityOrchestration> = new Map()

  // Configuration
  private readonly CONFIG = {
    threatIntelligence: {
      updateInterval: 15 * 60 * 1000, // 15 minutes
      maxIndicators: 100000,
      confidenceThreshold: 0.7,
      retentionDays: 90
    },
    zeroTrust: {
      defaultDeny: true,
      continuousVerification: true,
      riskThreshold: 70,
      sessionTimeout: 3600 // 1 hour
    },
    incidentResponse: {
      autoContainment: true,
      escalationTimeout: 1800, // 30 minutes
      forensicsRetention: 2555, // 7 years
      communicationChannels: ['email', 'sms', 'dashboard']
    },
    orchestration: {
      maxConcurrentWorkflows: 50,
      stepTimeout: 300, // 5 minutes
      retryAttempts: 3,
      approvalTimeout: 3600 // 1 hour
    }
  }

  constructor() {
    this.initializeThreatIntelligence()
    this.initializeZeroTrustPolicies()
    this.initializeSecurityOrchestrations()
    this.startThreatProtection()
  }

  async evaluateZeroTrustAccess(request: {
    userId: string
    resource: string
    action: string
    context: {
      ipAddress: string
      userAgent: string
      location?: string
      deviceId?: string
      timestamp: Date
    }
  }): Promise<{
    decision: 'allow' | 'deny' | 'challenge' | 'monitor'
    confidence: number
    riskScore: number
    appliedPolicies: string[]
    requiredActions: Array<{
      type: string
      description: string
      parameters: Record<string, any>
    }>
    sessionRestrictions?: Record<string, any>
  }> {
    try {
      const startTime = performance.now()
      let totalRiskScore = 0
      let policyCount = 0
      const appliedPolicies: string[] = []
      const requiredActions: any[] = []

      // Get user risk profile
      const userRisk = await this.calculateUserRiskScore(request.userId, request.context)
      totalRiskScore += userRisk * 0.4

      // Get resource sensitivity
      const resourceRisk = await this.calculateResourceRiskScore(request.resource, request.action)
      totalRiskScore += resourceRisk * 0.3

      // Get contextual risk
      const contextRisk = await this.calculateContextualRiskScore(request.context)
      totalRiskScore += contextRisk * 0.3

      // Evaluate applicable zero trust policies
      for (const [policyId, policy] of this.zeroTrustPolicies.entries()) {
        if (!policy.isActive) continue

        const policyApplies = await this.evaluatePolicyScope(policy, request)
        if (!policyApplies) continue

        const policyScore = await this.evaluatePolicyConditions(policy, request)
        if (policyScore > 0) {
          appliedPolicies.push(policyId)
          totalRiskScore += policyScore * (policy.priority / 100)
          policyCount++

          // Collect required actions from policy
          for (const action of policy.actions) {
            if (this.shouldExecuteAction(action, policyScore)) {
              requiredActions.push({
                type: action.type,
                description: `Policy ${policy.name} requires ${action.type}`,
                parameters: action.parameters
              })
            }
          }
        }
      }

      // Normalize risk score
      const finalRiskScore = Math.min(100, totalRiskScore)

      // Make access decision
      let decision: 'allow' | 'deny' | 'challenge' | 'monitor' = 'allow'
      let confidence = 0.8

      if (finalRiskScore >= 90) {
        decision = 'deny'
        confidence = 0.95
      } else if (finalRiskScore >= this.CONFIG.zeroTrust.riskThreshold) {
        decision = 'challenge'
        confidence = 0.85
      } else if (finalRiskScore >= 40) {
        decision = 'monitor'
        confidence = 0.75
      }

      // Generate session restrictions for high-risk access
      let sessionRestrictions
      if (finalRiskScore >= 50) {
        sessionRestrictions = {
          maxSessionDuration: Math.max(300, this.CONFIG.zeroTrust.sessionTimeout - (finalRiskScore * 30)),
          requireReauth: finalRiskScore >= 70,
          restrictedActions: finalRiskScore >= 80 ? ['delete', 'export', 'admin'] : [],
          monitoringLevel: finalRiskScore >= 60 ? 'enhanced' : 'standard'
        }
      }

      // Log zero trust evaluation
      await this.securityEngine.logAuditTrail({
        userId: request.userId,
        action: 'zero_trust_evaluation',
        resource: request.resource,
        details: {
          decision,
          risk_score: finalRiskScore,
          applied_policies: appliedPolicies,
          required_actions: requiredActions.length
        },
        ipAddress: request.context.ipAddress,
        userAgent: request.context.userAgent,
        outcome: decision === 'allow' ? 'success' : 'restricted',
        riskLevel: finalRiskScore >= 70 ? 'high' : finalRiskScore >= 40 ? 'medium' : 'low',
        dataClassification: 'internal'
      })

      // Record metrics
      performanceMonitor.recordCustomMetric({
        name: 'zero_trust_evaluation_duration',
        value: performance.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          decision,
          risk_score: Math.floor(finalRiskScore / 10) * 10, // Bucket by 10s
          policies_applied: appliedPolicies.length.toString()
        }
      })

      return {
        decision,
        confidence,
        riskScore: finalRiskScore,
        appliedPolicies,
        requiredActions,
        sessionRestrictions
      }

    } catch (error) {
      throw new Error(`Zero trust evaluation failed: ${(error as Error).message}`)
    }
  }

  async initiateIncidentResponse(threatId: string, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<string> {
    try {
      const incidentId = `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const incident: IncidentResponse = {
        id: incidentId,
        threatId,
        severity,
        status: 'detected',
        timeline: [{
          phase: 'detection',
          action: 'incident_created',
          timestamp: new Date(),
          performer: 'system',
          result: 'success',
          details: 'Incident response initiated automatically'
        }],
        affectedSystems: [],
        containmentActions: [],
        forensicData: {
          evidenceCollected: [],
          analysisResults: {},
          indicators: []
        },
        communicationLog: []
      }

      // Store incident
      this.activeIncidents.set(incidentId, incident)
      await this.db.insert('security_incidents', incident)

      // Start automated response workflow
      await this.executeIncidentWorkflow(incidentId)

      // Notify stakeholders
      await this.notifyIncidentStakeholders(incident)

      return incidentId

    } catch (error) {
      throw new Error(`Incident response initiation failed: ${(error as Error).message}`)
    }
  }

  async updateThreatIntelligence(): Promise<{
    updated: number
    added: number
    removed: number
    errors: string[]
  }> {
    try {
      let updated = 0
      let added = 0
      let removed = 0
      const errors: string[] = []

      for (const [feedId, feed] of this.threatIntelligenceFeeds.entries()) {
        if (!feed.isActive) continue

        try {
          const newIndicators = await this.fetchThreatIntelligence(feed)
          
          // Update existing indicators
          for (const indicator of newIndicators) {
            const existingIndicator = feed.indicators.find(i => i.value === indicator.value)
            if (existingIndicator) {
              existingIndicator.lastSeen = indicator.lastSeen
              existingIndicator.confidence = indicator.confidence
              updated++
            } else {
              feed.indicators.push(indicator)
              added++
            }
          }

          // Remove expired indicators
          const cutoffDate = new Date(Date.now() - this.CONFIG.threatIntelligence.retentionDays * 24 * 60 * 60 * 1000)
          const initialCount = feed.indicators.length
          feed.indicators = feed.indicators.filter(i => i.lastSeen > cutoffDate)
          removed += initialCount - feed.indicators.length

          feed.lastUpdate = new Date()

        } catch (error) {
          errors.push(`Feed ${feedId}: ${(error as Error).message}`)
        }
      }

      // Update cache
      for (const [feedId, feed] of this.threatIntelligenceFeeds.entries()) {
        await this.cache.set(`threat_intel:${feedId}`, feed, { 
          ttl: this.CONFIG.threatIntelligence.updateInterval / 1000,
          tags: ['threat_intelligence', feedId]
        })
      }

      return { updated, added, removed, errors }

    } catch (error) {
      throw new Error(`Threat intelligence update failed: ${(error as Error).message}`)
    }
  }

  async executeSecurityOrchestration(orchestrationId: string, triggerData: any): Promise<string> {
    try {
      const orchestration = this.securityOrchestrations.get(orchestrationId)
      if (!orchestration || !orchestration.isActive) {
        throw new Error(`Orchestration ${orchestrationId} not found or inactive`)
      }

      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const execution = {
        executionId,
        startTime: new Date(),
        status: 'running' as const,
        steps: orchestration.workflow.map(step => ({
          step: step.step,
          status: 'pending' as const
        }))
      }

      orchestration.executionHistory.push(execution)

      // Execute workflow steps
      for (const workflowStep of orchestration.workflow) {
        const stepExecution = execution.steps.find(s => s.step === workflowStep.step)!
        stepExecution.status = 'running'
        stepExecution.startTime = new Date()

        try {
          const result = await this.executeOrchestrationStep(workflowStep, triggerData)
          stepExecution.status = 'completed'
          stepExecution.endTime = new Date()
          stepExecution.result = result

          if (workflowStep.onSuccess === 'complete') break

        } catch (error) {
          stepExecution.status = 'failed'
          stepExecution.endTime = new Date()

          if (workflowStep.onFailure === 'abort') {
            execution.status = 'failed'
            break
          } else if (workflowStep.onFailure === 'escalate') {
            await this.escalateOrchestrationFailure(orchestrationId, workflowStep, error as Error)
          }
        }
      }

      execution.endTime = new Date()
      if (execution.status === 'running') {
        execution.status = 'completed'
      }

      return executionId

    } catch (error) {
      throw new Error(`Security orchestration execution failed: ${(error as Error).message}`)
    }
  }

  // Private helper methods
  private async calculateUserRiskScore(userId: string, context: any): Promise<number> {
    let riskScore = 0

    // Get user's recent security events
    const recentEvents = await this.db.findMany('security_events',
      { 'source.userId': userId, timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      { limit: 50 }
    )

    const eventCount = recentEvents.data?.length || 0
    riskScore += Math.min(30, eventCount * 2)

    // Check behavioral profile
    const behavioralProfile = await this.threatDetection.getBehavioralProfile(userId)
    if (behavioralProfile) {
      riskScore += behavioralProfile.currentBehavior.anomalyScore * 40
    }

    // Check threat intelligence for user's IP
    const ipThreat = await this.checkThreatIntelligence('ip', context.ipAddress)
    if (ipThreat) {
      riskScore += ipThreat.confidence * 30
    }

    return Math.min(100, riskScore)
  }

  private async calculateResourceRiskScore(resource: string, action: string): Promise<number> {
    let riskScore = 0

    // Base risk by resource type
    if (resource.includes('/admin')) riskScore += 40
    if (resource.includes('/users')) riskScore += 30
    if (resource.includes('/blood')) riskScore += 25
    if (resource.includes('/reports')) riskScore += 20

    // Risk by action
    if (action === 'delete') riskScore += 30
    if (action === 'update') riskScore += 20
    if (action === 'create') riskScore += 15
    if (action === 'read') riskScore += 5

    return Math.min(100, riskScore)
  }

  private async calculateContextualRiskScore(context: any): Promise<number> {
    let riskScore = 0

    // Time-based risk
    const hour = new Date(context.timestamp).getHours()
    if (hour < 6 || hour > 22) riskScore += 15

    // Location-based risk
    if (context.location && await this.isHighRiskLocation(context.location)) {
      riskScore += 25
    }

    // Device-based risk
    if (!context.deviceId || context.deviceId === 'unknown') {
      riskScore += 20
    }

    return Math.min(100, riskScore)
  }

  private async evaluatePolicyScope(policy: ZeroTrustPolicy, request: any): Promise<boolean> {
    // Check if policy applies to this request
    if (policy.scope.users.length > 0 && !policy.scope.users.includes(request.userId)) {
      return false
    }

    if (policy.scope.resources.length > 0) {
      const resourceMatches = policy.scope.resources.some(pattern => 
        request.resource.match(new RegExp(pattern))
      )
      if (!resourceMatches) return false
    }

    return true
  }

  private async evaluatePolicyConditions(policy: ZeroTrustPolicy, request: any): Promise<number> {
    let totalScore = 0
    let totalWeight = 0

    for (const condition of policy.conditions) {
      const conditionMet = await this.evaluateCondition(condition, request)
      if (conditionMet) {
        totalScore += condition.weight
      }
      totalWeight += condition.weight
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0
  }

  private async evaluateCondition(condition: any, request: any): Promise<boolean> {
    switch (condition.type) {
      case 'location':
        return this.evaluateLocationCondition(condition, request.context.location)
      case 'time':
        return this.evaluateTimeCondition(condition, request.context.timestamp)
      case 'device':
        return this.evaluateDeviceCondition(condition, request.context.deviceId)
      case 'risk_score':
        const userRisk = await this.calculateUserRiskScore(request.userId, request.context)
        return this.evaluateNumericCondition(condition, userRisk)
      default:
        return false
    }
  }

  private evaluateLocationCondition(condition: any, location: string): boolean {
    switch (condition.operator) {
      case 'equals':
        return location === condition.value
      case 'not_equals':
        return location !== condition.value
      case 'in':
        return condition.value.includes(location)
      case 'not_in':
        return !condition.value.includes(location)
      default:
        return false
    }
  }

  private evaluateTimeCondition(condition: any, timestamp: Date): boolean {
    const hour = timestamp.getHours()
    switch (condition.operator) {
      case 'greater_than':
        return hour > condition.value
      case 'less_than':
        return hour < condition.value
      case 'in':
        return condition.value.includes(hour)
      default:
        return false
    }
  }

  private evaluateDeviceCondition(condition: any, deviceId: string): boolean {
    return this.evaluateLocationCondition(condition, deviceId)
  }

  private evaluateNumericCondition(condition: any, value: number): boolean {
    switch (condition.operator) {
      case 'greater_than':
        return value > condition.value
      case 'less_than':
        return value < condition.value
      case 'equals':
        return value === condition.value
      default:
        return false
    }
  }

  private shouldExecuteAction(action: any, policyScore: number): boolean {
    if (action.conditions) {
      return action.conditions.some((cond: string) => {
        if (cond === 'high_risk') return policyScore >= 70
        if (cond === 'medium_risk') return policyScore >= 40
        return true
      })
    }
    return policyScore >= 50
  }

  private async executeIncidentWorkflow(incidentId: string): Promise<void> {
    const incident = this.activeIncidents.get(incidentId)
    if (!incident) return

    // Find applicable orchestration
    const orchestration = Array.from(this.securityOrchestrations.values())
      .find(o => o.trigger.eventType === 'security_incident' && 
                 o.trigger.severity.includes(incident.severity))

    if (orchestration) {
      await this.executeSecurityOrchestration(orchestration.id, { incident })
    }
  }

  private async executeOrchestrationStep(step: any, triggerData: any): Promise<any> {
    switch (step.action) {
      case 'isolate_user':
        return await this.isolateUser(step.parameters.userId)
      case 'block_ip':
        return await this.blockIP(step.parameters.ipAddress)
      case 'collect_evidence':
        return await this.collectEvidence(step.parameters)
      case 'notify_team':
        return await this.notifySecurityTeam(step.parameters.message)
      default:
        throw new Error(`Unknown orchestration action: ${step.action}`)
    }
  }

  private async isolateUser(userId: string): Promise<any> {
    await this.db.update('users', { id: userId }, { status: 'isolated' })
    return { action: 'user_isolated', userId, timestamp: new Date() }
  }

  private async blockIP(ipAddress: string): Promise<any> {
    await this.cache.set(`blocked_ip:${ipAddress}`, true, { ttl: 3600 })
    return { action: 'ip_blocked', ipAddress, timestamp: new Date() }
  }

  private async collectEvidence(parameters: any): Promise<any> {
    // Collect forensic evidence
    return { action: 'evidence_collected', items: [], timestamp: new Date() }
  }

  private async notifySecurityTeam(message: string): Promise<any> {
    await this.eventSystem.publishEvent({
      id: `security_notification_${Date.now()}`,
      type: 'emergency_alert',
      priority: 'critical',
      source: 'threat_protection',
      timestamp: new Date(),
      data: { type: 'security_team_notification', message }
    })
    return { action: 'team_notified', message, timestamp: new Date() }
  }

  private async escalateOrchestrationFailure(orchestrationId: string, step: any, error: Error): Promise<void> {
    await this.eventSystem.publishEvent({
      id: `orchestration_failure_${Date.now()}`,
      type: 'emergency_alert',
      priority: 'high',
      source: 'threat_protection',
      timestamp: new Date(),
      data: {
        type: 'orchestration_failure',
        orchestration_id: orchestrationId,
        failed_step: step.step,
        error: error.message
      }
    })
  }

  private async notifyIncidentStakeholders(incident: IncidentResponse): Promise<void> {
    const message = `Security incident ${incident.id} detected with ${incident.severity} severity`
    
    incident.communicationLog.push({
      timestamp: new Date(),
      recipient: 'security_team',
      channel: 'dashboard',
      message,
      acknowledged: false
    })

    await this.eventSystem.publishEvent({
      id: `incident_notification_${incident.id}`,
      type: 'emergency_alert',
      priority: incident.severity === 'critical' ? 'critical' : 'high',
      source: 'threat_protection',
      timestamp: new Date(),
      data: {
        type: 'security_incident',
        incident_id: incident.id,
        severity: incident.severity,
        threat_id: incident.threatId
      }
    })
  }

  private async fetchThreatIntelligence(feed: ThreatIntelligenceFeed): Promise<any[]> {
    // In production, this would fetch from actual threat intelligence feeds
    return []
  }

  private async checkThreatIntelligence(type: string, value: string): Promise<any> {
    for (const feed of this.threatIntelligenceFeeds.values()) {
      const indicator = feed.indicators.find(i => i.type === type && i.value === value)
      if (indicator && indicator.confidence >= this.CONFIG.threatIntelligence.confidenceThreshold) {
        return indicator
      }
    }
    return null
  }

  private async isHighRiskLocation(location: string): Promise<boolean> {
    // Check against threat intelligence for high-risk locations
    return false
  }

  private initializeThreatIntelligence(): void {
    // Initialize threat intelligence feeds
    console.log('Threat intelligence feeds initialized')
  }

  private initializeZeroTrustPolicies(): void {
    // Initialize default zero trust policies
    const defaultPolicy: ZeroTrustPolicy = {
      id: 'default_zero_trust',
      name: 'Default Zero Trust Policy',
      description: 'Default policy for zero trust evaluation',
      scope: {
        users: [],
        resources: ['*'],
        networks: [],
        devices: []
      },
      conditions: [
        {
          type: 'risk_score',
          operator: 'less_than',
          value: 70,
          weight: 1.0
        }
      ],
      actions: [
        {
          type: 'allow',
          parameters: {},
          conditions: ['low_risk']
        }
      ],
      priority: 50,
      isActive: true,
      lastModified: new Date()
    }

    this.zeroTrustPolicies.set(defaultPolicy.id, defaultPolicy)
  }

  private initializeSecurityOrchestrations(): void {
    // Initialize security orchestration workflows
    console.log('Security orchestrations initialized')
  }

  private startThreatProtection(): void {
    // Start threat intelligence updates
    setInterval(async () => {
      try {
        await this.updateThreatIntelligence()
      } catch (error) {
        console.error('Threat intelligence update failed:', error)
      }
    }, this.CONFIG.threatIntelligence.updateInterval)

    console.log('Advanced threat protection system started')
  }

  // Public API methods
  public async getActiveIncidents(): Promise<IncidentResponse[]> {
    return Array.from(this.activeIncidents.values())
      .sort((a, b) => b.timeline[0].timestamp.getTime() - a.timeline[0].timestamp.getTime())
  }

  public async getThreatIntelligenceStats(): Promise<{
    feeds: number
    indicators: number
    lastUpdate: Date
    coverage: Record<string, number>
  }> {
    let totalIndicators = 0
    const coverage: Record<string, number> = {}
    let lastUpdate = new Date(0)

    for (const feed of this.threatIntelligenceFeeds.values()) {
      totalIndicators += feed.indicators.length
      coverage[feed.type] = (coverage[feed.type] || 0) + feed.indicators.length
      if (feed.lastUpdate > lastUpdate) {
        lastUpdate = feed.lastUpdate
      }
    }

    return {
      feeds: this.threatIntelligenceFeeds.size,
      indicators: totalIndicators,
      lastUpdate,
      coverage
    }
  }

  public getSystemStats() {
    return {
      threatIntelligenceFeeds: this.threatIntelligenceFeeds.size,
      zeroTrustPolicies: this.zeroTrustPolicies.size,
      activeIncidents: this.activeIncidents.size,
      securityOrchestrations: this.securityOrchestrations.size
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = this.getSystemStats()
    const criticalIncidents = Array.from(this.activeIncidents.values())
      .filter(i => i.severity === 'critical' && i.status !== 'resolved').length

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (criticalIncidents > 3) {
      status = 'unhealthy'
    } else if (criticalIncidents > 0) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        ...stats,
        criticalIncidents,
        threatIntelligenceHealth: this.threatIntelligenceFeeds.size > 0 ? 'active' : 'inactive'
      }
    }
  }
}

// Singleton instance
let advancedThreatProtectionInstance: AdvancedThreatProtectionSystem | null = null

export function getAdvancedThreatProtectionSystem(): AdvancedThreatProtectionSystem {
  if (!advancedThreatProtectionInstance) {
    advancedThreatProtectionInstance = new AdvancedThreatProtectionSystem()
  }
  return advancedThreatProtectionInstance
}

export default AdvancedThreatProtectionSystem
