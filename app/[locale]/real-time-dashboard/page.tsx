"use client"

import React, { useState, useEffect } from "react"
import { ResponsiveLayout } from "@/components/responsive-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { 
  Activity, 
  Bell, 
  Users, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Wifi,
  WifiOff,
  MessageSquare,
  Smartphone,
  Globe
} from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { getWebSocketService, type WebSocketMessage } from "@/lib/websocket-service"
import { getPushNotificationService } from "@/lib/push-notification-service"
import { getBloodRequestService } from "@/lib/blood-request-service"
import { getNotificationService } from "@/lib/notification-service"
import { getSupabase } from "@/lib/supabase"

interface RealTimeStats {
  activeRequests: number
  totalDonors: number
  matchedRequests: number
  emergencyAlerts: number
  responseRate: number
  avgResponseTime: number
}

interface LiveActivity {
  id: string
  type: 'blood_request' | 'donor_response' | 'emergency_alert' | 'notification'
  title: string
  description: string
  timestamp: string
  urgency?: string
  status?: string
}

export default function RealTimeDashboardPage() {
  const { user } = useEnhancedAuth()
  const [stats, setStats] = useState<RealTimeStats>({
    activeRequests: 0,
    totalDonors: 0,
    matchedRequests: 0,
    emergencyAlerts: 0,
    responseRate: 0,
    avgResponseTime: 0
  })
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([])
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)
  const [isPushEnabled, setIsPushEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("overview")

  const websocketService = getWebSocketService()
  const pushNotificationService = getPushNotificationService()
  const bloodRequestService = getBloodRequestService()
  const notificationService = getNotificationService()

  useEffect(() => {
    if (!user) return

    initializeRealTimeFeatures()
    loadInitialData()
    setupWebSocketListeners()

    return () => {
      // Cleanup WebSocket listeners
      websocketService.disconnect()
    }
  }, [user])

  const initializeRealTimeFeatures = async () => {
    try {
      // Initialize WebSocket service
      await websocketService.initialize()
      
      // Check WebSocket connection
      setIsWebSocketConnected(websocketService.isConnectedToServer())

      // Check push notification status
      const pushSupported = pushNotificationService.isSupported()
      if (pushSupported) {
        const isSubscribed = await pushNotificationService.checkSubscription(user!.id)
        setIsPushEnabled(isSubscribed)
      }

      // Subscribe to push notifications if not already subscribed
      if (pushSupported && !isPushEnabled) {
        const success = await pushNotificationService.subscribeToPushNotifications(user!.id)
        setIsPushEnabled(success)
      }
    } catch (error) {
      console.error('Error initializing real-time features:', error)
    }
  }

  const loadInitialData = async () => {
    try {
      setIsLoading(true)

      // Load real-time stats
      await loadRealTimeStats()

      // Load recent activities
      await loadRecentActivities()

    } catch (error) {
      console.error('Error loading initial data:', error)
      toast({
        title: "Error",
        description: "Failed to load real-time data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadRealTimeStats = async () => {
    try {
      // Get active blood requests
      const requestsResult = await bloodRequestService.getBloodRequests({ status: 'pending' })
      const activeRequests = requestsResult.data?.length || 0

      // Get total donors (users who are available)
      const { data: donors } = await getSupabase()
        .from('users')
        .select('id')
        .eq('available', true)
        .eq('receive_alerts', true)

      // Get matched requests
      const matchedResult = await bloodRequestService.getBloodRequests({ status: 'matched' })
      const matchedRequests = matchedResult.data?.length || 0

      // Get emergency alerts
      const { data: alerts } = await getSupabase()
        .from('emergency_alerts')
        .select('id')
        .eq('status', 'active')

      // Calculate response rate (mock data for now)
      const responseRate = 75 // Mock percentage
      const avgResponseTime = 15 // Mock minutes

      setStats({
        activeRequests,
        totalDonors: donors?.length || 0,
        matchedRequests,
        emergencyAlerts: alerts?.length || 0,
        responseRate,
        avgResponseTime
      })
    } catch (error) {
      console.error('Error loading real-time stats:', error)
    }
  }

  const loadRecentActivities = async () => {
    try {
      // Get recent blood requests
      const requestsResult = await bloodRequestService.getBloodRequests()
      const requests = requestsResult.data?.slice(0, 5) || []

      // Get recent notifications
      const notificationsResult = await notificationService.getUserNotifications(user!.id)
      const notifications = notificationsResult.data?.slice(0, 5) || []

      const activities: LiveActivity[] = []

      // Add blood requests
      requests.forEach((request: any) => {
        activities.push({
          id: request.id,
          type: 'blood_request',
          title: `${request.blood_type} Blood Request`,
          description: `${request.patient_name} at ${request.hospital_name}`,
          timestamp: request.created_at,
          urgency: request.urgency,
          status: request.status
        })
      })

      // Add notifications
      notifications.forEach((notification: any) => {
        activities.push({
          id: notification.id,
          type: notification.notification_type,
          title: notification.title,
          description: notification.message,
          timestamp: notification.created_at
        })
      })

      // Sort by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setLiveActivities(activities.slice(0, 10))
    } catch (error) {
      console.error('Error loading recent activities:', error)
    }
  }

  const setupWebSocketListeners = () => {
    // Listen for blood request updates
    websocketService.subscribe('blood_request', (message: WebSocketMessage) => {
      const request = message.data
      const activity: LiveActivity = {
        id: request.id,
        type: 'blood_request',
        title: `${request.blood_type} Blood Request`,
        description: `${request.patient_name} at ${request.hospital_name}`,
        timestamp: message.timestamp,
        urgency: request.urgency,
        status: request.status
      }

      setLiveActivities(prev => [activity, ...prev.slice(0, 9)])
      setStats(prev => ({ ...prev, activeRequests: prev.activeRequests + 1 }))
    })

    // Listen for donor responses
    websocketService.subscribe('donor_response', (message: WebSocketMessage) => {
      const response = message.data
      const activity: LiveActivity = {
        id: response.id,
        type: 'donor_response',
        title: `Donor ${response.response_type}`,
        description: `Response to blood request`,
        timestamp: message.timestamp,
        status: response.status
      }

      setLiveActivities(prev => [activity, ...prev.slice(0, 9)])
    })

    // Listen for emergency alerts
    websocketService.subscribe('emergency_alert', (message: WebSocketMessage) => {
      const alert = message.data
      const activity: LiveActivity = {
        id: alert.id,
        type: 'emergency_alert',
        title: 'Emergency Alert',
        description: alert.message,
        timestamp: message.timestamp
      }

      setLiveActivities(prev => [activity, ...prev.slice(0, 9)])
      setStats(prev => ({ ...prev, emergencyAlerts: prev.emergencyAlerts + 1 }))
    })

    // Listen for connection status
    websocketService.subscribe('connection', (message: WebSocketMessage) => {
      setIsWebSocketConnected(message.type === 'connected')
    })
  }

  const handlePushNotificationToggle = async () => {
    try {
      if (isPushEnabled) {
        const success = await pushNotificationService.unsubscribeFromPushNotifications(user!.id)
        setIsPushEnabled(!success)
      } else {
        const success = await pushNotificationService.subscribeToPushNotifications(user!.id)
        setIsPushEnabled(success)
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error)
      toast({
        title: "Error",
        description: "Failed to update push notification settings",
        variant: "destructive"
      })
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'blood_request':
        return <Activity className="h-4 w-4 text-blue-500" />
      case 'donor_response':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'emergency_alert':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'notification':
        return <Bell className="h-4 w-4 text-yellow-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getUrgencyBadge = (urgency?: string) => {
    if (!urgency) return null
    
    const variants = {
      critical: "destructive",
      urgent: "default",
      normal: "secondary"
    } as const

    return (
      <Badge variant={variants[urgency as keyof typeof variants] || "secondary"}>
        {urgency.toUpperCase()}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <ResponsiveLayout>
          <main className="flex min-h-screen flex-col">
            <div className="flex-1 p-4">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </ResponsiveLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <ResponsiveLayout>
        <main className="flex min-h-screen flex-col">
          <div className="flex-1 p-4">
            <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Real-Time Dashboard</h1>
                <p className="text-muted-foreground">Live blood donation activity and statistics</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {isWebSocketConnected ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isWebSocketConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePushNotificationToggle}
                  className="flex items-center space-x-1"
                >
                  <Bell className="h-4 w-4" />
                  <span>{isPushEnabled ? 'Disable' : 'Enable'} Push</span>
                </Button>
              </div>
            </div>

            {/* Real-time Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeRequests}</div>
                  <p className="text-xs text-muted-foreground">
                    Pending blood requests
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available Donors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalDonors}</div>
                  <p className="text-xs text-muted-foreground">
                    Ready to donate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.responseRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    Donor response rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Emergency Alerts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.emergencyAlerts}</div>
                  <p className="text-xs text-muted-foreground">
                    Active emergency alerts
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Live Activity</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Response Time Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Average Response Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{stats.avgResponseTime} min</div>
                      <Progress value={Math.min((stats.avgResponseTime / 30) * 100, 100)} className="mt-2" />
                      <p className="text-xs text-muted-foreground mt-2">
                        Average time for donors to respond
                      </p>
                    </CardContent>
                  </Card>

                  {/* Matched Requests */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Successfully Matched</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{stats.matchedRequests}</div>
                      <p className="text-xs text-muted-foreground">
                        Requests with confirmed donors
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Live Activity Feed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {liveActivities.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No recent activity
                        </div>
                      ) : (
                        liveActivities.map((activity) => (
                          <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                            <div className="mt-1">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">{activity.title}</p>
                                <div className="flex items-center space-x-2">
                                  {getUrgencyBadge(activity.urgency)}
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(activity.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {activity.description}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="features" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* WebSocket Status */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Real-time Updates</CardTitle>
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">
                          {isWebSocketConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Live WebSocket connection
                      </p>
                    </CardContent>
                  </Card>

                  {/* Push Notifications */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Push Notifications</CardTitle>
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isPushEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">
                          {isPushEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Browser notifications
                      </p>
                    </CardContent>
                  </Card>

                  {/* WhatsApp Integration */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">WhatsApp Integration</CardTitle>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm">Available</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        WhatsApp Business API
                      </p>
                    </CardContent>
                  </Card>

                  {/* USSD Support */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">USSD Support</CardTitle>
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm">Available</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Feature phone support
                      </p>
                    </CardContent>
                  </Card>

                  {/* Offline Capabilities */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Offline Support</CardTitle>
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm">Available</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Service worker enabled
                      </p>
                    </CardContent>
                  </Card>

                  {/* Multi-language */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Multi-language</CardTitle>
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm">Available</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        EN, PT, FR, SW
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <Toaster />
      </main>
    </ResponsiveLayout>
    </ProtectedRoute>
  )
} 