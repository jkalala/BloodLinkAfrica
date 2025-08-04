"use client"

import { ResponsiveLayout } from "@/components/responsive-layout"
import { EnhancedInventoryManagement } from "@/components/enhanced-inventory-management"
import { useParams } from "next/navigation"
import { useI18n } from "@/lib/i18n/client"

export default function InventoryPage() {
  const params = useParams()
  const locale = params.locale as string
  const t = useI18n()

  return (
    <ResponsiveLayout>
      <div className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          <EnhancedInventoryManagement />
        </div>
      </div>
    </ResponsiveLayout>
  )
} 