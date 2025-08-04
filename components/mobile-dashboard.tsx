"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Heart, 
  MapPin, 
  Clock, 
  Users, 
  Activity, 
  Bell,
  Smartphone,
  Wifi,
  WifiOff,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer
} from "lucide-react"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { getOfflineSyncService } from "@/lib/offline-sync-service"
import { getPushNotificationService } from "@/lib/push-notification-service"
import { cn } from "@/lib/utils"

interface MobileQuickAction {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
  color: string
  action: () => void
  badge?: string
}

interface MobileNotification {
  id: string
  title: string
  body: string
  time: string
  type: 'blood_request' | 'emergency' | 'reminder' | 'match'
  read: boolean
}

export function MobileDashboard() {
  const { user } = useEnhancedAuth()
  const [syncStatus, setSyncStatus] = useState({ 
    isOnline: true, 
    queueSize: 0, 
    syncInProgress: false 
  })
  const [notifications, setNotifications] = useState<MobileNotification[]>([])
  const [quickStats, setQuickStats] = useState({
    activeRequests: 0,
    donationsThisMonth: 0,
    nearbyDonors: 0,
    responseTime: 0
  })

  const quickActions: MobileQuickAction[] = [
    {
      id: 'request-blood',
      title: 'Request Blood',
      description: 'Create urgent blood request',
      icon: Heart,
      color: 'text-red-500 bg-red-50 dark:bg-red-950',
      action: () => window.location.href = '/request',
      badge: 'Emergency'
    },
    {
      id: 'find-donors',
      title: 'Find Donors',
      description: 'Search nearby donors',
      icon: Users,
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950',
      action: () => window.location.href = '/map'
    },
    {
      id: 'my-requests',
      title: 'My Requests',
      description: 'View active requests',
      icon: Activity,
      color: 'text-green-500 bg-green-50 dark:bg-green-950',
      action: () => window.location.href = '/requests',
      badge: quickStats.activeRequests > 0 ? quickStats.activeRequests.toString() : undefined
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Recent updates',
      icon: Bell,
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-950',
      action: () => window.location.href = '/notifications',
      badge: notifications.filter(n => !n.read).length.toString()
    }
  ]

  useEffect(() => {
    const offlineSync = getOfflineSyncService()
    const pushService = getPushNotificationService()
    
    // Update sync status
    const updateSyncStatus = () => {
      const status = offlineSync.getSyncStatus()
      setSyncStatus(status)
    }
    
    // Load notifications
    const loadNotifications = async () => {
      if (user) {
        try {
          const history = await pushService.getNotificationHistory(user.id, 10)
          const formattedNotifications: MobileNotification[] = history.map(n => ({
            id: n.id || Math.random().toString(),
            title: n.title,
            body: n.body,
            time: new Date(n.sent_at).toLocaleTimeString(),
            type: n.type || 'blood_request',
            read: false
          }))
          setNotifications(formattedNotifications)
        } catch (error) {
          console.error('Failed to load notifications:', error)
        }
      }
    }

    // Simulate stats (in real app, fetch from API)
    const loadStats = () => {
      setQuickStats({
        activeRequests: Math.floor(Math.random() * 5) + 1,
        donationsThisMonth: Math.floor(Math.random() * 3),
        nearbyDonors: Math.floor(Math.random() * 20) + 5,
        responseTime: Math.floor(Math.random() * 30) + 15
      })
    }

    updateSyncStatus()
    loadNotifications()
    loadStats()
    
    const interval = setInterval(updateSyncStatus, 5000)
    return () => clearInterval(interval)
  }, [user])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'emergency': return AlertTriangle
      case 'match': return CheckCircle
      case 'reminder': return Timer
      default: return Heart
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'emergency': return 'text-red-500'
      case 'match': return 'text-green-500'
      case 'reminder': return 'text-blue-500'
      default: return 'text-purple-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-pink-500 p-4 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">BloodConnect</h1>
            <p className="text-red-100">Save lives together</p>
          </div>
          <div className="flex items-center space-x-2">
            {syncStatus.isOnline ? (
              <div className="flex items-center space-x-1 bg-white/20 rounded-full px-2 py-1">
                <Wifi className="h-4 w-4" />
                <span className="text-xs">Online</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 bg-yellow-500/20 rounded-full px-2 py-1">
                <WifiOff className="h-4 w-4" />
                <span className="text-xs">Offline</span>
                {syncStatus.queueSize > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {syncStatus.queueSize}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Heart className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{user.name || user.phone || 'User'}</h3>
                <p className="text-red-100 text-sm">{user.blood_type || 'Blood Type'} • {user.location || 'Location'}</p>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {user.available ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Requests</p>
                  <p className="text-lg font-bold text-red-600">{quickStats.activeRequests}</p>
                </div>
                <Activity className="h-5 w-5 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Donations</p>
                  <p className="text-lg font-bold text-green-600">{quickStats.donationsThisMonth}</p>
                </div>
                <Heart className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Nearby Donors</p>
                  <p className="text-lg font-bold text-blue-600">{quickStats.nearbyDonors}</p>
                </div>
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Avg Response</p>
                  <p className="text-lg font-bold text-purple-600">{quickStats.responseTime}min</p>
                </div>
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Card 
              key={action.id} 
              className="cursor-pointer hover:shadow-md transition-all duration-200 active:scale-95"
              onClick={action.action}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={cn("p-2 rounded-lg", action.color)}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{action.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                  </div>
                  {action.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {action.badge}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Updates</h2>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/notifications'}>
            View All
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              {notifications.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                </div>
              ) : (
                notifications.map((notification, index) => {
                  const Icon = getNotificationIcon(notification.type)
                  return (
                    <div key={notification.id}>
                      <div className="flex items-start space-x-3 p-4">
                        <div className={cn("p-2 rounded-full bg-gray-100 dark:bg-gray-800", getNotificationColor(notification.type))}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium">{notification.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{notification.body}</p>
                          <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                        )}
                      </div>
                      {index < notifications.length - 1 && <Separator />}
                    </div>
                  )
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      {syncStatus.queueSize > 0 && (
        <div className="px-4 mb-6">
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-800 rounded-full">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Offline Changes Pending
                  </h4>
                  <p className="text-xs text-orange-600 dark:text-orange-300">
                    {syncStatus.queueSize} item{syncStatus.queueSize > 1 ? 's' : ''} will sync when online
                  </p>
                </div>
                {syncStatus.syncInProgress && (
                  <div className="animate-spin">
                    <Activity className="h-4 w-4 text-orange-600" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}