/**
 * Authentication Middleware for API Routes
 * Provides JWT token validation and user context extraction
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export interface AuthenticatedUser extends User {
  role?: string
  permissions?: string[]
  institution_id?: string
}

export interface AuthContext {
  user: AuthenticatedUser
  session: { access_token: string }
  isAdmin: boolean
  isStaff: boolean
  hasPermission: (permission: string) => boolean
}

/**
 * Extract and validate JWT token from request
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Try multiple cookie names for better compatibility
  const cookieToken = request.cookies.get('sb-access-token')?.value ||
                     request.cookies.get('supabase-auth-token')?.value ||
                     request.cookies.get('sb-jwt-token')?.value
  if (cookieToken) {
    return cookieToken
  }

  // Try custom header
  const customToken = request.headers.get('x-supabase-token')
  if (customToken) {
    return customToken
  }

  return null
}

/**
 * Verify authentication and get user context
 */
export async function verifyAuthentication(request: NextRequest): Promise<AuthContext | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return null
    }

    // Use service role key for server-side auth verification
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = extractTokenFromRequest(request)
    if (!token) {
      return null
    }

    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      console.error('Token verification failed:', error?.message)
      return null
    }

    // Get additional user profile data
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, institution_id, permissions')
      .eq('id', user.id)
      .single()

    const authenticatedUser: AuthenticatedUser = {
      ...user,
      role: userProfile?.role || 'donor',
      permissions: userProfile?.permissions || [],
      institution_id: userProfile?.institution_id
    }

    return {
      user: authenticatedUser,
      session: { access_token: token },
      isAdmin: userProfile?.role === 'admin' || userProfile?.role === 'super_admin',
      isStaff: ['staff', 'admin', 'super_admin'].includes(userProfile?.role || ''),
      hasPermission: (permission: string) => {
        const permissions = userProfile?.permissions || {}
        return permissions[permission] === true || 
               (Array.isArray(permissions) && permissions.includes(permission))
      }
    }
  } catch (error) {
    console.error('Authentication verification error:', error)
    return null
  }
}

/**
 * Create authenticated Supabase client with user context
 */
export function createAuthenticatedSupabaseClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  })

  return supabase
}

/**
 * Middleware function to protect API routes
 */
export async function requireAuth(
  request: NextRequest,
  options: {
    requiredRole?: string
    requiredPermission?: string
    allowSelf?: boolean
  } = {}
): Promise<{ success: false; error: string; status: number } | { success: true; context: AuthContext }> {
  const authContext = await verifyAuthentication(request)
  
  if (!authContext) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid access token.',
      status: 401
    }
  }

  // Check role requirement
  if (options.requiredRole && authContext.user.role !== options.requiredRole) {
    // Allow admin and super_admin to access most resources
    const privilegedRoles = ['admin', 'super_admin']
    if (!privilegedRoles.includes(authContext.user.role || '')) {
      return {
        success: false,
        error: `Access denied. Required role: ${options.requiredRole}`,
        status: 403
      }
    }
  }

  // Check permission requirement
  if (options.requiredPermission && !authContext.hasPermission(options.requiredPermission)) {
    return {
      success: false,
      error: `Access denied. Required permission: ${options.requiredPermission}`,
      status: 403
    }
  }

  return {
    success: true,
    context: authContext
  }
}

/**
 * Check if user can access resource belonging to another user
 */
export function canAccessUserResource(
  authContext: AuthContext,
  targetUserId: string,
  options: { allowSelf?: boolean; requireAdmin?: boolean } = {}
): boolean {
  // Allow access to own resources if allowSelf is true
  if (options.allowSelf && authContext.user.id === targetUserId) {
    return true
  }

  // Always allow admin access
  if (authContext.isAdmin) {
    return true
  }

  // Check for admin requirement
  if (options.requireAdmin) {
    return false
  }

  // Default: only allow access to own resources
  return authContext.user.id === targetUserId
}

/**
 * Get user ID from request parameters or authenticated user
 */
export function getUserIdFromRequest(
  request: NextRequest,
  authContext: AuthContext,
  paramName: string = 'userId'
): string {
  const url = new URL(request.url)
  const userIdParam = url.searchParams.get(paramName)
  
  // If no userId parameter provided, use authenticated user's ID
  return userIdParam || authContext.user.id
}