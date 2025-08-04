/**
 * Mobile Features API Endpoint
 *
 * Provides REST API for offline-first architecture, background sync,
 * and mobile performance optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOfflineManager } from '@/lib/mobile/offline/offline-manager'
import { getBackgroundSyncService } from '@/lib/mobile/sync/background-sync'
import { getMobilePerformanceOptimizer } from '@/lib/mobile/performance/mobile-optimizer'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const StoreOfflineDataSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  data: z.any(),
  userId: z.string().min(1)
})

const RetrieveOfflineDataSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().optional(),
  userId: z.string().optional()
})

const UpdateOfflineDataSchema = z.object({
  offlineId: z.string().min(1),
  data: z.any(),
  userId: z.string().min(1)
})

const ResolveConflictSchema = z.object({
  conflictId: z.string().min(1),
  resolution: z.enum(['local_wins', 'server_wins', 'merge', 'manual']),
  resolvedData: z.any().optional()
})

const ScheduleSyncSchema = z.object({
  type: z.enum(['full_sync', 'incremental_sync', 'priority_sync', 'conflict_resolution']),
  entityTypes: z.array(z.string()),
  priority: z.enum(['low', 'normal', 'high', 'critical']),
  estimatedDuration: z.number().min(1),
  dataSize: z.number().min(0),
  networkRequirement: z.enum(['any', 'wifi_only', 'good_connection']),
  batteryRequirement: z.enum(['any', 'charging', 'sufficient']),
  maxRetries: z.number().min(0).max(10),
  metadata: z.record(z.any()).optional()
})

const DeviceCapabilitiesSchema = z.object({
  totalMemory: z.number().min(0),
  availableMemory: z.number().min(0),
  cpuCores: z.number().min(1),
  gpuTier: z.enum(['low', 'mid', 'high']),
  screenWidth: z.number().min(1),
  screenHeight: z.number().min(1),
  pixelDensity: z.number().min(0.1),
  refreshRate: z.number().min(30),
  connectionType: z.enum(['wifi', 'cellular', 'none']),
  bandwidth: z.number().min(0),
  latency: z.number().min(0),
  batteryLevel: z.number().min(0).max(100),
  isCharging: z.boolean(),
  batteryHealth: z.number().min(0).max(100),
  averageFPS: z.number().min(0),
  memoryPressure: z.enum(['low', 'medium', 'high', 'critical']),
  thermalState: z.enum(['nominal', 'fair', 'serious', 'critical'])
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
      // Offline Manager Actions
      case 'store_offline_data':
        return await handleStoreOfflineData(body, user)
      
      case 'retrieve_offline_data':
        return await handleRetrieveOfflineData(body, user)
      
      case 'update_offline_data':
        return await handleUpdateOfflineData(body, user)
      
      case 'sync_with_server':
        return await handleSyncWithServer(body, user)
      
      case 'resolve_conflict':
        return await handleResolveConflict(body, user)
      
      // Background Sync Actions
      case 'schedule_sync':
        return await handleScheduleSync(body, user)
      
      case 'cancel_sync':
        return await handleCancelSync(body, user)
      
      case 'force_sync_now':
        return await handleForceSyncNow(body, user)
      
      case 'optimize_sync_schedule':
        return await handleOptimizeSyncSchedule(body, user)
      
      // Performance Optimizer Actions
      case 'optimize_for_device':
        return await handleOptimizeForDevice(body, user)
      
      case 'adaptive_optimization':
        return await handleAdaptiveOptimization(body, user)
      
      case 'measure_performance':
        return await handleMeasurePerformance(body, user)
      
      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Mobile API error:', error)
    
    return createApiResponse(null, 'Mobile operation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

// Offline Manager Handlers
async function handleStoreOfflineData(body: any, user: any) {
  const validationResult = StoreOfflineDataSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid offline data', 400, {
      errors: validationResult.error.errors
    })
  }

  const { entityType, entityId, data, userId } = validationResult.data

  const offlineManager = getOfflineManager()
  const result = await offlineManager.storeOfflineData(entityType, entityId, data, userId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      offlineId: result.offlineId,
      stored: true,
      storedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      entityType,
      entityId,
      dataSize: JSON.stringify(data).length
    }
  })
}

async function handleRetrieveOfflineData(body: any, user: any) {
  const validationResult = RetrieveOfflineDataSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid retrieval parameters', 400, {
      errors: validationResult.error.errors
    })
  }

  const { entityType, entityId, userId } = validationResult.data

  const offlineManager = getOfflineManager()
  const result = await offlineManager.retrieveOfflineData(entityType, entityId, userId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      offlineData: result.data,
      count: result.data?.length || 0,
      retrievedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      entityType,
      entityId: entityId || 'all'
    }
  })
}

async function handleUpdateOfflineData(body: any, user: any) {
  const validationResult = UpdateOfflineDataSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid update data', 400, {
      errors: validationResult.error.errors
    })
  }

  const { offlineId, data, userId } = validationResult.data

  const offlineManager = getOfflineManager()
  const result = await offlineManager.updateOfflineData(offlineId, data, userId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      updated: true,
      updatedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      offlineId,
      dataSize: JSON.stringify(data).length
    }
  })
}

async function handleSyncWithServer(body: any, user: any) {
  const { force } = body

  const offlineManager = getOfflineManager()
  const result = await offlineManager.syncWithServer(force)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      syncResults: result.syncResults,
      syncedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      forceSync: force || false
    }
  })
}

async function handleResolveConflict(body: any, user: any) {
  const validationResult = ResolveConflictSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid conflict resolution data', 400, {
      errors: validationResult.error.errors
    })
  }

  const { conflictId, resolution, resolvedData } = validationResult.data

  const offlineManager = getOfflineManager()
  const result = await offlineManager.resolveConflict(conflictId, resolution, resolvedData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      resolved: true,
      resolution,
      resolvedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      conflictId,
      resolution
    }
  })
}

// Background Sync Handlers
async function handleScheduleSync(body: any, user: any) {
  const validationResult = ScheduleSyncSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid sync job data', 400, {
      errors: validationResult.error.errors
    })
  }

  const jobData = validationResult.data

  const backgroundSync = getBackgroundSyncService()
  const result = await backgroundSync.scheduleSync(jobData)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      jobId: result.jobId,
      scheduled: true,
      scheduledAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      jobType: jobData.type,
      priority: jobData.priority,
      entityTypes: jobData.entityTypes
    }
  })
}

async function handleCancelSync(body: any, user: any) {
  const { jobId } = body

  if (!jobId) {
    return createApiResponse(null, 'Job ID is required', 400)
  }

  const backgroundSync = getBackgroundSyncService()
  const result = await backgroundSync.cancelSync(jobId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      cancelled: true,
      cancelledAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      jobId
    }
  })
}

async function handleForceSyncNow(body: any, user: any) {
  const { entityTypes } = body

  const backgroundSync = getBackgroundSyncService()
  const result = await backgroundSync.forceSyncNow(entityTypes)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      jobId: result.jobId,
      forcedSync: true,
      scheduledAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      entityTypes: entityTypes || ['all']
    }
  })
}

async function handleOptimizeSyncSchedule(body: any, user: any) {
  const backgroundSync = getBackgroundSyncService()
  const result = await backgroundSync.optimizeSyncSchedule()

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      optimizations: result.optimizations,
      optimizedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      optimizationCount: result.optimizations?.length || 0
    }
  })
}

// Performance Optimizer Handlers
async function handleOptimizeForDevice(body: any, user: any) {
  const validationResult = DeviceCapabilitiesSchema.safeParse(body.capabilities)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid device capabilities', 400, {
      errors: validationResult.error.errors
    })
  }

  const capabilities = validationResult.data

  const optimizer = getMobilePerformanceOptimizer()
  const result = await optimizer.optimizeForDevice(capabilities)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      profile: result.profile,
      optimizations: result.optimizations,
      optimizedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      deviceTier: result.profile?.deviceTier,
      optimizationCount: result.optimizations?.length || 0
    }
  })
}

async function handleAdaptiveOptimization(body: any, user: any) {
  const optimizer = getMobilePerformanceOptimizer()
  const result = await optimizer.adaptiveOptimization()

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      changes: result.changes,
      adaptedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      changeCount: result.changes?.length || 0
    }
  })
}

async function handleMeasurePerformance(body: any, user: any) {
  const optimizer = getMobilePerformanceOptimizer()
  const result = await optimizer.measurePerformance()

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      metrics: result.metrics,
      measuredAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      averageFPS: result.metrics?.averageFPS,
      memoryUsage: result.metrics?.memoryUsage
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
      case 'get_network_status':
        return await handleGetNetworkStatus()
      
      case 'get_sync_metrics':
        return await handleGetSyncMetrics(user)
      
      case 'get_sync_status':
        return await handleGetSyncStatus(user)
      
      case 'get_offline_capabilities':
        return await handleGetOfflineCapabilities()
      
      case 'get_performance_profiles':
        return await handleGetPerformanceProfiles()
      
      case 'get_optimization_recommendations':
        return await handleGetOptimizationRecommendations(user)
      
      case 'system_stats':
        return await handleGetSystemStats()
      
      default:
        return await handleGetSystemStats()
    }

  } catch (error) {
    console.error('Mobile query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve mobile data', 500)
  }
}

async function handleGetNetworkStatus() {
  const offlineManager = getOfflineManager()
  const networkStatus = await offlineManager.getNetworkStatus()

  return createApiResponse({
    success: true,
    data: {
      networkStatus,
      retrievedAt: new Date().toISOString()
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetSyncMetrics(user: any) {
  if (!user) {
    return createApiResponse(null, 'Authentication required for sync metrics', 401)
  }

  const offlineManager = getOfflineManager()
  const metrics = await offlineManager.getSyncMetrics()

  return createApiResponse({
    success: true,
    data: {
      metrics,
      retrievedAt: new Date().toISOString()
    },
    metadata: {
      userId: user.id
    }
  })
}

async function handleGetSyncStatus(user: any) {
  if (!user) {
    return createApiResponse(null, 'Authentication required for sync status', 401)
  }

  const backgroundSync = getBackgroundSyncService()
  const status = await backgroundSync.getSyncStatus()

  return createApiResponse({
    success: true,
    data: {
      status,
      retrievedAt: new Date().toISOString()
    },
    metadata: {
      userId: user.id
    }
  })
}

async function handleGetOfflineCapabilities() {
  const offlineManager = getOfflineManager()
  const capabilities = offlineManager.getOfflineCapabilities()

  return createApiResponse({
    success: true,
    data: {
      capabilities,
      count: capabilities.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetPerformanceProfiles() {
  const optimizer = getMobilePerformanceOptimizer()
  const profiles = optimizer.getPerformanceProfiles()

  return createApiResponse({
    success: true,
    data: {
      profiles,
      count: profiles.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetOptimizationRecommendations(user: any) {
  if (!user) {
    return createApiResponse(null, 'Authentication required for optimization recommendations', 401)
  }

  const optimizer = getMobilePerformanceOptimizer()
  const result = await optimizer.getOptimizationRecommendations()

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      recommendations: result.recommendations,
      count: result.recommendations?.length || 0,
      retrievedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id
    }
  })
}

async function handleGetSystemStats() {
  const offlineManager = getOfflineManager()
  const backgroundSync = getBackgroundSyncService()
  const optimizer = getMobilePerformanceOptimizer()

  const [offlineStats, syncStats, optimizerStats] = await Promise.all([
    offlineManager.getSystemStats(),
    backgroundSync.getSystemStats(),
    optimizer.getSystemStats()
  ])

  return createApiResponse({
    success: true,
    data: {
      offline: offlineStats,
      sync: syncStats,
      performance: optimizerStats,
      overall: {
        totalFeatures: 3,
        offlineCapabilities: offlineStats.offlineCapabilities,
        syncStrategies: syncStats.syncStrategies,
        performanceProfiles: optimizerStats.performanceProfiles
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
    const offlineManager = getOfflineManager()
    const backgroundSync = getBackgroundSyncService()
    const optimizer = getMobilePerformanceOptimizer()

    const [offlineHealth, syncHealth, optimizerHealth] = await Promise.all([
      offlineManager.healthCheck(),
      backgroundSync.healthCheck(),
      optimizer.healthCheck()
    ])

    const overallStatus = [offlineHealth, syncHealth, optimizerHealth]
      .every(h => h.status === 'healthy') ? 'healthy' :
      [offlineHealth, syncHealth, optimizerHealth]
        .some(h => h.status === 'unhealthy') ? 'unhealthy' : 'degraded'

    return new NextResponse(null, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 206 : 503,
      headers: {
        'X-Offline-Status': offlineHealth.status,
        'X-Sync-Status': syncHealth.status,
        'X-Performance-Status': optimizerHealth.status,
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
