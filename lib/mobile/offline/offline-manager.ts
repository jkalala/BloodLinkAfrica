/**
 * Offline-First Architecture Manager
 * 
 * Comprehensive offline-first architecture with local storage,
 * background sync, conflict resolution, and seamless online/offline transitions
 */

import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'
import { getSecurityEngine } from '../../security/security-engine'
import { performanceMonitor } from '../../performance/metrics'
import { getRealTimeEventSystem } from '../../realtime/event-system'

export interface OfflineData {
  id: string
  type: 'donor' | 'appointment' | 'donation' | 'inventory' | 'user_profile' | 'notification'
  data: any
  timestamp: Date
  version: number
  checksum: string
  syncStatus: 'pending' | 'synced' | 'conflict' | 'failed'
  lastModified: Date
  deviceId: string
  userId: string
}

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entityType: string
  entityId: string
  localData: any
  serverData?: any
  timestamp: Date
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'conflict'
  retryCount: number
  maxRetries: number
  error?: string
  conflictResolution?: 'local_wins' | 'server_wins' | 'merge' | 'manual'
}

export interface ConflictResolution {
  id: string
  operationId: string
  localVersion: any
  serverVersion: any
  conflictType: 'data_conflict' | 'version_conflict' | 'delete_conflict'
  resolution: 'local_wins' | 'server_wins' | 'merge' | 'manual'
  resolvedData?: any
  resolvedBy?: string
  resolvedAt?: Date
  isResolved: boolean
}

export interface OfflineCapability {
  entityType: string
  operations: ('create' | 'read' | 'update' | 'delete')[]
  syncStrategy: 'immediate' | 'batch' | 'scheduled' | 'manual'
  conflictResolution: 'auto' | 'manual'
  storageLimit: number // MB
  retentionPeriod: number // days
  compressionEnabled: boolean
  encryptionEnabled: boolean
}

export interface NetworkStatus {
  isOnline: boolean
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
  effectiveType: '2g' | '3g' | '4g' | '5g' | 'unknown'
  downlink: number // Mbps
  rtt: number // ms
  saveData: boolean
  lastOnline: Date
  lastOffline: Date
}

export interface SyncMetrics {
  totalOperations: number
  pendingOperations: number
  completedOperations: number
  failedOperations: number
  conflictOperations: number
  averageSyncTime: number
  lastSyncTime: Date
  dataTransferred: number // bytes
  compressionRatio: number
  errorRate: number
}

class OfflineManager {
  private db = getOptimizedDB()
  private cache = getCache()
  private securityEngine = getSecurityEngine()
  private eventSystem = getRealTimeEventSystem()

  // Offline capabilities configuration
  private readonly OFFLINE_CAPABILITIES: OfflineCapability[] = [
    {
      entityType: 'donor',
      operations: ['create', 'read', 'update'],
      syncStrategy: 'immediate',
      conflictResolution: 'manual',
      storageLimit: 50, // 50MB
      retentionPeriod: 30, // 30 days
      compressionEnabled: true,
      encryptionEnabled: true
    },
    {
      entityType: 'appointment',
      operations: ['create', 'read', 'update', 'delete'],
      syncStrategy: 'immediate',
      conflictResolution: 'auto',
      storageLimit: 20, // 20MB
      retentionPeriod: 7, // 7 days
      compressionEnabled: true,
      encryptionEnabled: false
    },
    {
      entityType: 'donation',
      operations: ['create', 'read', 'update'],
      syncStrategy: 'immediate',
      conflictResolution: 'manual',
      storageLimit: 100, // 100MB
      retentionPeriod: 90, // 90 days
      compressionEnabled: true,
      encryptionEnabled: true
    },
    {
      entityType: 'inventory',
      operations: ['read', 'update'],
      syncStrategy: 'batch',
      conflictResolution: 'server_wins',
      storageLimit: 10, // 10MB
      retentionPeriod: 1, // 1 day
      compressionEnabled: false,
      encryptionEnabled: false
    },
    {
      entityType: 'user_profile',
      operations: ['read', 'update'],
      syncStrategy: 'immediate',
      conflictResolution: 'manual',
      storageLimit: 5, // 5MB
      retentionPeriod: 365, // 1 year
      compressionEnabled: false,
      encryptionEnabled: true
    },
    {
      entityType: 'notification',
      operations: ['create', 'read', 'update', 'delete'],
      syncStrategy: 'batch',
      conflictResolution: 'auto',
      storageLimit: 15, // 15MB
      retentionPeriod: 14, // 14 days
      compressionEnabled: true,
      encryptionEnabled: false
    }
  ]

  // Network quality thresholds
  private readonly NETWORK_THRESHOLDS = {
    GOOD_CONNECTION: { rtt: 150, downlink: 1.5 }, // RTT < 150ms, Downlink > 1.5 Mbps
    POOR_CONNECTION: { rtt: 500, downlink: 0.5 }, // RTT > 500ms, Downlink < 0.5 Mbps
    SYNC_THRESHOLD: { rtt: 300, downlink: 1.0 } // Minimum for background sync
  }

  private networkStatus: NetworkStatus = {
    isOnline: true,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
    lastOnline: new Date(),
    lastOffline: new Date()
  }

  private syncQueue: SyncOperation[] = []
  private isBackgroundSyncRunning = false

  constructor() {
    this.initializeOfflineManager()
    this.setupNetworkMonitoring()
    this.startBackgroundSync()
  }

  async storeOfflineData(entityType: string, entityId: string, data: any, userId: string): Promise<{
    success: boolean
    offlineId?: string
    error?: string
  }> {
    try {
      const capability = this.getOfflineCapability(entityType)
      if (!capability) {
        return { success: false, error: 'Entity type not supported for offline storage' }
      }

      // Check storage limits
      const storageCheck = await this.checkStorageLimit(entityType, capability.storageLimit)
      if (!storageCheck.withinLimit) {
        await this.cleanupOldData(entityType, capability.retentionPeriod)
      }

      const offlineId = `offline_${entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Compress data if enabled
      let processedData = data
      if (capability.compressionEnabled) {
        processedData = await this.compressData(data)
      }

      // Encrypt data if enabled
      if (capability.encryptionEnabled) {
        processedData = await this.securityEngine.encryptData(processedData, userId)
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(processedData)

      const offlineData: OfflineData = {
        id: offlineId,
        type: entityType as any,
        data: processedData,
        timestamp: new Date(),
        version: 1,
        checksum,
        syncStatus: 'pending',
        lastModified: new Date(),
        deviceId: await this.getDeviceId(),
        userId
      }

      // Store in local database
      await this.storeInLocalDB(offlineData)

      // Cache for quick access
      await this.cache.set(`offline:${offlineId}`, offlineData, {
        ttl: capability.retentionPeriod * 24 * 60 * 60, // Convert days to seconds
        tags: ['offline', entityType, userId]
      })

      // Add to sync queue if online
      if (this.networkStatus.isOnline && capability.syncStrategy === 'immediate') {
        await this.addToSyncQueue('create', entityType, entityId, data, userId)
      }

      // Log offline storage
      await this.eventSystem.publishEvent({
        id: `offline_data_stored_${offlineId}`,
        type: 'offline_event',
        priority: 'low',
        source: 'offline_manager',
        timestamp: new Date(),
        data: {
          type: 'offline_data_stored',
          offline_id: offlineId,
          entity_type: entityType,
          entity_id: entityId,
          user_id: userId,
          compressed: capability.compressionEnabled,
          encrypted: capability.encryptionEnabled
        }
      })

      return { success: true, offlineId }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async retrieveOfflineData(entityType: string, entityId?: string, userId?: string): Promise<{
    success: boolean
    data?: OfflineData[]
    error?: string
  }> {
    try {
      const capability = this.getOfflineCapability(entityType)
      if (!capability || !capability.operations.includes('read')) {
        return { success: false, error: 'Entity type not supported for offline reading' }
      }

      // Build query filters
      const filters: any = { type: entityType }
      if (entityId) filters.entityId = entityId
      if (userId) filters.userId = userId

      // Retrieve from local database
      const result = await this.retrieveFromLocalDB(filters)
      if (!result.success) {
        return { success: false, error: result.error }
      }

      const offlineDataList = result.data as OfflineData[]

      // Decrypt and decompress data
      for (const offlineData of offlineDataList) {
        if (capability.encryptionEnabled && userId) {
          offlineData.data = await this.securityEngine.decryptData(offlineData.data, userId)
        }

        if (capability.compressionEnabled) {
          offlineData.data = await this.decompressData(offlineData.data)
        }

        // Verify checksum
        const calculatedChecksum = await this.calculateChecksum(offlineData.data)
        if (calculatedChecksum !== offlineData.checksum) {
          console.warn(`Checksum mismatch for offline data ${offlineData.id}`)
        }
      }

      return { success: true, data: offlineDataList }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async updateOfflineData(offlineId: string, data: any, userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Get existing offline data
      const existingResult = await this.getOfflineDataById(offlineId)
      if (!existingResult.success || !existingResult.data) {
        return { success: false, error: 'Offline data not found' }
      }

      const existingData = existingResult.data
      const capability = this.getOfflineCapability(existingData.type)
      
      if (!capability || !capability.operations.includes('update')) {
        return { success: false, error: 'Entity type not supported for offline updates' }
      }

      // Process data (compress/encrypt if needed)
      let processedData = data
      if (capability.compressionEnabled) {
        processedData = await this.compressData(data)
      }

      if (capability.encryptionEnabled) {
        processedData = await this.securityEngine.encryptData(processedData, userId)
      }

      // Calculate new checksum
      const checksum = await this.calculateChecksum(processedData)

      // Update offline data
      const updatedData: Partial<OfflineData> = {
        data: processedData,
        version: existingData.version + 1,
        checksum,
        syncStatus: 'pending',
        lastModified: new Date()
      }

      await this.updateInLocalDB(offlineId, updatedData)

      // Update cache
      const fullUpdatedData = { ...existingData, ...updatedData }
      await this.cache.set(`offline:${offlineId}`, fullUpdatedData, {
        ttl: capability.retentionPeriod * 24 * 60 * 60,
        tags: ['offline', existingData.type, userId]
      })

      // Add to sync queue if online
      if (this.networkStatus.isOnline && capability.syncStrategy === 'immediate') {
        await this.addToSyncQueue('update', existingData.type, offlineId, data, userId)
      }

      return { success: true }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async syncWithServer(force: boolean = false): Promise<{
    success: boolean
    syncResults?: {
      completed: number
      failed: number
      conflicts: number
    }
    error?: string
  }> {
    try {
      if (!this.networkStatus.isOnline && !force) {
        return { success: false, error: 'Device is offline' }
      }

      if (this.isBackgroundSyncRunning && !force) {
        return { success: false, error: 'Background sync is already running' }
      }

      this.isBackgroundSyncRunning = true

      const syncResults = {
        completed: 0,
        failed: 0,
        conflicts: 0
      }

      // Process sync queue
      const pendingOperations = this.syncQueue.filter(op => op.status === 'pending')
      
      for (const operation of pendingOperations) {
        try {
          operation.status = 'in_progress'
          
          const result = await this.processSyncOperation(operation)
          
          if (result.success) {
            operation.status = 'completed'
            syncResults.completed++
          } else if (result.conflict) {
            operation.status = 'conflict'
            syncResults.conflicts++
            await this.handleSyncConflict(operation, result.serverData)
          } else {
            operation.status = 'failed'
            operation.error = result.error
            operation.retryCount++
            syncResults.failed++
          }

        } catch (error) {
          operation.status = 'failed'
          operation.error = (error as Error).message
          operation.retryCount++
          syncResults.failed++
        }
      }

      // Remove completed operations from queue
      this.syncQueue = this.syncQueue.filter(op => op.status !== 'completed')

      // Update sync metrics
      await this.updateSyncMetrics(syncResults)

      this.isBackgroundSyncRunning = false

      // Log sync completion
      await this.eventSystem.publishEvent({
        id: `sync_completed_${Date.now()}`,
        type: 'offline_event',
        priority: 'medium',
        source: 'offline_manager',
        timestamp: new Date(),
        data: {
          type: 'sync_completed',
          results: syncResults,
          operations_processed: pendingOperations.length,
          force_sync: force
        }
      })

      return { success: true, syncResults }

    } catch (error) {
      this.isBackgroundSyncRunning = false
      return { success: false, error: (error as Error).message }
    }
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution['resolution'], resolvedData?: any): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Get conflict details
      const conflictResult = await this.getConflictById(conflictId)
      if (!conflictResult.success || !conflictResult.conflict) {
        return { success: false, error: 'Conflict not found' }
      }

      const conflict = conflictResult.conflict

      // Apply resolution
      let finalData: any
      switch (resolution) {
        case 'local_wins':
          finalData = conflict.localVersion
          break
        case 'server_wins':
          finalData = conflict.serverVersion
          break
        case 'merge':
          finalData = await this.mergeConflictData(conflict.localVersion, conflict.serverVersion)
          break
        case 'manual':
          if (!resolvedData) {
            return { success: false, error: 'Resolved data required for manual resolution' }
          }
          finalData = resolvedData
          break
        default:
          return { success: false, error: 'Invalid resolution type' }
      }

      // Update conflict record
      const updatedConflict: Partial<ConflictResolution> = {
        resolution,
        resolvedData: finalData,
        resolvedAt: new Date(),
        isResolved: true
      }

      await this.updateConflictInDB(conflictId, updatedConflict)

      // Update the original sync operation
      const operation = this.syncQueue.find(op => op.id === conflict.operationId)
      if (operation) {
        operation.localData = finalData
        operation.conflictResolution = resolution
        operation.status = 'pending' // Re-queue for sync
      }

      return { success: true }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    return this.networkStatus
  }

  async getSyncMetrics(): Promise<SyncMetrics> {
    try {
      const result = await this.db.findOne('sync_metrics', { id: 'current' })
      
      if (result.success && result.data) {
        return result.data as SyncMetrics
      }

      // Return default metrics if none exist
      return {
        totalOperations: 0,
        pendingOperations: this.syncQueue.filter(op => op.status === 'pending').length,
        completedOperations: 0,
        failedOperations: 0,
        conflictOperations: 0,
        averageSyncTime: 0,
        lastSyncTime: new Date(),
        dataTransferred: 0,
        compressionRatio: 0,
        errorRate: 0
      }

    } catch (error) {
      throw new Error(`Failed to get sync metrics: ${(error as Error).message}`)
    }
  }

  // Private helper methods
  private getOfflineCapability(entityType: string): OfflineCapability | undefined {
    return this.OFFLINE_CAPABILITIES.find(cap => cap.entityType === entityType)
  }

  private async checkStorageLimit(entityType: string, limitMB: number): Promise<{
    withinLimit: boolean
    currentSize: number
    limit: number
  }> {
    try {
      const result = await this.db.aggregate('offline_data', [
        { $match: { type: entityType } },
        { $group: { _id: null, totalSize: { $sum: { $bsonSize: '$data' } } } }
      ])

      const currentSizeMB = result.success && result.data?.[0] 
        ? result.data[0].totalSize / (1024 * 1024) 
        : 0

      return {
        withinLimit: currentSizeMB < limitMB,
        currentSize: currentSizeMB,
        limit: limitMB
      }

    } catch (error) {
      return { withinLimit: true, currentSize: 0, limit: limitMB }
    }
  }

  private async cleanupOldData(entityType: string, retentionDays: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    await this.db.deleteMany('offline_data', {
      type: entityType,
      timestamp: { $lt: cutoffDate },
      syncStatus: 'synced'
    })
  }

  private async compressData(data: any): Promise<string> {
    // Simulate data compression (in real implementation, use a compression library)
    const jsonString = JSON.stringify(data)
    return Buffer.from(jsonString).toString('base64')
  }

  private async decompressData(compressedData: string): Promise<any> {
    // Simulate data decompression
    const jsonString = Buffer.from(compressedData, 'base64').toString()
    return JSON.parse(jsonString)
  }

  private async calculateChecksum(data: any): Promise<string> {
    // Simple checksum calculation (in real implementation, use crypto.createHash)
    const jsonString = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  private async getDeviceId(): Promise<string> {
    // Get or generate device ID
    let deviceId = await this.cache.get<string>('device_id')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await this.cache.set('device_id', deviceId, { ttl: 365 * 24 * 60 * 60 }) // 1 year
    }
    return deviceId
  }

  private async storeInLocalDB(offlineData: OfflineData): Promise<void> {
    await this.db.insert('offline_data', offlineData)
  }

  private async retrieveFromLocalDB(filters: any): Promise<{
    success: boolean
    data?: OfflineData[]
    error?: string
  }> {
    return await this.db.findMany('offline_data', filters)
  }

  private async updateInLocalDB(offlineId: string, updates: Partial<OfflineData>): Promise<void> {
    await this.db.update('offline_data', { id: offlineId }, updates)
  }

  private async getOfflineDataById(offlineId: string): Promise<{
    success: boolean
    data?: OfflineData
    error?: string
  }> {
    const result = await this.db.findOne('offline_data', { id: offlineId })
    return {
      success: result.success,
      data: result.data as OfflineData,
      error: result.error
    }
  }

  private async addToSyncQueue(type: SyncOperation['type'], entityType: string, entityId: string, data: any, userId: string): Promise<void> {
    const operation: SyncOperation = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      entityType,
      entityId,
      localData: data,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3
    }

    this.syncQueue.push(operation)
  }

  private async processSyncOperation(operation: SyncOperation): Promise<{
    success: boolean
    conflict?: boolean
    serverData?: any
    error?: string
  }> {
    try {
      // Simulate server sync operation
      // In real implementation, this would make HTTP requests to the server API
      
      const success = Math.random() > 0.1 // 90% success rate
      const conflict = Math.random() < 0.05 // 5% conflict rate

      if (conflict) {
        return {
          success: false,
          conflict: true,
          serverData: { ...operation.localData, serverModified: true }
        }
      }

      if (!success) {
        return {
          success: false,
          error: 'Server sync failed'
        }
      }

      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  private async handleSyncConflict(operation: SyncOperation, serverData: any): Promise<void> {
    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const conflict: ConflictResolution = {
      id: conflictId,
      operationId: operation.id,
      localVersion: operation.localData,
      serverVersion: serverData,
      conflictType: 'data_conflict',
      resolution: 'manual',
      isResolved: false
    }

    await this.storeConflictInDB(conflict)

    // Notify user about conflict
    await this.eventSystem.publishEvent({
      id: `sync_conflict_${conflictId}`,
      type: 'offline_event',
      priority: 'high',
      source: 'offline_manager',
      timestamp: new Date(),
      data: {
        type: 'sync_conflict',
        conflict_id: conflictId,
        operation_id: operation.id,
        entity_type: operation.entityType,
        entity_id: operation.entityId
      }
    })
  }

  private async mergeConflictData(localData: any, serverData: any): Promise<any> {
    // Simple merge strategy - in real implementation, this would be more sophisticated
    return {
      ...serverData,
      ...localData,
      mergedAt: new Date().toISOString()
    }
  }

  private async getConflictById(conflictId: string): Promise<{
    success: boolean
    conflict?: ConflictResolution
    error?: string
  }> {
    const result = await this.db.findOne('sync_conflicts', { id: conflictId })
    return {
      success: result.success,
      conflict: result.data as ConflictResolution,
      error: result.error
    }
  }

  private async storeConflictInDB(conflict: ConflictResolution): Promise<void> {
    await this.db.insert('sync_conflicts', conflict)
  }

  private async updateConflictInDB(conflictId: string, updates: Partial<ConflictResolution>): Promise<void> {
    await this.db.update('sync_conflicts', { id: conflictId }, updates)
  }

  private async updateSyncMetrics(syncResults: { completed: number; failed: number; conflicts: number }): Promise<void> {
    const currentMetrics = await this.getSyncMetrics()
    
    const updatedMetrics: SyncMetrics = {
      totalOperations: currentMetrics.totalOperations + syncResults.completed + syncResults.failed + syncResults.conflicts,
      pendingOperations: this.syncQueue.filter(op => op.status === 'pending').length,
      completedOperations: currentMetrics.completedOperations + syncResults.completed,
      failedOperations: currentMetrics.failedOperations + syncResults.failed,
      conflictOperations: currentMetrics.conflictOperations + syncResults.conflicts,
      averageSyncTime: currentMetrics.averageSyncTime, // Would be calculated from actual sync times
      lastSyncTime: new Date(),
      dataTransferred: currentMetrics.dataTransferred, // Would be calculated from actual data transfer
      compressionRatio: currentMetrics.compressionRatio, // Would be calculated from compression stats
      errorRate: (currentMetrics.failedOperations + syncResults.failed) / (currentMetrics.totalOperations + syncResults.completed + syncResults.failed + syncResults.conflicts)
    }

    await this.db.upsert('sync_metrics', { id: 'current' }, updatedMetrics)
  }

  private setupNetworkMonitoring(): void {
    // Simulate network monitoring
    // In real implementation, this would use navigator.connection API and network event listeners
    
    setInterval(() => {
      const wasOnline = this.networkStatus.isOnline
      this.networkStatus.isOnline = Math.random() > 0.05 // 95% online
      
      if (wasOnline !== this.networkStatus.isOnline) {
        if (this.networkStatus.isOnline) {
          this.networkStatus.lastOnline = new Date()
          this.onNetworkOnline()
        } else {
          this.networkStatus.lastOffline = new Date()
          this.onNetworkOffline()
        }
      }

      // Update connection quality
      this.networkStatus.rtt = 50 + Math.random() * 200 // 50-250ms
      this.networkStatus.downlink = 1 + Math.random() * 10 // 1-11 Mbps
      
    }, 5000) // Check every 5 seconds
  }

  private onNetworkOnline(): void {
    console.log('Network came online - starting background sync')
    this.startBackgroundSync()
  }

  private onNetworkOffline(): void {
    console.log('Network went offline - pausing sync operations')
  }

  private startBackgroundSync(): void {
    if (!this.networkStatus.isOnline) return

    // Start background sync interval
    setInterval(async () => {
      if (this.networkStatus.isOnline && !this.isBackgroundSyncRunning) {
        const networkQuality = this.assessNetworkQuality()
        
        if (networkQuality === 'good' || networkQuality === 'fair') {
          await this.syncWithServer()
        }
      }
    }, 30000) // Sync every 30 seconds
  }

  private assessNetworkQuality(): 'good' | 'fair' | 'poor' {
    const { rtt, downlink } = this.networkStatus
    
    if (rtt < this.NETWORK_THRESHOLDS.GOOD_CONNECTION.rtt && 
        downlink > this.NETWORK_THRESHOLDS.GOOD_CONNECTION.downlink) {
      return 'good'
    }
    
    if (rtt > this.NETWORK_THRESHOLDS.POOR_CONNECTION.rtt || 
        downlink < this.NETWORK_THRESHOLDS.POOR_CONNECTION.downlink) {
      return 'poor'
    }
    
    return 'fair'
  }

  private initializeOfflineManager(): void {
    console.log('Offline-first architecture manager initialized')
  }

  // Public API methods
  public getOfflineCapabilities(): OfflineCapability[] {
    return this.OFFLINE_CAPABILITIES
  }

  public getSyncQueue(): SyncOperation[] {
    return [...this.syncQueue] // Return copy to prevent external modification
  }

  public async getSystemStats() {
    const metrics = await this.getSyncMetrics()
    
    return {
      offlineCapabilities: this.OFFLINE_CAPABILITIES.length,
      supportedEntityTypes: this.OFFLINE_CAPABILITIES.map(cap => cap.entityType),
      totalStorageLimit: this.OFFLINE_CAPABILITIES.reduce((sum, cap) => sum + cap.storageLimit, 0),
      pendingOperations: metrics.pendingOperations,
      syncSuccessRate: metrics.totalOperations > 0 ? (1 - metrics.errorRate) * 100 : 100,
      networkStatus: this.networkStatus.isOnline ? 'online' : 'offline'
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = await this.getSystemStats()
    const metrics = await this.getSyncMetrics()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    // Check error rate
    if (metrics.errorRate > 0.2) { // More than 20% error rate
      status = 'unhealthy'
    } else if (metrics.errorRate > 0.1) { // More than 10% error rate
      status = 'degraded'
    }
    
    // Check pending operations
    if (metrics.pendingOperations > 100) {
      status = status === 'healthy' ? 'degraded' : 'unhealthy'
    }

    return {
      status,
      details: {
        ...stats,
        errorRate: metrics.errorRate,
        pendingOperations: metrics.pendingOperations,
        lastSyncTime: metrics.lastSyncTime,
        backgroundSyncRunning: this.isBackgroundSyncRunning
      }
    }
  }
}

// Singleton instance
let offlineManagerInstance: OfflineManager | null = null

export function getOfflineManager(): OfflineManager {
  if (!offlineManagerInstance) {
    offlineManagerInstance = new OfflineManager()
  }
  return offlineManagerInstance
}

export default OfflineManager
