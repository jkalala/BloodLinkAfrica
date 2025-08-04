"use client"

export interface OfflineData {
  id: string
  type: 'blood_request' | 'donor_response' | 'profile_update' | 'location_update'
  data: unknown
  timestamp: string
  synced: boolean
  retryCount: number
}

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

export class OfflineSyncService {
  private dbName = 'bloodconnect-offline'
  private dbVersion = 1
  private db: IDBDatabase | null = null
  private isOnline = navigator.onLine
  private syncInProgress = false
  private syncQueue: Set<string> = new Set()

  constructor() {
    this.initialize()
    this.setupEventListeners()
  }

  /**
   * Initialize IndexedDB database
   */
  private async initialize(): Promise<void> {
    try {
      this.db = await this.openDatabase()
      console.log('✅ Offline sync database initialized')
    } catch (error) {
      console.error('Failed to initialize offline sync database:', error)
    }
  }

  /**
   * Open IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create offline data store
        if (!db.objectStoreNames.contains('offline_data')) {
          const store = db.createObjectStore('offline_data', { keyPath: 'id' })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('synced', 'synced', { unique: false })
        }

        // Create cached data store
        if (!db.objectStoreNames.contains('cached_data')) {
          const cacheStore = db.createObjectStore('cached_data', { keyPath: 'key' })
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false })
          cacheStore.createIndex('type', 'type', { unique: false })
        }
      }
    })
  }

  /**
   * Setup event listeners for online/offline detection
   */
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Back online - starting sync')
      this.isOnline = true
      this.syncPendingData()
    })

    window.addEventListener('offline', () => {
      console.log('📴 Gone offline - queuing data locally')
      this.isOnline = false
    })

    // Listen for visibility change to sync when app becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline && !this.syncInProgress) {
        this.syncPendingData()
      }
    })
  }

  /**
   * Store data offline when connection is unavailable
   */
  async storeOfflineData(type: OfflineData['type'], data: unknown): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const offlineData: OfflineData = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_data'], 'readwrite')
      const store = transaction.objectStore('offline_data')
      const request = store.add(offlineData)

      request.onsuccess = () => {
        console.log('📦 Data stored offline:', offlineData.id)
        resolve(offlineData.id)
      }

      request.onerror = () => {
        reject(new Error('Failed to store offline data'))
      }
    })
  }

  /**
   * Get all pending offline data
   */
  async getPendingData(): Promise<OfflineData[]> {
    if (!this.db) {
      return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_data'], 'readonly')
      const store = transaction.objectStore('offline_data')
      const index = store.index('synced')
      const request = index.getAll(false)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new Error('Failed to get pending data'))
      }
    })
  }

  /**
   * Sync pending data with server
   */
  async syncPendingData(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress or offline'] }
    }

    this.syncInProgress = true
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] }

    try {
      const pendingData = await this.getPendingData()
      console.log(`🔄 Syncing ${pendingData.length} pending items`)

      for (const item of pendingData) {
        try {
          if (this.syncQueue.has(item.id)) {
            continue // Skip if already being processed
          }

          this.syncQueue.add(item.id)
          
          const success = await this.syncSingleItem(item)
          
          if (success) {
            await this.markAsSynced(item.id)
            result.synced++
            console.log('✅ Synced item:', item.id)
          } else {
            await this.incrementRetryCount(item.id)
            result.failed++
            result.errors.push(`Failed to sync ${item.type} item: ${item.id}`)
          }
          
          this.syncQueue.delete(item.id)
        } catch (error) {
          console.error('Error syncing item:', error)
          result.failed++
          result.errors.push(`Error syncing ${item.id}: ${error}`)
          this.syncQueue.delete(item.id)
        }
      }

      // Clean up old synced items
      await this.cleanupSyncedData()
      
    } catch (error) {
      console.error('Error during sync:', error)
      result.success = false
      result.errors.push(`Sync error: ${error}`)
    } finally {
      this.syncInProgress = false
    }

    return result
  }

  /**
   * Sync a single item with the server
   */
  private async syncSingleItem(item: OfflineData): Promise<boolean> {
    try {
      let endpoint = ''
      let method = 'POST'
      let body = item.data

      // Determine endpoint based on item type
      switch (item.type) {
        case 'blood_request':
          endpoint = '/api/blood-requests'
          break
        case 'donor_response':
          endpoint = '/api/donor-responses'
          break
        case 'profile_update':
          endpoint = '/api/profile'
          method = 'PUT'
          break
        case 'location_update':
          endpoint = '/api/location/update'
          break
        default:
          console.warn('Unknown sync item type:', item.type)
          return false
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          ...body,
          _offline_id: item.id,
          _offline_timestamp: item.timestamp
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Authentication error - might need to re-login
          console.warn('Authentication error during sync - user may need to re-login')
        }
        return false
      }

      const result = await response.json()
      
      // Store the server response for reference
      if (result.id) {
        await this.storeServerResponse(item.id, result)
      }

      return true
    } catch (error) {
      console.error('Error syncing single item:', error)
      return false
    }
  }

  /**
   * Mark item as synced
   */
  private async markAsSynced(id: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_data'], 'readwrite')
      const store = transaction.objectStore('offline_data')
      const request = store.get(id)

      request.onsuccess = () => {
        const data = request.result
        if (data) {
          data.synced = true
          data.syncedAt = new Date().toISOString()
          
          const updateRequest = store.put(data)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(new Error('Failed to mark as synced'))
        } else {
          resolve() // Item doesn't exist anymore
        }
      }

      request.onerror = () => {
        reject(new Error('Failed to get item for sync marking'))
      }
    })
  }

  /**
   * Increment retry count for failed sync
   */
  private async incrementRetryCount(id: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_data'], 'readwrite')
      const store = transaction.objectStore('offline_data')
      const request = store.get(id)

      request.onsuccess = () => {
        const data = request.result
        if (data) {
          data.retryCount = (data.retryCount || 0) + 1
          data.lastRetry = new Date().toISOString()
          
          const updateRequest = store.put(data)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(new Error('Failed to update retry count'))
        } else {
          resolve()
        }
      }

      request.onerror = () => {
        reject(new Error('Failed to get item for retry count update'))
      }
    })
  }

  /**
   * Store server response for reference
   */
  private async storeServerResponse(offlineId: string, response: unknown): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached_data'], 'readwrite')
      const store = transaction.objectStore('cached_data')
      
      const cacheData = {
        key: `sync_response_${offlineId}`,
        type: 'sync_response',
        data: response,
        timestamp: new Date().toISOString()
      }
      
      const request = store.put(cacheData)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to store server response'))
    })
  }

  /**
   * Clean up old synced data
   */
  private async cleanupSyncedData(): Promise<void> {
    if (!this.db) return

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 7) // Keep synced items for 7 days

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_data'], 'readwrite')
      const store = transaction.objectStore('offline_data')
      const index = store.index('synced')
      const request = index.openCursor(IDBKeyRange.only(true))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const data = cursor.value
          const syncedAt = new Date(data.syncedAt || data.timestamp)
          
          if (syncedAt < cutoffDate) {
            cursor.delete()
          }
          
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => {
        reject(new Error('Failed to cleanup synced data'))
      }
    })
  }

  /**
   * Cache data for offline access
   */
  async cacheData(key: string, type: string, data: unknown, ttl?: number): Promise<void> {
    if (!this.db) return

    const expiresAt = ttl ? new Date(Date.now() + ttl).toISOString() : null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached_data'], 'readwrite')
      const store = transaction.objectStore('cached_data')
      
      const cacheData = {
        key,
        type,
        data,
        timestamp: new Date().toISOString(),
        expiresAt
      }
      
      const request = store.put(cacheData)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to cache data'))
    })
  }

  /**
   * Get cached data
   */
  async getCachedData(key: string): Promise<unknown> {
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached_data'], 'readonly')
      const store = transaction.objectStore('cached_data')
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        if (!result) {
          resolve(null)
          return
        }

        // Check if expired
        if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
          // Delete expired data
          const deleteTransaction = this.db!.transaction(['cached_data'], 'readwrite')
          const deleteStore = deleteTransaction.objectStore('cached_data')
          deleteStore.delete(key)
          resolve(null)
          return
        }

        resolve(result.data)
      }

      request.onerror = () => {
        reject(new Error('Failed to get cached data'))
      }
    })
  }

  /**
   * Force sync now (manual trigger)
   */
  async forceSync(): Promise<SyncResult> {
    if (!this.isOnline) {
      return { success: false, synced: 0, failed: 0, errors: ['Device is offline'] }
    }

    return this.syncPendingData()
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    pendingCount: number
    lastSync: string | null
    isOnline: boolean
    syncInProgress: boolean
  }> {
    const pendingData = await this.getPendingData()
    
    return {
      pendingCount: pendingData.length,
      lastSync: localStorage.getItem('lastSyncTime'),
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress
    }
  }

  /**
   * Clear all offline data (use with caution)
   */
  async clearOfflineData(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_data', 'cached_data'], 'readwrite')
      
      const clearOffline = transaction.objectStore('offline_data').clear()
      const clearCache = transaction.objectStore('cached_data').clear()
      
      Promise.all([
        new Promise((res, rej) => {
          clearOffline.onsuccess = () => res(null)
          clearOffline.onerror = () => rej(new Error('Failed to clear offline data'))
        }),
        new Promise((res, rej) => {
          clearCache.onsuccess = () => res(null)
          clearCache.onerror = () => rej(new Error('Failed to clear cached data'))
        })
      ]).then(() => {
        console.log('🗑️ All offline data cleared')
        resolve()
      }).catch(reject)
    })
  }
}

// Singleton instance
let offlineSyncServiceInstance: OfflineSyncService | null = null

export const getOfflineSyncService = (): OfflineSyncService => {
  if (!offlineSyncServiceInstance) {
    offlineSyncServiceInstance = new OfflineSyncService()
  }
  return offlineSyncServiceInstance
}

// Export singleton instance for direct access
export const offlineSyncService = getOfflineSyncService()