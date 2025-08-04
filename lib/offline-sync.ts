"use client"

type SyncItem = {
  id: string
  type: "donation" | "request" | "response"
  data: unknown
  timestamp: number
  synced: boolean
}

export class OfflineSync {
  private storageKey = "bloodlink_offline_data"
  private syncQueue: SyncItem[] = []
  private isOnline = true
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor() {
    if (typeof window !== "undefined") {
      // Load any existing sync queue from localStorage
      this.loadQueue()

      // Set up online/offline event listeners
      window.addEventListener("online", this.handleOnline)
      window.addEventListener("offline", this.handleOffline)

      // Check initial online status
      this.isOnline = navigator.onLine

      // Initialize IndexedDB
      this.initIndexedDB()

      // Register for background sync if available
      this.registerBackgroundSync()
    }
  }

  private initIndexedDB() {
    if (!("indexedDB" in window)) {
      console.warn("IndexedDB not supported")
      return
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("bloodlink-db", 1)

      request.onerror = (event) => {
        console.error("IndexedDB error:", event)
        reject("Error opening database")
      }

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains("offline-requests")) {
          db.createObjectStore("offline-requests", { keyPath: "id" })
        }

        if (!db.objectStoreNames.contains("offline-data")) {
          db.createObjectStore("offline-data", { keyPath: "key" })
        }
      }
    })
  }

  private registerBackgroundSync() {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register("bloodlink-sync").catch((err) => {
          console.error("Background sync registration failed:", err)
        })
      })
    }
  }

  private loadQueue(): void {
    try {
      const storedQueue = localStorage.getItem(this.storageKey)
      if (storedQueue) {
        this.syncQueue = JSON.parse(storedQueue)
      }
    } catch (error) {
      console.error("Failed to load sync queue:", error)
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.syncQueue))
    } catch (error) {
      console.error("Failed to save sync queue:", error)
    }
  }

  private handleOnline = (): void => {
    this.isOnline = true
    this.attemptSync()
  }

  private handleOffline = (): void => {
    this.isOnline = false
  }

  public addToQueue(type: "donation" | "request" | "response", data: unknown): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const item: SyncItem = {
      id,
      type,
      data,
      timestamp: Date.now(),
      synced: false,
    }

    this.syncQueue.push(item)
    this.saveQueue()

    // Also save to IndexedDB for service worker access
    this.saveToIndexedDB(item)

    // If we're online, attempt to sync immediately
    if (this.isOnline) {
      this.attemptSync()
    } else {
      // If offline, attempt to send via SMS if it's urgent
      if (type === "request" && data.urgency === "emergency") {
        this.sendViaSMS(item)
      }
    }

    return id
  }

  private saveToIndexedDB(item: SyncItem): void {
    if (!this.dbPromise) return

    this.dbPromise
      .then((db) => {
        const tx = db.transaction("offline-requests", "readwrite")
        const store = tx.objectStore("offline-requests")
        store.put({
          id: item.id,
          type: item.type,
          data: item.data,
          timestamp: item.timestamp,
        })
      })
      .catch((err) => {
        console.error("Error saving to IndexedDB:", err)
      })
  }

  public async storeData(key: string, data: unknown): Promise<void> {
    if (!this.dbPromise) return

    try {
      const db = await this.dbPromise
      const tx = db.transaction("offline-data", "readwrite")
      const store = tx.objectStore("offline-data")
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ key, data })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error("Error storing data:", error)
    }
  }

  public async getData(key: string): Promise<unknown> {
    if (!this.dbPromise) return null

    try {
      const db = await this.dbPromise
      const tx = db.transaction("offline-data", "readonly")
      const store = tx.objectStore("offline-data")
      return new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result?.data || null)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error("Error getting data:", error)
      return null
    }
  }

  private async attemptSync(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) return

    const unsynced = this.syncQueue.filter((item) => !item.synced)

    for (const item of unsynced) {
      try {
        // In a real app, this would make API calls to sync the data
        const endpoint = `/api/${item.type}s` // e.g., /api/requests, /api/donations
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item.data),
        })

        if (response.ok) {
          // Mark as synced
          item.synced = true

          // Remove from IndexedDB
          if (this.dbPromise) {
            const db = await this.dbPromise
            const tx = db.transaction("offline-requests", "readwrite")
            const store = tx.objectStore("offline-requests")
            store.delete(item.id)
          }
        } else {
          console.error(`Failed to sync item ${item.id}: Server returned ${response.status}`)
        }
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error)
      }
    }

    // Update the stored queue
    this.saveQueue()

    // Remove successfully synced items that are older than 24 hours
    this.cleanupQueue()
  }

  private sendViaSMS(item: SyncItem): void {
    // In a real app, this would use a service to send SMS
    console.log(`Sending emergency request via SMS: ${JSON.stringify(item.data)}`)
  }

  private cleanupQueue(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    this.syncQueue = this.syncQueue.filter((item) => {
      // Keep all unsynced items
      if (!item.synced) return true

      // Keep synced items less than 24 hours old
      return item.timestamp > oneDayAgo
    })

    this.saveQueue()
  }

  public getQueueStatus(): { total: number; unsynced: number } {
    const unsynced = this.syncQueue.filter((item) => !item.synced).length
    return {
      total: this.syncQueue.length,
      unsynced,
    }
  }

  public isNetworkAvailable(): boolean {
    return this.isOnline
  }

  public cleanup(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline)
      window.removeEventListener("offline", this.handleOffline)
    }
  }
}

// Create a singleton instance
let offlineSyncInstance: OfflineSync | null = null

export function getOfflineSync(): OfflineSync {
  if (!offlineSyncInstance && typeof window !== "undefined") {
    offlineSyncInstance = new OfflineSync()
  }
  return offlineSyncInstance as OfflineSync
}
