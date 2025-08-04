/**
 * Native Platform Integration API Endpoint
 * 
 * Provides REST API for HealthKit, Health Connect, biometric authentication,
 * and platform-specific features
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHealthKitIntegration } from '@/lib/native/health/healthkit-integration'
import { getHealthConnectIntegration } from '@/lib/native/health/health-connect-integration'
import { getBiometricAuthentication } from '@/lib/native/auth/biometric-authentication'
import { getPlatformFeatures } from '@/lib/native/platform/platform-features'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const BiometricAuthSchema = z.object({
  method: z.enum(['face_id', 'touch_id', 'fingerprint', 'voice', 'iris', 'any']),
  reason: z.string().min(10).max(200),
  fallbackTitle: z.string().optional(),
  cancelTitle: z.string().optional(),
  timeout: z.number().min(5).max(300).optional(),
  allowDeviceCredentials: z.boolean().optional()
})

const BiometricEnrollmentSchema = z.object({
  type: z.enum(['face', 'fingerprint', 'voice', 'iris']),
  language: z.string().optional(),
  phrases: z.array(z.string()).optional()
})

const VitalSignsQuerySchema = z.object({
  timeRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional()
  }).optional()
})

const WidgetUpdateSchema = z.object({
  widgetId: z.string().min(1),
  content: z.record(z.any()).optional()
})

const NotificationScheduleSchema = z.object({
  templateId: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
  customData: z.record(z.any()).optional()
})

const HealthDataSyncSchema = z.object({
  platform: z.enum(['ios', 'android']),
  dataTypes: z.array(z.string()).optional()
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
      case 'biometric_authenticate':
        return await handleBiometricAuthentication(body, user)
      
      case 'biometric_enroll':
        return await handleBiometricEnrollment(body, user)
      
      case 'health_permissions':
        return await handleHealthPermissions(body, user)
      
      case 'read_vital_signs':
        return await handleReadVitalSigns(body, user)
      
      case 'check_donation_eligibility':
        return await handleCheckDonationEligibility(body, user)
      
      case 'record_donation':
        return await handleRecordDonation(body, user)
      
      case 'sync_health_data':
        return await handleSyncHealthData(body, user)
      
      case 'setup_widgets':
        return await handleSetupWidgets(body, user)
      
      case 'update_widget':
        return await handleUpdateWidget(body, user)
      
      case 'schedule_notification':
        return await handleScheduleNotification(body, user)
      
      case 'setup_shortcuts':
        return await handleSetupShortcuts(body, user)
      
      case 'setup_voice_assistant':
        return await handleSetupVoiceAssistant(body, user)
      
      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Native platform API error:', error)
    
    return createApiResponse(null, 'Platform operation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

async function handleBiometricAuthentication(body: any, user: any) {
  // Validate biometric authentication request
  const validationResult = BiometricAuthSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid biometric authentication data', 400, {
      errors: validationResult.error.errors
    })
  }

  const authData = validationResult.data

  // Perform biometric authentication
  const biometricAuth = getBiometricAuthentication()
  const result = await biometricAuth.authenticateWithBiometric({
    userId: user.id,
    method: authData.method,
    reason: authData.reason,
    fallbackTitle: authData.fallbackTitle,
    cancelTitle: authData.cancelTitle,
    timeout: authData.timeout,
    allowDeviceCredentials: authData.allowDeviceCredentials
  })

  return createApiResponse({
    success: result.success,
    data: {
      authenticated: result.success,
      method: result.method,
      confidence: result.biometricData?.confidence,
      quality: result.biometricData?.quality,
      timestamp: result.timestamp
    },
    error: result.error ? {
      code: result.error.code,
      message: result.error.message,
      type: result.error.type
    } : undefined,
    metadata: {
      deviceInfo: result.deviceInfo,
      processingTime: Date.now() - result.timestamp.getTime()
    }
  })
}

async function handleBiometricEnrollment(body: any, user: any) {
  // Validate biometric enrollment request
  const validationResult = BiometricEnrollmentSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid biometric enrollment data', 400, {
      errors: validationResult.error.errors
    })
  }

  const enrollmentData = validationResult.data

  // Perform biometric enrollment
  const biometricAuth = getBiometricAuthentication()
  const result = await biometricAuth.enrollBiometric(
    user.id,
    enrollmentData.type,
    {
      language: enrollmentData.language,
      phrases: enrollmentData.phrases
    }
  )

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      enrolled: true,
      templateId: result.templateId,
      quality: result.quality,
      biometricType: enrollmentData.type
    } : null,
    error: result.error,
    metadata: {
      enrollmentType: enrollmentData.type,
      language: enrollmentData.language,
      timestamp: new Date().toISOString()
    }
  })
}

async function handleHealthPermissions(body: any, user: any) {
  const platform = body.platform || 'ios'

  if (platform === 'ios') {
    const healthKit = getHealthKitIntegration()
    const result = await healthKit.requestPermissions()

    return createApiResponse({
      success: result.success,
      data: {
        platform: 'ios',
        granted: result.granted,
        denied: result.denied,
        totalRequested: result.granted.length + result.denied.length
      },
      error: result.error,
      metadata: {
        timestamp: new Date().toISOString(),
        userId: user.id
      }
    })
  } else if (platform === 'android') {
    const healthConnect = getHealthConnectIntegration()
    const result = await healthConnect.requestPermissions()

    return createApiResponse({
      success: result.success,
      data: {
        platform: 'android',
        granted: result.granted,
        denied: result.denied,
        totalRequested: result.granted.length + result.denied.length
      },
      error: result.error,
      metadata: {
        timestamp: new Date().toISOString(),
        userId: user.id
      }
    })
  } else {
    return createApiResponse(null, 'Unsupported platform', 400)
  }
}

async function handleReadVitalSigns(body: any, user: any) {
  // Validate vital signs query
  const validationResult = VitalSignsQuerySchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid vital signs query', 400, {
      errors: validationResult.error.errors
    })
  }

  const queryData = validationResult.data
  const platform = body.platform || 'ios'

  let timeRange
  if (queryData.timeRange) {
    timeRange = {
      start: queryData.timeRange.start ? new Date(queryData.timeRange.start) : undefined,
      end: queryData.timeRange.end ? new Date(queryData.timeRange.end) : undefined
    }
  }

  if (platform === 'ios') {
    const healthKit = getHealthKitIntegration()
    const result = await healthKit.readVitalSigns(user.id, timeRange)

    return createApiResponse({
      success: result.success,
      data: result.data ? {
        platform: 'ios',
        vitalSigns: result.data,
        readAt: new Date().toISOString()
      } : null,
      error: result.error,
      metadata: {
        timeRange,
        userId: user.id
      }
    })
  } else if (platform === 'android') {
    const healthConnect = getHealthConnectIntegration()
    const result = await healthConnect.readVitalSigns(user.id, timeRange)

    return createApiResponse({
      success: result.success,
      data: result.data ? {
        platform: 'android',
        vitalSigns: result.data,
        readAt: new Date().toISOString()
      } : null,
      error: result.error,
      metadata: {
        timeRange,
        userId: user.id
      }
    })
  } else {
    return createApiResponse(null, 'Unsupported platform', 400)
  }
}

async function handleCheckDonationEligibility(body: any, user: any) {
  const platform = body.platform || 'ios'

  if (platform === 'ios') {
    const healthKit = getHealthKitIntegration()
    const result = await healthKit.checkDonationEligibility(user.id, body.vitalSigns)

    return createApiResponse({
      success: result.success,
      data: {
        platform: 'ios',
        eligible: result.eligible,
        reasons: result.reasons,
        recommendations: result.recommendations,
        nextEligibleDate: result.nextEligibleDate
      },
      metadata: {
        checkedAt: new Date().toISOString(),
        userId: user.id
      }
    })
  } else if (platform === 'android') {
    const healthConnect = getHealthConnectIntegration()
    const result = await healthConnect.checkDonationEligibility(user.id, body.vitalSigns, body.fitnessData)

    return createApiResponse({
      success: result.success,
      data: {
        platform: 'android',
        eligible: result.eligible,
        reasons: result.reasons,
        recommendations: result.recommendations,
        fitnessScore: result.fitnessScore,
        nextEligibleDate: result.nextEligibleDate
      },
      metadata: {
        checkedAt: new Date().toISOString(),
        userId: user.id
      }
    })
  } else {
    return createApiResponse(null, 'Unsupported platform', 400)
  }
}

async function handleRecordDonation(body: any, user: any) {
  const platform = body.platform || 'ios'
  const donationData = body.donationData

  if (!donationData) {
    return createApiResponse(null, 'Donation data is required', 400)
  }

  if (platform === 'ios') {
    const healthKit = getHealthKitIntegration()
    const result = await healthKit.recordBloodDonation({
      userId: user.id,
      donationDate: new Date(donationData.donationDate),
      bloodType: donationData.bloodType,
      volume: donationData.volume,
      location: donationData.location,
      preVitals: donationData.preVitals,
      postVitals: donationData.postVitals,
      eligibilityChecks: donationData.eligibilityChecks,
      complications: donationData.complications,
      followUp: donationData.followUp
    })

    return createApiResponse({
      success: result.success,
      data: result.success ? {
        platform: 'ios',
        recordId: result.recordId,
        recorded: true
      } : null,
      error: result.error,
      metadata: {
        recordedAt: new Date().toISOString(),
        userId: user.id
      }
    })
  } else if (platform === 'android') {
    const healthConnect = getHealthConnectIntegration()
    const result = await healthConnect.writeBloodDonationRecord(user.id, {
      donationDate: new Date(donationData.donationDate),
      bloodType: donationData.bloodType,
      volume: donationData.volume,
      location: donationData.location,
      preVitals: donationData.preVitals,
      postVitals: donationData.postVitals,
      notes: donationData.notes
    })

    return createApiResponse({
      success: result.success,
      data: result.success ? {
        platform: 'android',
        recordId: result.recordId,
        recorded: true
      } : null,
      error: result.error,
      metadata: {
        recordedAt: new Date().toISOString(),
        userId: user.id
      }
    })
  } else {
    return createApiResponse(null, 'Unsupported platform', 400)
  }
}

async function handleSyncHealthData(body: any, user: any) {
  // Validate health data sync request
  const validationResult = HealthDataSyncSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid health data sync request', 400, {
      errors: validationResult.error.errors
    })
  }

  const syncData = validationResult.data

  if (syncData.platform === 'ios') {
    const healthKit = getHealthKitIntegration()
    const result = await healthKit.syncHealthData(user.id)

    return createApiResponse({
      success: result.success,
      data: {
        platform: 'ios',
        syncedData: result.syncedData,
        errors: result.errors,
        syncedAt: new Date().toISOString()
      },
      metadata: {
        userId: user.id,
        dataTypes: syncData.dataTypes
      }
    })
  } else if (syncData.platform === 'android') {
    const healthConnect = getHealthConnectIntegration()
    const result = await healthConnect.syncHealthData(user.id)

    return createApiResponse({
      success: result.success,
      data: {
        platform: 'android',
        syncedData: result.syncedData,
        errors: result.errors,
        syncedAt: new Date().toISOString()
      },
      metadata: {
        userId: user.id,
        dataTypes: syncData.dataTypes
      }
    })
  } else {
    return createApiResponse(null, 'Unsupported platform', 400)
  }
}

async function handleSetupWidgets(body: any, user: any) {
  const platformFeatures = getPlatformFeatures()
  const result = await platformFeatures.setupWidgets(user.id)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      widgets: result.widgets,
      setupAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      widgetCount: result.widgets.length
    }
  })
}

async function handleUpdateWidget(body: any, user: any) {
  // Validate widget update request
  const validationResult = WidgetUpdateSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid widget update request', 400, {
      errors: validationResult.error.errors
    })
  }

  const updateData = validationResult.data

  const platformFeatures = getPlatformFeatures()
  const result = await platformFeatures.updateWidget(user.id, updateData.widgetId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      widget: result.widget,
      updatedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      widgetId: updateData.widgetId
    }
  })
}

async function handleScheduleNotification(body: any, user: any) {
  // Validate notification schedule request
  const validationResult = NotificationScheduleSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid notification schedule request', 400, {
      errors: validationResult.error.errors
    })
  }

  const scheduleData = validationResult.data

  const platformFeatures = getPlatformFeatures()
  const templates = platformFeatures.getNotificationTemplates()
  const template = templates.find(t => t.id === scheduleData.templateId)

  if (!template) {
    return createApiResponse(null, 'Notification template not found', 404)
  }

  // Merge custom data if provided
  if (scheduleData.customData) {
    template.customData = { ...template.customData, ...scheduleData.customData }
  }

  const result = await platformFeatures.scheduleNotification(
    template,
    user.id,
    scheduleData.scheduledFor ? new Date(scheduleData.scheduledFor) : undefined
  )

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      notificationId: result.notificationId,
      scheduled: true,
      scheduledAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      templateId: scheduleData.templateId,
      scheduledFor: scheduleData.scheduledFor
    }
  })
}

async function handleSetupShortcuts(body: any, user: any) {
  const platformFeatures = getPlatformFeatures()
  const result = await platformFeatures.setupAppShortcuts()

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      shortcuts: result.shortcuts,
      setupAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      shortcutCount: result.shortcuts.length
    }
  })
}

async function handleSetupVoiceAssistant(body: any, user: any) {
  const language = body.language || 'en'
  const assistantType = body.assistantType || 'siri' // 'siri' or 'google_assistant'

  const platformFeatures = getPlatformFeatures()

  if (assistantType === 'siri') {
    const result = await platformFeatures.setupSiriShortcuts(language)

    return createApiResponse({
      success: result.success,
      data: result.success ? {
        assistant: 'siri',
        shortcuts: result.shortcuts,
        setupAt: new Date().toISOString()
      } : null,
      error: result.error,
      metadata: {
        userId: user.id,
        language,
        shortcutCount: result.shortcuts?.length || 0
      }
    })
  } else if (assistantType === 'google_assistant') {
    const result = await platformFeatures.setupGoogleAssistantActions(language)

    return createApiResponse({
      success: result.success,
      data: result.success ? {
        assistant: 'google_assistant',
        actions: result.actions,
        setupAt: new Date().toISOString()
      } : null,
      error: result.error,
      metadata: {
        userId: user.id,
        language,
        actionCount: result.actions?.length || 0
      }
    })
  } else {
    return createApiResponse(null, 'Unsupported voice assistant type', 400)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'platform_capabilities':
        return await handleGetPlatformCapabilities()
      
      case 'biometric_capabilities':
        return await handleGetBiometricCapabilities()
      
      case 'health_system_status':
        return await handleGetHealthSystemStatus()
      
      case 'notification_templates':
        return await handleGetNotificationTemplates()
      
      case 'system_stats':
        return await handleGetSystemStats()
      
      default:
        return await handleGetSystemStats()
    }

  } catch (error) {
    console.error('Native platform query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve platform data', 500)
  }
}

async function handleGetPlatformCapabilities() {
  const platformFeatures = getPlatformFeatures()
  const capabilities = await platformFeatures.detectPlatformCapabilities()

  return createApiResponse({
    success: true,
    data: {
      platform: capabilities.platform,
      version: capabilities.version,
      features: capabilities.features,
      permissions: capabilities.permissions
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetBiometricCapabilities() {
  const biometricAuth = getBiometricAuthentication()
  const capabilities = await biometricAuth.checkBiometricCapabilities()

  return createApiResponse({
    success: true,
    data: {
      capabilities,
      securityPolicies: biometricAuth.getSecurityPolicies(),
      voiceLanguages: Object.keys(biometricAuth.getVoiceEnrollmentPhrases())
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetHealthSystemStatus() {
  const healthKit = getHealthKitIntegration()
  const healthConnect = getHealthConnectIntegration()

  const [healthKitHealth, healthConnectHealth] = await Promise.all([
    healthKit.healthCheck(),
    healthConnect.healthCheck()
  ])

  return createApiResponse({
    success: true,
    data: {
      ios: {
        status: healthKitHealth.status,
        details: healthKitHealth.details
      },
      android: {
        status: healthConnectHealth.status,
        details: healthConnectHealth.details
      }
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetNotificationTemplates() {
  const platformFeatures = getPlatformFeatures()
  const templates = platformFeatures.getNotificationTemplates()

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

async function handleGetSystemStats() {
  const platformFeatures = getPlatformFeatures()
  const biometricAuth = getBiometricAuthentication()
  const healthKit = getHealthKitIntegration()
  const healthConnect = getHealthConnectIntegration()

  const [platformStats, biometricStats, healthKitStats, healthConnectStats] = await Promise.all([
    platformFeatures.getSystemStats(),
    biometricAuth.getSystemStats(),
    healthKit.getSystemStats(),
    healthConnect.getSystemStats()
  ])

  return createApiResponse({
    success: true,
    data: {
      platform: platformStats,
      biometric: biometricStats,
      healthKit: healthKitStats,
      healthConnect: healthConnectStats,
      overall: {
        totalFeatures: platformStats.supportedFeatures + biometricStats.supportedMethods,
        healthIntegrations: 2, // HealthKit + Health Connect
        authenticationMethods: biometricStats.supportedMethods
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
    const platformFeatures = getPlatformFeatures()
    const biometricAuth = getBiometricAuthentication()
    const healthKit = getHealthKitIntegration()
    const healthConnect = getHealthConnectIntegration()

    const [platformHealth, biometricHealth, healthKitHealth, healthConnectHealth] = await Promise.all([
      platformFeatures.healthCheck(),
      biometricAuth.healthCheck(),
      healthKit.healthCheck(),
      healthConnect.healthCheck()
    ])

    const overallStatus = [platformHealth, biometricHealth, healthKitHealth, healthConnectHealth]
      .every(h => h.status === 'healthy') ? 'healthy' :
      [platformHealth, biometricHealth, healthKitHealth, healthConnectHealth]
        .some(h => h.status === 'unhealthy') ? 'unhealthy' : 'degraded'

    return new NextResponse(null, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 206 : 503,
      headers: {
        'X-Platform-Status': platformHealth.status,
        'X-Biometric-Status': biometricHealth.status,
        'X-HealthKit-Status': healthKitHealth.status,
        'X-HealthConnect-Status': healthConnectHealth.status,
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
