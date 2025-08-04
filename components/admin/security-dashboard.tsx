/**
 * Security Monitoring Dashboard
 * 
 * Comprehensive security dashboard for monitoring threats,
 * managing security policies, and viewing security analytics
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  Eye, 
  Ban, 
  Users, 
  Activity,
  TrendingUp,
  Clock,
  Globe,
  Zap,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'

interface SecurityThreat {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  description: string
  timestamp: Date
  resolved: boolean
}

interface SecurityMetrics {
  totalThreats: number
  threatsBlocked: number
  activeUsers: number
  blockedIPs: number
  threatsByType: Record<string, number>
  threatsBySeverity: Record<string, number>
  responseTime: number
}

interface SecurityEvent {
  id: string
  type: 'login' | 'logout' | 'failed_login' | 'password_change' | 'mfa_setup'
  userId: string
  email: string
  ipAddress: string
  timestamp: Date
  success: boolean
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function SecurityDashboard() {
  const [threats, setThreats] = useState<SecurityThreat[]>([])
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [blockedIPs, setBlockedIPs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchSecurityData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchSecurityData, 30000) // Update every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const fetchSecurityData = async () => {
    try {
      setIsLoading(true)
      
      const [threatsResponse, metricsResponse, eventsResponse, blockedIPsResponse] = await Promise.all([
        fetch('/api/admin/security/threats'),
        fetch('/api/admin/security/metrics'),
        fetch('/api/admin/security/events'),
        fetch('/api/admin/security/blocked-ips')
      ])

      const threatsData = await threatsResponse.json()
      const metricsData = await metricsResponse.json()
      const eventsData = await eventsResponse.json()
      const blockedIPsData = await blockedIPsResponse.json()

      setThreats(threatsData.data || [])
      setMetrics(metricsData.data)
      setEvents(eventsData.data || [])
      setBlockedIPs(blockedIPsData.data || [])
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'medium': return <Eye className="h-4 w-4" />
      case 'low': return <CheckCircle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const handleUnblockIP = async (ip: string) => {
    try {
      await fetch(`/api/admin/security/unblock-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      })
      
      setBlockedIPs(prev => prev.filter(blockedIP => blockedIP !== ip))
    } catch (error) {
      console.error('Failed to unblock IP:', error)
    }
  }

  const handleResolveThreat = async (threatId: string) => {
    try {
      await fetch(`/api/admin/security/resolve-threat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threatId, resolution: 'Manually resolved by admin' })
      })
      
      setThreats(prev => prev.map(threat => 
        threat.id === threatId ? { ...threat, resolved: true } : threat
      ))
    } catch (error) {
      console.error('Failed to resolve threat:', error)
    }
  }

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading security dashboard...</span>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load security data</h3>
        <p className="text-muted-foreground mb-4">
          There was an error loading the security dashboard.
        </p>
        <Button onClick={fetchSecurityData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const threatTimelineData = threats
    .slice(0, 24)
    .reverse()
    .map((threat, index) => ({
      time: `${index + 1}h ago`,
      threats: threats.slice(0, index + 1).length,
      blocked: threats.slice(0, index + 1).filter(t => t.severity === 'critical' || t.severity === 'high').length
    }))

  const threatTypeData = Object.entries(metrics.threatsByType).map(([type, count]) => ({
    name: type.replace('_', ' ').toUpperCase(),
    value: count
  }))

  const severityData = Object.entries(metrics.threatsBySeverity).map(([severity, count]) => ({
    name: severity.toUpperCase(),
    value: count
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time security monitoring and threat management
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button size="sm" onClick={fetchSecurityData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {threats.filter(t => t.severity === 'critical' && !t.resolved).length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Critical Security Threats Detected</AlertTitle>
          <AlertDescription className="text-red-700">
            {threats.filter(t => t.severity === 'critical' && !t.resolved).length} critical threats require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Threats</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalThreats}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.threatsBlocked} blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.blockedIPs}</div>
            <p className="text-xs text-muted-foreground">
              Automatically blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.responseTime.toFixed(1)}ms</div>
            <p className="text-xs text-muted-foreground">
              Avg detection time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Security Monitoring */}
      <Tabs defaultValue="threats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="blocked-ips">Blocked IPs</TabsTrigger>
        </TabsList>

        <TabsContent value="threats" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Threat Timeline</CardTitle>
                <CardDescription>Security threats detected over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={threatTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="threats" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="blocked" 
                      stackId="1"
                      stroke="#ff7300" 
                      fill="#ff7300" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Threat Types</CardTitle>
                <CardDescription>Distribution of detected threats</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={threatTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {threatTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Threats</CardTitle>
              <CardDescription>Latest security threats detected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {threats.slice(0, 10).map((threat) => (
                  <div key={threat.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${getSeverityColor(threat.severity)}`}>
                        {getSeverityIcon(threat.severity)}
                      </div>
                      <div>
                        <div className="font-medium">{threat.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {threat.type.replace('_', ' ')} from {threat.source}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {threat.timestamp.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={threat.resolved ? 'default' : 'destructive'}>
                        {threat.resolved ? 'Resolved' : threat.severity.toUpperCase()}
                      </Badge>
                      {!threat.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveThreat(threat.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Threat Severity Distribution</CardTitle>
                <CardDescription>Breakdown by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
                <CardDescription>Key security performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Detection Rate</span>
                  <span className="font-bold">
                    {((metrics.threatsBlocked / metrics.totalThreats) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>False Positive Rate</span>
                  <span className="font-bold">2.1%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Mean Time to Detection</span>
                  <span className="font-bold">{metrics.responseTime.toFixed(1)}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Mean Time to Response</span>
                  <span className="font-bold">1.2s</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>Recent authentication and security events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.slice(0, 20).map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <div className={`p-1 rounded-full ${event.success ? 'bg-green-100' : 'bg-red-100'}`}>
                        {event.success ? 
                          <CheckCircle className="h-3 w-3 text-green-600" /> : 
                          <XCircle className="h-3 w-3 text-red-600" />
                        }
                      </div>
                      <div>
                        <div className="font-medium">{event.type.replace('_', ' ').toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.email} from {event.ipAddress}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {event.timestamp.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked-ips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blocked IP Addresses</CardTitle>
              <CardDescription>IP addresses currently blocked by the security system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {blockedIPs.map((ip) => (
                  <div key={ip} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{ip}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnblockIP(ip)}
                    >
                      Unblock
                    </Button>
                  </div>
                ))}
                {blockedIPs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No IP addresses are currently blocked
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
