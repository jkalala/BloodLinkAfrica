"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

interface BloodUnit {
  id: string
  donor_id: string
  blood_type: string
  volume: number
  collection_date: string
  expiry_date: string
  status: 'available' | 'reserved' | 'used' | 'expired' | 'quarantine' | 'testing'
  location: string
  storage_temperature: number
  storage_humidity: number
  quality_score: number
  batch_number: string
  test_results: {
    hiv: 'negative' | 'positive' | 'pending'
    hepatitisB: 'negative' | 'positive' | 'pending'
    hepatitisC: 'negative' | 'positive' | 'pending'
    syphilis: 'negative' | 'positive' | 'pending'
    completedAt?: string
  }
  metadata: {
    collectionCenter: string
    processingStaff: string
    notes?: string
  }
  reserved_for_request?: string
  reserved_at?: string
  created_at: string
  updated_at: string
}

interface InventoryStats {
  totalUnits: number
  availableUnits: number
  reservedUnits: number
  expiringSoon: number
  byBloodType: Record<string, {
    available: number
    reserved: number
    expiring: number
    total: number
  }>
  storageUtilization: number
  qualityMetrics: {
    averageQualityScore: number
    unitsInTesting: number
    qualityIssues: number
  }
}

interface InventoryAlert {
  id: string
  type: 'low_stock' | 'expiry_warning' | 'critical_shortage' | 'temperature_alert' | 'quality_issue'
  severity: 'low' | 'medium' | 'high' | 'critical'
  bloodType?: string
  message: string
  details: any
  createdAt: string
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
}

export function EnhancedInventoryManagement() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Data states
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [bloodUnits, setBloodUnits] = useState<BloodUnit[]>([])
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>("all")
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage] = useState(20)

  // Load initial data
  useEffect(() => {
    loadInventoryData()
  }, [])

  const loadInventoryData = async () => {
    try {
      setLoading(true)
      
      // Load stats, units, and alerts in parallel
      const [statsRes, unitsRes, alertsRes] = await Promise.all([
        fetch('/api/inventory/stats'),
        fetch('/api/inventory/units?limit=100'),
        fetch('/api/inventory/alerts?resolved=false&limit=20')
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.data.stats)
      }

      if (unitsRes.ok) {
        const unitsData = await unitsRes.json()
        setBloodUnits(unitsData.data.units || [])
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlerts(alertsData.data.alerts || [])
      }

    } catch (error) {
      console.error('Error loading inventory data:', error)
      toast({
        title: "Error",
        description: "Failed to load inventory data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadInventoryData()
    setRefreshing(false)
    toast({
      title: "Success",
      description: "Inventory data refreshed",
    })
  }

  const checkForAlerts = async () => {
    try {
      const response = await fetch('/api/inventory/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.data.newAlerts.length > 0) {
          setAlerts(prev => [...data.data.newAlerts, ...prev])
          toast({
            title: "New Alerts",
            description: `Found ${data.data.newAlerts.length} new inventory alerts`,
            variant: "destructive",
          })
        } else {
          toast({
            title: "No Issues",
            description: "No new inventory alerts found",
          })
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error)
    }
  }

  const processExpiredUnits = async () => {
    try {
      const response = await fetch('/api/inventory/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_expired' })
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Expired Units Processed",
          description: `${data.data.processedCount} expired units have been disposed of`,
        })
        await refreshData()
      }
    } catch (error) {
      console.error('Error processing expired units:', error)
      toast({
        title: "Error",
        description: "Failed to process expired units",
        variant: "destructive",
      })
    }
  }

  const resolveAlert = async (alertId: string, resolution: string) => {
    try {
      const response = await fetch('/api/inventory/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'resolve',
          alertId,
          resolution
        })
      })

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId))
        toast({
          title: "Alert Resolved",
          description: "Alert has been marked as resolved",
        })
      }
    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  // Filter blood units based on search and filters
  const filteredUnits = bloodUnits.filter(unit => {
    const matchesSearch = unit.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         unit.blood_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         unit.location.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || unit.status === statusFilter
    const matchesBloodType = bloodTypeFilter === "all" || unit.blood_type === bloodTypeFilter

    return matchesSearch && matchesStatus && matchesBloodType
  })

  // Paginated units
  const paginatedUnits = filteredUnits.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  )

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available': return 'default'
      case 'reserved': return 'secondary'
      case 'testing': return 'outline'
      case 'expired': return 'destructive'
      case 'quarantine': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="h-4 w-4" />
      case 'reserved': return <Clock className="h-4 w-4" />
      case 'testing': return <AlertCircle className="h-4 w-4" />
      case 'expired': return <XCircle className="h-4 w-4" />
      case 'quarantine': return <AlertTriangle className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50'
      case 'high': return 'border-orange-500 bg-orange-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      case 'low': return 'border-blue-500 bg-blue-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  const formatDate = (dateString: string) => {
    // Avoid hydration mismatch
    if (typeof window === 'undefined') {
      return dateString.split('T')[0] // Return YYYY-MM-DD format for SSR
    }
    return new Date(dateString).toLocaleDateString()
  }

  const getDaysUntilExpiry = (expiryDate: string) => {
    // Avoid hydration mismatch
    if (typeof window === 'undefined') {
      return 0 // Fallback for server-side rendering
    }
    const days = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enhanced Inventory Management</h1>
          <p className="text-muted-foreground">
            AI-powered blood inventory with real-time tracking and automated alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkForAlerts}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Check Alerts
          </Button>
          <Button variant="outline" onClick={processExpiredUnits}>
            <XCircle className="h-4 w-4 mr-2" />
            Process Expired
          </Button>
          <Button variant="outline" onClick={refreshData} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Units
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <Alert key={alert.id} className={getAlertSeverityColor(alert.severity)}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{alert.message}</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => resolveAlert(alert.id, 'Manually resolved')}
                >
                  Resolve
                </Button>
              </AlertDescription>
            </Alert>
          ))}
          {alerts.length > 3 && (
            <p className="text-sm text-muted-foreground">
              +{alerts.length - 3} more alerts
            </p>
          )}
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Units</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUnits}</div>
              <p className="text-xs text-muted-foreground">
                {stats.availableUnits} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
              <p className="text-xs text-muted-foreground">
                Within 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.storageUtilization}%</div>
              <Progress value={stats.storageUtilization} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.qualityMetrics.averageQualityScore}</div>
              <p className="text-xs text-muted-foreground">
                {stats.qualityMetrics.qualityIssues} quality issues
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Blood Type Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Blood Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {Object.entries(stats.byBloodType).map(([type, data]) => (
                <div key={type} className="text-center">
                  <div className="text-lg font-bold">{type}</div>
                  <div className="text-2xl font-bold text-red-600">{data.available}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.reserved} reserved
                  </div>
                  {data.expiring > 0 && (
                    <div className="text-xs text-orange-600">
                      {data.expiring} expiring
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Blood Units ({filteredUnits.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by batch number, blood type, or location..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="quarantine">Quarantine</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bloodTypeFilter} onValueChange={setBloodTypeFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Blood Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="O+">O+</SelectItem>
                <SelectItem value="O-">O-</SelectItem>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A-">A-</SelectItem>
                <SelectItem value="B+">B+</SelectItem>
                <SelectItem value="B-">B-</SelectItem>
                <SelectItem value="AB+">AB+</SelectItem>
                <SelectItem value="AB-">AB-</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Blood Units Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUnits.map((unit) => {
                  const daysUntilExpiry = getDaysUntilExpiry(unit.expiry_date)
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.batch_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{unit.blood_type}</Badge>
                      </TableCell>
                      <TableCell>{unit.volume}mL</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(unit.status)} className="flex items-center gap-1 w-fit">
                          {getStatusIcon(unit.status)}
                          {unit.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm">{unit.quality_score}</div>
                          <div className={`w-2 h-2 rounded-full ${
                            unit.quality_score >= 90 ? 'bg-green-500' :
                            unit.quality_score >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm ${
                          daysUntilExpiry <= 7 ? 'text-red-600 font-medium' :
                          daysUntilExpiry <= 14 ? 'text-orange-600' : ''
                        }`}>
                          {formatDate(unit.expiry_date)}
                          <div className="text-xs text-muted-foreground">
                            {daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'Expired'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{unit.location}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredUnits.length > itemsPerPage && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * itemsPerPage + 1} to {Math.min((currentPage + 1) * itemsPerPage, filteredUnits.length)} of {filteredUnits.length} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={(currentPage + 1) * itemsPerPage >= filteredUnits.length}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}