"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input' 
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Clock, MapPin, Phone, Mail, Users, Activity, TrendingUp, Bell, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { emergencyAlertService, EmergencyAlert } from '@/lib/emergency-alert-service'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface EmergencyCoordinatorDashboardProps {
  coordinatorId: string
  hospitalId?: string
}

interface AlertStats {
  totalAlerts: number
  activeAlerts: number
  fulfilledAlerts: number
  averageResponseTime: number
  topAlertTypes: Array<{ type: string; count: number }>
  responseRate: number
}

export default function EmergencyCoordinatorDashboard({ coordinatorId, hospitalId }: EmergencyCoordinatorDashboardProps) {
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([])
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<EmergencyAlert | null>(null)
  const [isCreateAlertOpen, setIsCreateAlertOpen] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer | null>(null)

  // Real-time data refresh
  const refreshData = useCallback(async () => {
    try {
      const [alerts, stats] = await Promise.all([
        emergencyAlertService.getActiveAlerts(coordinatorId),
        emergencyAlertService.getAlertStatistics('today')
      ])
      
      setActiveAlerts(alerts)
      setAlertStats(stats)
      setError(null)
    } catch (err) {
      console.error('Failed to refresh data:', err)
      setError('Failed to load emergency data')
    }
  }, [coordinatorId])

  useEffect(() => {
    const initializeDashboard = async () => {
      setLoading(true)
      await refreshData()
      setLoading(false)
    }

    initializeDashboard()

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000)
    setRefreshInterval(interval)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [refreshData])

  const getPriorityColor = (priority: EmergencyAlert['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-black'
      case 'low': return 'bg-blue-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getStatusColor = (status: EmergencyAlert['status']) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800'
      case 'partially_fulfilled': return 'bg-yellow-100 text-yellow-800'
      case 'fulfilled': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const handleCreateAlert = async (alertData: any) => {
    try {
      await emergencyAlertService.createEmergencyAlert(alertData)
      setIsCreateAlertOpen(false)
      await refreshData()
    } catch (err) {
      console.error('Failed to create alert:', err)
      setError('Failed to create emergency alert')
    }
  }

  const handleCancelAlert = async (alertId: string, reason: string) => {
    try {
      await emergencyAlertService.cancelAlert(alertId, reason, coordinatorId)
      await refreshData()
    } catch (err) {
      console.error('Failed to cancel alert:', err)
      setError('Failed to cancel alert')
    }
  }

  if (loading) {
    return (
      <div className=\"flex items-center justify-center h-64\">
        <div className=\"animate-spin rounded-full h-32 w-32 border-b-2 border-red-500\"></div>
      </div>
    )
  }

  return (
    <div className=\"p-6 space-y-6\">
      {/* Header */}
      <div className=\"flex justify-between items-center\">
        <div>
          <h1 className=\"text-3xl font-bold text-gray-900\">Emergency Coordinator Dashboard</h1>
          <p className=\"text-gray-600 mt-1\">Monitor and manage emergency blood alerts</p>
        </div>
        <div className=\"flex gap-3\">
          <Button onClick={refreshData} variant=\"outline\">
            <Activity className=\"w-4 h-4 mr-2\" />
            Refresh
          </Button>
          <Dialog open={isCreateAlertOpen} onOpenChange={setIsCreateAlertOpen}>
            <DialogTrigger asChild>
              <Button className=\"bg-red-600 hover:bg-red-700\">
                <AlertTriangle className=\"w-4 h-4 mr-2\" />
                Create Emergency Alert
              </Button>
            </DialogTrigger>
            <CreateAlertDialog onSubmit={handleCreateAlert} />
          </Dialog>
        </div>
      </div>

      {error && (
        <div className=\"bg-red-50 border border-red-200 rounded-md p-4\">
          <div className=\"flex\">
            <XCircle className=\"w-5 h-5 text-red-400\" />
            <div className=\"ml-3\">
              <h3 className=\"text-sm font-medium text-red-800\">Error</h3>
              <p className=\"text-sm text-red-700 mt-1\">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6\">
        <Card>
          <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
            <CardTitle className=\"text-sm font-medium\">Active Alerts</CardTitle>
            <AlertTriangle className=\"h-4 w-4 text-red-500\" />
          </CardHeader>
          <CardContent>
            <div className=\"text-2xl font-bold\">{alertStats?.activeAlerts || 0}</div>
            <p className=\"text-xs text-muted-foreground\">
              {alertStats?.totalAlerts || 0} total today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
            <CardTitle className=\"text-sm font-medium\">Fulfilled</CardTitle>
            <CheckCircle className=\"h-4 w-4 text-green-500\" />
          </CardHeader>
          <CardContent>
            <div className=\"text-2xl font-bold\">{alertStats?.fulfilledAlerts || 0}</div>
            <p className=\"text-xs text-muted-foreground\">
              {alertStats?.totalAlerts > 0 
                ? Math.round((alertStats.fulfilledAlerts / alertStats.totalAlerts) * 100)
                : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
            <CardTitle className=\"text-sm font-medium\">Avg Response</CardTitle>
            <Clock className=\"h-4 w-4 text-blue-500\" />
          </CardHeader>
          <CardContent>
            <div className=\"text-2xl font-bold\">{Math.round(alertStats?.averageResponseTime || 0)}m</div>
            <p className=\"text-xs text-muted-foreground\">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
            <CardTitle className=\"text-sm font-medium\">Response Rate</CardTitle>
            <TrendingUp className=\"h-4 w-4 text-green-500\" />
          </CardHeader>
          <CardContent>
            <div className=\"text-2xl font-bold\">{Math.round((alertStats?.responseRate || 0) * 100)}%</div>
            <p className=\"text-xs text-muted-foreground\">
              Donor response rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue=\"active-alerts\" className=\"space-y-4\">
        <TabsList>
          <TabsTrigger value=\"active-alerts\">Active Alerts</TabsTrigger>
          <TabsTrigger value=\"analytics\">Analytics</TabsTrigger>
          <TabsTrigger value=\"history\">History</TabsTrigger>
        </TabsList>

        <TabsContent value=\"active-alerts\" className=\"space-y-4\">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className=\"flex flex-col items-center justify-center py-16\">
                <CheckCircle className=\"w-12 h-12 text-green-500 mb-4\" />
                <h3 className=\"text-lg font-semibold mb-2\">No Active Emergency Alerts</h3>
                <p className=\"text-gray-600 text-center\">
                  All clear! There are currently no active emergency blood alerts.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className=\"grid gap-4\">
              {activeAlerts.map((alert) => (
                <Card key={alert.id} className=\"border-l-4 border-l-red-500\">
                  <CardHeader>
                    <div className=\"flex justify-between items-start\">
                      <div className=\"space-y-2\">
                        <div className=\"flex items-center gap-2\">
                          <Badge className={getPriorityColor(alert.priority)}>
                            {alert.priority.toUpperCase()}
                          </Badge>
                          <Badge variant=\"outline\" className={getStatusColor(alert.status)}>
                            {alert.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className=\"text-sm text-gray-500\">
                            {formatTimeAgo(alert.createdAt)}
                          </span>
                        </div>
                        <CardTitle className=\"text-xl\">
                          {alert.type.replace('_', ' ').toUpperCase()} - {alert.bloodType}
                        </CardTitle>
                        <CardDescription>
                          {alert.unitsNeeded} units needed • {alert.hospitalName}
                        </CardDescription>
                      </div>
                      <div className=\"flex gap-2\">
                        <Button 
                          variant=\"outline\" 
                          size=\"sm\"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          View Details
                        </Button>
                        {alert.status === 'active' && (
                          <Button 
                            variant=\"destructive\" 
                            size=\"sm\"
                            onClick={() => handleCancelAlert(alert.id, 'Cancelled by coordinator')}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4 text-sm\">
                      <div className=\"flex items-center gap-2\">
                        <MapPin className=\"w-4 h-4 text-gray-500\" />
                        <span>{alert.location.address}</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <Phone className=\"w-4 h-4 text-gray-500\" />
                        <span>{alert.contactInfo.phone}</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <Clock className=\"w-4 h-4 text-gray-500\" />
                        <span>Expires: {new Date(alert.expiresAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className=\"mt-3 p-3 bg-gray-50 rounded-md\">
                      <p className=\"text-sm\">{alert.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value=\"analytics\" className=\"space-y-4\">
          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
            <Card>
              <CardHeader>
                <CardTitle>Top Alert Types</CardTitle>
                <CardDescription>Most common emergency types today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-3\">
                  {alertStats?.topAlertTypes.map((type, index) => (
                    <div key={type.type} className=\"flex justify-between items-center\">
                      <span className=\"text-sm font-medium\">
                        {type.type.replace('_', ' ').toUpperCase()}
                      </span>
                      <div className=\"flex items-center gap-2\">
                        <div className=\"w-32 bg-gray-200 rounded-full h-2\">
                          <div 
                            className=\"bg-red-500 h-2 rounded-full\" 
                            style={{ 
                              width: `${(type.count / (alertStats?.totalAlerts || 1)) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className=\"text-sm text-gray-600\">{type.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Metrics</CardTitle>
                <CardDescription>Alert response performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-4\">
                  <div className=\"flex justify-between items-center p-3 bg-green-50 rounded-lg\">
                    <div>
                      <p className=\"font-medium text-green-800\">Response Rate</p>
                      <p className=\"text-sm text-green-600\">Donors responding to alerts</p>
                    </div>
                    <div className=\"text-2xl font-bold text-green-800\">
                      {Math.round((alertStats?.responseRate || 0) * 100)}%
                    </div>
                  </div>
                  
                  <div className=\"flex justify-between items-center p-3 bg-blue-50 rounded-lg\">
                    <div>
                      <p className=\"font-medium text-blue-800\">Avg Response Time</p>
                      <p className=\"text-sm text-blue-600\">Time to first response</p>
                    </div>
                    <div className=\"text-2xl font-bold text-blue-800\">
                      {Math.round(alertStats?.averageResponseTime || 0)}m
                    </div>
                  </div>

                  <div className=\"flex justify-between items-center p-3 bg-orange-50 rounded-lg\">
                    <div>
                      <p className=\"font-medium text-orange-800\">Fulfillment Rate</p>
                      <p className=\"text-sm text-orange-600\">Alerts successfully fulfilled</p>
                    </div>
                    <div className=\"text-2xl font-bold text-orange-800\">
                      {alertStats?.totalAlerts > 0 
                        ? Math.round((alertStats.fulfilledAlerts / alertStats.totalAlerts) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value=\"history\">
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Historical emergency alerts and their outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className=\"text-gray-600\">Historical alert data would be displayed here...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <AlertDetailsModal 
          alert={selectedAlert} 
          onClose={() => setSelectedAlert(null)}
          onCancel={(reason) => handleCancelAlert(selectedAlert.id, reason)}
        />
      )}
    </div>
  )
}

// Create Alert Dialog Component
function CreateAlertDialog({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    type: '',
    priority: '',
    bloodType: '',
    unitsNeeded: '',
    hospitalName: '',
    description: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    city: '',
    alertRadius: '25'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      type: formData.type,
      priority: formData.priority,
      bloodType: formData.bloodType,
      unitsNeeded: parseInt(formData.unitsNeeded),
      hospitalId: 'hospital_001', // Would be dynamic
      hospitalName: formData.hospitalName,
      location: {
        latitude: 0, // Would be geocoded from address
        longitude: 0,
        address: formData.address,
        city: formData.city,
        country: 'Kenya'
      },
      description: formData.description,
      contactInfo: {
        phone: formData.contactPhone,
        email: formData.contactEmail,
        emergencyContact: formData.contactPhone
      },
      alertRadius: parseInt(formData.alertRadius)
    })
  }

  return (
    <DialogContent className=\"max-w-2xl\">
      <DialogHeader>
        <DialogTitle>Create Emergency Alert</DialogTitle>
        <DialogDescription>
          Create a new emergency blood alert to notify nearby donors.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className=\"space-y-4\">
        <div className=\"grid grid-cols-2 gap-4\">
          <div className=\"space-y-2\">
            <Label htmlFor=\"type\">Emergency Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
              <SelectTrigger>
                <SelectValue placeholder=\"Select type\" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=\"blood_shortage\">Blood Shortage</SelectItem>
                <SelectItem value=\"mass_casualty\">Mass Casualty</SelectItem>
                <SelectItem value=\"natural_disaster\">Natural Disaster</SelectItem>
                <SelectItem value=\"hospital_emergency\">Hospital Emergency</SelectItem>
                <SelectItem value=\"critical_patient\">Critical Patient</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className=\"space-y-2\">
            <Label htmlFor=\"priority\">Priority Level</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
              <SelectTrigger>
                <SelectValue placeholder=\"Select priority\" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=\"critical\">Critical</SelectItem>
                <SelectItem value=\"high\">High</SelectItem>
                <SelectItem value=\"medium\">Medium</SelectItem>
                <SelectItem value=\"low\">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className=\"grid grid-cols-2 gap-4\">
          <div className=\"space-y-2\">
            <Label htmlFor=\"bloodType\">Blood Type</Label>
            <Select value={formData.bloodType} onValueChange={(value) => setFormData({...formData, bloodType: value})}>
              <SelectTrigger>
                <SelectValue placeholder=\"Select blood type\" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=\"O-\">O-</SelectItem>
                <SelectItem value=\"O+\">O+</SelectItem>
                <SelectItem value=\"A-\">A-</SelectItem>
                <SelectItem value=\"A+\">A+</SelectItem>
                <SelectItem value=\"B-\">B-</SelectItem>
                <SelectItem value=\"B+\">B+</SelectItem>
                <SelectItem value=\"AB-\">AB-</SelectItem>
                <SelectItem value=\"AB+\">AB+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className=\"space-y-2\">
            <Label htmlFor=\"unitsNeeded\">Units Needed</Label>
            <Input 
              type=\"number\" 
              value={formData.unitsNeeded}
              onChange={(e) => setFormData({...formData, unitsNeeded: e.target.value})}
              placeholder=\"Number of units\"
              min=\"1\"
              required
            />
          </div>
        </div>

        <div className=\"space-y-2\">
          <Label htmlFor=\"hospitalName\">Hospital/Facility Name</Label>
          <Input 
            value={formData.hospitalName}
            onChange={(e) => setFormData({...formData, hospitalName: e.target.value})}
            placeholder=\"Hospital or medical facility name\"
            required
          />
        </div>

        <div className=\"grid grid-cols-2 gap-4\">
          <div className=\"space-y-2\">
            <Label htmlFor=\"contactPhone\">Contact Phone</Label>
            <Input 
              value={formData.contactPhone}
              onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
              placeholder=\"Emergency contact number\"
              required
            />
          </div>

          <div className=\"space-y-2\">
            <Label htmlFor=\"contactEmail\">Contact Email</Label>
            <Input 
              type=\"email\"
              value={formData.contactEmail}
              onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
              placeholder=\"Emergency contact email\"
            />
          </div>
        </div>

        <div className=\"space-y-2\">
          <Label htmlFor=\"address\">Address</Label>
          <Input 
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder=\"Full address of emergency location\"
            required
          />
        </div>

        <div className=\"space-y-2\">
          <Label htmlFor=\"description\">Description</Label>
          <Textarea 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder=\"Describe the emergency situation and any specific requirements\"
            rows={3}
            required
          />
        </div>

        <DialogFooter>
          <Button type=\"submit\" className=\"bg-red-600 hover:bg-red-700\">
            Create Emergency Alert
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// Alert Details Modal Component
function AlertDetailsModal({ 
  alert, 
  onClose, 
  onCancel 
}: { 
  alert: EmergencyAlert
  onClose: () => void
  onCancel: (reason: string) => void
}) {
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className=\"max-w-4xl max-h-[80vh] overflow-y-auto\">
        <DialogHeader>
          <DialogTitle className=\"flex items-center gap-2\">
            <AlertTriangle className=\"w-5 h-5 text-red-500\" />
            Emergency Alert Details
          </DialogTitle>
          <DialogDescription>
            Alert ID: {alert.id}
          </DialogDescription>
        </DialogHeader>

        <div className=\"space-y-6\">
          {/* Alert Summary */}
          <div className=\"flex justify-between items-start\">
            <div className=\"space-y-2\">
              <div className=\"flex items-center gap-2\">
                <Badge className={`${alert.priority === 'critical' ? 'bg-red-500' : alert.priority === 'high' ? 'bg-orange-500' : 'bg-yellow-500'} text-white`}>
                  {alert.priority.toUpperCase()}
                </Badge>
                <Badge variant=\"outline\">{alert.status.replace('_', ' ').toUpperCase()}</Badge>
              </div>
              <h3 className=\"text-xl font-semibold\">
                {alert.type.replace('_', ' ').toUpperCase()} - {alert.bloodType}
              </h3>
              <p className=\"text-gray-600\">
                {alert.unitsNeeded} units needed at {alert.hospitalName}
              </p>
            </div>
            {alert.status === 'active' && (
              <Button 
                variant=\"destructive\" 
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel Alert
              </Button>
            )}
          </div>

          {/* Alert Information Grid */}
          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
            <Card>
              <CardHeader>
                <CardTitle className=\"text-lg\">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className=\"space-y-3\">
                <div className=\"flex items-center gap-2\">
                  <Phone className=\"w-4 h-4 text-gray-500\" />
                  <span>{alert.contactInfo.phone}</span>
                </div>
                <div className=\"flex items-center gap-2\">
                  <Mail className=\"w-4 h-4 text-gray-500\" />
                  <span>{alert.contactInfo.email}</span>
                </div>
                <div className=\"flex items-center gap-2\">
                  <MapPin className=\"w-4 h-4 text-gray-500\" />
                  <span>{alert.location.address}, {alert.location.city}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className=\"text-lg\">Alert Timeline</CardTitle>
              </CardHeader>
              <CardContent className=\"space-y-3\">
                <div>
                  <p className=\"font-medium\">Created</p>
                  <p className=\"text-sm text-gray-600\">{alert.createdAt.toLocaleString()}</p>
                </div>
                <div>
                  <p className=\"font-medium\">Expires</p>
                  <p className=\"text-sm text-gray-600\">{alert.expiresAt.toLocaleString()}</p>
                </div>
                {alert.fulfilledAt && (
                  <div>
                    <p className=\"font-medium\">Fulfilled</p>
                    <p className=\"text-sm text-gray-600\">{alert.fulfilledAt.toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-lg\">Emergency Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className=\"text-gray-700\">{alert.description}</p>
            </CardContent>
          </Card>

          {/* Alert Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-lg\">Alert Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4\">
                <div className=\"text-center p-3 bg-blue-50 rounded-lg\">
                  <p className=\"text-2xl font-bold text-blue-800\">
                    {alert.alertRadius}km
                  </p>
                  <p className=\"text-sm text-blue-600\">Alert Radius</p>
                </div>
                <div className=\"text-center p-3 bg-green-50 rounded-lg\">
                  <p className=\"text-2xl font-bold text-green-800\">
                    {alert.estimatedResponseTime}m
                  </p>
                  <p className=\"text-sm text-green-600\">Est. Response</p>
                </div>
                <div className=\"text-center p-3 bg-purple-50 rounded-lg\">
                  <p className=\"text-2xl font-bold text-purple-800\">
                    {alert.metadata?.donorsNotified || 0}
                  </p>
                  <p className=\"text-sm text-purple-600\">Donors Notified</p>
                </div>
                <div className=\"text-center p-3 bg-orange-50 rounded-lg\">
                  <p className=\"text-2xl font-bold text-orange-800\">
                    {alert.metadata?.notificationsSent || 0}
                  </p>
                  <p className=\"text-sm text-orange-600\">Notifications Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cancel Alert Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Emergency Alert</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this emergency alert? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className=\"space-y-4\">
              <div className=\"space-y-2\">
                <Label htmlFor=\"cancelReason\">Reason for Cancellation</Label>
                <Textarea 
                  id=\"cancelReason\"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder=\"Please provide a reason for cancelling this alert\"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant=\"outline\" onClick={() => setShowCancelDialog(false)}>
                Keep Alert Active
              </Button>
              <Button 
                variant=\"destructive\" 
                onClick={() => {
                  onCancel(cancelReason)
                  setShowCancelDialog(false)
                  onClose()
                }}
                disabled={!cancelReason.trim()}
              >
                Cancel Alert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}