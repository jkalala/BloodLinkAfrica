// Service Worker for BloodLink App

const CACHE_NAME = "bloodlink-cache-v1"
const OFFLINE_URL = "/offline.html"

// Assets to cache
const ASSETS_TO_CACHE = ["/", "/offline.html", "/favicon.ico", "/placeholder.svg"]

// Install event - cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache")
        return cache.addAll(ASSETS_TO_CACHE)
      })
      .then(() => self.skipWaiting()),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  // Skip cross-origin requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL)
      }),
    )
  } else {
    event.respondWith(
      caches
        .match(event.request)
        .then((response) => {
          return (
            response ||
            fetch(event.request).then((fetchResponse) => {
              // Cache important assets
              if (shouldCache(event.request.url)) {
                return caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, fetchResponse.clone())
                  return fetchResponse
                })
              }
              return fetchResponse
            })
          )
        })
        .catch(() => {
          // Return the offline page for HTML requests
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match(OFFLINE_URL)
          }
        }),
    )
  }
})

// Push event - handle push notifications
self.addEventListener("push", (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      data = {
        title: "BloodLink",
        body: event.data.text(),
      }
    }
  }

  const title = data.title || "BloodLink Alert"
  const options = {
    body: data.body || "New blood donation request",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: data.url || "/",
    vibrate: [100, 50, 100],
    actions: [
      {
        action: "accept",
        title: "Accept",
      },
      {
        action: "decline",
        title: "Decline",
      },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "accept") {
    // Handle accept action
    event.waitUntil(clients.openWindow("/alerts?action=accept&id=" + (event.notification.data.requestId || "")))
  } else if (event.action === "decline") {
    // Handle decline action
    event.waitUntil(clients.openWindow("/alerts?action=decline&id=" + (event.notification.data.requestId || "")))
  } else {
    // Handle notification click
    event.waitUntil(clients.openWindow(event.notification.data || "/"))
  }
})

// Helper function to determine if a URL should be cached
function shouldCache(url) {
  const urlObj = new URL(url)
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf)$/.test(urlObj.pathname)
  return isStaticAsset
}

// Sync event - handle background sync
self.addEventListener("sync", (event) => {
  if (event.tag === "bloodlink-sync") {
    event.waitUntil(syncData())
  }
})

// Function to sync data with the server
async function syncData() {
  try {
    // Get data from IndexedDB
    const db = await openDatabase()
    const tx = db.transaction("offline-requests", "readonly")
    const store = tx.objectStore("offline-requests")
    const requests = await store.getAll()

    // Process each request
    for (const request of requests) {
      try {
        // Try to send the request to the server
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        })

        if (response.ok) {
          // If successful, remove from IndexedDB
          const deleteTx = db.transaction("offline-requests", "readwrite")
          const deleteStore = deleteTx.objectStore("offline-requests")
          await deleteStore.delete(request.id)
        }
      } catch (error) {
        console.error("Error syncing request:", error)
      }
    }
  } catch (error) {
    console.error("Error in syncData:", error)
  }
}

// Function to open IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bloodlink-db", 1)

    request.onerror = (event) => {
      reject("Error opening database")
    }

    request.onsuccess = (event) => {
      resolve(event.target.result)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains("offline-requests")) {
        db.createObjectStore("offline-requests", { keyPath: "id" })
      }
    }
  })
}

// Install prompt handling
self.addEventListener('beforeinstallprompt', (event) => {
  console.log('[ServiceWorker] Before install prompt')
  // Prevent the mini-infobar from appearing on mobile
  event.preventDefault()
  
  // Notify clients that install is available
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'INSTALL_AVAILABLE',
        payload: { canInstall: true }
      })
    })
  })
})

// App installed event
self.addEventListener('appinstalled', (event) => {
  console.log('[ServiceWorker] App installed')
  
  // Notify clients that app was installed
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'APP_INSTALLED',
        payload: { installed: true }
      })
    })
  })
})
