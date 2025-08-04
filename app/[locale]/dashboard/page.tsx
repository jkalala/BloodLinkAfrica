"use client"

import { ResponsiveLayout } from "@/components/responsive-layout"
import { RoleBasedDashboard } from "@/components/role-based-dashboard"
import { EnhancedBloodRequestDashboard } from "@/components/enhanced-blood-request-dashboard"
import { ProtectedRoute } from "@/components/protected-route"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"

export default function DashboardPage() {
  const { userRole } = useEnhancedAuth()

  // Show enhanced dashboard for staff and emergency responders
  const shouldShowEnhancedDashboard = userRole === "hospital_staff" || 
                                    userRole === "blood_bank_staff" || 
                                    userRole === "emergency_responder" || 
                                    userRole === "admin"

  return (
    <ProtectedRoute>
      <ResponsiveLayout>
        <div className="flex-1 p-4">
          {shouldShowEnhancedDashboard ? (
            <EnhancedBloodRequestDashboard />
          ) : (
            <RoleBasedDashboard />
          )}
        </div>
      </ResponsiveLayout>
    </ProtectedRoute>
  )
} 