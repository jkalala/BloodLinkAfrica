"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Brain, 
  Shield, 
  Activity, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Heart, 
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Zap
} from "lucide-react"
import { 
  getAnalyticsData, 
  getIoTDashboardData, 
  getBlockchainStats,
  findOptimalDonors 
} from "@/app/actions/phase3-actions"

interface AnalyticsData {
  total_donors: number
  total_requests: number
  total_donations: number
  success_rate: number
  avg_response_time: number
  blood_type_distribution: Record<string, number>
  efficiency_metrics: {
    matching_efficiency: number
    response_efficiency: number
    completion_efficiency: number
  }
  demand_forecast: Array<{ date: string; predicted_demand: number; confidence: number }>
}

interface IoTData {
  total_devices: number
  online_devices: number
  alerts_count: number
  critical_alerts: number
  total_blood_units: number
  quality_average: number
  devices: Array<{
    id: string
    device_type: string
    location: string
    status: string
    temperature?: number
    humidity?: number
    power_consumption?: number
  }>
  recent_alerts: Array<{
    id: string
    alert_type: string
    severity: string
    message: string
    timestamp: string
  }>
}

interface BlockchainData {
  total_records: number
  total_requests: number
  total_donations: number
  total_verifications: number
  chain_integrity: number
}

export default function Phase3Dashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [iotData, setIotData] = useState<IoTData | null>(null)
  const [blockchainData, setBlockchainData] = useState<BlockchainData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiPredictions, setAiPredictions] = useState<any[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      const [analyticsResult, iotResult, blockchainResult] = await Promise.all([
        getAnalyticsData(),
        getIoTDashboardData(),
        getBlockchainStats()
      ])

      if (analyticsResult.success && analyticsResult.data) setAnalyticsData(analyticsResult.data)
      if (iotResult.success && iotResult.data) setIotData(iotResult.data)
      if (blockchainResult.success && blockchainResult.data) setBlockchainData(blockchainResult.data)

      // Simulate AI predictions
      const predictions = await findOptimalDonors(
        "sample-request-id",
        "O+",
        "urgent",
        "Nairobi"
      )
      if (predictions.success) {
        setAiPredictions(predictions.data || [])
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getDeviceStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600'
      case 'offline': return 'text-red-600'
      case 'maintenance': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phase 3 Dashboard</h1>
          <p className="text-muted-foreground">
            Advanced features: AI Matching, Blockchain Tracking, IoT Monitoring, Analytics
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai">AI Matching</TabsTrigger>
          <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
          <TabsTrigger value="iot">IoT Monitoring</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Donors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.total_donors || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Active blood donors
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.success_rate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  Successful donations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">IoT Devices</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{iotData?.online_devices || 0}/{iotData?.total_devices || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Online devices
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chain Integrity</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{blockchainData?.chain_integrity || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  Blockchain integrity
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Efficiency Metrics</CardTitle>
                <CardDescription>System performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Matching Efficiency</span>
                    <span>{analyticsData?.efficiency_metrics.matching_efficiency || 0}%</span>
                  </div>
                  <Progress value={analyticsData?.efficiency_metrics.matching_efficiency || 0} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Response Efficiency</span>
                    <span>{analyticsData?.efficiency_metrics.response_efficiency || 0}%</span>
                  </div>
                  <Progress value={analyticsData?.efficiency_metrics.response_efficiency || 0} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Completion Efficiency</span>
                    <span>{analyticsData?.efficiency_metrics.completion_efficiency || 0}%</span>
                  </div>
                  <Progress value={analyticsData?.efficiency_metrics.completion_efficiency || 0} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Demand Forecast</CardTitle>
                <CardDescription>Predicted blood demand for next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyticsData?.demand_forecast.slice(0, 3).map((forecast, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm">{forecast.date}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{forecast.predicted_demand}</span>
                        <Badge variant="secondary">{forecast.confidence}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>AI-Powered Donor Matching</span>
              </CardTitle>
              <CardDescription>
                Machine learning predictions for optimal donor-recipient matching
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiPredictions.map((prediction, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">Donor Match #{index + 1}</h4>
                        <p className="text-sm text-muted-foreground">ID: {prediction.donor_id}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{prediction.compatibility_score}</div>
                        <div className="text-sm text-muted-foreground">Compatibility Score</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Success Probability:</span>
                        <div className="font-medium">{Math.round(prediction.success_probability * 100)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Response Time:</span>
                        <div className="font-medium">{prediction.response_time_prediction} min</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-sm text-muted-foreground">Factors:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {prediction.factors.map((factor: string, factorIndex: number) => (
                          <Badge key={factorIndex} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blockchain" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Blockchain Statistics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{blockchainData?.total_records || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Records</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{blockchainData?.total_requests || 0}</div>
                    <div className="text-sm text-muted-foreground">Blood Requests</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{blockchainData?.total_donations || 0}</div>
                    <div className="text-sm text-muted-foreground">Donations</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{blockchainData?.total_verifications || 0}</div>
                    <div className="text-sm text-muted-foreground">Verifications</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Chain Integrity</span>
                    <span>{blockchainData?.chain_integrity || 0}%</span>
                  </div>
                  <Progress value={blockchainData?.chain_integrity || 0} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transparency Features</CardTitle>
                <CardDescription>Blockchain-powered traceability</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Immutable donation records</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Complete audit trail</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Real-time verification</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Transparent supply chain</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="iot" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>IoT Device Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {iotData?.devices.map((device) => (
                    <div key={device.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium capitalize">{device.device_type}</h4>
                          <p className="text-sm text-muted-foreground">{device.location}</p>
                        </div>
                        <Badge 
                          variant={device.status === 'online' ? 'default' : 'destructive'}
                          className={getDeviceStatusColor(device.status)}
                        >
                          {device.status}
                        </Badge>
                      </div>
                      {device.temperature && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">Temperature:</span>
                          <span className="ml-1 font-medium">{device.temperature}°C</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Quality Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {iotData?.recent_alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`} />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium capitalize">{alert.alert_type}</p>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Blood Quality Metrics</CardTitle>
              <CardDescription>Real-time quality monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{iotData?.total_blood_units || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Blood Units</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{iotData?.quality_average || 0}%</div>
                  <div className="text-sm text-muted-foreground">Average Quality Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{iotData?.critical_alerts || 0}</div>
                  <div className="text-sm text-muted-foreground">Critical Alerts</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Blood Type Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData?.blood_type_distribution && 
                    Object.entries(analyticsData.blood_type_distribution).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="font-medium">{type}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${(count / Math.max(...Object.values(analyticsData.blood_type_distribution))) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{count}</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Time Analysis</CardTitle>
                <CardDescription>Average response times and efficiency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Average Response Time</span>
                    <span>{analyticsData?.avg_response_time || 0} minutes</span>
                  </div>
                  <Progress 
                    value={Math.max(0, 100 - ((analyticsData?.avg_response_time || 0) / 60) * 100)} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Requests:</span>
                    <div className="font-medium">{analyticsData?.total_requests || 0}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Donations:</span>
                    <div className="font-medium">{analyticsData?.total_donations || 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 