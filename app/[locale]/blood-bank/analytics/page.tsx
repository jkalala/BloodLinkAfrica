"use client"

import { useI18n } from "@/lib/i18n/client"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Droplet,
  Activity,
  AlertCircle,
  Calendar,
  Clock
} from "lucide-react"

export default function AnalyticsPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string

  // Mock data for key metrics
  const keyMetrics = [
    {
      title: "Total Donors",
      value: "1,234",
      change: "+12%",
      trend: "up",
      icon: <Users className="h-4 w-4" />
    },
    {
      title: "Blood Units Available",
      value: "456",
      change: "-5%",
      trend: "down",
      icon: <Droplet className="h-4 w-4" />
    },
    {
      title: "Donation Rate",
      value: "85%",
      change: "+3%",
      trend: "up",
      icon: <Activity className="h-4 w-4" />
    },
    {
      title: "Critical Inventory",
      value: "3",
      change: "-2",
      trend: "down",
      icon: <AlertCircle className="h-4 w-4" />
    }
  ]

  // Mock data for blood type distribution
  const bloodTypeDistribution = [
    { type: "O+", percentage: 35, units: 160 },
    { type: "O-", percentage: 15, units: 68 },
    { type: "A+", percentage: 25, units: 114 },
    { type: "A-", percentage: 10, units: 45 },
    { type: "B+", percentage: 8, units: 36 },
    { type: "B-", percentage: 4, units: 18 },
    { type: "AB+", percentage: 2, units: 9 },
    { type: "AB-", percentage: 1, units: 5 }
  ]

  // Mock data for recent activities
  const recentActivities = [
    {
      id: "A001",
      type: "Donation",
      description: "New blood donation received",
      time: "2 hours ago",
      status: "Completed"
    },
    {
      id: "A002",
      type: "Inventory",
      description: "Blood unit transferred to hospital",
      time: "4 hours ago",
      status: "Completed"
    },
    {
      id: "A003",
      type: "Alert",
      description: "Low inventory alert for B-",
      time: "6 hours ago",
      status: "Pending"
    }
  ]

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-muted-foreground">Monitor blood bank performance and metrics</p>
            </div>
            <Select defaultValue="7d">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {keyMetrics.map((metric, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {metric.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <h3 className="text-2xl font-bold">{metric.value}</h3>
                        <Badge
                          variant={metric.trend === "up" ? "default" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          {metric.trend === "up" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {metric.change}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      {metric.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Blood Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Blood Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bloodTypeDistribution.map((item) => (
                    <div key={item.type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.type}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.units} units
                        </span>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{activity.type}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {activity.time}
                          </span>
                        </div>
                        <p className="text-sm">{activity.description}</p>
                      </div>
                      <Badge
                        variant={
                          activity.status === "Completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {activity.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
} 