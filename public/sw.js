/**
 * BloodLink Africa Service Worker
 * 
 * Advanced caching, offline support, and performance optimization
 * for the BloodLink Africa PWA
 */

const CACHE_NAME = 'bloodlink-v2.0.0'
const STATIC_CACHE = 'bloodlink-static-v2.0.0'
const DYNAMIC_CACHE = 'bloodlink-dynamic-v2.0.0'
const API_CACHE = 'bloodlink-api-v2.0.0'

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
}

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
]

// API endpoints cache configuration
const API_CACHE_CONFIG = {
  '/api/blood-requests': {
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    ttl: 300000, // 5 minutes
    maxEntries: 50
  },
  '/api/donors': {
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    ttl: 600000, // 10 minutes
    maxEntries: 100
  },
  '/api/analytics': {
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    ttl: 60000, // 1 minute
    maxEntries: 20
  },
  '/api/auth': {
    strategy: CACHE_STRATEGIES.NETWORK_ONLY,
    ttl: 0,
    maxEntries: 0
  }
}

// Performance metrics
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  offlineRequests: 0
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Caching static assets...')
        return cache.addAll(STATIC_ASSETS)
      }),
      self.skipWaiting()
    ])
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      self.clients.claim()
    ])
  )
})

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStaticAssets(request))
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
    event.respondWith(handleAssets(request))
  } else {
    event.respondWith(handlePageRequest(request))
  }
})

// Handle API requests with intelligent caching
async function handleAPIRequest(request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  
  // Find matching cache config
  const cacheConfig = Object.entries(API_CACHE_CONFIG).find(([pattern]) => 
    pathname.startsWith(pattern)
  )?.[1] || {
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    ttl: 300000,
    maxEntries: 20
  }

  switch (cacheConfig.strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return cacheFirst(request, API_CACHE, cacheConfig)
    
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return networkFirst(request, API_CACHE, cacheConfig)
    
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request, API_CACHE, cacheConfig)
    
    case CACHE_STRATEGIES.NETWORK_ONLY:
      return networkOnly(request)
    
    case CACHE_STRATEGIES.CACHE_ONLY:
      return cacheOnly(request, API_CACHE)
    
    default:
      return networkFirst(request, API_CACHE, cacheConfig)
  }
}

// Handle static assets (Next.js build files)
async function handleStaticAssets(request) {
  return cacheFirst(request, STATIC_CACHE, { ttl: 31536000000 }) // 1 year
}

// Handle other assets (images, fonts, etc.)
async function handleAssets(request) {
  return staleWhileRevalidate(request, DYNAMIC_CACHE, { ttl: 86400000 }) // 1 day
}

// Handle page requests
async function handlePageRequest(request) {
  try {
    // Try network first for pages
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache successful page responses
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
      performanceMetrics.networkRequests++
      return networkResponse
    }
    
    throw new Error('Network response not ok')
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      performanceMetrics.cacheHits++
      return cachedResponse
    }
    
    // Ultimate fallback to offline page
    performanceMetrics.offlineRequests++
    return caches.match('/offline.html')
  }
}

// Cache-first strategy
async function cacheFirst(request, cacheName, config = {}) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse && !isExpired(cachedResponse, config.ttl)) {
    performanceMetrics.cacheHits++
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone()
      await cache.put(request, responseToCache)
      await cleanupCache(cache, config.maxEntries)
      performanceMetrics.networkRequests++
      return networkResponse
    }
    
    // Return stale cache if network fails
    if (cachedResponse) {
      performanceMetrics.cacheHits++
      return cachedResponse
    }
    
    throw new Error('Network response not ok')
  } catch (error) {
    performanceMetrics.cacheMisses++
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'OFFLINE',
          message: 'Request failed and no cached version available'
        }
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Network-first strategy
async function networkFirst(request, cacheName, config = {}) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      const responseToCache = networkResponse.clone()
      await cache.put(request, responseToCache)
      await cleanupCache(cache, config.maxEntries)
      performanceMetrics.networkRequests++
      return networkResponse
    }
    
    throw new Error('Network response not ok')
  } catch (error) {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      performanceMetrics.cacheHits++
      return cachedResponse
    }
    
    performanceMetrics.cacheMisses++
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'OFFLINE',
          message: 'Network request failed and no cached version available'
        }
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName, config = {}) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  // Start network request (don't await)
  const networkResponsePromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone()
      await cache.put(request, responseToCache)
      await cleanupCache(cache, config.maxEntries)
      performanceMetrics.networkRequests++
    }
    return networkResponse
  }).catch(() => null)
  
  // Return cached response immediately if available
  if (cachedResponse && !isExpired(cachedResponse, config.ttl)) {
    performanceMetrics.cacheHits++
    return cachedResponse
  }
  
  // Wait for network response if no cache or expired
  const networkResponse = await networkResponsePromise
  
  if (networkResponse && networkResponse.ok) {
    return networkResponse
  }
  
  // Return stale cache as last resort
  if (cachedResponse) {
    performanceMetrics.cacheHits++
    return cachedResponse
  }
  
  performanceMetrics.cacheMisses++
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'OFFLINE',
        message: 'No cached version available'
      }
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

// Network-only strategy
async function networkOnly(request) {
  performanceMetrics.networkRequests++
  return fetch(request)
}

// Cache-only strategy
async function cacheOnly(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    performanceMetrics.cacheHits++
    return cachedResponse
  }
  
  performanceMetrics.cacheMisses++
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'NOT_CACHED',
        message: 'Resource not available in cache'
      }
    }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

// Check if cached response is expired
function isExpired(response, ttl) {
  if (!ttl) return false
  
  const cachedTime = response.headers.get('sw-cached-time')
  if (!cachedTime) return true
  
  return Date.now() - parseInt(cachedTime) > ttl
}

// Clean up cache to maintain size limits
async function cleanupCache(cache, maxEntries) {
  if (!maxEntries) return
  
  const keys = await cache.keys()
  
  if (keys.length > maxEntries) {
    // Remove oldest entries (simple FIFO)
    const keysToDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(keysToDelete.map(key => cache.delete(key)))
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync())
  }
})

async function handleBackgroundSync() {
  // Handle queued offline actions
  const offlineActions = await getOfflineActions()
  
  for (const action of offlineActions) {
    try {
      await fetch(action.url, action.options)
      await removeOfflineAction(action.id)
    } catch (error) {
      console.error('Background sync failed for action:', action.id, error)
    }
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  const data = event.data.json()
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.urgency === 'high',
    tag: data.tag || 'default'
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  const data = event.notification.data
  
  if (data && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    )
  }
})

// Message handling for cache management
self.addEventListener('message', (event) => {
  const { type, payload } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'GET_CACHE_STATS':
      event.ports[0].postMessage({
        type: 'CACHE_STATS',
        payload: performanceMetrics
      })
      break
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          payload: { success: true }
        })
      })
      break
      
    case 'PREFETCH_RESOURCES':
      prefetchResources(payload.urls).then(() => {
        event.ports[0].postMessage({
          type: 'PREFETCH_COMPLETE',
          payload: { success: true }
        })
      })
      break
  }
})

// Utility functions
async function getOfflineActions() {
  // In a real implementation, you would retrieve from IndexedDB
  return []
}

async function removeOfflineAction(id) {
  // In a real implementation, you would remove from IndexedDB
}

async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(name => caches.delete(name)))
  performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    networkRequests: 0,
    offlineRequests: 0
  }
}

async function prefetchResources(urls) {
  const cache = await caches.open(DYNAMIC_CACHE)
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          await cache.put(url, response)
        }
      } catch (error) {
        console.error('Prefetch failed for:', url, error)
      }
    })
  )
}

console.log('BloodLink Africa Service Worker loaded')
