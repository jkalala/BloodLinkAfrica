/**
 * Security Configuration
 * 
 * Centralized security configuration for authentication, authorization,
 * threat detection, and security policies
 */

export const SECURITY_CONFIG = {
  // Authentication Configuration
  auth: {
    // JWT Configuration
    jwt: {
      accessTokenExpiry: 15 * 60, // 15 minutes
      refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
      rememberMeExpiry: 30 * 24 * 60 * 60, // 30 days
      algorithm: 'HS256' as const,
      issuer: 'BloodLink Africa',
      audience: 'bloodlink.africa'
    },

    // Password Policy
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      preventReuse: 5, // Last 5 passwords
      specialChars: '!@#$%^&*(),.?":{}|<>'
    },

    // Account Lockout Policy
    lockout: {
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      progressiveLockout: true, // Increase lockout time with repeated failures
      resetOnSuccess: true
    },

    // Multi-Factor Authentication
    mfa: {
      issuer: 'BloodLink Africa',
      algorithm: 'SHA1' as const,
      digits: 6,
      period: 30,
      window: 2, // Allow 2 time steps of drift
      backupCodes: 10,
      enforceForRoles: ['admin', 'super_admin']
    },

    // Session Management
    session: {
      timeout: 24 * 60 * 60 * 1000, // 24 hours
      extendOnActivity: true,
      maxConcurrentSessions: 3,
      secureOnly: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const
    }
  },

  // Authorization Configuration
  authorization: {
    // Role Hierarchy (higher number = more permissions)
    roleHierarchy: {
      donor: 1,
      hospital: 2,
      admin: 3,
      super_admin: 4
    },

    // Permission Categories
    permissions: {
      // Profile permissions
      'read:profile': ['donor', 'hospital', 'admin', 'super_admin'],
      'write:profile': ['donor', 'hospital', 'admin', 'super_admin'],
      
      // Blood request permissions
      'read:blood_requests': ['donor', 'hospital', 'admin', 'super_admin'],
      'write:blood_requests': ['donor', 'hospital', 'admin', 'super_admin'],
      'approve:blood_requests': ['hospital', 'admin', 'super_admin'],
      
      // Donor permissions
      'read:donors': ['hospital', 'admin', 'super_admin'],
      'write:donors': ['admin', 'super_admin'],
      
      // Analytics permissions
      'read:analytics': ['hospital', 'admin', 'super_admin'],
      'write:analytics': ['admin', 'super_admin'],
      
      // Admin permissions
      'admin:users': ['admin', 'super_admin'],
      'admin:system': ['super_admin'],
      'admin:security': ['super_admin']
    },

    // Resource-based permissions
    resourcePermissions: {
      ownProfile: ['read:profile', 'write:profile'],
      ownRequests: ['read:blood_requests', 'write:blood_requests'],
      hospitalRequests: ['read:blood_requests', 'approve:blood_requests'],
      systemWide: ['admin:system', 'admin:security']
    }
  },

  // Threat Detection Configuration
  threatDetection: {
    enabled: true,
    
    // Detection Thresholds
    thresholds: {
      bruteForce: {
        maxAttempts: 5,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        severity: 'high' as const
      },
      
      rateLimitViolation: {
        maxRequests: 100,
        timeWindow: 60 * 1000, // 1 minute
        severity: 'medium' as const
      },
      
      sqlInjection: {
        severity: 'critical' as const,
        autoBlock: true
      },
      
      xssAttempt: {
        severity: 'high' as const,
        autoBlock: true
      },
      
      suspiciousLogin: {
        geoAnomalyThreshold: 1000, // km
        timeAnomalyHours: [2, 3, 4, 5], // 2 AM - 5 AM
        severity: 'medium' as const
      }
    },

    // Automated Responses
    responses: {
      autoBlock: {
        enabled: true,
        severityThreshold: 'high' as const,
        duration: 60 * 60 * 1000 // 1 hour
      },
      
      alertAdmin: {
        enabled: true,
        severityThreshold: 'medium' as const,
        channels: ['email', 'dashboard']
      },
      
      requireMFA: {
        enabled: true,
        triggers: ['geo_anomaly', 'time_anomaly', 'suspicious_login']
      }
    }
  },

  // Rate Limiting Configuration
  rateLimit: {
    enabled: true,
    
    // Global rate limits
    global: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false
    },

    // Endpoint-specific rate limits
    endpoints: {
      '/api/auth/login': {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        skipSuccessfulRequests: true
      },
      
      '/api/auth/register': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        skipSuccessfulRequests: true
      },
      
      '/api/auth/forgot-password': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        skipSuccessfulRequests: false
      },
      
      '/api/blood-requests': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
        skipSuccessfulRequests: false
      },
      
      '/api/ml': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20,
        skipSuccessfulRequests: false
      }
    }
  },

  // Data Protection Configuration
  dataProtection: {
    // Encryption settings
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
      encryptPII: true,
      encryptSensitiveFields: [
        'email', 'phone', 'address', 'medical_info',
        'blood_type', 'emergency_contact'
      ]
    },

    // Data masking
    masking: {
      enabled: true,
      maskingChar: '*',
      preserveLength: true,
      fields: {
        email: { visibleChars: 2, maskDomain: false },
        phone: { visibleChars: 4, maskPrefix: true },
        address: { visibleChars: 10, maskMiddle: true }
      }
    },

    // Data retention
    retention: {
      userProfiles: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
      securityLogs: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
      auditTrails: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
      temporaryData: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  },

  // Security Headers Configuration
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://api.bloodlink.africa", "wss://api.bloodlink.africa"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },

    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },

    frameOptions: 'DENY',
    contentTypeOptions: 'nosniff',
    xssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=(self)'
  },

  // Monitoring and Logging
  monitoring: {
    enabled: true,
    
    // Log levels
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    
    // Event logging
    logEvents: [
      'login', 'logout', 'failed_login', 'password_change',
      'mfa_setup', 'mfa_disable', 'role_change', 'permission_change',
      'data_access', 'data_modification', 'admin_action',
      'security_threat', 'system_error'
    ],

    // Metrics collection
    metrics: {
      enabled: true,
      interval: 60 * 1000, // 1 minute
      retention: 30 * 24 * 60 * 60 * 1000 // 30 days
    },

    // Alerting
    alerts: {
      enabled: true,
      channels: {
        email: {
          enabled: true,
          recipients: process.env.SECURITY_ALERT_EMAILS?.split(',') || []
        },
        webhook: {
          enabled: false,
          url: process.env.SECURITY_WEBHOOK_URL
        }
      },
      
      conditions: [
        {
          name: 'High Threat Volume',
          condition: 'threats_per_hour > 50',
          severity: 'high'
        },
        {
          name: 'Critical Threat Detected',
          condition: 'threat_severity == critical',
          severity: 'critical'
        },
        {
          name: 'Multiple Failed Logins',
          condition: 'failed_logins_per_hour > 100',
          severity: 'medium'
        }
      ]
    }
  },

  // Compliance Configuration
  compliance: {
    // GDPR compliance
    gdpr: {
      enabled: true,
      dataProcessingBasis: 'consent',
      retentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
      anonymizationDelay: 30 * 24 * 60 * 60 * 1000, // 30 days after deletion
      consentTracking: true
    },

    // HIPAA compliance (for medical data)
    hipaa: {
      enabled: true,
      encryptionRequired: true,
      auditTrailRequired: true,
      accessLoggingRequired: true,
      minimumNecessaryAccess: true
    },

    // Data localization
    dataLocalization: {
      enabled: true,
      allowedRegions: ['EU', 'US', 'AF'], // Europe, US, Africa
      dataResidency: 'AF' // Primary data residency in Africa
    }
  }
}

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  // Development overrides
  SECURITY_CONFIG.auth.lockout.maxAttempts = 10
  SECURITY_CONFIG.rateLimit.global.maxRequests = 1000
  SECURITY_CONFIG.threatDetection.responses.autoBlock.enabled = false
}

if (process.env.NODE_ENV === 'production') {
  // Production overrides
  SECURITY_CONFIG.auth.session.secureOnly = true
  SECURITY_CONFIG.threatDetection.responses.autoBlock.enabled = true
  SECURITY_CONFIG.monitoring.logLevel = 'warn'
}

// Utility functions
export function getSecurityConfig(section?: keyof typeof SECURITY_CONFIG) {
  return section ? SECURITY_CONFIG[section] : SECURITY_CONFIG
}

export function hasPermission(userRole: string, permission: string): boolean {
  const permissionConfig = SECURITY_CONFIG.authorization.permissions[permission]
  return permissionConfig ? permissionConfig.includes(userRole) : false
}

export function getRoleLevel(role: string): number {
  return SECURITY_CONFIG.authorization.roleHierarchy[role] || 0
}

export function canAccessResource(userRole: string, resource: string, action: string): boolean {
  const resourcePermissions = SECURITY_CONFIG.authorization.resourcePermissions[resource]
  if (!resourcePermissions) return false
  
  const requiredPermission = `${action}:${resource}`
  return resourcePermissions.includes(requiredPermission) && hasPermission(userRole, requiredPermission)
}

export function isHighPrivilegeRole(role: string): boolean {
  return ['admin', 'super_admin'].includes(role)
}

export function requiresMFA(role: string): boolean {
  return SECURITY_CONFIG.auth.mfa.enforceForRoles.includes(role)
}

export default SECURITY_CONFIG
