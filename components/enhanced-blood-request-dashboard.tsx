"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { getEnhancedBloodRequestService } from "@/lib/enhanced-blood-request-service"
import {
  Heart,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  User,
  Building,
  Calendar,
  DollarSign,
  Shield,
  Plus,
  Search,
  Filter,
  TrendingUp,
  Users,
  Activity,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Zap,
  RefreshCw,
  Bell
} from "lucide-react"

interface BloodRequest {
  id: string
  patient_name: string
  hospital_name: string
  blood_type: string
  units_needed: number
  urgency: string
  contact_name: string
  contact_phone: string
  status: string
  priority_score: number
  urgency_level: string
  request_type: string
  created_at: string
  requester_name?: string
  institution_name?: string
  matched_donors?: number
  accepted_donors?: number
}

interface EmergencyAlert {
  id: string
  alert_type: string
  severity: string
  affected_area: Record<string, any>
  blood_types_needed: Record<string, any>
  units_required: number
  deadline: string
  status: string
  created_at: string
}

interface InventorySummary {
  institution_name: string
  blood_type: string
  current_stock: number
  available_stock: number
  stock_status: string
}

export function EnhancedBloodRequestDashboard() {
  const { user } = useEnhancedAuth()
  const bloodRequestService = getEnhancedBloodRequestService()
  const { toast } = useToast()

  const [activeRequests, setActiveRequests] = useState<BloodRequest[]>([])
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([])
  const [inventorySummary, setInventorySummary] = useState<InventorySummary[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTab, setSelectedTab] = useState("overview")
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all")
  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>("all")
  
  // Dialog states
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [userRole])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Load active requests using new API
      const requestsRes = await fetch('/api/blood-requests/create')
      
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        setActiveRequests(requestsData.data?.requests || [])
      }

      // Load statistics using enhanced service
      const statsResult = await bloodRequestService.getRequestStatistics()
      if (statsResult.success) {
        setStatistics(statsResult.data)
      }

      // Load emergency alerts (for emergency responders and admins)
      if (userRole === "emergency_responder" || userRole === "admin") {
        const alertsResult = await bloodRequestService.getActiveEmergencyAlerts()
        if (alertsResult.success) {
          setEmergencyAlerts(alertsResult.data || [])
        }
      }

      // Load inventory summary (for blood bank staff and admins)
      if (userRole === "blood_bank_staff" || userRole === "admin") {
        const inventoryResult = await bloodRequestService.getInventorySummary()
        if (inventoryResult.success) {
          setInventorySummary(inventoryResult.data || [])
        }
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
    toast({
      title: "Success",
      description: "Dashboard data refreshed",
    })
  }

  const handleDonorResponse = async (requestId: string, responseType: 'accept' | 'decline' | 'maybe') => {
    try {
      const response = await fetch('/api/blood-requests/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          response_type: responseType,
          eta_minutes: responseType === 'accept' ? 30 : undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: data.matched ? "Request Matched!" : "Response Recorded",
          description: data.message,
          variant: data.matched ? "default" : "default",
        })
        await refreshData()
      } else {
        throw new Error('Failed to record response')
      }
    } catch (error) {
      console.error('Error responding to request:', error)
      toast({
        title: "Error",
        description: "Failed to record your response",
        variant: "destructive",
      })
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "emergency":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "critical":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
      case "urgent":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      default:
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fulfilled":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "matched":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      default:
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    }
  }

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "low":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      default:
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    }
  }

  // Filter requests based on search and filters
  const filteredRequests = activeRequests.filter(request => {
    const matchesSearch = 
      request.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.hospital_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.blood_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter
    const matchesUrgency = urgencyFilter === "all" || request.urgency_level === urgencyFilter
    const matchesBloodType = bloodTypeFilter === "all" || request.blood_type === bloodTypeFilter

    return matchesSearch && matchesStatus && matchesUrgency && matchesBloodType
  })

  // Sort by priority score and urgency
  const sortedRequests = filteredRequests.sort((a, b) => {
    const urgencyOrder = { emergency: 4, critical: 3, urgent: 2, normal: 1 }
    const urgencyDiff = (urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] || 1) - (urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] || 1)
    if (urgencyDiff !== 0) return urgencyDiff
    
    return (b.priority_score || 0) - (a.priority_score || 0)
  })

  const formatTimeAgo = (dateString: string) => {
    // Avoid hydration mismatch by checking if we're on client side
    if (typeof window === 'undefined') {
      return 'Recently' // Fallback for server-side rendering
    }
    
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) return `${hours}h ${minutes}m ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blood Request Management</h1>
          <p className="text-muted-foreground">
            Manage blood requests and monitor system activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refreshData} variant="outline" size="sm" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {user?.hasPermission("create_blood_requests") && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Blood Request</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-muted-foreground">
                    Enhanced blood request form with AI-powered location detection
                    and smart donor matching would go here.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Heart className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_requests}</div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.pending_requests}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting fulfillment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fulfilled</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.fulfilled_requests}</div>
              <p className="text-xs text-muted-foreground">
                Successfully completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.success_rate?.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Average fulfillment rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Emergency Alerts */}
      {emergencyAlerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="font-semibold">
            ACTIVE EMERGENCY ALERTS - {emergencyAlerts.length} emergency situation(s) require immediate attention
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Active Requests</TabsTrigger>
          {userRole === "emergency_responder" && (
            <TabsTrigger value="emergencies">Emergencies</TabsTrigger>
          )}
          {userRole === "blood_bank_staff" && (
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Requests
                </CardTitle>
                <CardDescription>
                  Latest blood requests in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">{request.patient_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.blood_type} • {request.units_needed} units
                          </p>
                        </div>
                      </div>
                      <Badge className={getUrgencyColor(request.urgency_level)}>
                        {request.urgency_level}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {user?.hasPermission("create_blood_requests") && (
                    <Button className="w-full justify-start" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Request
                    </Button>
                  )}
                  {userRole === "emergency_responder" && (
                    <Button className="w-full justify-start" variant="outline">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Emergency Alert
                    </Button>
                  )}
                  {userRole === "blood_bank_staff" && (
                    <Button className="w-full justify-start" variant="outline">
                      <Building className="h-4 w-4 mr-2" />
                      Update Inventory
                    </Button>
                  )}
                  <Button className="w-full justify-start" variant="outline">
                    <Search className="h-4 w-4 mr-2" />
                    Search Requests
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Active Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Active Blood Requests ({filteredRequests.length})
              </CardTitle>
              <CardDescription>
                All pending and in-progress blood requests with real-time matching
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patients, hospitals, contacts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="partially_fulfilled">Partial</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Urgency</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bloodTypeFilter} onValueChange={setBloodTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Blood Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enhanced Requests List */}
              <div className="space-y-4">
                {sortedRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Heart className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No blood requests found matching your filters.</p>
                  </div>
                ) : (
                  sortedRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            request.urgency_level === 'emergency' ? 'bg-red-600 animate-pulse' :
                            request.urgency_level === 'critical' ? 'bg-orange-500' :
                            request.urgency_level === 'urgent' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></div>
                          <div>
                            <h3 className="font-semibold">{request.patient_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {request.hospital_name} • {request.contact_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Created {formatTimeAgo(request.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getUrgencyColor(request.urgency_level)}>
                            {request.urgency_level}
                          </Badge>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Blood Type:</span>
                          <p className="text-muted-foreground font-mono text-lg">{request.blood_type}</p>
                        </div>
                        <div>
                          <span className="font-medium">Units Needed:</span>
                          <p className="text-muted-foreground">{request.units_needed}</p>
                        </div>
                        <div>
                          <span className="font-medium">Priority Score:</span>
                          <div className="flex items-center gap-2">
                            <Progress value={(request.priority_score || 0) * 10} className="w-16 h-2" />
                            <span className="text-muted-foreground">{(request.priority_score || 0).toFixed(1)}/10</span>
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Matched Donors:</span>
                          <p className="text-muted-foreground">
                            {request.matched_donors?.length || 0} / {request.units_needed}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Accepted:</span>
                          <p className="text-muted-foreground">
                            {request.accepted_donors || 0}
                          </p>
                        </div>
                      </div>

                      {/* Donor Response Buttons (for donors) */}
                      {userRole === 'donor' && request.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-sm font-medium">Respond:</span>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleDonorResponse(request.id, 'accept')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDonorResponse(request.id, 'maybe')}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Maybe
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDonorResponse(request.id, 'decline')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Created: {new Date(request.created_at).toLocaleDateString()}</span>
                          {request.requester_name && (
                            <span>By: {request.requester_name}</span>
                          )}
                          {request.institution_name && (
                            <span>• {request.institution_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                          {user?.hasPermission("update_blood_requests") && (
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          {request.urgency_level === 'emergency' && (
                            <Button size="sm" className="bg-red-600 hover:bg-red-700">
                              <Zap className="h-4 w-4 mr-1" />
                              Emergency
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergencies Tab */}
        {userRole === "emergency_responder" && (
          <TabsContent value="emergencies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Emergency Alerts
                </CardTitle>
                <CardDescription>
                  Active emergency situations requiring immediate response
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {emergencyAlerts.map((alert) => (
                    <div key={alert.id} className="border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          <div>
                            <h3 className="font-semibold text-red-800 dark:text-red-200">
                              {alert.alert_type.replace('_', ' ').toUpperCase()}
                            </h3>
                            <p className="text-sm text-red-700 dark:text-red-300">
                              {alert.units_required} units needed • Deadline: {new Date(alert.deadline).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Blood Types:</span>
                          <p className="text-muted-foreground">
                            {Object.keys(alert.blood_types_needed).join(', ')}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Units Required:</span>
                          <p className="text-muted-foreground">{alert.units_required}</p>
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>
                          <p className="text-muted-foreground">{alert.status}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-red-200">
                        <span className="text-sm text-red-700 dark:text-red-300">
                          Created: {new Date(alert.created_at).toLocaleString()}
                        </span>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700">
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Respond
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Inventory Tab */}
        {userRole === "blood_bank_staff" && (
          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Blood Inventory
                </CardTitle>
                <CardDescription>
                  Current blood stock levels across all institutions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventorySummary.map((item) => (
                    <div key={`${item.institution_name}-${item.blood_type}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{item.institution_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Blood Type: {item.blood_type}
                          </p>
                        </div>
                        <Badge className={getStockStatusColor(item.stock_status)}>
                          {item.stock_status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                        <div>
                          <span className="font-medium">Current Stock:</span>
                          <p className="text-muted-foreground">{item.current_stock}</p>
                        </div>
                        <div>
                          <span className="font-medium">Available:</span>
                          <p className="text-muted-foreground">{item.available_stock}</p>
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>
                          <p className="text-muted-foreground capitalize">{item.stock_status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Request Details Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-600" />
                Blood Request Details - {selectedRequest.patient_name}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Patient Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Name:</span> {selectedRequest.patient_name}</p>
                    <p><span className="font-medium">Blood Type:</span> <span className="font-mono text-lg">{selectedRequest.blood_type}</span></p>
                    <p><span className="font-medium">Units Needed:</span> {selectedRequest.units_needed}</p>
                    <p><span className="font-medium">Urgency:</span> 
                      <Badge className={`ml-2 ${getUrgencyColor(selectedRequest.urgency_level)}`}>
                        {selectedRequest.urgency_level}
                      </Badge>
                    </p>
                    <p><span className="font-medium">Status:</span> 
                      <Badge className={`ml-2 ${getStatusColor(selectedRequest.status)}`}>
                        {selectedRequest.status}
                      </Badge>
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Hospital Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Hospital:</span> {selectedRequest.hospital_name}</p>
                    <p><span className="font-medium">Contact:</span> {selectedRequest.contact_name}</p>
                    <p><span className="font-medium">Phone:</span> {selectedRequest.contact_phone}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Request Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Priority Score:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={(selectedRequest.priority_score || 0) * 10} className="flex-1" />
                        <span>{(selectedRequest.priority_score || 0).toFixed(1)}/10</span>
                      </div>
                    </p>
                    <p><span className="font-medium">Matched Donors:</span> {selectedRequest.matched_donors?.length || 0}</p>
                    <p><span className="font-medium">Accepted Donors:</span> {selectedRequest.accepted_donors || 0}</p>
                    <p><span className="font-medium">Created:</span> {new Date(selectedRequest.created_at).toLocaleString()}</p>
                  </div>
                </div>
                
                {selectedRequest.additional_info && (
                  <div>
                    <h4 className="font-semibold mb-2">Additional Information</h4>
                    <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-900 p-3 rounded">
                      {selectedRequest.additional_info}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Donor Response Section for donors */}
            {userRole === 'donor' && selectedRequest.status === 'pending' && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Respond to Request</h4>
                <div className="flex items-center gap-3">
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleDonorResponse(selectedRequest.id, 'accept')
                      setSelectedRequest(null)
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept - I can donate
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      handleDonorResponse(selectedRequest.id, 'maybe')
                      setSelectedRequest(null)
                    }}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Maybe - Check back later
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      handleDonorResponse(selectedRequest.id, 'decline')
                      setSelectedRequest(null)
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline - Cannot donate
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 