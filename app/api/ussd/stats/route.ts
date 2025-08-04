import { NextRequest, NextResponse } from 'next/server'
import { getUSSDStats } from '@/app/actions/phase4-actions'
import { getSupabase } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthorizationError, AuthenticationError } from '@/lib/error-handling'
import { formatSuccessResponse, formatErrorResponse, extractRequestMeta } from '@/lib/api-response'
import { trackApiUsage, logSecurityEvent, SecurityEventType, RiskLevel } from '@/lib/security-monitoring'
import { asyncHandler } from '@/lib/error-handling'

export const GET = asyncHandler(async (req: NextRequest) => {
  const supabase = getSupabase()
  const requestMeta = extractRequestMeta(req)

  try {
    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      await logSecurityEvent({
        event_type: SecurityEventType.ACCESS_DENIED,
        risk_level: RiskLevel.MEDIUM,
        ip_address: requestMeta.ipAddress,
        user_agent: requestMeta.userAgent,
        endpoint: '/api/ussd/stats',
        method: 'GET',
        details: {
          reason: 'No authentication provided',
          endpoint: '/api/ussd/stats'
        }
      })
      
      throw new AuthenticationError('Authentication required to access USSD statistics')
    }

    // Check user permissions
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, emergency_access, verification_status')
      .eq('id', session.user.id)
      .single()

    if (userError || !userData) {
      throw new AuthenticationError('User verification failed')
    }

    // Only allow admin, staff, and emergency responders to access stats
    const allowedRoles = ['admin', 'staff', 'emergency_responder']
    const hasPermission = allowedRoles.includes(userData.role) || userData.emergency_access

    if (!hasPermission) {
      await logSecurityEvent({
        event_type: SecurityEventType.ACCESS_DENIED,
        risk_level: RiskLevel.MEDIUM,
        user_id: session.user.id,
        ip_address: requestMeta.ipAddress,
        user_agent: requestMeta.userAgent,
        endpoint: '/api/ussd/stats',
        method: 'GET',
        details: {
          reason: 'Insufficient permissions',
          user_role: userData.role,
          required_roles: allowedRoles
        }
      })
      
      throw new AuthorizationError('Insufficient permissions to access USSD statistics')
    }

    // Log the API access for security monitoring
    await trackApiUsage('/api/ussd/stats', 'GET', session.user.id, requestMeta.ipAddress)

    // Log successful access
    await logSecurityEvent({
      event_type: SecurityEventType.SENSITIVE_DATA_ACCESS,
      risk_level: RiskLevel.LOW,
      user_id: session.user.id,
      ip_address: requestMeta.ipAddress,
      user_agent: requestMeta.userAgent,
      endpoint: '/api/ussd/stats',
      method: 'GET',
      details: {
        data_type: 'ussd_statistics',
        user_role: userData.role,
        access_granted: true
      }
    })

    // Get USSD statistics
    const result = await getUSSDStats()

    if (!result.success) {
      throw new Error(result.error || 'Failed to retrieve USSD statistics')
    }

    return formatSuccessResponse(
      result.data || result,
      {
        ...requestMeta,
        userId: session.user.id
      }
    )

  } catch (error) {
    const appError = handleError(error, session?.user?.id, requestMeta.requestId)
    
    // Log the error for security monitoring
    await logSecurityEvent({
      event_type: SecurityEventType.SYSTEM_ERROR,
      risk_level: RiskLevel.MEDIUM,
      user_id: session?.user?.id,
      ip_address: requestMeta.ipAddress,
      user_agent: requestMeta.userAgent,
      endpoint: '/api/ussd/stats',
      method: 'GET',
      details: {
        error_type: appError.type,
        error_message: appError.message,
        correlation_id: appError.correlationId
      }
    })

    return createErrorResponse(appError)
  }
}) 