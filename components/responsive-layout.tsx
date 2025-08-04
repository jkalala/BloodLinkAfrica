"use client"

import React from "react"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { MobileNav } from "./mobile-nav"
import { DesktopNav } from "./desktop-nav"

interface ResponsiveLayoutProps {
  children: React.ReactNode
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const { user, isLoading } = useEnhancedAuth()
  const isMobile = useIsMobile()

  // Don't render anything while loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    )
  }

  // If not authenticated, show children without navigation
  if (!user) {
    return <>{children}</>
  }

  // If authenticated and mobile, show mobile navigation
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex-1 pb-20">{children}</div>
        <MobileNav />
      </div>
    )
  }

  // If authenticated and desktop, show desktop layout
  return (
    <div className="flex min-h-screen">
      <DesktopNav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
} 