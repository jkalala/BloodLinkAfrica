/**
 * Integration & Ecosystem API Endpoint
 * 
 * Provides REST API for FHIR healthcare integration, payment gateways,
 * and third-party system integrations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFHIRIntegration } from '@/lib/integrations/fhir/fhir-integration'
import { getPaymentGateway } from '@/lib/integrations/payments/payment-gateway'
import { getIntegrationManager } from '@/lib/integrations/third-party/integration-manager'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const FHIREndpointSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url(),
  version: z.enum(['R4', 'R5', 'STU3']),
  authentication: z.object({
    type: z.enum(['none', 'basic', 'bearer', 'oauth2', 'client_credentials']),
    credentials: z.object({
      username: z.string().optional(),
      password: z.string().optional(),
      token: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      tokenUrl: z.string().optional(),
      scope: z.string().optional()
    }).optional()
  }),
  capabilities: z.object({
    resourceTypes: z.array(z.string()),
    interactions: z.array(z.string()),
    searchParams: z.record(z.array(z.string()))
  }).optional(),
  isActive: z.boolean().default(true)
})

const FHIRPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  birthDate: z.string().datetime(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  medicalRecordNumber: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string()
  }).optional()
})

const BloodDonationObservationSchema = z.object({
  patientId: z.string().min(1),
  donationDate: z.string().datetime(),
  bloodType: z.string().min(1),
  hemoglobin: z.number().min(0),
  bloodPressure: z.object({
    systolic: z.number().min(0),
    diastolic: z.number().min(0)
  }),
  heartRate: z.number().min(0),
  temperature: z.number().min(0),
  weight: z.number().min(0),
  performerId: z.string().optional()
})

const PaymentProviderSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['card', 'mobile_money', 'bank_transfer', 'digital_wallet', 'crypto']),
  region: z.array(z.string()),
  currencies: z.array(z.string()),
  configuration: z.object({
    apiKey: z.string().optional(),
    secretKey: z.string().optional(),
    publicKey: z.string().optional(),
    merchantId: z.string().optional(),
    webhookSecret: z.string().optional(),
    sandboxMode: z.boolean(),
    apiVersion: z.string().optional(),
    baseUrl: z.string().optional()
  }),
  features: z.object({
    recurring: z.boolean(),
    refunds: z.boolean(),
    disputes: z.boolean(),
    webhooks: z.boolean(),
    multiCurrency: z.boolean(),
    tokenization: z.boolean()
  }),
  fees: z.object({
    percentage: z.number().min(0),
    fixed: z.number().min(0),
    currency: z.string(),
    minimumFee: z.number().optional(),
    maximumFee: z.number().optional()
  }),
  isActive: z.boolean().default(true),
  priority: z.number().min(1).max(10).default(5)
})

const PaymentIntentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().min(0.01),
  currency: z.string().length(3),
  description: z.string().min(1).max(500),
  paymentMethodId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  providerId: z.string().optional()
})

const IntegrationEndpointSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['rest_api', 'graphql', 'soap', 'webhook', 'database', 'file_transfer', 'message_queue']),
  category: z.enum(['crm', 'erp', 'messaging', 'analytics', 'healthcare', 'logistics', 'finance', 'custom']),
  baseUrl: z.string().url(),
  authentication: z.object({
    type: z.enum(['none', 'api_key', 'bearer_token', 'oauth2', 'basic_auth', 'certificate']),
    credentials: z.record(z.string())
  }),
  configuration: z.object({
    timeout: z.number().min(1000).max(300000).default(30000),
    retryAttempts: z.number().min(0).max(10).default(3),
    retryDelay: z.number().min(100).max(60000).default(1000),
    rateLimiting: z.object({
      enabled: z.boolean(),
      requestsPerMinute: z.number().min(1),
      burstLimit: z.number().min(1)
    }),
    headers: z.record(z.string()),
    queryParams: z.record(z.string())
  }),
  dataMapping: z.object({
    inbound: z.array(z.any()),
    outbound: z.array(z.any())
  }),
  webhooks: z.object({
    enabled: z.boolean(),
    url: z.string().optional(),
    secret: z.string().optional(),
    events: z.array(z.string())
  }),
  monitoring: z.object({
    healthCheckUrl: z.string().optional(),
    healthCheckInterval: z.number().min(60).default(300),
    alertThresholds: z.object({
      responseTime: z.number().min(100),
      errorRate: z.number().min(0).max(100),
      availability: z.number().min(0).max(100)
    })
  }),
  isActive: z.boolean().default(true)
})

export async function POST(request: NextRequest) {
  try {
    // Authentication required for most operations
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user) {
      return createApiResponse(null, 'Invalid token', 401)
    }

    // Parse request body
    const body = await request.json()
    const action = body.action

    switch (action) {
      // FHIR Integration Actions
      case 'create_fhir_endpoint':
        return await handleCreateFHIREndpoint(body, user)
      
      case 'create_fhir_patient':
        return await handleCreateFHIRPatient(body, user)
      
      case 'create_blood_donation_observation':
        return await handleCreateBloodDonationObservation(body, user)
      
      case 'sync_fhir_endpoint':
        return await handleSyncFHIREndpoint(body, user)
      
      // Payment Gateway Actions
      case 'create_payment_provider':
        return await handleCreatePaymentProvider(body, user)
      
      case 'create_payment_intent':
        return await handleCreatePaymentIntent(body, user)
      
      case 'confirm_payment':
        return await handleConfirmPayment(body, user)
      
      case 'process_webhook':
        return await handleProcessWebhook(body, user)
      
      // Third-Party Integration Actions
      case 'create_integration_endpoint':
        return await handleCreateIntegrationEndpoint(body, user)
      
      case 'create_integration_flow':
        return await handleCreateIntegrationFlow(body, user)
      
      case 'execute_integration_flow':
        return await handleExecuteIntegrationFlow(body, user)
      
      case 'sync_with_system':
        return await handleSyncWithSystem(body, user)
      
      case 'transform_data':
        return await handleTransformData(body, user)
      
      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Integration API error:', error)
    
    return createApiResponse(null, 'Integration operation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

// FHIR Integration Handlers
async function handleCreateFHIREndpoint(body: any, user: any) {
  const validationResult = FHIREndpointSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid FHIR endpoint data', 400, {
      errors: validationResult.error.errors
    })
  }

  const endpointData = validationResult.data

  const fhirIntegration = getFHIRIntegration()
  const result = await fhirIntegration.createFHIREndpoint(endpointData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      endpointId: result.endpointId,
      created: true,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      endpointName: endpointData.name,
      fhirVersion: endpointData.version
    }
  })
}

async function handleCreateFHIRPatient(body: any, user: any) {
  const validationResult = FHIRPatientSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid FHIR patient data', 400, {
      errors: validationResult.error.errors
    })
  }

  const patientData = validationResult.data

  const fhirIntegration = getFHIRIntegration()
  const result = await fhirIntegration.createFHIRPatient(patientData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      patient: result.patient,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      patientName: `${patientData.firstName} ${patientData.lastName}`
    }
  })
}

async function handleCreateBloodDonationObservation(body: any, user: any) {
  const validationResult = BloodDonationObservationSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid blood donation observation data', 400, {
      errors: validationResult.error.errors
    })
  }

  const observationData = {
    ...validationResult.data,
    donationDate: new Date(validationResult.data.donationDate)
  }

  const fhirIntegration = getFHIRIntegration()
  const result = await fhirIntegration.createBloodDonationObservation(observationData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      observations: result.observations,
      count: result.observations?.length || 0,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      patientId: observationData.patientId,
      bloodType: observationData.bloodType
    }
  })
}

async function handleSyncFHIREndpoint(body: any, user: any) {
  const { endpointId, resourceTypes } = body

  if (!endpointId) {
    return createApiResponse(null, 'Endpoint ID is required', 400)
  }

  const fhirIntegration = getFHIRIntegration()
  const result = await fhirIntegration.syncWithFHIREndpoint(endpointId, resourceTypes)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      syncResults: result.syncResults,
      syncedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      endpointId,
      resourceTypes: resourceTypes?.length || 0
    }
  })
}

// Payment Gateway Handlers
async function handleCreatePaymentProvider(body: any, user: any) {
  const validationResult = PaymentProviderSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid payment provider data', 400, {
      errors: validationResult.error.errors
    })
  }

  const providerData = validationResult.data

  const paymentGateway = getPaymentGateway()
  const result = await paymentGateway.createPaymentProvider(providerData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      providerId: result.providerId,
      created: true,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      providerName: providerData.name,
      providerType: providerData.type
    }
  })
}

async function handleCreatePaymentIntent(body: any, user: any) {
  const validationResult = PaymentIntentSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid payment intent data', 400, {
      errors: validationResult.error.errors
    })
  }

  const intentData = validationResult.data

  const paymentGateway = getPaymentGateway()
  const result = await paymentGateway.createPaymentIntent(intentData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      paymentIntent: {
        id: result.paymentIntent?.id,
        clientSecret: result.paymentIntent?.clientSecret,
        confirmationUrl: result.paymentIntent?.confirmationUrl,
        status: result.paymentIntent?.status,
        amount: result.paymentIntent?.amount,
        currency: result.paymentIntent?.currency
      },
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      amount: intentData.amount,
      currency: intentData.currency
    }
  })
}

async function handleConfirmPayment(body: any, user: any) {
  const { paymentIntentId, paymentMethodData } = body

  if (!paymentIntentId) {
    return createApiResponse(null, 'Payment intent ID is required', 400)
  }

  const paymentGateway = getPaymentGateway()
  const result = await paymentGateway.confirmPayment(paymentIntentId, paymentMethodData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      transaction: {
        id: result.transaction?.id,
        status: result.transaction?.status,
        amount: result.transaction?.amount,
        currency: result.transaction?.currency,
        fees: result.transaction?.fees
      },
      processedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      paymentIntentId
    }
  })
}

async function handleProcessWebhook(body: any, user: any) {
  const { providerId, eventData, signature } = body

  if (!providerId || !eventData || !signature) {
    return createApiResponse(null, 'Provider ID, event data, and signature are required', 400)
  }

  const paymentGateway = getPaymentGateway()
  const result = await paymentGateway.processWebhook(providerId, eventData, signature)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      processed: result.processed,
      processedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      providerId,
      eventType: eventData.type || eventData.event_type || 'unknown'
    }
  })
}

// Third-Party Integration Handlers
async function handleCreateIntegrationEndpoint(body: any, user: any) {
  const validationResult = IntegrationEndpointSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid integration endpoint data', 400, {
      errors: validationResult.error.errors
    })
  }

  const endpointData = validationResult.data

  const integrationManager = getIntegrationManager()
  const result = await integrationManager.createIntegrationEndpoint(endpointData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      endpointId: result.endpointId,
      created: true,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      endpointName: endpointData.name,
      endpointType: endpointData.type,
      category: endpointData.category
    }
  })
}

async function handleCreateIntegrationFlow(body: any, user: any) {
  const { name, description, sourceEndpointId, targetEndpointId, trigger, dataFlow, monitoring, isActive } = body

  if (!name || !sourceEndpointId || !targetEndpointId || !trigger || !dataFlow) {
    return createApiResponse(null, 'Name, source endpoint, target endpoint, trigger, and data flow are required', 400)
  }

  const flowData = {
    name,
    description,
    sourceEndpointId,
    targetEndpointId,
    trigger,
    dataFlow,
    monitoring: monitoring || { enabled: false, successThreshold: 95, errorThreshold: 5, notificationChannels: [] },
    isActive: isActive !== undefined ? isActive : true
  }

  const integrationManager = getIntegrationManager()
  const result = await integrationManager.createIntegrationFlow(flowData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      flowId: result.flowId,
      created: true,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      flowName: name,
      sourceEndpoint: sourceEndpointId,
      targetEndpoint: targetEndpointId
    }
  })
}

async function handleExecuteIntegrationFlow(body: any, user: any) {
  const { flowId, manualTrigger } = body

  if (!flowId) {
    return createApiResponse(null, 'Flow ID is required', 400)
  }

  const integrationManager = getIntegrationManager()
  const result = await integrationManager.executeIntegrationFlow(flowId, manualTrigger)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      executionId: result.executionId,
      status: 'running',
      startedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      flowId,
      manualTrigger: manualTrigger || false
    }
  })
}

async function handleSyncWithSystem(body: any, user: any) {
  const { systemId, syncType } = body

  if (!systemId) {
    return createApiResponse(null, 'System ID is required', 400)
  }

  const integrationManager = getIntegrationManager()
  const result = await integrationManager.syncWithSystem(systemId, syncType)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      syncResults: result.syncResults,
      syncedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      systemId,
      syncType: syncType || 'incremental'
    }
  })
}

async function handleTransformData(body: any, user: any) {
  const { data, mappingRules } = body

  if (!data || !mappingRules) {
    return createApiResponse(null, 'Data and mapping rules are required', 400)
  }

  const integrationManager = getIntegrationManager()
  const result = await integrationManager.transformData(data, mappingRules)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      transformedData: result.transformedData,
      transformedAt: new Date().toISOString()
    } : null,
    error: result.errors?.join(', '),
    metadata: {
      userId: user.id,
      mappingRulesCount: mappingRules.length,
      hasErrors: (result.errors?.length || 0) > 0
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    // Some actions may not require authentication
    let user = null
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const authManager = getAuthManager()
      user = await authManager.verifyToken(token)
    }

    switch (action) {
      case 'get_fhir_resources':
        return await handleGetFHIRResources()
      
      case 'get_fhir_code_systems':
        return await handleGetFHIRCodeSystems()
      
      case 'get_payment_providers':
        return await handleGetPaymentProviders()
      
      case 'get_donation_presets':
        return await handleGetDonationPresets(url.searchParams)
      
      case 'get_payment_analytics':
        return await handleGetPaymentAnalytics(url.searchParams, user)
      
      case 'get_integration_templates':
        return await handleGetIntegrationTemplates()
      
      case 'get_transformation_functions':
        return await handleGetTransformationFunctions()
      
      case 'system_stats':
        return await handleGetSystemStats()
      
      default:
        return await handleGetSystemStats()
    }

  } catch (error) {
    console.error('Integration query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve integration data', 500)
  }
}

async function handleGetFHIRResources() {
  const fhirIntegration = getFHIRIntegration()
  const resources = fhirIntegration.getBloodDonationResources()

  return createApiResponse({
    success: true,
    data: {
      resources: Object.entries(resources).map(([type, description]) => ({
        type,
        description
      })),
      count: Object.keys(resources).length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetFHIRCodeSystems() {
  const fhirIntegration = getFHIRIntegration()
  const codeSystems = fhirIntegration.getCodeSystems()
  const bloodDonationCodes = fhirIntegration.getBloodDonationCodes()

  return createApiResponse({
    success: true,
    data: {
      codeSystems,
      bloodDonationCodes,
      codeSystemCount: Object.keys(codeSystems).length,
      bloodDonationCodeCount: Object.keys(bloodDonationCodes).length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetPaymentProviders() {
  const paymentGateway = getPaymentGateway()
  const providers = paymentGateway.getPaymentProviders()

  return createApiResponse({
    success: true,
    data: {
      providers,
      count: providers.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetDonationPresets(searchParams: URLSearchParams) {
  const currency = searchParams.get('currency') || 'USD'
  
  const paymentGateway = getPaymentGateway()
  const presets = paymentGateway.getDonationPresets(currency)

  return createApiResponse({
    success: true,
    data: {
      currency,
      presets,
      count: presets.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetPaymentAnalytics(searchParams: URLSearchParams, user: any) {
  if (!user) {
    return createApiResponse(null, 'Authentication required for payment analytics', 401)
  }

  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const timeRange = {
    start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: endDate ? new Date(endDate) : new Date()
  }

  const paymentGateway = getPaymentGateway()
  const result = await paymentGateway.getPaymentAnalytics(timeRange)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      analytics: result.analytics,
      timeRange,
      retrievedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id
    }
  })
}

async function handleGetIntegrationTemplates() {
  const integrationManager = getIntegrationManager()
  const templates = integrationManager.getIntegrationTemplates()

  return createApiResponse({
    success: true,
    data: {
      templates,
      count: templates.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetTransformationFunctions() {
  const integrationManager = getIntegrationManager()
  const functions = integrationManager.getTransformationFunctions()

  return createApiResponse({
    success: true,
    data: {
      functions,
      count: functions.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetSystemStats() {
  const fhirIntegration = getFHIRIntegration()
  const paymentGateway = getPaymentGateway()
  const integrationManager = getIntegrationManager()

  const [fhirStats, paymentStats, integrationStats] = await Promise.all([
    fhirIntegration.getSystemStats(),
    paymentGateway.getSystemStats(),
    integrationManager.getSystemStats()
  ])

  return createApiResponse({
    success: true,
    data: {
      fhir: fhirStats,
      payments: paymentStats,
      integrations: integrationStats,
      overall: {
        totalIntegrationTypes: 3,
        fhirResourceTypes: fhirStats.supportedResources,
        paymentProviders: paymentStats.supportedProviders,
        integrationTemplates: integrationStats.integrationTemplates
      }
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    const fhirIntegration = getFHIRIntegration()
    const paymentGateway = getPaymentGateway()
    const integrationManager = getIntegrationManager()

    const [fhirHealth, paymentHealth, integrationHealth] = await Promise.all([
      fhirIntegration.healthCheck(),
      paymentGateway.healthCheck(),
      integrationManager.healthCheck()
    ])

    const overallStatus = [fhirHealth, paymentHealth, integrationHealth]
      .every(h => h.status === 'healthy') ? 'healthy' :
      [fhirHealth, paymentHealth, integrationHealth]
        .some(h => h.status === 'unhealthy') ? 'unhealthy' : 'degraded'

    return new NextResponse(null, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 206 : 503,
      headers: {
        'X-FHIR-Status': fhirHealth.status,
        'X-Payment-Status': paymentHealth.status,
        'X-Integration-Status': integrationHealth.status,
        'X-System-Health': overallStatus
      }
    })

  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-System-Health': 'unhealthy',
        'X-Error': 'Health check failed'
      }
    })
  }
}
