/**
 * Security metrics API endpoint
 * Provides security monitoring data for the admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, AuthorizationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { SecurityMonitor } from '@/lib/security-monitoring'

const securityMonitor = new SecurityMonitor()

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/admin/security/metrics', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Verify admin permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      throw AuthorizationError('Admin access required')
    }

    // Get time range from query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '24h'

    // Calculate time threshold
    let hoursAgo: number
    switch (timeRange) {
      case '1h':
        hoursAgo = 1
        break
      case '24h':
        hoursAgo = 24
        break
      case '7d':
        hoursAgo = 24 * 7
        break
      case '30d':
        hoursAgo = 24 * 30
        break
      default:
        hoursAgo = 24
    }

    const timeThreshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

    // Get security metrics
    const metrics = await securityMonitor.getSecurityMetrics(timeRange as any)

    // Get active threats (unresolved high/critical events from last 24h)
    const { data: activeThreats } = await supabase
      .from('security_events')
      .select('*')
      .in('risk_level', ['high', 'critical'])
      .eq('resolved', false)
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(10)

    // Get system health indicators
    const systemHealth = await getSystemHealth(supabase)

    // Format active threats
    const formattedThreats = (activeThreats || []).map(threat => ({
      id: threat.id,
      type: threat.risk_level,
      title: formatThreatTitle(threat.event_type),
      description: formatThreatDescription(threat),
      timestamp: threat.timestamp,
      resolved: threat.resolved
    }))

    const response = {
      success: true,
      data: {
        metrics,
        activeThreats: formattedThreats,
        systemHealth,
        timeRange,
        lastUpdated: new Date().toISOString()
      }
    }

    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

/**
 * Get system health indicators
 */
async function getSystemHealth(supabase: any) {
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

  try {
    // Check authentication system health (recent successful logins)
    const { data: recentLogins } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'login_success')
      .gte('timestamp', fiveMinutesAgo.toISOString())

    // Check for recent authentication failures
    const { data: recentFailures } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'login_failure')
      .gte('timestamp', fiveMinutesAgo.toISOString())

    // Check rate limiting health (recent rate limit events)
    const { data: rateLimitEvents } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'rate_limit_exceeded')
      .gte('timestamp', fiveMinutesAgo.toISOString())

    // Check monitoring system health (recent events logged)
    const { data: recentEvents } = await supabase
      .from('security_events')
      .select('id')
      .gte('timestamp', fiveMinutesAgo.toISOString())

    return {
      authentication: determineHealthStatus(recentLogins?.length || 0, recentFailures?.length || 0),
      database: 'healthy', // If we can query, database is healthy
      rateLimit: (rateLimitEvents?.length || 0) > 10 ? 'warning' : 'healthy',
      monitoring: (recentEvents?.length || 0) > 0 ? 'healthy' : 'warning'
    }
  } catch (error) {
    return {
      authentication: 'critical',
      database: 'critical',
      rateLimit: 'critical',
      monitoring: 'critical'
    }
  }
}

/**
 * Determine health status based on metrics
 */
function determineHealthStatus(successCount: number, failureCount: number): 'healthy' | 'warning' | 'critical' {
  if (failureCount === 0) return 'healthy'
  if (failureCount > successCount * 2) return 'critical'
  if (failureCount > successCount) return 'warning'
  return 'healthy'
}

/**
 * Format threat title for display
 */
function formatThreatTitle(eventType: string): string {
  const titleMap: Record<string, string> = {
    'login_failure': 'Multiple Failed Login Attempts',
    'rate_limit_exceeded': 'Rate Limit Exceeded',
    'malicious_input_detected': 'Malicious Input Detected',
    'suspicious_activity': 'Suspicious Activity Detected',
    'account_locked': 'Account Locked Due to Security',
    'xss_attempt': 'Cross-Site Scripting Attempt',
    'sql_injection_attempt': 'SQL Injection Attempt',
    'authentication_failed': 'Authentication Failure',
    'authorization_failed': 'Authorization Failure',
    'sensitive_data_access': 'Sensitive Data Access'
  }

  return titleMap[eventType] || `Security Event: ${eventType}`
}

/**
 * Format threat description for display
 */
function formatThreatDescription(threat: any): string {
  const { event_type, ip_address, user_agent, details } = threat

  switch (event_type) {
    case 'login_failure':
      return `Failed login attempt from IP ${ip_address}. ${details?.attempt_count ? `Attempt ${details.attempt_count}` : ''}`
    
    case 'rate_limit_exceeded':
      return `Rate limit exceeded from IP ${ip_address}. ${details?.endpoint ? `Endpoint: ${details.endpoint}` : ''}`
    
    case 'malicious_input_detected':
      return `Malicious input detected from IP ${ip_address}. Threats: ${details?.threats?.join(', ') || 'Unknown'}`
    
    case 'suspicious_activity':
      return `Suspicious activity pattern detected from IP ${ip_address}. Activity: ${details?.activity || 'Unknown'}`
    
    case 'account_locked':
      return `Account locked due to security policy violation. Reason: ${details?.reason || 'Multiple violations'}`
    
    default:
      return `Security event from IP ${ip_address}. ${details?.description || 'See event details for more information.'}`
  }
}