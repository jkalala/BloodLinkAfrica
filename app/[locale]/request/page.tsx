"use client"

import { ResponsiveLayout } from "@/components/responsive-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { EnhancedBloodRequestForm } from "@/components/enhanced-blood-request-form"

export default function RequestPage() {
  return (
    <ProtectedRoute>
      <ResponsiveLayout>
        <div className="flex-1 p-4">
          <EnhancedBloodRequestForm />
        </div>
      </ResponsiveLayout>
    </ProtectedRoute>
  )
} 