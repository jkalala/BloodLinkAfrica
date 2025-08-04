"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n/client"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { getOfflineSyncService } from "@/lib/offline-sync-service"
import { getPushNotificationService } from "@/lib/push-notification-service"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "./language-switcher"
import { ThemeToggle } from "./theme-toggle"
import { 
  Home, 
  Map, 
  Heart, 
  User, 
  Bell, 
  History, 
  Calendar,
  Settings,
  Activity,
  MessageSquare,
  Smartphone,
  Globe,
  Brain,
  BarChart3,
  Wifi,
  WifiOff,
  Sync,
  Siren
} from "lucide-react"

export function MobileNav() {
  const t = useI18n()
  const pathname = usePathname()
  const { user } = useEnhancedAuth()
  const [syncStatus, setSyncStatus] = useState({ isOnline: true, queueSize: 0 })
  const [notificationSupported, setNotificationSupported] = useState(false)
  
  useEffect(() => {
    const offlineSync = getOfflineSyncService()
    const pushService = getPushNotificationService()
    
    // Check notification support
    setNotificationSupported(pushService.isSupported())
    
    // Update sync status periodically
    const updateSyncStatus = () => {
      const status = offlineSync.getSyncStatus()
      setSyncStatus({ isOnline: status.isOnline, queueSize: status.queueSize })
    }
    
    updateSyncStatus()
    const interval = setInterval(updateSyncStatus, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
    {
      name: "Real-time Dashboard",
      href: "/real-time-dashboard",
      icon: Activity,
    },
    {
      name: "Phase 3 Dashboard",
      href: "/phase3-dashboard",
      icon: Brain,
    },
    {
      name: "Map",
      href: "/map",
      icon: Map,
    },
    {
      name: "Request",
      href: "/request",
      icon: Heart,
    },
    {
      name: "Requests",
      href: "/requests",
      icon: Bell,
    },
    {
      name: "Schedule",
      href: "/schedule",
      icon: Calendar,
    },
    {
      name: "History",
      href: "/history",
      icon: History,
    },
    {
      name: "Emergency",
      href: "/emergency",
      icon: Siren,
    },
    {
      name: "Notifications",
      href: "/notifications",
      icon: Bell,
    },
    {
      name: "WhatsApp",
      href: `/${typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'en'}/whatsapp`,
      icon: MessageSquare,
    },
    {
      name: "USSD",
      href: `/${typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'en'}/ussd`,
      icon: Smartphone,
    },
    {
      name: "Offline Maps",
      href: "/offline-maps",
      icon: Globe,
    },
    {
      name: "Analytics",
      href: "/analytics",
      icon: BarChart3,
      badge: "New"
    },
    {
      name: "Profile",
      href: "/profile",
      icon: User,
    },
  ]

  return (
    <>
      {/* Floating Controls */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col space-y-2">
        {/* Sync Status Indicator */}
        <div className={cn(
          "p-2 rounded-full shadow-lg transition-all duration-200",
          syncStatus.isOnline ? "bg-green-500" : "bg-red-500"
        )}>
          {syncStatus.isOnline ? (
            <Wifi className="h-4 w-4 text-white" />
          ) : (
            <div className="relative">
              <WifiOff className="h-4 w-4 text-white" />
              {syncStatus.queueSize > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-xs"
                >
                  {syncStatus.queueSize}
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Notification Status */}
        {notificationSupported && (
          <div className="p-2 rounded-full bg-blue-500 shadow-lg">
            <Bell className="h-4 w-4 text-white" />
          </div>
        )}
        
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      
      {/* User Info Banner - appears above bottom nav */}
      {user && (
        <div className="fixed bottom-16 left-0 right-0 z-40 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-t px-4 py-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {user?.name || user?.phone || "User"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.blood_type || "Blood Type"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
        <div className="flex justify-around">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center py-2 px-3 text-xs transition-all duration-200 hover:scale-105",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                <item.icon className="h-5 w-5 mb-1" />
                <span className="text-center leading-none">{item.name}</span>
                {(item as any).badge && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-1 -right-1 h-4 px-1 text-xs"
                  >
                    {(item as any).badge}
                  </Badge>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
