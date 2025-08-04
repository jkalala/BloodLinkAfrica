/**
 * Comprehensive Security Middleware
 * 
 * Integrates authentication, authorization, threat detection,
 * and security monitoring into a unified middleware system
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthManager, User, Permission } from './auth-manager'
import { getThreatDetectionSystem } from './threat-detection'
import { getEncryptionManager } from './encryption'
import { performanceMonitor } from '../performance/metrics'

export interface SecurityConfig {
  enableThreatDetection: boolean
  enableRateLimit: boolean
  enableCSRFProtection: boolean
  enableCORS: boolean
  requireAuth: boolean
  requiredPermissions?: Permission[]
  allowedRoles?: string[]
  skipPaths?: string[]
}

export interface SecurityContext {
  user?: User
  isAuthenticated: boolean
  hasRequiredPermissions: boolean
  threats: any[]
  blocked: boolean
  requestId: string
  timestamp: Date
}

class SecurityMiddleware {
  private authManager = getAuthManager()
  private threatDetection = getThreatDetectionSystem()
  private encryption = getEncryptionManager()

  // Default security configuration
  private readonly DEFAULT_CONFIG: SecurityConfig = {
    enableThreatDetection: true,
    enableRateLimit: true,
    enableCSRFProtection: true,
    enableCORS: true,
    requireAuth: false,
    skipPaths: ['/api/health', '/api/public', '/login', '/register']
  }

  async processRequest(
    request: NextRequest,
    config: Partial<SecurityConfig> = {}
  ): Promise<{
    response?: NextResponse
    context: SecurityContext
    shouldContinue: boolean
  }> {
    const startTime = performance.now()
    const mergedConfig = { ...this.DEFAULT_CONFIG, ...config }
    const requestId = this.generateRequestId()

    const context: SecurityContext = {
      isAuthenticated: false,
      hasRequiredPermissions: false,
      threats: [],
      blocked: false,
      requestId,
      timestamp: new Date()
    }

    try {
      // Check if path should be skipped
      if (this.shouldSkipPath(request.url, mergedConfig.skipPaths)) {
        return { context, shouldContinue: true }
      }

      // 1. Threat Detection
      if (mergedConfig.enableThreatDetection) {
        const threatAnalysis = await this.threatDetection.analyzeRequest(request)
        context.threats = threatAnalysis.threats
        context.blocked = threatAnalysis.shouldBlock

        if (threatAnalysis.shouldBlock) {
          const response = this.createBlockedResponse(threatAnalysis.threats)
          return { response, context, shouldContinue: false }
        }
      }

      // 2. Rate Limiting
      if (mergedConfig.enableRateLimit) {
        const rateLimitResult = await this.checkRateLimit(request)
        if (rateLimitResult.blocked) {
          const response = this.createRateLimitResponse(rateLimitResult.retryAfter)
          return { response, context, shouldContinue: false }
        }
      }

      // 3. CORS Handling
      if (mergedConfig.enableCORS) {
        const corsResponse = this.handleCORS(request)
        if (corsResponse) {
          return { response: corsResponse, context, shouldContinue: false }
        }
      }

      // 4. CSRF Protection
      if (mergedConfig.enableCSRFProtection) {
        const csrfResult = await this.validateCSRF(request)
        if (!csrfResult.valid) {
          const response = this.createCSRFErrorResponse()
          return { response, context, shouldContinue: false }
        }
      }

      // 5. Authentication
      if (mergedConfig.requireAuth) {
        const authResult = await this.authenticateRequest(request)
        context.user = authResult.user
        context.isAuthenticated = authResult.isAuthenticated

        if (!authResult.isAuthenticated) {
          const response = this.createUnauthorizedResponse()
          return { response, context, shouldContinue: false }
        }
      }

      // 6. Authorization
      if (mergedConfig.requiredPermissions && context.user) {
        const hasPermissions = this.checkPermissions(
          context.user,
          mergedConfig.requiredPermissions
        )
        context.hasRequiredPermissions = hasPermissions

        if (!hasPermissions) {
          const response = this.createForbiddenResponse()
          return { response, context, shouldContinue: false }
        }
      }

      // 7. Role-based Access Control
      if (mergedConfig.allowedRoles && context.user) {
        const hasRole = mergedConfig.allowedRoles.includes(context.user.role)
        if (!hasRole) {
          const response = this.createForbiddenResponse()
          return { response, context, shouldContinue: false }
        }
      }

      // Record successful security check
      this.recordSecurityMetrics(request, context, performance.now() - startTime, true)

      return { context, shouldContinue: true }

    } catch (error) {
      console.error('Security middleware error:', error)
      
      // Record failed security check
      this.recordSecurityMetrics(request, context, performance.now() - startTime, false)

      const response = this.createInternalErrorResponse()
      return { response, context, shouldContinue: false }
    }
  }

  async processResponse(
    request: NextRequest,
    response: NextResponse,
    context: SecurityContext
  ): Promise<NextResponse> {
    try {
      // Add security headers
      response = this.addSecurityHeaders(response)

      // Add request ID for tracing
      response.headers.set('X-Request-ID', context.requestId)

      // Add security context headers (for debugging in development)
      if (process.env.NODE_ENV === 'development') {
        response.headers.set('X-Security-Authenticated', context.isAuthenticated.toString())
        response.headers.set('X-Security-Threats', context.threats.length.toString())
      }

      return response

    } catch (error) {
      console.error('Security response processing error:', error)
      return response
    }
  }

  // Authentication methods
  private async authenticateRequest(request: NextRequest): Promise<{
    user?: User
    isAuthenticated: boolean
  }> {
    try {
      // Try to get token from Authorization header
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const user = await this.authManager.verifyToken(token)
        
        if (user) {
          return { user, isAuthenticated: true }
        }
      }

      // Try to get token from cookies
      const cookieToken = request.cookies.get('auth-token')?.value
      if (cookieToken) {
        const user = await this.authManager.verifyToken(cookieToken)
        if (user) {
          return { user, isAuthenticated: true }
        }
      }

      return { isAuthenticated: false }

    } catch (error) {
      console.error('Authentication error:', error)
      return { isAuthenticated: false }
    }
  }

  private checkPermissions(user: User, requiredPermissions: Permission[]): boolean {
    return this.authManager.hasAllPermissions(user, requiredPermissions)
  }

  // Rate limiting
  private async checkRateLimit(request: NextRequest): Promise<{
    blocked: boolean
    retryAfter?: number
  }> {
    try {
      const clientIP = this.getClientIP(request)
      const key = `rate_limit:${clientIP}`
      
      // This would integrate with Redis for distributed rate limiting
      // For now, we'll return a simple check
      return { blocked: false }

    } catch (error) {
      console.error('Rate limit check error:', error)
      return { blocked: false }
    }
  }

  // CORS handling
  private handleCORS(request: NextRequest): NextResponse | null {
    const origin = request.headers.get('origin')
    const method = request.method

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
          'Access-Control-Max-Age': '86400',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    }

    return null
  }

  // CSRF protection
  private async validateCSRF(request: NextRequest): Promise<{ valid: boolean }> {
    const method = request.method

    // Only check CSRF for state-changing methods
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return { valid: true }
    }

    const csrfToken = request.headers.get('X-CSRF-Token') || 
                     request.headers.get('x-csrf-token')
    
    if (!csrfToken) {
      return { valid: false }
    }

    // Validate CSRF token (simplified - in production, use proper CSRF validation)
    const isValid = csrfToken.length > 10 // Basic validation
    return { valid: isValid }
  }

  // Security headers
  private addSecurityHeaders(response: NextResponse): NextResponse {
    const securityHeaders = this.encryption.generateSecurityHeaders()
    
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Additional security headers
    response.headers.set('X-Powered-By', '') // Remove server info
    response.headers.set('Server', '') // Remove server info
    
    return response
  }

  // Response creators
  private createBlockedResponse(threats: any[]): NextResponse {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'SECURITY_THREAT_DETECTED',
          message: 'Request blocked due to security threat',
          details: process.env.NODE_ENV === 'development' ? threats : undefined
        }
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Security-Block': 'threat-detected'
        }
      }
    )
  }

  private createRateLimitResponse(retryAfter?: number): NextResponse {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests'
        }
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': (retryAfter || 60).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0'
        }
      }
    )
  }

  private createUnauthorizedResponse(): NextResponse {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer'
        }
      }
    )
  }

  private createForbiddenResponse(): NextResponse {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }

  private createCSRFErrorResponse(): NextResponse {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'CSRF token validation failed'
        }
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }

  private createInternalErrorResponse(): NextResponse {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SECURITY_ERROR',
          message: 'Security processing failed'
        }
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }

  // Utility methods
  private shouldSkipPath(url: string, skipPaths?: string[]): boolean {
    if (!skipPaths) return false
    
    const pathname = new URL(url).pathname
    return skipPaths.some(path => pathname.startsWith(path))
  }

  private getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0] ||
           request.headers.get('x-real-ip') ||
           request.ip ||
           'unknown'
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private recordSecurityMetrics(
    request: NextRequest,
    context: SecurityContext,
    duration: number,
    success: boolean
  ): void {
    performanceMonitor.recordCustomMetric({
      name: 'security_middleware_duration',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        success: success.toString(),
        authenticated: context.isAuthenticated.toString(),
        threats: context.threats.length.toString(),
        blocked: context.blocked.toString(),
        path: new URL(request.url).pathname
      }
    })
  }
}

// Singleton instance
let securityMiddlewareInstance: SecurityMiddleware | null = null

export function getSecurityMiddleware(): SecurityMiddleware {
  if (!securityMiddlewareInstance) {
    securityMiddlewareInstance = new SecurityMiddleware()
  }
  return securityMiddlewareInstance
}

// Convenience functions for Next.js middleware
export async function withSecurity(
  request: NextRequest,
  config?: Partial<SecurityConfig>
): Promise<NextResponse | null> {
  const middleware = getSecurityMiddleware()
  const result = await middleware.processRequest(request, config)
  
  if (!result.shouldContinue) {
    return result.response || new NextResponse('Security check failed', { status: 500 })
  }
  
  return null
}

export async function withSecurityResponse(
  request: NextRequest,
  response: NextResponse,
  context?: SecurityContext
): Promise<NextResponse> {
  const middleware = getSecurityMiddleware()
  
  if (context) {
    return middleware.processResponse(request, response, context)
  }
  
  return response
}

// Route protection decorators
export function requireAuth(config?: Partial<SecurityConfig>) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function(request: NextRequest, ...args: any[]) {
      const securityResult = await withSecurity(request, {
        requireAuth: true,
        ...config
      })

      if (securityResult) {
        return securityResult
      }

      return method.apply(this, [request, ...args])
    }
  }
}

export function requirePermissions(permissions: Permission[], config?: Partial<SecurityConfig>) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function(request: NextRequest, ...args: any[]) {
      const securityResult = await withSecurity(request, {
        requireAuth: true,
        requiredPermissions: permissions,
        ...config
      })

      if (securityResult) {
        return securityResult
      }

      return method.apply(this, [request, ...args])
    }
  }
}

export type { SecurityConfig, SecurityContext }
export default SecurityMiddleware
