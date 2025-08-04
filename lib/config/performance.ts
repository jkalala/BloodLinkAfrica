/**
 * Performance Configuration
 * 
 * Centralized configuration for all performance-related settings
 * including caching, monitoring, and optimization parameters
 */

export const PERFORMANCE_CONFIG = {
  // Cache Configuration
  cache: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: 'bloodlink:',
      defaultTTL: 300, // 5 minutes
      maxRetries: 3,
      retryDelayOnFailover: 100,
    },
    
    strategies: {
      // API endpoint caching strategies
      '/api/blood-requests': {
        strategy: 'stale-while-revalidate',
        ttl: 300, // 5 minutes
        maxEntries: 50,
        tags: ['blood-requests']
      },
      '/api/donors': {
        strategy: 'stale-while-revalidate',
        ttl: 600, // 10 minutes
        maxEntries: 100,
        tags: ['donors']
      },
      '/api/analytics': {
        strategy: 'network-first',
        ttl: 60, // 1 minute
        maxEntries: 20,
        tags: ['analytics']
      },
      '/api/auth': {
        strategy: 'network-only',
        ttl: 0,
        maxEntries: 0,
        tags: []
      },
      '/api/ml': {
        strategy: 'cache-first',
        ttl: 1800, // 30 minutes
        maxEntries: 30,
        tags: ['ml', 'predictions']
      }
    },
    
    // Browser cache settings
    browser: {
      staticAssets: {
        maxAge: 31536000, // 1 year
        immutable: true
      },
      apiResponses: {
        maxAge: 300, // 5 minutes
        staleWhileRevalidate: 86400 // 1 day
      },
      images: {
        maxAge: 2592000, // 30 days
        formats: ['webp', 'avif']
      }
    }
  },

  // Performance Monitoring
  monitoring: {
    enabled: process.env.NODE_ENV === 'production',
    
    // Web Vitals thresholds
    webVitals: {
      lcp: { good: 2500, poor: 4000 }, // Largest Contentful Paint
      fid: { good: 100, poor: 300 },   // First Input Delay
      cls: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
      fcp: { good: 1800, poor: 3000 }, // First Contentful Paint
      ttfb: { good: 800, poor: 1800 }  // Time to First Byte
    },
    
    // API performance thresholds
    api: {
      responseTime: {
        target: 100,    // Target response time in ms
        warning: 500,   // Warning threshold
        critical: 1000  // Critical threshold
      },
      errorRate: {
        target: 0.1,    // Target error rate (%)
        warning: 1.0,   // Warning threshold
        critical: 5.0   // Critical threshold
      }
    },
    
    // Sampling rates
    sampling: {
      webVitals: 1.0,     // 100% sampling for Web Vitals
      apiCalls: 0.1,      // 10% sampling for API calls
      errors: 1.0,        // 100% sampling for errors
      customMetrics: 0.5  // 50% sampling for custom metrics
    }
  },

  // Database Optimization
  database: {
    connectionPool: {
      maxConnections: 10,
      idleTimeout: 30000,
      connectionTimeout: 5000,
      retryAttempts: 3
    },
    
    queryOptimization: {
      defaultTimeout: 30000,
      slowQueryThreshold: 1000,
      enableExplain: process.env.NODE_ENV === 'development',
      batchSize: 100
    },
    
    caching: {
      enabled: true,
      defaultTTL: 300,
      maxCacheSize: 1000
    }
  },

  // Code Splitting & Lazy Loading
  codeSplitting: {
    enabled: true,
    
    // Route-based splitting
    routes: {
      preloadDelay: 200,     // Delay before preloading on hover
      retryAttempts: 3,      // Retry attempts for failed loads
      timeout: 15000,        // Timeout for component loading
      chunkSizeWarning: 244000 // Warn if chunk exceeds this size
    },
    
    // Component-based splitting
    components: {
      threshold: 50000,      // Split components larger than this
      preloadCritical: true, // Preload critical components
      lazyLoadImages: true   // Lazy load images by default
    }
  },

  // Compression & Minification
  compression: {
    enabled: process.env.NODE_ENV === 'production',
    
    gzip: {
      enabled: true,
      level: 6,
      threshold: 1024,
      excludeTypes: ['image/', 'video/', 'audio/']
    },
    
    brotli: {
      enabled: true,
      quality: 6,
      threshold: 1024
    },
    
    minification: {
      removeConsole: true,
      removeDebugger: true,
      dropUnusedImports: true
    }
  },

  // Rate Limiting
  rateLimit: {
    enabled: true,
    
    // Default limits
    default: {
      windowMs: 60000,      // 1 minute
      maxRequests: 100,     // Max requests per window
      skipSuccessfulRequests: false
    },
    
    // Endpoint-specific limits
    endpoints: {
      '/api/auth/login': {
        windowMs: 900000,   // 15 minutes
        maxRequests: 5      // Max 5 login attempts
      },
      '/api/auth/register': {
        windowMs: 3600000,  // 1 hour
        maxRequests: 3      // Max 3 registration attempts
      },
      '/api/blood-requests': {
        windowMs: 60000,    // 1 minute
        maxRequests: 50     // Max 50 requests per minute
      },
      '/api/ml': {
        windowMs: 60000,    // 1 minute
        maxRequests: 20     // Max 20 ML requests per minute
      }
    }
  },

  // CDN & Asset Optimization
  assets: {
    cdn: {
      enabled: process.env.NODE_ENV === 'production',
      domain: process.env.CDN_DOMAIN,
      regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1']
    },
    
    optimization: {
      images: {
        quality: 85,
        formats: ['webp', 'avif', 'jpeg'],
        sizes: [640, 768, 1024, 1280, 1920],
        placeholder: 'blur'
      },
      
      fonts: {
        preload: ['Inter-Regular.woff2', 'Inter-Medium.woff2'],
        display: 'swap',
        fallback: 'system-ui, sans-serif'
      },
      
      icons: {
        sprite: true,
        inline: true,
        optimize: true
      }
    }
  },

  // Service Worker & PWA
  serviceWorker: {
    enabled: process.env.NODE_ENV === 'production',
    
    caching: {
      staticAssets: {
        strategy: 'cache-first',
        maxAge: 31536000 // 1 year
      },
      
      apiResponses: {
        strategy: 'stale-while-revalidate',
        maxAge: 300 // 5 minutes
      },
      
      pages: {
        strategy: 'network-first',
        maxAge: 86400 // 1 day
      }
    },
    
    backgroundSync: {
      enabled: true,
      maxRetries: 3,
      retryDelay: 5000
    },
    
    pushNotifications: {
      enabled: true,
      vapidKeys: {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY
      }
    }
  },

  // Bundle Analysis
  bundleAnalysis: {
    enabled: process.env.ANALYZE === 'true',
    
    thresholds: {
      maxBundleSize: 500000,    // 500KB
      maxChunkSize: 244000,     // 244KB
      maxAssetSize: 100000      // 100KB
    },
    
    warnings: {
      duplicatePackages: true,
      unusedExports: true,
      largeDependencies: true
    }
  },

  // Development Tools
  development: {
    hotReload: {
      enabled: process.env.NODE_ENV === 'development',
      overlay: true,
      quiet: false
    },
    
    profiling: {
      enabled: process.env.PROFILE === 'true',
      includeNodeModules: false,
      outputPath: './performance-profile'
    },
    
    debugging: {
      sourceMap: process.env.NODE_ENV === 'development',
      verbose: process.env.DEBUG === 'true'
    }
  }
}

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
  // Production optimizations
  PERFORMANCE_CONFIG.cache.redis.defaultTTL = 600 // 10 minutes
  PERFORMANCE_CONFIG.monitoring.sampling.apiCalls = 0.05 // 5% sampling
  PERFORMANCE_CONFIG.database.connectionPool.maxConnections = 20
}

if (process.env.NODE_ENV === 'development') {
  // Development settings
  PERFORMANCE_CONFIG.cache.redis.defaultTTL = 60 // 1 minute
  PERFORMANCE_CONFIG.monitoring.sampling.apiCalls = 1.0 // 100% sampling
  PERFORMANCE_CONFIG.rateLimit.enabled = false // Disable rate limiting
}

// Utility functions
export const getPerformanceConfig = (section?: keyof typeof PERFORMANCE_CONFIG) => {
  return section ? PERFORMANCE_CONFIG[section] : PERFORMANCE_CONFIG
}

export const isPerformanceMonitoringEnabled = () => {
  return PERFORMANCE_CONFIG.monitoring.enabled
}

export const getCacheStrategy = (endpoint: string) => {
  const strategies = PERFORMANCE_CONFIG.cache.strategies
  const matchingStrategy = Object.entries(strategies).find(([pattern]) => 
    endpoint.startsWith(pattern)
  )
  
  return matchingStrategy ? matchingStrategy[1] : {
    strategy: 'network-first',
    ttl: 300,
    maxEntries: 20,
    tags: []
  }
}

export const getRateLimit = (endpoint: string) => {
  const limits = PERFORMANCE_CONFIG.rateLimit.endpoints
  return limits[endpoint] || PERFORMANCE_CONFIG.rateLimit.default
}

export const shouldEnableFeature = (feature: string) => {
  const features = {
    'service-worker': PERFORMANCE_CONFIG.serviceWorker.enabled,
    'compression': PERFORMANCE_CONFIG.compression.enabled,
    'monitoring': PERFORMANCE_CONFIG.monitoring.enabled,
    'rate-limiting': PERFORMANCE_CONFIG.rateLimit.enabled,
    'code-splitting': PERFORMANCE_CONFIG.codeSplitting.enabled
  }
  
  return features[feature] ?? false
}

export default PERFORMANCE_CONFIG
