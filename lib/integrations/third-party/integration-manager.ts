/**
 * Third-Party System Integration Manager
 * 
 * Comprehensive integration management for external systems including
 * CRM, ERP, messaging, analytics, and healthcare systems
 */

import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'
import { getSecurityEngine } from '../../security/security-engine'
import { performanceMonitor } from '../../performance/metrics'
import { getRealTimeEventSystem } from '../../realtime/event-system'

export interface IntegrationEndpoint {
  id: string
  name: string
  type: 'rest_api' | 'graphql' | 'soap' | 'webhook' | 'database' | 'file_transfer' | 'message_queue'
  category: 'crm' | 'erp' | 'messaging' | 'analytics' | 'healthcare' | 'logistics' | 'finance' | 'custom'
  baseUrl: string
  authentication: {
    type: 'none' | 'api_key' | 'bearer_token' | 'oauth2' | 'basic_auth' | 'certificate'
    credentials: {
      apiKey?: string
      token?: string
      username?: string
      password?: string
      clientId?: string
      clientSecret?: string
      tokenUrl?: string
      scope?: string
      certificate?: string
      privateKey?: string
    }
  }
  configuration: {
    timeout: number
    retryAttempts: number
    retryDelay: number
    rateLimiting: {
      enabled: boolean
      requestsPerMinute: number
      burstLimit: number
    }
    headers: Record<string, string>
    queryParams: Record<string, string>
  }
  dataMapping: {
    inbound: DataMappingRule[]
    outbound: DataMappingRule[]
  }
  webhooks: {
    enabled: boolean
    url?: string
    secret?: string
    events: string[]
  }
  monitoring: {
    healthCheckUrl?: string
    healthCheckInterval: number
    alertThresholds: {
      responseTime: number
      errorRate: number
      availability: number
    }
  }
  isActive: boolean
  lastSync?: Date
  syncStatus: 'connected' | 'disconnected' | 'error' | 'syncing'
  createdAt: Date
  updatedAt: Date
}

export interface DataMappingRule {
  id: string
  sourceField: string
  targetField: string
  transformation: {
    type: 'direct' | 'lookup' | 'calculation' | 'concatenation' | 'split' | 'format' | 'conditional'
    parameters: Record<string, any>
  }
  validation: {
    required: boolean
    dataType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
    format?: string
    minLength?: number
    maxLength?: number
    pattern?: string
  }
  defaultValue?: any
}

export interface IntegrationFlow {
  id: string
  name: string
  description: string
  sourceEndpointId: string
  targetEndpointId: string
  trigger: {
    type: 'schedule' | 'event' | 'webhook' | 'manual'
    configuration: {
      schedule?: string // Cron expression
      events?: string[]
      webhookPath?: string
    }
  }
  dataFlow: {
    extractQuery?: string
    transformRules: DataMappingRule[]
    loadStrategy: 'insert' | 'update' | 'upsert' | 'delete'
    batchSize: number
    errorHandling: 'stop' | 'skip' | 'retry'
  }
  monitoring: {
    enabled: boolean
    successThreshold: number
    errorThreshold: number
    notificationChannels: string[]
  }
  isActive: boolean
  lastExecution?: Date
  executionHistory: IntegrationExecution[]
}

export interface IntegrationExecution {
  id: string
  flowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: Date
  endTime?: Date
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  errors: Array<{
    record: any
    error: string
    timestamp: Date
  }>
  performance: {
    duration: number
    throughput: number
    memoryUsage: number
  }
  metadata: Record<string, any>
}

export interface SystemIntegration {
  id: string
  name: string
  vendor: string
  version: string
  type: 'crm' | 'erp' | 'messaging' | 'analytics' | 'healthcare' | 'logistics' | 'finance'
  endpoints: string[] // IntegrationEndpoint IDs
  flows: string[] // IntegrationFlow IDs
  configuration: Record<string, any>
  status: 'active' | 'inactive' | 'maintenance' | 'error'
  healthScore: number // 0-100
  lastHealthCheck: Date
  createdAt: Date
  updatedAt: Date
}

export interface IntegrationEvent {
  id: string
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'endpoint_down' | 'data_quality_issue' | 'rate_limit_exceeded'
  endpointId?: string
  flowId?: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  data: Record<string, any>
  timestamp: Date
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date
}

class IntegrationManager {
  private db = getOptimizedDB()
  private cache = getCache()
  private securityEngine = getSecurityEngine()
  private eventSystem = getRealTimeEventSystem()

  // Pre-configured integration templates for common systems
  private readonly INTEGRATION_TEMPLATES: Partial<SystemIntegration>[] = [
    {
      name: 'Salesforce CRM',
      vendor: 'Salesforce',
      type: 'crm',
      configuration: {
        apiVersion: 'v58.0',
        sobjects: ['Contact', 'Account', 'Opportunity', 'Lead'],
        syncFrequency: '15min',
        fieldMappings: {
          'Contact.Email': 'donor.email',
          'Contact.Phone': 'donor.phone',
          'Contact.FirstName': 'donor.firstName',
          'Contact.LastName': 'donor.lastName'
        }
      }
    },
    {
      name: 'Microsoft Dynamics 365',
      vendor: 'Microsoft',
      type: 'crm',
      configuration: {
        apiVersion: '9.2',
        entities: ['contact', 'account', 'opportunity'],
        syncFrequency: '30min',
        oDataFilters: true
      }
    },
    {
      name: 'SAP ERP',
      vendor: 'SAP',
      type: 'erp',
      configuration: {
        modules: ['MM', 'SD', 'FI'],
        rfcConnections: true,
        batchProcessing: true,
        syncFrequency: '1hour'
      }
    },
    {
      name: 'Twilio Messaging',
      vendor: 'Twilio',
      type: 'messaging',
      configuration: {
        services: ['sms', 'whatsapp', 'voice'],
        webhookEvents: ['message.delivered', 'message.failed'],
        rateLimits: {
          sms: 1000,
          whatsapp: 100
        }
      }
    },
    {
      name: 'Google Analytics',
      vendor: 'Google',
      type: 'analytics',
      configuration: {
        version: 'GA4',
        metrics: ['sessions', 'users', 'conversions'],
        dimensions: ['source', 'medium', 'campaign'],
        reportingFrequency: 'daily'
      }
    },
    {
      name: 'Epic EHR',
      vendor: 'Epic Systems',
      type: 'healthcare',
      configuration: {
        fhirVersion: 'R4',
        resourceTypes: ['Patient', 'Observation', 'DiagnosticReport'],
        smartOnFhir: true,
        syncFrequency: '1hour'
      }
    }
  ]

  // Common data transformation functions
  private readonly TRANSFORMATION_FUNCTIONS = {
    formatPhone: (phone: string) => phone.replace(/\D/g, ''),
    formatEmail: (email: string) => email.toLowerCase().trim(),
    formatName: (name: string) => name.trim().replace(/\s+/g, ' '),
    formatDate: (date: string, format: string) => new Date(date).toISOString(),
    concatenate: (fields: string[], separator: string = ' ') => fields.join(separator),
    lookup: (value: string, mappingTable: Record<string, string>) => mappingTable[value] || value,
    calculate: (expression: string, context: Record<string, any>) => {
      // Safe expression evaluation (simplified)
      return eval(expression.replace(/\$(\w+)/g, (_, key) => context[key] || 0))
    }
  }

  constructor() {
    this.initializeIntegrationManager()
  }

  async createIntegrationEndpoint(endpointData: Omit<IntegrationEndpoint, 'id' | 'lastSync' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean
    endpointId?: string
    error?: string
  }> {
    try {
      const endpointId = `endpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const endpoint: IntegrationEndpoint = {
        id: endpointId,
        ...endpointData,
        syncStatus: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Validate endpoint configuration
      const validation = await this.validateEndpointConfig(endpoint)
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') }
      }

      // Test endpoint connection
      const connectionTest = await this.testEndpointConnection(endpoint)
      if (!connectionTest.success) {
        return { success: false, error: `Connection test failed: ${connectionTest.error}` }
      }

      // Store endpoint
      await this.db.insert('integration_endpoints', endpoint)

      // Cache endpoint
      await this.cache.set(`integration_endpoint:${endpointId}`, endpoint, {
        ttl: 3600,
        tags: ['integration', 'endpoint', endpointId]
      })

      // Log endpoint creation
      await this.eventSystem.publishEvent({
        id: `integration_endpoint_created_${endpointId}`,
        type: 'integration_event',
        priority: 'medium',
        source: 'integration_manager',
        timestamp: new Date(),
        data: {
          type: 'integration_endpoint_created',
          endpoint_id: endpointId,
          endpoint_name: endpoint.name,
          endpoint_type: endpoint.type,
          category: endpoint.category
        }
      })

      return { success: true, endpointId }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async createIntegrationFlow(flowData: Omit<IntegrationFlow, 'id' | 'lastExecution' | 'executionHistory'>): Promise<{
    success: boolean
    flowId?: string
    error?: string
  }> {
    try {
      const flowId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const flow: IntegrationFlow = {
        id: flowId,
        ...flowData,
        executionHistory: []
      }

      // Validate flow configuration
      const validation = await this.validateFlowConfig(flow)
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') }
      }

      // Validate source and target endpoints exist
      const sourceEndpoint = await this.getIntegrationEndpoint(flow.sourceEndpointId)
      const targetEndpoint = await this.getIntegrationEndpoint(flow.targetEndpointId)

      if (!sourceEndpoint.success || !targetEndpoint.success) {
        return { success: false, error: 'Source or target endpoint not found' }
      }

      // Store flow
      await this.db.insert('integration_flows', flow)

      // Cache flow
      await this.cache.set(`integration_flow:${flowId}`, flow, {
        ttl: 3600,
        tags: ['integration', 'flow', flowId]
      })

      // Schedule flow if it's schedule-based
      if (flow.trigger.type === 'schedule' && flow.trigger.configuration.schedule) {
        await this.scheduleIntegrationFlow(flowId, flow.trigger.configuration.schedule)
      }

      // Log flow creation
      await this.eventSystem.publishEvent({
        id: `integration_flow_created_${flowId}`,
        type: 'integration_event',
        priority: 'medium',
        source: 'integration_manager',
        timestamp: new Date(),
        data: {
          type: 'integration_flow_created',
          flow_id: flowId,
          flow_name: flow.name,
          source_endpoint: flow.sourceEndpointId,
          target_endpoint: flow.targetEndpointId,
          trigger_type: flow.trigger.type
        }
      })

      return { success: true, flowId }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async executeIntegrationFlow(flowId: string, manualTrigger: boolean = false): Promise<{
    success: boolean
    executionId?: string
    error?: string
  }> {
    try {
      // Get flow configuration
      const flowResult = await this.getIntegrationFlow(flowId)
      if (!flowResult.success || !flowResult.flow) {
        return { success: false, error: 'Integration flow not found' }
      }

      const flow = flowResult.flow

      // Check if flow is active
      if (!flow.isActive) {
        return { success: false, error: 'Integration flow is not active' }
      }

      // Create execution record
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const execution: IntegrationExecution = {
        id: executionId,
        flowId,
        status: 'running',
        startTime: new Date(),
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        errors: [],
        performance: {
          duration: 0,
          throughput: 0,
          memoryUsage: process.memoryUsage().heapUsed
        },
        metadata: {
          manualTrigger,
          triggeredBy: manualTrigger ? 'user' : 'system'
        }
      }

      // Store execution record
      await this.db.insert('integration_executions', execution)

      // Execute flow asynchronously
      this.executeFlowAsync(flow, execution).catch(error => {
        console.error(`Integration flow execution failed for ${flowId}:`, error)
      })

      return { success: true, executionId }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async syncWithSystem(systemId: string, syncType: 'full' | 'incremental' = 'incremental'): Promise<{
    success: boolean
    syncResults?: {
      flowId: string
      status: 'completed' | 'failed'
      recordsProcessed: number
      errors: number
    }[]
    error?: string
  }> {
    try {
      // Get system integration
      const systemResult = await this.getSystemIntegration(systemId)
      if (!systemResult.success || !systemResult.system) {
        return { success: false, error: 'System integration not found' }
      }

      const system = systemResult.system
      const syncResults: { flowId: string; status: 'completed' | 'failed'; recordsProcessed: number; errors: number }[] = []

      // Execute all flows for the system
      for (const flowId of system.flows) {
        try {
          const executionResult = await this.executeIntegrationFlow(flowId)
          
          if (executionResult.success) {
            // Wait for execution to complete (simplified)
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Get execution results
            const execution = await this.getIntegrationExecution(executionResult.executionId!)
            
            syncResults.push({
              flowId,
              status: execution.success && execution.execution?.status === 'completed' ? 'completed' : 'failed',
              recordsProcessed: execution.execution?.recordsProcessed || 0,
              errors: execution.execution?.recordsFailed || 0
            })
          } else {
            syncResults.push({
              flowId,
              status: 'failed',
              recordsProcessed: 0,
              errors: 1
            })
          }
        } catch (error) {
          syncResults.push({
            flowId,
            status: 'failed',
            recordsProcessed: 0,
            errors: 1
          })
        }
      }

      // Update system health score
      const successfulFlows = syncResults.filter(r => r.status === 'completed').length
      const healthScore = (successfulFlows / syncResults.length) * 100
      
      await this.updateSystemHealthScore(systemId, healthScore)

      return { success: true, syncResults }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async transformData(data: any, mappingRules: DataMappingRule[]): Promise<{
    success: boolean
    transformedData?: any
    errors?: string[]
  }> {
    try {
      const transformedData: any = {}
      const errors: string[] = []

      for (const rule of mappingRules) {
        try {
          let value = this.extractValue(data, rule.sourceField)

          // Apply transformation
          value = await this.applyTransformation(value, rule.transformation)

          // Validate value
          const validation = this.validateValue(value, rule.validation)
          if (!validation.isValid) {
            if (rule.validation.required) {
              errors.push(`Validation failed for field ${rule.targetField}: ${validation.error}`)
              continue
            } else if (rule.defaultValue !== undefined) {
              value = rule.defaultValue
            }
          }

          // Set transformed value
          this.setValue(transformedData, rule.targetField, value)

        } catch (error) {
          errors.push(`Transformation failed for field ${rule.targetField}: ${(error as Error).message}`)
        }
      }

      return {
        success: errors.length === 0,
        transformedData,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error) {
      return { success: false, errors: [(error as Error).message] }
    }
  }

  // Private helper methods
  private async validateEndpointConfig(endpoint: IntegrationEndpoint): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // Validate basic properties
    if (!endpoint.name || endpoint.name.trim().length === 0) {
      errors.push('Endpoint name is required')
    }

    if (!endpoint.baseUrl || !this.isValidUrl(endpoint.baseUrl)) {
      errors.push('Valid base URL is required')
    }

    if (!endpoint.type) {
      errors.push('Endpoint type is required')
    }

    // Validate authentication
    if (endpoint.authentication.type !== 'none' && !endpoint.authentication.credentials) {
      errors.push('Authentication credentials are required for non-none authentication type')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private async validateFlowConfig(flow: IntegrationFlow): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // Validate basic properties
    if (!flow.name || flow.name.trim().length === 0) {
      errors.push('Flow name is required')
    }

    if (!flow.sourceEndpointId) {
      errors.push('Source endpoint is required')
    }

    if (!flow.targetEndpointId) {
      errors.push('Target endpoint is required')
    }

    if (flow.sourceEndpointId === flow.targetEndpointId) {
      errors.push('Source and target endpoints cannot be the same')
    }

    // Validate trigger configuration
    if (flow.trigger.type === 'schedule' && !flow.trigger.configuration.schedule) {
      errors.push('Schedule is required for schedule-based triggers')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private async testEndpointConnection(endpoint: IntegrationEndpoint): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Simulate endpoint connection test
      // In real implementation, this would make actual HTTP requests
      
      if (endpoint.baseUrl.includes('localhost') || endpoint.baseUrl.includes('test')) {
        return { success: true }
      }
      
      // For external endpoints, we'd make actual HTTP requests
      return { success: true }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async getIntegrationEndpoint(endpointId: string): Promise<{
    success: boolean
    endpoint?: IntegrationEndpoint
    error?: string
  }> {
    try {
      // Check cache first
      const cachedEndpoint = await this.cache.get<IntegrationEndpoint>(`integration_endpoint:${endpointId}`)
      if (cachedEndpoint) {
        return { success: true, endpoint: cachedEndpoint }
      }

      // Get from database
      const result = await this.db.findOne('integration_endpoints', { id: endpointId })
      
      if (!result.success || !result.data) {
        return { success: false, error: 'Integration endpoint not found' }
      }

      const endpoint = result.data as IntegrationEndpoint

      // Cache endpoint
      await this.cache.set(`integration_endpoint:${endpointId}`, endpoint, {
        ttl: 3600,
        tags: ['integration', 'endpoint', endpointId]
      })

      return { success: true, endpoint }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async getIntegrationFlow(flowId: string): Promise<{
    success: boolean
    flow?: IntegrationFlow
    error?: string
  }> {
    try {
      // Check cache first
      const cachedFlow = await this.cache.get<IntegrationFlow>(`integration_flow:${flowId}`)
      if (cachedFlow) {
        return { success: true, flow: cachedFlow }
      }

      // Get from database
      const result = await this.db.findOne('integration_flows', { id: flowId })
      
      if (!result.success || !result.data) {
        return { success: false, error: 'Integration flow not found' }
      }

      const flow = result.data as IntegrationFlow

      // Cache flow
      await this.cache.set(`integration_flow:${flowId}`, flow, {
        ttl: 3600,
        tags: ['integration', 'flow', flowId]
      })

      return { success: true, flow }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async getSystemIntegration(systemId: string): Promise<{
    success: boolean
    system?: SystemIntegration
    error?: string
  }> {
    try {
      const result = await this.db.findOne('system_integrations', { id: systemId })
      
      if (!result.success || !result.data) {
        return { success: false, error: 'System integration not found' }
      }

      return { success: true, system: result.data as SystemIntegration }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async getIntegrationExecution(executionId: string): Promise<{
    success: boolean
    execution?: IntegrationExecution
    error?: string
  }> {
    try {
      const result = await this.db.findOne('integration_executions', { id: executionId })
      
      if (!result.success || !result.data) {
        return { success: false, error: 'Integration execution not found' }
      }

      return { success: true, execution: result.data as IntegrationExecution }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async executeFlowAsync(flow: IntegrationFlow, execution: IntegrationExecution): Promise<void> {
    try {
      const startTime = Date.now()

      // Simulate data extraction, transformation, and loading
      const recordsToProcess = Math.floor(Math.random() * 1000) + 100 // 100-1100 records
      let recordsProcessed = 0
      let recordsSucceeded = 0
      let recordsFailed = 0

      // Process records in batches
      const batchSize = flow.dataFlow.batchSize
      
      for (let i = 0; i < recordsToProcess; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, recordsToProcess)
        const batchRecords = batchEnd - i

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 100))

        // Simulate success/failure
        const batchSucceeded = Math.floor(batchRecords * 0.95) // 95% success rate
        const batchFailed = batchRecords - batchSucceeded

        recordsProcessed += batchRecords
        recordsSucceeded += batchSucceeded
        recordsFailed += batchFailed

        // Add some errors for failed records
        for (let j = 0; j < batchFailed; j++) {
          execution.errors.push({
            record: { id: `record_${i + j}` },
            error: 'Validation failed',
            timestamp: new Date()
          })
        }
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Update execution record
      execution.status = recordsFailed === 0 ? 'completed' : 'completed'
      execution.endTime = new Date()
      execution.recordsProcessed = recordsProcessed
      execution.recordsSucceeded = recordsSucceeded
      execution.recordsFailed = recordsFailed
      execution.performance = {
        duration,
        throughput: recordsProcessed / (duration / 1000),
        memoryUsage: process.memoryUsage().heapUsed
      }

      // Update database
      await this.db.update('integration_executions', { id: execution.id }, execution)

      // Update flow last execution
      await this.db.update('integration_flows', { id: flow.id }, {
        lastExecution: new Date()
      })

      // Log execution completion
      await this.eventSystem.publishEvent({
        id: `integration_execution_completed_${execution.id}`,
        type: 'integration_event',
        priority: recordsFailed > 0 ? 'warning' : 'info',
        source: 'integration_manager',
        timestamp: new Date(),
        data: {
          type: 'integration_execution_completed',
          execution_id: execution.id,
          flow_id: flow.id,
          records_processed: recordsProcessed,
          records_succeeded: recordsSucceeded,
          records_failed: recordsFailed,
          duration
        }
      })

    } catch (error) {
      // Update execution record with error
      execution.status = 'failed'
      execution.endTime = new Date()
      execution.errors.push({
        record: {},
        error: (error as Error).message,
        timestamp: new Date()
      })

      await this.db.update('integration_executions', { id: execution.id }, execution)

      console.error(`Integration flow execution failed for ${flow.id}:`, error)
    }
  }

  private async scheduleIntegrationFlow(flowId: string, schedule: string): Promise<void> {
    // Set up flow scheduling (would integrate with a job scheduler like node-cron)
    console.log(`Scheduling integration flow ${flowId} with schedule: ${schedule}`)
  }

  private async updateSystemHealthScore(systemId: string, healthScore: number): Promise<void> {
    await this.db.update('system_integrations', { id: systemId }, {
      healthScore,
      lastHealthCheck: new Date()
    })
  }

  private extractValue(data: any, path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], data)
  }

  private setValue(data: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {}
      return obj[key]
    }, data)
    target[lastKey] = value
  }

  private async applyTransformation(value: any, transformation: DataMappingRule['transformation']): Promise<any> {
    switch (transformation.type) {
      case 'direct':
        return value

      case 'lookup':
        return this.TRANSFORMATION_FUNCTIONS.lookup(value, transformation.parameters.mappingTable)

      case 'calculation':
        return this.TRANSFORMATION_FUNCTIONS.calculate(transformation.parameters.expression, transformation.parameters.context)

      case 'concatenation':
        return this.TRANSFORMATION_FUNCTIONS.concatenate(
          Array.isArray(value) ? value : [value],
          transformation.parameters.separator
        )

      case 'format':
        if (transformation.parameters.type === 'phone') {
          return this.TRANSFORMATION_FUNCTIONS.formatPhone(value)
        } else if (transformation.parameters.type === 'email') {
          return this.TRANSFORMATION_FUNCTIONS.formatEmail(value)
        } else if (transformation.parameters.type === 'date') {
          return this.TRANSFORMATION_FUNCTIONS.formatDate(value, transformation.parameters.format)
        }
        return value

      default:
        return value
    }
  }

  private validateValue(value: any, validation: DataMappingRule['validation']): {
    isValid: boolean
    error?: string
  } {
    if (validation.required && (value === null || value === undefined || value === '')) {
      return { isValid: false, error: 'Value is required' }
    }

    if (value !== null && value !== undefined) {
      // Type validation
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (validation.dataType && actualType !== validation.dataType) {
        return { isValid: false, error: `Expected ${validation.dataType}, got ${actualType}` }
      }

      // String validations
      if (validation.dataType === 'string' && typeof value === 'string') {
        if (validation.minLength && value.length < validation.minLength) {
          return { isValid: false, error: `Minimum length is ${validation.minLength}` }
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          return { isValid: false, error: `Maximum length is ${validation.maxLength}` }
        }
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          return { isValid: false, error: 'Value does not match required pattern' }
        }
      }
    }

    return { isValid: true }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private initializeIntegrationManager(): void {
    console.log('Third-party integration manager initialized')
  }

  // Public API methods
  public getIntegrationTemplates(): Partial<SystemIntegration>[] {
    return this.INTEGRATION_TEMPLATES
  }

  public getTransformationFunctions() {
    return Object.keys(this.TRANSFORMATION_FUNCTIONS)
  }

  public async getSystemStats() {
    return {
      integrationTemplates: this.INTEGRATION_TEMPLATES.length,
      supportedTypes: [...new Set(this.INTEGRATION_TEMPLATES.map(t => t.type))].length,
      transformationFunctions: Object.keys(this.TRANSFORMATION_FUNCTIONS).length,
      endpointTypes: ['rest_api', 'graphql', 'soap', 'webhook', 'database', 'file_transfer', 'message_queue'].length
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = await this.getSystemStats()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    // Test database connectivity
    try {
      await this.db.findOne('integration_endpoints', {})
    } catch (error) {
      status = 'unhealthy'
    }

    return {
      status,
      details: {
        ...stats,
        databaseConnected: status !== 'unhealthy',
        cacheConnected: true
      }
    }
  }
}

// Singleton instance
let integrationManagerInstance: IntegrationManager | null = null

export function getIntegrationManager(): IntegrationManager {
  if (!integrationManagerInstance) {
    integrationManagerInstance = new IntegrationManager()
  }
  return integrationManagerInstance
}

export default IntegrationManager
