"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabase } from "@/lib/supabase"
import type { Session, User } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

type DatabaseUser = Database['public']['Tables']['users']['Row']
type Institution = Database['public']['Tables']['institutions']['Row']

interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
}

interface EnhancedUser extends DatabaseUser {
  institution: Institution | null
  permissions: Permission[]
  isStaff: boolean
  isAdmin: boolean
  hasPermission: (permission: string) => boolean
  isEmergencyResponder: () => boolean
  canAccessResource: (resource: string, action: string) => boolean
}

interface EnhancedAuthContextType {
  user: EnhancedUser | null
  session: Session | null
  isLoading: boolean
  signIn: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (phone: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  updateProfile: (updates: { name?: string; [key: string]: unknown }) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  setUser?: (user: EnhancedUser | null) => void
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined)

// Helper function to format phone number
const formatPhoneNumber = (phone: string) => {
  // Remove any non-digit characters except +
  let formatted = phone.replace(/[^\d+]/g, '')
  
  // Ensure it starts with +
  if (!formatted.startsWith('+')) {
    formatted = '+' + formatted
  }
  
  return formatted
}

interface RolePermissionResult {
  permissions: {
    id: string
    name: string
    description: string
    resource: string
    action: string
  }
}

interface RpcPermission {
  permission_id: string
  permission_name: string
  permission_description: string
  permission_resource: string
  permission_action: string
}

interface DbPermission {
  id: string
  name: string
  description: string
  resource: string
  action: string
}

export function EnhancedAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EnhancedUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = getSupabase()

  const createEnhancedUser = async (authUser: User): Promise<EnhancedUser | null> => {
    try {
      console.log('Creating enhanced user for:', authUser.id)

      // Get user data
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      console.log('Initial user data fetch:', { userData, userError })

      if (userError) {
        console.error('Error fetching user data:', {
          error: userError,
          userId: authUser.id
        })
        return null
      }

      // If no user data exists, create basic profile
      if (!userData) {
        console.log('User profile not found, creating basic profile...')

        // Get phone from either phone field or email (for backward compatibility)
        const phone = authUser.phone || (
          authUser.email ? authUser.email.replace('@bloodlink.app', '') : null
        )

        if (!phone) {
          console.error('No phone number available for user:', authUser.id)
          return null
        }

        const formattedPhone = phone.replace(/[^\d+]/g, '').startsWith('+') ? phone : '+' + phone

        const derivedName = authUser.user_metadata?.['name'] || authUser.user_metadata?.['full_name'] || authUser.email?.split('@')[0] || 'User'
        console.log('👤 Creating enhanced user profile with name:', derivedName)
        console.log('🔍 Available user metadata:', authUser.user_metadata)
        
        const newUserData = {
          id: authUser.id,
          phone: formattedPhone,
          name: derivedName,
          blood_type: authUser.user_metadata?.['blood_type'] || 'Unknown',
          location: authUser.user_metadata?.['location'] || 'Angola',
          allow_location: true,
          receive_alerts: true,
          available: true,
          points: 0,
          role: 'donor',
          stakeholder_type: 'donor',
          verification_status: 'pending',
          created_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          emergency_access: false,
          phone_verified: false,
          permissions: {},
          last_donation: null,
          medical_conditions: null,
          institution_id: null
        }

        console.log('Attempting to create user with data:', newUserData)

        const { error: createError } = await supabase
          .from('users')
          .insert([newUserData])

        if (createError) {
          console.error('Error creating user profile:', {
            error: createError ? {
              code: createError.code,
              message: createError.message,
              details: createError.details,
              hint: createError.hint
            } : null,
            userId: authUser.id,
            userData: newUserData
          })
          return null
        }

        // Fetch the newly created user
        const { data: createdUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (fetchError || !createdUser) {
          console.error('Error fetching created user:', {
            error: fetchError,
            userId: authUser.id
          })
          return null
        }

        userData = createdUser

        // Update auth user metadata to match
        await supabase.auth.updateUser({
          data: {
            name: userData.name,
            blood_type: userData.blood_type,
            location: userData.location,
            phone: userData.phone
          }
        })
      }

      // Load user permissions
      console.log('Loading permissions for user:', authUser.id)

      // Default permissions for donor role
      const defaultDonorPermissions: Permission[] = [
        {
          id: 'a2c3c0e6-14bf-4692-96de-63fa984279d8',
          name: 'view_own_profile',
          description: 'View own user profile',
          resource: 'profile',
          action: 'view'
        },
        {
          id: 'b3d4c1e7-25cf-4793-97ef-74fa985379d9',
          name: 'update_own_profile',
          description: 'Update own user profile',
          resource: 'profile',
          action: 'update'
        }
      ]

      let userPermissions: Permission[] = []
      try {
        const { data: permissionsData, error: permissionsError } = await supabase
          .rpc('get_user_full_permissions', { user_id: authUser.id })

        if (permissionsError) {
          console.error('Error loading permissions:', {
            error: permissionsError,
            userId: authUser.id,
            code: permissionsError.code,
            message: permissionsError.message,
            details: permissionsError.details,
            hint: permissionsError.hint
          })

          // Try direct query as fallback
          const { data: rolePerms, error: roleError } = await supabase
            .from('permissions')
            .select('*')
            .eq('role_permissions.role', userData.role)
            .eq('role_permissions.permission_id', 'permissions.id')

          if (roleError) {
            console.error('Error loading role permissions:', {
              error: roleError,
              userId: authUser.id,
              role: userData.role
            })
          } else if (rolePerms) {
            userPermissions = rolePerms
            console.log('Loaded permissions from direct query:', userPermissions)
          }
        } else {
          userPermissions = permissionsData as Permission[]
          console.log('Loaded permissions from RPC:', userPermissions)
        }
      } catch (error) {
        console.error('Unexpected error loading permissions:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error,
          userId: authUser.id
        })
      }

      // Use default permissions if none were loaded
      if (!userPermissions.length) {
        userPermissions = userData.role === 'donor' ? defaultDonorPermissions : []
        console.log('Using default permissions:', userPermissions)
      }

      // Load institution if user is staff
      let institutionData = null
      if (userData.role === 'staff' || userData.role === 'admin') {
        console.log('Loading institution data for staff/admin:', authUser.id)
        const { data: staffData, error: staffError } = await supabase
          .from('institution_staff')
          .select('*, institutions(*)')
          .eq('user_id', authUser.id)
          .eq('is_active', true)
          .single()

        if (staffError) {
          console.error('Error loading institution staff:', {
            error: staffError,
            userId: authUser.id
          })
        } else {
          institutionData = staffData?.institutions
        }
      }

      console.log('Loaded institution:', institutionData)

      // Create enhanced user object
      const enhancedUser: EnhancedUser = {
        ...userData,
        permissions: userPermissions,
        institution: institutionData,
        isStaff: userData.role === 'staff' || userData.role === 'admin',
        isAdmin: userData.role === 'admin',
        hasPermission: (permission: string) => {
          return userPermissions.some((p: Permission) => p.name === permission)
        },
        isEmergencyResponder: () => {
          return userData.role === 'emergency_responder' || userData.emergency_access
        },
        canAccessResource: (resource: string, action: string) => {
          return userPermissions.some((p: Permission) => 
            p.resource === resource && p.action === action
          )
        }
      }

      console.log('Enhanced user created successfully:', enhancedUser)
      return enhancedUser
    } catch (error) {
      console.error('Unexpected error in createEnhancedUser:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        userId: authUser.id
      })
      return null
    }
  }

  useEffect(() => {
    let subscription: any = null

    const setupAuth = async () => {
      try {
        console.log('Starting auth setup')
        setIsLoading(true)

        // Check active session
        const { data: { session: activeSession } } = await supabase.auth.getSession()
        console.log('Got active session:', activeSession?.user?.id)
        setSession(activeSession)

        if (activeSession?.user) {
          console.log('Creating profile for active session user')
          const profile = await createEnhancedUser(activeSession.user)
          setUser(profile)
        }

        // Listen for auth changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          console.log('Auth state changed:', event, currentSession?.user?.id)
          setSession(currentSession)
          
          if (currentSession?.user) {
            console.log('Creating profile for new session user')
            const profile = await createEnhancedUser(currentSession.user)
            setUser(profile)
          } else {
            setUser(null)
          }
          
          setIsLoading(false)
        })

        subscription = authSubscription
        setIsLoading(false)
      } catch (error) {
        console.error('Error in setupAuth:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error
        })
        setIsLoading(false)
      }
    }

    setupAuth()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [supabase])

  const signIn = async (phone: string, password: string) => {
    try {
      console.log('Attempting sign in for:', phone)
      const formattedPhone = formatPhoneNumber(phone)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${formattedPhone}@bloodlink.app`,
        password,
      })

      if (error) {
        console.error('Sign in error:', error)
        return { success: false, error: error.message }
      }

      console.log('Sign in successful:', data.user?.id)
      return { success: true }
    } catch (error: any) {
      console.error('Unexpected sign in error:', error)
      return { success: false, error: error.message }
    }
  }

  const signUp = async (registrationDataOrPhone: any, password?: string, name?: string) => {
    try {
      // Handle both old signature (phone, password, name) and new signature (registrationData)
      let registrationData
      if (typeof registrationDataOrPhone === 'string') {
        // Old signature: signUp(phone, password, name)
        registrationData = {
          phone: registrationDataOrPhone,
          password: password!,
          name: name!
        }
      } else {
        // New signature: signUp(registrationData)
        registrationData = registrationDataOrPhone
      }

      console.log('Attempting sign up for:', registrationData.phone)
      const formattedPhone = formatPhoneNumber(registrationData.phone)
      const { data, error } = await supabase.auth.signUp({
        email: `${formattedPhone}@bloodlink.app`,
        password: registrationData.password,
        phone: formattedPhone,
        options: {
          data: {
            name: registrationData.name,
            phone: formattedPhone,
            blood_type: registrationData.bloodType,
            stakeholder_type: registrationData.stakeholderType,
            location: registrationData.profileData?.location,
            institution_id: registrationData.institutionId,
            emergency_access: registrationData.emergencyAccess,
            ...registrationData.profileData
          }
        }
      })

      if (error) {
        console.error('Sign up error:', error)
        return { success: false, error: error.message }
      }

      console.log('✅ Sign up successful for:', registrationData.name, '- User ID:', data.user?.id)
      console.log('📝 User metadata saved:', data.user?.user_metadata)
      return { success: true }
    } catch (error: any) {
      console.error('Unexpected sign up error:', error)
      return { success: false, error: error.message }
    }
  }

  const updateProfile = async (updates: { name?: string; [key: string]: any }) => {
    try {
      if (!user) {
        return { success: false, error: 'No user logged in' }
      }

      console.log('🔄 Updating user profile:', updates)

      // Update auth user metadata
      if (updates.name) {
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            name: updates.name,
            ...Object.fromEntries(
              Object.entries(updates).filter(([key]) => key !== 'name')
            )
          }
        })

        if (authError) {
          console.error('Auth update error:', authError)
          return { success: false, error: authError.message }
        }
      }

      // Update database profile
      const { error: dbError } = await supabase
        .from('users')
        .update({
          ...updates,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id)

      if (dbError) {
        console.error('Database update error:', dbError)
        return { success: false, error: dbError.message }
      }

      console.log('✅ Profile updated successfully')
      
      // Refresh the user data by refetching from database
      if (session?.user) {
        const refreshedProfile = await createEnhancedUser(session.user)
        setUser(refreshedProfile)
      }
      
      return { success: true }
    } catch (error: any) {
      console.error('Unexpected profile update error:', error)
      return { success: false, error: error.message }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    updateProfile,
    signOut,
    setUser,
  }

  return <EnhancedAuthContext.Provider value={value}>{children}</EnhancedAuthContext.Provider>
}

export const useEnhancedAuth = () => {
  const context = useContext(EnhancedAuthContext)
  if (context === undefined) {
    throw new Error("useEnhancedAuth must be used within an EnhancedAuthProvider")
  }
  return context
} 