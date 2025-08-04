"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import {
  Bell,
  BellOff,
  Settings,
  Send,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Smartphone,
  Mail,
  Phone,
  MessageSquare,
  BarChart3,
  Activity,
  Zap,
  Volume2,
  VolumeX,
  RefreshCw,
  Plus,
  Eye,
  Filter
} from "lucide-react"

interface NotificationPreferences {
  push_notifications: boolean
  sms_notifications: boolean
  email_notifications: boolean
  whatsapp_notifications: boolean
  call_notifications: boolean
  emergency_only: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  blood_request_alerts: boolean
  donation_reminders: boolean
  system_updates: boolean
}

interface NotificationStats {
  total_sent: number
  total_failed: number
  total_pending: number
  by_type: Record<string, number>
  by_priority: Record<string, number>
  by_channel: Record<string, number>
  success_rate: number
}

interface QueueStats {
  total_notifications: number
  pending: number
  sent: number
  failed: number
  processing: number
  by_priority: Record<string, number>
  by_type: Record<string, number>
  failed_with_retries: number
  pending_retries: number
}

export function NotificationCenter() {
  const { user } = useEnhancedAuth()
  const { toast } = useToast()

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedTab, setSelectedTab] = useState("preferences")
  
  // Send notification dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sendNotificationData, setSendNotificationData] = useState({
    type: 'blood_request',
    title: '',
    message: '',
    priority: 'normal',
    channels: ['push'],
    recipients: [] as string[]
  })

  useEffect(() => {
    loadNotificationData()
    
    // Set up auto-refresh for queue stats
    const interval = setInterval(() => {
      if (selectedTab === 'queue' && user?.hasPermission('manage_notifications')) {
        loadQueueStats()
      }
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [selectedTab, user])

  const loadNotificationData = async () => {
    setIsLoading(true)
    try {
      // Load user preferences
      const prefsRes = await fetch('/api/notifications/preferences')
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json()
        setPreferences(prefsData.data.preferences)
      }

      // Load notification statistics
      const statsRes = await fetch('/api/notifications/send?days=30')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.data.statistics)
      }

      // Load queue statistics (admin only)
      if (user?.hasPermission('manage_notifications')) {
        await loadQueueStats()
      }

    } catch (error) {
      console.error('Error loading notification data:', error)
      toast({
        title: "Error",
        description: "Failed to load notification data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadQueueStats = async () => {
    try {
      const queueRes = await fetch('/api/notifications/process')
      if (queueRes.ok) {
        const queueData = await queueRes.json()
        setQueueStats(queueData.data.queue_statistics)
      }
    } catch (error) {
      console.error('Error loading queue stats:', error)
    }
  }

  const updatePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    setSaving(true)
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences)
      })

      if (response.ok) {
        const data = await response.json()
        setPreferences(data.data.preferences)
        toast({
          title: "Success",
          description: "Notification preferences updated",
        })
      } else {
        throw new Error('Failed to update preferences')
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const resetPreferences = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        setPreferences(data.data.preferences)
        toast({
          title: "Success",
          description: "Preferences reset to defaults",
        })
      } else {
        throw new Error('Failed to reset preferences')
      }
    } catch (error) {
      console.error('Error resetting preferences:', error)
      toast({
        title: "Error",
        description: "Failed to reset preferences",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const processNotifications = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/notifications/process', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: `Processed ${data.data.processed} notifications, retried ${data.data.retried}`,
        })
        await loadQueueStats()
      } else {
        throw new Error('Failed to process notifications')
      }
    } catch (error) {
      console.error('Error processing notifications:', error)
      toast({
        title: "Error",
        description: "Failed to process notifications",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const sendNotification = async () => {
    try {
      if (!sendNotificationData.title || !sendNotificationData.message) {
        toast({
          title: "Error",
          description: "Title and message are required",
          variant: "destructive",
        })
        return
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendNotificationData)
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: `Notification sent to ${data.data.notifications_sent} recipients`,
        })
        setSendDialogOpen(false)
        setSendNotificationData({
          type: 'blood_request',
          title: '',
          message: '',
          priority: 'normal',
          channels: ['push'],
          recipients: []
        })
      } else {
        throw new Error('Failed to send notification')
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive",
      })
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'push': return <Smartphone className="h-4 w-4" />
      case 'sms': return <MessageSquare className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />
      case 'call': return <Phone className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8 text-red-600" />
            Notification Center
          </h1>
          <p className="text-muted-foreground">
            Manage your notification preferences and system alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadNotificationData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {user?.hasPermission('send_notifications') && (
            <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700">
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Send Notification</DialogTitle>
                  <DialogDescription>
                    Send notifications to users through multiple channels
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={sendNotificationData.type}
                        onValueChange={(value) => setSendNotificationData(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blood_request">Blood Request</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="system">System Update</SelectItem>
                          <SelectItem value="reminder">Reminder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={sendNotificationData.priority}
                        onValueChange={(value) => setSendNotificationData(prev => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      value={sendNotificationData.title}
                      onChange={(e) => setSendNotificationData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Notification title"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      value={sendNotificationData.message}
                      onChange={(e) => setSendNotificationData(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Notification message"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label>Channels</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['push', 'sms', 'email', 'whatsapp', 'call'].map(channel => (
                        <div key={channel} className="flex items-center space-x-2">
                          <Checkbox
                            id={channel}
                            checked={sendNotificationData.channels.includes(channel)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSendNotificationData(prev => ({
                                  ...prev,
                                  channels: [...prev.channels, channel]
                                }))
                              } else {
                                setSendNotificationData(prev => ({
                                  ...prev,
                                  channels: prev.channels.filter(c => c !== channel)
                                }))
                              }
                            }}
                          />
                          <Label htmlFor={channel} className="flex items-center gap-2">
                            {getChannelIcon(channel)}
                            {channel.charAt(0).toUpperCase() + channel.slice(1)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={sendNotification} className="bg-red-600 hover:bg-red-700">
                      Send Notification
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          {user?.hasPermission('manage_notifications') && (
            <TabsTrigger value="queue">Queue Management</TabsTrigger>
          )}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {preferences && (
                <>
                  {/* Channel Preferences */}
                  <div>
                    <h4 className="font-semibold mb-3">Notification Channels</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          <Label>Push Notifications</Label>
                        </div>
                        <Switch
                          checked={preferences.push_notifications}
                          onCheckedChange={(checked) => updatePreferences({ push_notifications: checked })}
                          disabled={isSaving}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <Label>SMS Notifications</Label>
                        </div>
                        <Switch
                          checked={preferences.sms_notifications}
                          onCheckedChange={(checked) => updatePreferences({ sms_notifications: checked })}
                          disabled={isSaving}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <Label>Email Notifications</Label>
                        </div>
                        <Switch
                          checked={preferences.email_notifications}
                          onCheckedChange={(checked) => updatePreferences({ email_notifications: checked })}
                          disabled={isSaving}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <Label>Call Notifications</Label>
                        </div>
                        <Switch
                          checked={preferences.call_notifications}
                          onCheckedChange={(checked) => updatePreferences({ call_notifications: checked })}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Content Preferences */}
                  <div>
                    <h4 className="font-semibold mb-3">Notification Types</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <Label>Blood Request Alerts</Label>
                        </div>
                        <Switch
                          checked={preferences.blood_request_alerts}
                          onCheckedChange={(checked) => updatePreferences({ blood_request_alerts: checked })}
                          disabled={isSaving}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          <Label>Donation Reminders</Label>
                        </div>
                        <Switch
                          checked={preferences.donation_reminders}
                          onCheckedChange={(checked) => updatePreferences({ donation_reminders: checked })}
                          disabled={isSaving}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          <Label>System Updates</Label>
                        </div>
                        <Switch
                          checked={preferences.system_updates}
                          onCheckedChange={(checked) => updatePreferences({ system_updates: checked })}
                          disabled={isSaving}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <Label>Emergency Only Mode</Label>
                        </div>
                        <Switch
                          checked={preferences.emergency_only}
                          onCheckedChange={(checked) => updatePreferences({ emergency_only: checked })}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quiet Hours */}
                  <div>
                    <h4 className="font-semibold mb-3">Quiet Hours</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quiet-start">Start Time</Label>
                        <Input
                          id="quiet-start"
                          type="time"
                          value={preferences.quiet_hours_start || ''}
                          onChange={(e) => updatePreferences({ quiet_hours_start: e.target.value })}
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <Label htmlFor="quiet-end">End Time</Label>
                        <Input
                          id="quiet-end"
                          type="time"
                          value={preferences.quiet_hours_end || ''}
                          onChange={(e) => updatePreferences({ quiet_hours_end: e.target.value })}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={resetPreferences} variant="outline" disabled={isSaving}>
                      Reset to Defaults
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_sent}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_failed}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_pending}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Queue Management Tab */}
        {user?.hasPermission('manage_notifications') && (
          <TabsContent value="queue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Notification Queue
                  </span>
                  <Button 
                    onClick={processNotifications} 
                    disabled={isProcessing}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Process Queue
                  </Button>
                </CardTitle>
                <CardDescription>
                  Monitor and manage the notification processing queue
                </CardDescription>
              </CardHeader>
              <CardContent>
                {queueStats && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{queueStats.pending}</div>
                        <div className="text-sm text-muted-foreground">Pending</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{queueStats.processing}</div>
                        <div className="text-sm text-muted-foreground">Processing</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{queueStats.sent}</div>
                        <div className="text-sm text-muted-foreground">Sent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{queueStats.pending_retries}</div>
                        <div className="text-sm text-muted-foreground">Retries</div>
                      </div>
                    </div>

                    {/* Priority Breakdown */}
                    <div>
                      <h4 className="font-semibold mb-2">By Priority</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(queueStats.by_priority).map(([priority, count]) => (
                          <Badge key={priority} className={getPriorityColor(priority)}>
                            {priority}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Type Breakdown */}
                    <div>
                      <h4 className="font-semibold mb-2">By Type</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(queueStats.by_type).map(([type, count]) => (
                          <Badge key={type} variant="outline">
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Notification History
              </CardTitle>
              <CardDescription>
                View your recent notification activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Notification history will appear here</p>
                <p className="text-sm">Recent notifications and delivery status</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}