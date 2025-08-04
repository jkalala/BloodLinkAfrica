/**
 * Comprehensive Security Middleware System
 * 
 * Integrated security middleware for Express.js applications
 * with HIPAA compliance, threat detection, and audit logging
 */

const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const { body, validationResult } = require('express-validator')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const { HIPAAComplianceFramework } = require('./hipaa-compliance')
const { ThreatDetectionSystem } = require('./threat-detection')
const { AuditTrailSystem } = require('./audit-trail')

class SecurityMiddlewareSystem {
  constructor(config = {}) {
    this.config = {
      jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
      jwtExpiresIn: '1h',
      refreshTokenExpiresIn: '7d',
      bcryptRounds: 12,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxLoginAttempts: 5,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100, // requests per window
      enableCSP: true,
      enableHSTS: true,
      enableXSSProtection: true,
      ...config
    }

    // Initialize security systems
    this.hipaaCompliance = new HIPAAComplianceFramework(this.config)
    this.threatDetection = new ThreatDetectionSystem(this.config)
    this.auditTrail = new AuditTrailSystem(this.config)
    
    // Track failed login attempts
    this.loginAttempts = new Map()
    this.blockedIPs = new Set()
    
    this.initialize()
  }

  async initialize() {
    console.log('🔐 Initializing Security Middleware System...')
    
    try {
      await this.hipaaCompliance.initialize()
      await this.threatDetection.initialize()
      await this.auditTrail.initialize()
      
      console.log('✅ Security Middleware System initialized')
    } catch (error) {
      console.error('❌ Security Middleware initialization failed:', error)
      throw error
    }
  }

  // Core Security Middleware
  getSecurityMiddleware() {
    return [
      this.compressionMiddleware(),
      this.helmetMiddleware(),
      this.corsMiddleware(),
      this.rateLimitMiddleware(),
      this.requestLoggingMiddleware(),
      this.threatDetectionMiddleware(),
      this.inputValidationMiddleware(),
      this.csrfProtectionMiddleware()
    ]
  }

  // Helmet Security Headers
  helmetMiddleware() {
    return helmet({
      contentSecurityPolicy: this.config.enableCSP ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://api.bloodlink.africa"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      } : false,
      hsts: this.config.enableHSTS ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      } : false,
      xssFilter: this.config.enableXSSProtection,
      noSniff: true,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  }

  // CORS Configuration
  corsMiddleware() {
    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true)
        
        if (this.config.corsOrigins.includes(origin)) {
          callback(null, true)
        } else {
          this.auditTrail.logSecurityEvent({
            eventType: 'cors_violation',
            severity: 'medium',
            description: `Blocked CORS request from unauthorized origin: ${origin}`,
            source: origin
          })
          callback(new Error('Not allowed by CORS'))
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining']
    })
  }

  // Rate Limiting
  rateLimitMiddleware() {
    return rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMax,
      message: {
        error: 'Too many requests from this IP, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: async (req, res) => {
        await this.auditTrail.logSecurityEvent({
          eventType: 'rate_limit_exceeded',
          severity: 'medium',
          description: `Rate limit exceeded for IP: ${req.ip}`,
          source: req.ip,
          userAgent: req.get('User-Agent')
        })
        
        res.status(429).json({
          success: false,
          error: 'Too many requests from this IP, please try again later',
          code: 'RATE_LIMIT_EXCEEDED'
        })
      },
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health'
      }
    })
  }

  // Compression Middleware
  compressionMiddleware() {
    return compression({
      filter: (req, res) => {
        // Don't compress responses with this request header
        if (req.headers['x-no-compression']) {
          return false
        }
        // Fallback to standard filter function
        return compression.filter(req, res)
      },
      level: 6,
      threshold: 1024
    })
  }

  // Request Logging and Monitoring
  requestLoggingMiddleware() {
    return async (req, res, next) => {
      const startTime = Date.now()
      const requestId = crypto.randomUUID()
      
      // Add request ID to request object
      req.requestId = requestId
      
      // Log request start
      await this.auditTrail.logEvent('system_access', {
        action: 'request_start',
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        requestId
      }, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
        source: 'http_middleware'
      })

      // Override res.json to log response
      const originalJson = res.json
      res.json = function(data) {
        const responseTime = Date.now() - startTime
        
        // Log response (async, don't wait)
        setImmediate(async () => {
          await this.auditTrail.logEvent('system_access', {
            action: 'request_complete',
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            requestId
          }, {
            ipAddress: req.ip,
            requestId,
            source: 'http_middleware'
          })
        })
        
        return originalJson.call(this, data)
      }.bind(this)

      next()
    }
  }

  // Threat Detection Middleware
  threatDetectionMiddleware() {
    return async (req, res, next) => {
      try {
        const analysis = await this.threatDetection.analyzeRequest(req, {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: req.requestId,
          userId: req.user?.id,
          sessionId: req.session?.id
        })

        // Add threat analysis to request
        req.threatAnalysis = analysis

        // Handle threat response
        switch (analysis.action) {
          case 'block':
            return res.status(403).json({
              success: false,
              error: 'Request blocked due to security policy',
              code: 'SECURITY_BLOCK'
            })
          
          case 'challenge':
            // Require additional authentication
            if (!req.user || !req.user.mfaVerified) {
              return res.status(401).json({
                success: false,
                error: 'Additional authentication required',
                code: 'MFA_REQUIRED',
                challengeRequired: true
              })
            }
            break
          
          case 'monitor':
            // Add monitoring headers
            res.set('X-Security-Monitor', 'true')
            break
        }

        next()
      } catch (error) {
        console.error('Threat detection middleware error:', error)
        next() // Continue on error to avoid blocking legitimate requests
      }
    }
  }

  // Input Validation Middleware
  inputValidationMiddleware() {
    return (req, res, next) => {
      // Add validation result handler
      req.validateInput = () => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
          // Log validation failure
          setImmediate(async () => {
            await this.auditTrail.logSecurityEvent({
              eventType: 'input_validation_failure',
              severity: 'low',
              description: 'Input validation failed',
              errors: errors.array(),
              path: req.path,
              method: req.method
            })
          })
          
          return res.status(422).json({
            success: false,
            error: 'Input validation failed',
            code: 'VALIDATION_ERROR',
            details: {
              errors: errors.array()
            }
          })
        }
        return null
      }
      
      next()
    }
  }

  // CSRF Protection
  csrfProtectionMiddleware() {
    return (req, res, next) => {
      // Skip CSRF for GET requests and API endpoints with proper authentication
      if (req.method === 'GET' || req.path.startsWith('/api/')) {
        return next()
      }

      const token = req.headers['x-csrf-token'] || req.body._csrf
      const sessionToken = req.session?.csrfToken

      if (!token || !sessionToken || token !== sessionToken) {
        // Log CSRF violation
        setImmediate(async () => {
          await this.auditTrail.logSecurityEvent({
            eventType: 'csrf_violation',
            severity: 'medium',
            description: 'CSRF token validation failed',
            path: req.path,
            method: req.method,
            providedToken: token ? 'present' : 'missing',
            sessionToken: sessionToken ? 'present' : 'missing'
          })
        })

        return res.status(403).json({
          success: false,
          error: 'CSRF token validation failed',
          code: 'CSRF_ERROR'
        })
      }

      next()
    }
  }

  // Authentication Middleware
  authenticationMiddleware() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req)
        
        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Authentication token required',
            code: 'TOKEN_REQUIRED'
          })
        }

        // Verify JWT token
        const decoded = jwt.verify(token, this.config.jwtSecret)
        
        // Validate session
        const sessionValidation = await this.hipaaCompliance.validateSession(decoded.sessionId, {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        })

        if (!sessionValidation.valid) {
          await this.auditTrail.logAuthentication({
            action: 'token_validation_failed',
            userId: decoded.userId,
            success: false,
            failureReason: sessionValidation.reason,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          })

          return res.status(401).json({
            success: false,
            error: 'Invalid or expired session',
            code: 'SESSION_INVALID'
          })
        }

        // Add user info to request
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          permissions: decoded.permissions || [],
          sessionId: decoded.sessionId
        }

        // Log successful authentication
        await this.auditTrail.logAuthentication({
          action: 'token_validated',
          userId: decoded.userId,
          success: true,
          method: 'jwt',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: decoded.sessionId
        })

        next()
      } catch (error) {
        let errorCode = 'TOKEN_INVALID'
        let errorMessage = 'Invalid authentication token'

        if (error.name === 'TokenExpiredError') {
          errorCode = 'TOKEN_EXPIRED'
          errorMessage = 'Authentication token has expired'
        } else if (error.name === 'JsonWebTokenError') {
          errorCode = 'TOKEN_MALFORMED'
          errorMessage = 'Malformed authentication token'
        }

        await this.auditTrail.logAuthentication({
          action: 'token_validation_failed',
          success: false,
          failureReason: error.message,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        })

        return res.status(401).json({
          success: false,
          error: errorMessage,
          code: errorCode
        })
      }
    }
  }

  // Authorization Middleware
  authorizationMiddleware(requiredPermissions = []) {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
      }

      // Check permissions
      const hasPermission = requiredPermissions.every(permission => 
        req.user.permissions.includes(permission) || req.user.role === 'admin'
      )

      if (!hasPermission) {
        await this.auditTrail.logEvent('authorization', {
          action: 'access_denied',
          userId: req.user.id,
          requiredPermissions,
          userPermissions: req.user.permissions,
          resource: req.path,
          method: req.method
        }, {
          userId: req.user.id,
          ipAddress: req.ip,
          source: 'authorization_middleware'
        })

        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      }

      // Log successful authorization
      await this.auditTrail.logEvent('authorization', {
        action: 'access_granted',
        userId: req.user.id,
        requiredPermissions,
        resource: req.path,
        method: req.method
      }, {
        userId: req.user.id,
        ipAddress: req.ip,
        source: 'authorization_middleware'
      })

      next()
    }
  }

  // PHI Access Middleware
  phiAccessMiddleware(purpose = 'treatment') {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required for PHI access',
          code: 'PHI_AUTH_REQUIRED'
        })
      }

      // Log PHI access attempt
      await this.auditTrail.logPHIAccess({
        action: 'access_attempt',
        resourceType: req.params.resourceType || 'unknown',
        resourceId: req.params.id || req.params.resourceId,
        userId: req.user.id,
        purpose,
        success: true,
        minimumNecessary: true,
        authorization: 'user_consent'
      })

      next()
    }
  }

  // Utility Methods
  extractToken(req) {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }
    return req.cookies?.token || req.query?.token
  }

  // Error Handling Middleware
  errorHandlingMiddleware() {
    return async (error, req, res, next) => {
      // Log error
      await this.auditTrail.logEvent('error_event', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        statusCode: error.statusCode || 500
      }, {
        userId: req.user?.id,
        ipAddress: req.ip,
        requestId: req.requestId,
        source: 'error_handler'
      })

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development'
      
      res.status(error.statusCode || 500).json({
        success: false,
        error: isDevelopment ? error.message : 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
        ...(isDevelopment && { stack: error.stack })
      })
    }
  }

  // Health Check Middleware
  healthCheckMiddleware() {
    return async (req, res) => {
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        security: {
          hipaaCompliance: await this.hipaaCompliance.getComplianceStatus(),
          threatDetection: await this.threatDetection.getSystemStatus(),
          auditTrail: await this.auditTrail.getSystemStatus()
        }
      }

      res.json(status)
    }
  }

  async shutdown() {
    console.log('🔐 Shutting down Security Middleware System...')
    
    await this.hipaaCompliance.shutdown()
    await this.threatDetection.shutdown()
    await this.auditTrail.shutdown()
  }
}

module.exports = {
  SecurityMiddlewareSystem
}
