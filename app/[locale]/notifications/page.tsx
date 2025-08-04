"use client"

import { NotificationCenter } from "@/components/notification-center"
import { ProtectedRoute } from "@/components/protected-route"
import { ResponsiveLayout } from "@/components/responsive-layout"

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <ResponsiveLayout>
        <div className="flex-1 p-4">
          <div className="max-w-6xl mx-auto">
            <NotificationCenter />
          </div>
        </div>
      </ResponsiveLayout>
    </ProtectedRoute>
  )
} 