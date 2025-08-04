'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Activity, 
  Users, 
  Globe, 
  Lock,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface SecurityMetrics {
  totalEvents: number
  eventsByType: Record<string, number>
  eventsByRisk: Record<string, number>
  topThreats: Array<{ type: string; count: number }>
  suspiciousIPs: Array<{ ip: string; events: number }>
}

interface ThreatAlert {
  id: string
  type: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  timestamp: string
  resolved: boolean
}

interface SystemHealth {
  authentication: 'healthy' | 'warning' | 'critical'
  database: 'healthy' | 'warning' | 'critical'
  rateLimit: 'healthy' | 'warning' | 'critical'
  monitoring: 'healthy' | 'warning' | 'critical'
}

export function SecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalEvents: 0,
    eventsByType: {},
    eventsByRisk: {},
    topThreats: [],
    suspiciousIPs: []
  })
  
  const [threats, setThreats] = useState<ThreatAlert[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    authentication: 'healthy',
    database: 'healthy',
    rateLimit: 'healthy',
    monitoring: 'healthy'
  })
  
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const [loading, setLoading] = useState(false)

  // Mock data for demonstration - in production, this would fetch from your security monitoring API
  useEffect(() => {
    loadSecurityData()
  }, [timeRange])

  const loadSecurityData = async () => {
    setLoading(true)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock data - replace with actual API calls
    setMetrics({
      totalEvents: 1247,
      eventsByType: {
        'login_failure': 89,
        'rate_limit_exceeded': 156,
        'malicious_input_detected': 23,
        'authentication_required': 67,
        'suspicious_activity': 12
      },
      eventsByRisk: {
        'low': 892,
        'medium': 267,
        'high': 78,
        'critical': 10
      },
      topThreats: [
        { type: 'Rate Limit Exceeded', count: 156 },
        { type: 'Login Failures', count: 89 },
        { type: 'Auth Required', count: 67 },
        { type: 'Malicious Input', count: 23 },
        { type: 'Suspicious Activity', count: 12 }
      ],
      suspiciousIPs: [
        { ip: '192.168.1.100', events: 45 },
        { ip: '10.0.0.50', events: 23 },
        { ip: '172.16.0.75', events: 18 },
        { ip: '203.0.113.42', events: 12 }
      ]
    })

    setThreats([
      {
        id: '1',
        type: 'critical',
        title: 'Multiple Failed Login Attempts',
        description: 'IP 192.168.1.100 has exceeded login failure threshold',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        resolved: false
      },
      {
        id: '2',
        type: 'high',
        title: 'SQL Injection Attempt Detected',
        description: 'Malicious input detected in /api/users endpoint',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        resolved: true
      },
      {
        id: '3',
        type: 'medium',
        title: 'Rate Limit Threshold Reached',
        description: 'API rate limit at 85% for endpoint /api/blood-requests',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        resolved: false
      }
    ])

    setSystemHealth({
      authentication: 'healthy',
      database: 'healthy',
      rateLimit: 'warning',
      monitoring: 'healthy'
    })

    setLoading(false)
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getThreatBadgeColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const resolveAlert = (alertId: string) => {
    setThreats(prev => prev.map(threat => 
      threat.id === alertId ? { ...threat, resolved: true } : threat
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSecurityData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Authentication</span>
              </div>
              {getHealthIcon(systemHealth.authentication)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">Database</span>
              </div>
              {getHealthIcon(systemHealth.database)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Rate Limiting</span>
              </div>
              {getHealthIcon(systemHealth.rateLimit)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Monitoring</span>
              </div>
              {getHealthIcon(systemHealth.monitoring)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="1h">Last Hour</TabsTrigger>
            <TabsTrigger value="24h">Last 24 Hours</TabsTrigger>
            <TabsTrigger value="7d">Last 7 Days</TabsTrigger>
            <TabsTrigger value="30d">Last 30 Days</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={timeRange} className="space-y-6">
          {/* Security Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalEvents.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Security events detected</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">High Risk Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {(metrics.eventsByRisk.high || 0) + (metrics.eventsByRisk.critical || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Requiring immediate attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Suspicious IPs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.suspiciousIPs.length}</div>
                <p className="text-xs text-muted-foreground">IP addresses flagged</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Threat</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {metrics.topThreats[0]?.type || 'None'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.topThreats[0]?.count || 0} occurrences
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Threats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span>Active Threat Alerts</span>
              </CardTitle>
              <CardDescription>
                Security incidents requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {threats.filter(t => !t.resolved).map((threat) => (
                  <Alert key={threat.id} className={threat.type === 'critical' ? 'border-red-500' : ''}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{threat.title}</span>
                        <Badge variant={getThreatBadgeColor(threat.type) as any}>
                          {threat.type.toUpperCase()}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(threat.id)}
                      >
                        Resolve
                      </Button>
                    </AlertTitle>
                    <AlertDescription>
                      <div className="mt-2">
                        <p>{threat.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(threat.timestamp)}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
                
                {threats.filter(t => !t.resolved).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No active threats detected</p>
                    <p className="text-sm">Your system is secure</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Threat Types and Suspicious IPs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Threat Types</CardTitle>
                <CardDescription>Most common security events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topThreats.map((threat, index) => (
                    <div key={threat.type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm">{threat.type}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{threat.count}</span>
                        <div className="w-16">
                          <Progress 
                            value={(threat.count / metrics.topThreats[0]?.count) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Suspicious IP Addresses</CardTitle>
                <CardDescription>IPs with unusual activity patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.suspiciousIPs.map((ip) => (
                    <div key={ip.ip} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-mono">{ip.ip}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{ip.events} events</Badge>
                        <Button variant="outline" size="sm">
                          Block
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {metrics.suspiciousIPs.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Globe className="h-8 w-8 mx-auto mb-2" />
                      <p>No suspicious IPs detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Level Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Level Distribution</CardTitle>
              <CardDescription>Security events by risk severity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(metrics.eventsByRisk).map(([risk, count]) => (
                  <div key={risk} className="text-center">
                    <div className={`text-2xl font-bold ${
                      risk === 'critical' ? 'text-red-600' :
                      risk === 'high' ? 'text-orange-500' :
                      risk === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {count}
                    </div>
                    <div className={`text-sm capitalize ${
                      risk === 'critical' ? 'text-red-600' :
                      risk === 'high' ? 'text-orange-500' :
                      risk === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {risk}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}