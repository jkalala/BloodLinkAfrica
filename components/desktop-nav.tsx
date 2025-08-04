"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n/client"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
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
  Activity,
  MessageSquare,
  Smartphone,
  Globe,
  Brain,
  LogOut,
  Settings,
  Siren
} from "lucide-react"
import { Button } from "./ui/button"

export function DesktopNav() {
  const t = useI18n()
  const pathname = usePathname()
  const { user, signOut } = useEnhancedAuth()

  const navigation = [
    {
      name: t("dashboard.title"),
      href: "/dashboard",
      icon: Home,
    },
    {
      name: t("dashboard.realTime"),
      href: "/real-time-dashboard",
      icon: Activity,
    },
    {
      name: t("dashboard.phase3"),
      href: "/phase3-dashboard",
      icon: Brain,
    },
    {
      name: t("map.title"),
      href: "/map",
      icon: Map,
    },
    {
      name: t("request.title"),
      href: "/request",
      icon: Heart,
    },
    {
      name: t("dashboard.bloodRequests"),
      href: "/requests",
      icon: Bell,
    },
    {
      name: t("schedule.title"),
      href: "/schedule",
      icon: Calendar,
    },
    {
      name: t("dashboard.history"),
      href: "/history",
      icon: History,
    },
    {
      name: t("emergency.title"),
      href: "/emergency",
      icon: Siren,
    },
    {
      name: t("notifications.title"),
      href: "/notifications",
      icon: Bell,
    },
    {
      name: t("whatsapp.title"),
      href: `/${typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'en'}/whatsapp`,
      icon: MessageSquare,
    },
    {
      name: t("ussd.title"),
      href: `/${typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'en'}/ussd`,
      icon: Smartphone,
    },
    {
      name: t("offline.title"),
      href: "/offline-maps",
      icon: Globe,
    },
    {
      name: t("dashboard.profile"),
      href: "/profile",
      icon: User,
    },
  ]

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
              <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg">BloodLink</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Africa</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
            <User className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user?.name || user?.phone || "User"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user?.blood_type || "Blood Type"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md",
                isActive
                  ? "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-105"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-gray-50 dark:bg-gray-800">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <Settings className="h-4 w-4 mr-3" />
          Settings
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  )
} 