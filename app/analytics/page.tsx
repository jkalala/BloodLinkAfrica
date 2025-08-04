"use client"

import { useState, useEffect } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getSupabase } from "@/lib/supabase"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, TrendingUp, Users, Droplet, Award } from "lucide-react"

export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState("month")
  const [donationStats, setDonationStats] = useState<any[]>([])
  const [bloodTypeStats, setBloodTypeStats] = useState<any[]>([])
  const [inventoryStats, setInventoryStats] = useState<any[]>([])
  const [summaryStats, setSummaryStats] = useState({
    totalDonations: 0,
    totalDonors: 0,
    totalRequests: 0,
    emergencyRequests: 0,
    averageResponseTime: 0,
  })
  const supabase = getSupabase()

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Calculate date range
        const endDate = new Date()
        const startDate = new Date()

        switch (timeRange) {
          case "week":
            startDate.setDate(endDate.getDate() - 7)
            break
          case "month":
            startDate.setMonth(endDate.getMonth() - 1)
            break
          case "quarter":
            startDate.setMonth(endDate.getMonth() - 3)
            break
          case "year":
            startDate.setFullYear(endDate.getFullYear() - 1)
            break
          default:
            startDate.setMonth(endDate.getMonth() - 1)
        }

        const startDateStr = startDate.toISOString()
        const endDateStr = endDate.toISOString()

        // Fetch donation statistics
        const { data: donationsData, error: donationsError } = await supabase
          .from("donations")
          .select("created_at, donation_type")
          .gte("created_at", startDateStr)
          .lte("created_at", endDateStr)
          .order("created_at", { ascending: true })

        if (donationsError) throw donationsError

        // Process donation data for chart
        const donationsByDate = processDonationsByDate(donationsData || [], timeRange)
        setDonationStats(donationsByDate)

        // Fetch blood type statistics
        const { data: usersData, error: usersError } = await supabase.from("users").select("blood_type")

        if (usersError) throw usersError

        // Process blood type data for chart
        const bloodTypeData = processBloodTypeData(usersData || [])
        setBloodTypeStats(bloodTypeData)

        // Fetch inventory statistics
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("blood_inventory")
          .select("blood_type, quantity, status")

        if (inventoryError) throw inventoryError

        // Process inventory data for chart
        const inventoryChartData = processInventoryData(inventoryData || [])
        setInventoryStats(inventoryChartData)

        // Fetch summary statistics
        const [
          { count: totalDonations },
          { count: totalDonors },
          { count: totalRequests },
          { count: emergencyRequests },
        ] = await Promise.all([
          supabase.from("donations").select("*", { count: "exact", head: true }),
          supabase.from("users").select("*", { count: "exact", head: true }),
          supabase.from("blood_requests").select("*", { count: "exact", head: true }),
          supabase.from("blood_requests").select("*", { count: "exact", head: true }).eq("urgency", "emergency"),
        ])

        setSummaryStats({
          totalDonations: totalDonations || 0,
          totalDonors: totalDonors || 0,
          totalRequests: totalRequests || 0,
          emergencyRequests: emergencyRequests || 0,
          averageResponseTime: 45, // Mock data - would be calculated from actual response times
        })
      } catch (error: any) {
        console.error("Error fetching analytics data:", error)
        setError(error.message || "Failed to load analytics data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [timeRange, supabase])

  // Helper function to process donation data by date
  const processDonationsByDate = (donations: any[], timeRange: string) => {
    const dateFormat =
      timeRange === "week" ? "day" : timeRange === "month" ? "day" : timeRange === "quarter" ? "week" : "month"

    // Group donations by date
    const donationsByDate = donations.reduce((acc: any, donation: any) => {
      const date = new Date(donation.created_at)
      let dateKey = ""

      switch (dateFormat) {
        case "day":
          dateKey = date.toLocaleDateString()
          break
        case "week":
          const weekNumber = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)
          dateKey = `Week ${weekNumber}`
          break
        case "month":
          dateKey = date.toLocaleDateString(undefined, { month: "short" })
          break
      }

      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          regular: 0,
          emergency: 0,
        }
      }

      if (donation.donation_type === "Emergency") {
        acc[dateKey].emergency += 1
      } else {
        acc[dateKey].regular += 1
      }

      return acc
    }, {})

    // Convert to array and sort by date
    return Object.values(donationsByDate)
  }

  // Helper function to process blood type data
  const processBloodTypeData = (users: any[]) => {
    const bloodTypeCounts = users.reduce((acc: any, user: any) => {
      const bloodType = user.blood_type || "Unknown"
      acc[bloodType] = (acc[bloodType] || 0) + 1
      return acc
    }, {})

    return Object.entries(bloodTypeCounts).map(([name, value]) => ({ name, value }))
  }

  // Helper function to process inventory data
  const processInventoryData = (inventory: any[]) => {
    const inventoryByType = inventory.reduce((acc: any, item: any) => {
      if (!acc[item.blood_type]) {
        acc[item.blood_type] = {
          name: item.blood_type,
          available: 0,
          low: 0,
          critical: 0,
        }
      }

      if (item.status === "critical") {
        acc[item.blood_type].critical += item.quantity
      } else if (item.status === "low") {
        acc[item.blood_type].low += item.quantity
      } else {
        acc[item.blood_type].available += item.quantity
      }

      return acc
    }, {})

    return Object.values(inventoryByType)
  }

  // Colors for charts
  const COLORS = ["#e53e3e", "#ed8936", "#38a169", "#3182ce", "#805ad5", "#d53f8c", "#718096", "#2d3748"]

  if (error) {
    return (
      <main className="flex min-h-screen flex-col">
        <MobileNav />
        <div className="flex-1 p-4">
          <div className="max-w-6xl mx-auto">
            <Card>
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
                >
                  Try Again
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-muted-foreground">Track donation metrics and blood bank statistics</p>
            </div>
            <div className="w-40">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                  <SelectItem value="quarter">Last 3 months</SelectItem>
                  <SelectItem value="year">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center space-x-4">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                  <Droplet className="h-6 w-6 text-red-600 dark:text-red-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{summaryStats.totalDonations}</div>
                  )}
                  <p className="text-sm text-muted-foreground">Total Donations</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center space-x-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{summaryStats.totalDonors}</div>
                  )}
                  <p className="text-sm text-muted-foreground">Registered Donors</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center space-x-4">
                <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                  <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{summaryStats.emergencyRequests}</div>
                  )}
                  <p className="text-sm text-muted-foreground">Emergency Requests</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center space-x-4">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{summaryStats.averageResponseTime}m</div>
                  )}
                  <p className="text-sm text-muted-foreground">Avg. Response Time</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="donations">
            <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
              <TabsTrigger value="donations">Donations</TabsTrigger>
              <TabsTrigger value="blood-types">Blood Types</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
            </TabsList>

            <TabsContent value="donations" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Donation Trends</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {isLoading ? (
                    <Skeleton className="w-full h-80" />
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={donationStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="regular" name="Regular Donations" fill="#3182ce" />
                        <Bar dataKey="emergency" name="Emergency Donations" fill="#e53e3e" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="blood-types" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Donor Blood Types</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {isLoading ? (
                    <Skeleton className="w-full h-80" />
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={bloodTypeStats}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={150}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {bloodTypeStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} donors`, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Blood Inventory Levels</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {isLoading ? (
                    <Skeleton className="w-full h-80" />
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={inventoryStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="available" name="Available" fill="#38a169" />
                        <Bar dataKey="low" name="Low" fill="#ed8936" />
                        <Bar dataKey="critical" name="Critical" fill="#e53e3e" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <div className="flex items-center space-x-3">
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                        <Droplet className="h-4 w-4 text-red-600 dark:text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium">Emergency donation at Central Hospital</p>
                        <p className="text-xs text-muted-foreground">2 hours ago</p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-red-600 dark:text-red-500">O+</div>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                        <Users className="h-4 w-4 text-green-600 dark:text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">New donor registered</p>
                        <p className="text-xs text-muted-foreground">5 hours ago</p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-green-600 dark:text-green-500">AB-</div>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">Blood request at Memorial Hospital</p>
                        <p className="text-xs text-muted-foreground">Yesterday</p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-500">B+</div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
                        <Award className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium">Reward redeemed</p>
                        <p className="text-xs text-muted-foreground">2 days ago</p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-amber-600 dark:text-amber-500">200 pts</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
