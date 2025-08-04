"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { 
  Heart, 
  User, 
  Building, 
  Package, 
  Shield, 
  AlertTriangle,
  TrendingUp,
  Users,
  Activity,
  MapPin,
  Clock,
  Award,
  Bell,
  Settings,
  Plus,
  Search,
  Filter
} from "lucide-react"

interface DashboardStats {
  totalDonations: number
  activeRequests: number
  savedLives: number
  points: number
  responseRate: number
}

interface BloodRequest {
  id: string
  patientName: string
  bloodType: string
  urgency: string
  location: string
  status: string
  createdAt: string
}

export function RoleBasedDashboard() {
  const { user } = useEnhancedAuth()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Mock data - in real app, this would come from API
  const stats: DashboardStats = {
    totalDonations: 12,
    activeRequests: 5,
    savedLives: 24,
    points: 850,
    responseRate: 85
  }

  const recentRequests: BloodRequest[] = [
    {
      id: "1",
      patientName: "Sarah Johnson",
      bloodType: "O+",
      urgency: "urgent",
      location: "Nairobi General Hospital",
      status: "pending",
      createdAt: "2024-01-15T10:30:00Z"
    },
    {
      id: "2",
      patientName: "Michael Chen",
      bloodType: "A-",
      urgency: "critical",
      location: "Kenyatta National Hospital",
      status: "matched",
      createdAt: "2024-01-15T09:15:00Z"
    }
  ]

  const renderDonorDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Donations</CardTitle>
            <Heart className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDonations}</div>
            <p className="text-xs text-muted-foreground">+2 this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lives Saved</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.savedLives}</div>
            <p className="text-xs text-muted-foreground">Through your donations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Earned</CardTitle>
            <Award className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.points}</div>
            <p className="text-xs text-muted-foreground">+150 this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.responseRate}%</div>
            <p className="text-xs text-muted-foreground">Of requests responded to</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Respond to urgent blood requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Button className="w-full" variant="outline">
              <Search className="mr-2 h-4 w-4" />
              Find Nearby Requests
            </Button>
            <Button className="w-full" variant="outline">
              <Bell className="mr-2 h-4 w-4" />
              Set Availability
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Blood Requests</CardTitle>
          <CardDescription>Urgent requests in your area</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col">
                    <p className="font-medium">{request.patientName}</p>
                    <p className="text-sm text-muted-foreground">{request.location}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={request.urgency === 'critical' ? 'destructive' : 'secondary'}>
                    {request.bloodType}
                  </Badge>
                  <Badge variant={request.urgency === 'critical' ? 'destructive' : 'default'}>
                    {request.urgency}
                  </Badge>
                  <Button size="sm">Respond</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderHospitalStaffDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRequests}</div>
            <p className="text-xs text-muted-foreground">+3 new today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Donors</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">In your area</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.3h</div>
            <p className="text-xs text-muted-foreground">Average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">Requests fulfilled</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hospital Management</CardTitle>
          <CardDescription>Manage blood requests and donor coordination</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Blood Request
            </Button>
            <Button className="w-full" variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Manage Donors
            </Button>
            <Button className="w-full" variant="outline">
              <Activity className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Blood Requests</CardTitle>
          <CardDescription>Manage and track blood requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col">
                    <p className="font-medium">{request.patientName}</p>
                    <p className="text-sm text-muted-foreground">{request.location}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={request.urgency === 'critical' ? 'destructive' : 'secondary'}>
                    {request.bloodType}
                  </Badge>
                  <Badge variant={request.status === 'matched' ? 'default' : 'secondary'}>
                    {request.status}
                  </Badge>
                  <Button size="sm">Manage</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderBloodBankStaffDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground">Units available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Blood types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-xs text-muted-foreground">Pass rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipment</CardTitle>
            <Settings className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Active machines</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Blood Bank Management</CardTitle>
          <CardDescription>Manage inventory and quality control</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Inventory
            </Button>
            <Button className="w-full" variant="outline">
              <Shield className="mr-2 h-4 w-4" />
              Quality Control
            </Button>
            <Button className="w-full" variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              Generate Reports
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Status */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Status</CardTitle>
          <CardDescription>Current blood type availability</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bloodType) => (
              <div key={bloodType} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{bloodType}</Badge>
                  <span className="text-sm font-medium">245 units</span>
                </div>
                <Progress value={75} className="w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderEmergencyResponderDashboard = () => (
    <div className="space-y-6">
      {/* Emergency Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Active Emergencies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">3</div>
            <p className="text-xs text-red-600 dark:text-red-400">Critical situations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.5min</div>
            <p className="text-xs text-muted-foreground">Average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Units</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">Emergency stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">96%</div>
            <p className="text-xs text-muted-foreground">Lives saved</p>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Actions */}
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="text-red-700 dark:text-red-300">Emergency Actions</CardTitle>
          <CardDescription className="text-red-600 dark:text-red-400">
            Quick access to emergency functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Button className="w-full bg-red-600 hover:bg-red-700">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Emergency Alert
            </Button>
            <Button className="w-full bg-orange-600 hover:bg-orange-700">
              <Users className="mr-2 h-4 w-4" />
              Mobilize Donors
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Access Status */}
      {isEmergencyResponder() && (
        <Card>
          <CardHeader>
            <CardTitle>Emergency Access Status</CardTitle>
            <CardDescription>Your current emergency privileges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-medium">Emergency Access Active</span>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              You have full access to all emergency functions and data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderGovernmentOfficialDashboard = () => (
    <div className="space-y-6">
      {/* Public Health Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Donors</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,847</div>
            <p className="text-xs text-muted-foreground">Registered donors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blood Supply</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">Adequate levels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hospitals</CardTitle>
            <Building className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">Participating</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-muted-foreground">Requests fulfilled</p>
          </CardContent>
        </Card>
      </div>

      {/* Government Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Government Functions</CardTitle>
          <CardDescription>Public health monitoring and management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button className="w-full">
              <TrendingUp className="mr-2 h-4 w-4" />
              Generate Reports
            </Button>
            <Button className="w-full" variant="outline">
              <Shield className="mr-2 h-4 w-4" />
              Emergency Preparedness
            </Button>
            <Button className="w-full" variant="outline">
              <Activity className="mr-2 h-4 w-4" />
              Monitor Supply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Public Health Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Public Health Metrics</CardTitle>
          <CardDescription>Key indicators for blood donation system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Donor Retention Rate</span>
              <div className="flex items-center space-x-2">
                <Progress value={78} className="w-24" />
                <span className="text-sm">78%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Emergency Response Time</span>
              <div className="flex items-center space-x-2">
                <Progress value={92} className="w-24" />
                <span className="text-sm">92%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Blood Type Distribution</span>
              <div className="flex items-center space-x-2">
                <Progress value={85} className="w-24" />
                <span className="text-sm">85%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Determine which dashboard to render based on stakeholder type
  const renderDashboard = () => {
    switch (user.stakeholder_type) {
      case 'donor':
        return renderDonorDashboard()
      case 'hospital_staff':
        return renderHospitalStaffDashboard()
      case 'blood_bank_staff':
        return renderBloodBankStaffDashboard()
      case 'emergency_responder':
        return renderEmergencyResponderDashboard()
      case 'government_official':
        return renderGovernmentOfficialDashboard()
      case 'recipient':
        return renderDonorDashboard() // Similar to donor for now
      default:
        return renderDonorDashboard()
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user.name}!</h1>
          <p className="text-muted-foreground">
            {user.institution ? `Working at ${user.institution.name}` : 'Blood donation hero'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{user.stakeholder_type}</Badge>
          {user.emergency_access && (
            <Badge variant="destructive">Emergency Access</Badge>
          )}
        </div>
      </div>

      {/* Role-based Dashboard Content */}
      {renderDashboard()}
    </div>
  )
} 