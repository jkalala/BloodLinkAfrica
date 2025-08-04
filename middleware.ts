import { createI18nMiddleware } from "next-international/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from '@supabase/supabase-js'

const I18nMiddleware = createI18nMiddleware({
  locales: ["en", "fr", "pt", "sw"],
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
})

import { checkRateLimit, RATE_LIMITS, createRateLimitKey } from './lib/rate-limiting'
import { logSecurityEvent, SecurityEventType, RiskLevel } from './lib/security-monitoring'
import { getThreatDetectionSystem } from './lib/security/threat-detection'
import { getEncryptionManager } from './lib/security/encryption'

async function verifyAuthentication(request: NextRequest): Promise<{ user: any; session: any } | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return null
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Get auth token from cookie or authorization header
    const authHeader = request.headers.get('authorization')
    const authCookie = request.cookies.get('sb-access-token')?.value
    
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authCookie
    
    if (!token) {
      return null
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }
    
    return { user, session: { access_token: token } }
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  try {
    // 1. Advanced Threat Detection
    const threatSystem = getThreatDetectionSystem()
    const threatAnalysis = await threatSystem.analyzeRequest(request)

    if (threatAnalysis.shouldBlock) {
      // Log security threat
      await logSecurityEvent({
        event_type: SecurityEventType.SECURITY_THREAT_DETECTED,
        risk_level: RiskLevel.HIGH,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.ip,
        user_agent: request.headers.get('user-agent'),
        endpoint: pathname,
        method: request.method,
        details: {
          threats: threatAnalysis.threats.map(t => ({
            type: t.type,
            severity: t.severity,
            description: t.description
          }))
        }
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'SECURITY_THREAT_DETECTED',
            message: 'Request blocked due to security threat',
            code: 'BLOCKED'
          }
        },
        {
          status: 403,
          headers: {
            'X-Security-Block': 'threat-detected',
            'X-Request-ID': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }
        }
      )
    }

    // 2. Apply rate limiting to all requests
    const rateLimitKey = createRateLimitKey(request)
    const rateLimitResult = await checkRateLimit(rateLimitKey, RATE_LIMITS.API_GENERAL)

    if (!rateLimitResult.success) {
      // Log rate limit violation
      await logSecurityEvent({
        event_type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        risk_level: RiskLevel.MEDIUM,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.ip,
        user_agent: request.headers.get('user-agent'),
        endpoint: pathname,
        method: request.method,
        details: {
          limit: rateLimitResult.limit,
          hits: rateLimitResult.totalHits,
          retryAfter: rateLimitResult.retryAfter
        }
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retryAfter: rateLimitResult.retryAfter
          }
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      )
    }
  } catch (error) {
    console.error('Security middleware error:', error)
    // Continue with request processing on security system errors
  }
  
  // API route protection
  if (pathname.startsWith('/api/')) {
    // Public API routes that don't require authentication
    const publicRoutes = [
      '/api/health',
      '/api/public'
    ]
    
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
    
    if (!isPublicRoute) {
      const auth = await verifyAuthentication(request)
      
      if (!auth) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      
      // Clone the request to add headers
      const response = NextResponse.next()
      response.headers.set('x-user-id', auth.user.id)
      response.headers.set('x-user-email', auth.user.email || '')
      return response
    }
  }
  
  // Apply i18n middleware to all other requests
  const i18nResponse = I18nMiddleware(request)
  
  // Add comprehensive security headers to all responses
  if (i18nResponse instanceof NextResponse) {
    const encryption = getEncryptionManager()
    const securityHeaders = encryption.generateSecurityHeaders()

    // Apply all security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      i18nResponse.headers.set(key, value)
    })

    // Additional headers
    i18nResponse.headers.set('X-DNS-Prefetch-Control', 'on')
    i18nResponse.headers.set('X-Request-ID', `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

    // Remove server information
    i18nResponse.headers.delete('Server')
    i18nResponse.headers.delete('X-Powered-By')
  }
  
  return i18nResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
} 