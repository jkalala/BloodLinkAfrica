"use client"

import { useI18n } from "@/lib/i18n/client"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart
} from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { useState, useEffect } from "react"
import { analyticsService, type AnalyticsData, type AnalyticsFilter } from "@/lib/analytics-service"
import { realTimeAnalyticsService, type RealTimeMetrics, type RealTimeUpdate } from "@/lib/real-time-analytics-service"
import { Activity, TrendingUp, Users, AlertTriangle, Download, RefreshCw, Search, Filter, Calendar, Zap, Clock, Target } from "lucide-react"

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"]

export default function AnalyticsPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string
  const [timeRange, setTimeRange] = useState("6m")
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTab, setSelectedTab] = useState("overview")
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<AnalyticsFilter>({})
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null)
  const [realtimeUpdates, setRealtimeUpdates] = useState<RealTimeUpdate[]>([])
  const [performanceInsights, setPerformanceInsights] = useState<any>(null)
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false)

  const fetchAnalyticsData = async () => {
    try {
      setRefreshing(true)
      
      // Build filter with date range
      const currentFilter: AnalyticsFilter = {
        ...filter,
        dateRange: dateRange.from && dateRange.to ? {
          start: dateRange.from.toISOString(),
          end: dateRange.to.toISOString()
        } : undefined
      }
      
      const data = await analyticsService.getAnalyticsData(currentFilter)
      const inventory = await analyticsService.getInventoryLevels()
      const shortages = await analyticsService.getCriticalShortages()
      
      setAnalyticsData({
        ...data,
        inventory_levels: inventory,
        critical_shortages: shortages,
        real_time_metrics: {
          active_requests: Math.floor(Math.random() * 20) + 5,
          available_donors: Math.round(data.total_donors * 0.7),
          emergency_alerts: shortages.length,
          avg_match_time: data.avg_response_time
        }
      })
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null)
      return
    }
    
    try {
      setIsSearching(true)
      const currentFilter: AnalyticsFilter = {
        ...filter,
        dateRange: dateRange.from && dateRange.to ? {
          start: dateRange.from.toISOString(),
          end: dateRange.to.toISOString()
        } : undefined
      }
      
      const results = await analyticsService.searchAnalyticsData(searchTerm, currentFilter)
      setSearchResults(results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }
  
  const applyFilters = () => {
    fetchAnalyticsData()
    setShowFilters(false)
  }
  
  const clearFilters = () => {
    setFilter({})
    setDateRange({})
    setSearchTerm("")
    setSearchResults(null)
    fetchAnalyticsData()
  }

  const exportData = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      if (!analyticsData) return
      const exportedData = await analyticsService.exportData(format)
      
      let filename = `blood-connect-analytics.${format}`
      let mimeType = 'text/plain'
      
      switch (format) {
        case 'csv':
          mimeType = 'text/csv'
          break
        case 'json':
          mimeType = 'application/json'
          break
        case 'pdf':
          mimeType = 'application/pdf'
          break
      }
      
      const blob = new Blob([exportedData], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export data:', error)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchAnalyticsData, 30000)
    return () => clearInterval(interval)
  }, [timeRange, filter, dateRange])

  // Initialize real-time analytics
  useEffect(() => {
    // Connect to real-time service
    realTimeAnalyticsService.connect()
      .then(() => {
        setIsRealTimeConnected(true)
        console.log('✅ Real-time analytics connected')
      })
      .catch(error => {
        console.warn('⚠️ Real-time analytics connection failed, using polling fallback:', error)
        setIsRealTimeConnected(false)
      })

    // Subscribe to real-time metrics updates
    const unsubscribeMetrics = realTimeAnalyticsService.onMetricsUpdate((metrics) => {
      setRealTimeMetrics(metrics)
    })

    // Subscribe to real-time updates
    const unsubscribeUpdates = realTimeAnalyticsService.onUpdate((update) => {
      setRealtimeUpdates(prev => {
        const newUpdates = [update, ...prev.slice(0, 19)] // Keep last 20 updates
        return newUpdates
      })
      
      // If it's an emergency alert, trigger notification
      if (update.type === 'emergency_alert') {
        // In a real app, this would trigger a browser notification
        console.log('🚨 Emergency alert:', update.data)
      }
    })

    // Fetch performance insights
    const fetchInsights = async () => {
      try {
        const insights = await realTimeAnalyticsService.getPerformanceInsights()
        setPerformanceInsights(insights)
      } catch (error) {
        console.error('Failed to fetch performance insights:', error)
      }
    }

    fetchInsights()
    const insightsInterval = setInterval(fetchInsights, 60000) // Update every minute

    return () => {
      unsubscribeMetrics()
      unsubscribeUpdates()
      clearInterval(insightsInterval)
      realTimeAnalyticsService.disconnect()
    }
  }, [])
  
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch()
      } else {
        setSearchResults(null)
      }
    }, 300)
    
    return () => clearTimeout(delayedSearch)
  }, [searchTerm])

  if (loading || !analyticsData) {
    return (
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
        <MobileNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading analytics...</span>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6" />
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">Real-time blood donation insights and forecasting</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="Search donors, requests, locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {isSearching && (
                  <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {(Object.keys(filter).length > 0 || dateRange.from || dateRange.to) && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {Object.keys(filter).length + (dateRange.from ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="font-medium">Filter Analytics</div>
                    
                    <div className="grid gap-2">
                      <Label>Date Range</Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 text-left font-normal">
                              <Calendar className="h-4 w-4" />
                              {dateRange.from ? format(dateRange.from, 'MMM dd') : 'From'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateRange.from}
                              onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 text-left font-normal">
                              <Calendar className="h-4 w-4" />
                              {dateRange.to ? format(dateRange.to, 'MMM dd') : 'To'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateRange.to}
                              onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label>Blood Type</Label>
                      <Select value={filter.bloodType || ''} onValueChange={(value) => setFilter(prev => ({ ...prev, bloodType: value || undefined }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="All blood types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All blood types</SelectItem>
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
                    
                    <div className="grid gap-2">
                      <Label>Urgency Level</Label>
                      <Select value={filter.urgencyLevel || ''} onValueChange={(value) => setFilter(prev => ({ ...prev, urgencyLevel: value || undefined }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="All urgency levels" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All urgency levels</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={filter.status || ''} onValueChange={(value) => setFilter(prev => ({ ...prev, status: value || undefined }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All statuses</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button onClick={applyFilters} size="sm" className="flex-1">
                        Apply Filters
                      </Button>
                      <Button onClick={clearFilters} variant="outline" size="sm">
                        Clear
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData('csv')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalyticsData}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              {/* Real-time connection indicator */}
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${isRealTimeConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-muted-foreground">
                  {isRealTimeConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced Real-time metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realTimeMetrics?.active_requests || analyticsData.real_time_metrics?.active_requests || 0}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">Live</Badge>
                  {realTimeMetrics && (
                    <div className="text-xs text-muted-foreground">
                      {realTimeMetrics.requests_last_hour} in last hour
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Donors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(realTimeMetrics?.available_donors || analyticsData.real_time_metrics?.available_donors || 0)}</div>
                <div className="text-xs text-muted-foreground">out of {analyticsData.total_donors} total</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate Today</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realTimeMetrics?.success_rate_today || analyticsData.success_rate}%</div>
                <Progress value={realTimeMetrics?.success_rate_today || analyticsData.success_rate} className="mt-2" />
                {realTimeMetrics && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {realTimeMetrics.responses_last_hour} responses/hour
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Load</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realTimeMetrics?.system_load || 0}%</div>
                <Progress 
                  value={realTimeMetrics?.system_load || 0} 
                  className={`mt-2 ${(realTimeMetrics?.system_load || 0) > 80 ? 'bg-red-100' : (realTimeMetrics?.system_load || 0) > 60 ? 'bg-yellow-100' : 'bg-green-100'}`}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Avg match: {realTimeMetrics?.avg_match_time || 0}min
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Performance Insights */}
          {performanceInsights && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Performance Insights
                </CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-400">
                  AI-powered recommendations to optimize your blood network
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Bottlenecks */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Current Bottlenecks</h4>
                    {performanceInsights.bottlenecks.length > 0 ? (
                      <ul className="space-y-1">
                        {performanceInsights.bottlenecks.map((bottleneck: string, index: number) => (
                          <li key={index} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3" />
                            {bottleneck}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-green-600 dark:text-green-400">No major bottlenecks detected</p>
                    )}
                  </div>
                  
                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Recommendations</h4>
                    {performanceInsights.recommendations.length > 0 ? (
                      <ul className="space-y-1">
                        {performanceInsights.recommendations.map((recommendation: string, index: number) => (
                          <li key={index} className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" />
                            {recommendation}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-green-600 dark:text-green-400">System performing optimally</p>
                    )}
                  </div>
                </div>
                
                {/* Trends */}
                {performanceInsights.trends && performanceInsights.trends.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-sm mb-2">Key Trends</h4>
                    <div className="flex flex-wrap gap-2">
                      {performanceInsights.trends.map((trend: any, index: number) => (
                        <Badge 
                          key={index} 
                          variant={trend.direction === 'up' ? 'default' : trend.direction === 'down' ? 'secondary' : 'outline'}
                          className="gap-1"
                        >
                          {trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'}
                          {trend.metric}: {trend.percentage}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Real-time Updates Feed */}
          {realtimeUpdates.length > 0 && (
            <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Live Activity Feed
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Recent system events and updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {realtimeUpdates.slice(0, 10).map((update, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                      <div className="flex items-center gap-2">
                        {update.type === 'emergency_alert' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {update.type === 'new_request' && <Activity className="h-4 w-4 text-blue-500" />}
                        {update.type === 'new_response' && <Users className="h-4 w-4 text-green-500" />}
                        {update.type === 'completion' && <TrendingUp className="h-4 w-4 text-green-600" />}
                        {update.type === 'metrics_update' && <Zap className="h-4 w-4 text-yellow-500" />}
                        <div>
                          <div className="text-sm font-medium">
                            {update.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(update.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Live
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Critical Shortages Alert */}
          {analyticsData.critical_shortages && analyticsData.critical_shortages.length > 0 && (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Critical Blood Shortages
                </CardTitle>
                <CardDescription className="text-red-600 dark:text-red-400">
                  Immediate attention required for the following blood types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {analyticsData.critical_shortages.map((shortage) => (
                    <div key={shortage.blood_type} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div>
                        <div className="font-medium">{shortage.blood_type}</div>
                        <div className="text-sm text-muted-foreground">{shortage.current_level} units left</div>
                      </div>
                      <Badge variant={shortage.days_until_critical <= 3 ? "destructive" : "secondary"}>
                        {shortage.days_until_critical}d left
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search Results */}
          {searchResults && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search Results for "{searchTerm}"
                </CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-400">
                  Found {searchResults.donors.length} donors, {searchResults.requests.length} requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="donors" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="donors">Donors ({searchResults.donors.length})</TabsTrigger>
                    <TabsTrigger value="requests">Requests ({searchResults.requests.length})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="donors" className="mt-4">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {searchResults.donors.map((donor: any) => (
                        <div key={donor.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <div>
                            <div className="font-medium">{donor.full_name}</div>
                            <div className="text-sm text-muted-foreground">{donor.blood_type} • {donor.location}</div>
                          </div>
                          <Badge variant={donor.available ? "default" : "secondary"}>
                            {donor.available ? "Available" : "Unavailable"}
                          </Badge>
                        </div>
                      ))}
                      {searchResults.donors.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          No donors found matching your search
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="requests" className="mt-4">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {searchResults.requests.map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <div>
                            <div className="font-medium">{request.blood_type} blood needed</div>
                            <div className="text-sm text-muted-foreground">
                              {request.location} • {new Date(request.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              request.emergency_level === 'critical' ? 'destructive' :
                              request.emergency_level === 'high' ? 'secondary' : 'default'
                            }>
                              {request.emergency_level}
                            </Badge>
                            <Badge variant={
                              request.status === 'completed' ? 'default' :
                              request.status === 'active' ? 'secondary' : 'outline'
                            }>
                              {request.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {searchResults.requests.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          No requests found matching your search
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trends">Trends & Forecast</TabsTrigger>
              <TabsTrigger value="bloodTypes">Blood Types</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Requests vs Donations</CardTitle>
                    <CardDescription>Daily trends comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analyticsData.time_series_data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                          <YAxis />
                          <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                          <Bar dataKey="requests" fill="#3b82f6" name="Requests" />
                          <Line type="monotone" dataKey="donations" stroke="#ef4444" strokeWidth={2} name="Donations" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Location Heatmap</CardTitle>
                    <CardDescription>Request concentration by area</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analyticsData.location_heatmap.slice(0, 5).map((location, index) => (
                        <div key={location.location} className="flex items-center justify-between">
                          <span className="text-sm">{location.location}</span>
                          <div className="flex items-center gap-2">
                            <Progress value={(location.count / Math.max(...analyticsData.location_heatmap.map(l => l.count))) * 100} className="w-20" />
                            <span className="text-sm font-medium">{location.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Demand Forecast</CardTitle>
                    <CardDescription>Predicted blood demand for the next 14 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analyticsData.demand_forecast}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                          <YAxis />
                          <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                          <Area 
                            type="monotone" 
                            dataKey="predicted_demand" 
                            stroke="#8b5cf6" 
                            fill="#8b5cf6" 
                            fillOpacity={0.3}
                            name="Predicted Demand"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="confidence" 
                            stroke="#22c55e" 
                            strokeWidth={2} 
                            name="Confidence %"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="bloodTypes">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Blood Type Distribution</CardTitle>
                    <CardDescription>Request distribution by blood type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(analyticsData.blood_type_distribution).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.entries(analyticsData.blood_type_distribution).map(([_, __], index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Blood Type Breakdown</CardTitle>
                    <CardDescription>Detailed statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(analyticsData.blood_type_distribution).map(([bloodType, count], index) => {
                        const percentage = (count / analyticsData.total_requests) * 100
                        return (
                          <div key={bloodType} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="font-medium">{bloodType}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{count} requests</div>
                              <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="efficiency">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Matching Efficiency</CardTitle>
                    <CardDescription>Requests that got responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{analyticsData.efficiency_metrics.matching_efficiency}%</div>
                    <Progress value={analyticsData.efficiency_metrics.matching_efficiency} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Response Efficiency</CardTitle>
                    <CardDescription>Average response speed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{analyticsData.efficiency_metrics.response_efficiency}%</div>
                    <Progress value={analyticsData.efficiency_metrics.response_efficiency} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Completion Rate</CardTitle>
                    <CardDescription>Successfully completed requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{analyticsData.efficiency_metrics.completion_efficiency}%</div>
                    <Progress value={analyticsData.efficiency_metrics.completion_efficiency} className="mt-2" />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="inventory">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Blood Bank Inventory Levels</CardTitle>
                    <CardDescription>Current stock status across all blood types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(analyticsData.inventory_levels || {}).map(([bloodType, levels]) => {
                        const percentage = (levels.current / levels.maximum) * 100
                        const status = percentage < 25 ? 'critical' : percentage < 50 ? 'low' : 'good'
                        return (
                          <div key={bloodType} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{bloodType}</span>
                              <span className="text-sm">{levels.current}/{levels.maximum} units</span>
                            </div>
                            <Progress 
                              value={percentage} 
                              className={`h-2 ${status === 'critical' ? 'bg-red-100' : status === 'low' ? 'bg-yellow-100' : 'bg-green-100'}`}
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Min: {levels.minimum}</span>
                              <Badge variant={status === 'critical' ? 'destructive' : status === 'low' ? 'secondary' : 'default'}>
                                {status.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
} 