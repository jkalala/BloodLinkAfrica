"use client"

import { useI18n } from "@/lib/i18n/client"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Package, 
  Users, 
  Wrench, 
  UserPlus, 
  BarChart3,
  AlertCircle,
  TrendingUp,
  Activity
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function BloodBankPortal() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string

  const portalSections = [
    {
      id: "inventory",
      title: "Inventory Management",
      description: "Track blood units, supplies, and storage conditions",
      icon: <Package className="h-6 w-6" />,
      href: "/blood-bank/inventory"
    },
    {
      id: "staff",
      title: "Staff Management",
      description: "Manage staff schedules, roles, and performance",
      icon: <Users className="h-6 w-6" />,
      href: "/blood-bank/staff"
    },
    {
      id: "equipment",
      title: "Equipment Tracking",
      description: "Monitor equipment status and maintenance schedules",
      icon: <Wrench className="h-6 w-6" />,
      href: "/blood-bank/equipment"
    },
    {
      id: "donors",
      title: "Donor Management",
      description: "Manage donor relationships and communication",
      icon: <UserPlus className="h-6 w-6" />,
      href: "/blood-bank/donors"
    },
    {
      id: "analytics",
      title: "Analytics Dashboard",
      description: "View insights and performance metrics",
      icon: <BarChart3 className="h-6 w-6" />,
      href: "/blood-bank/analytics"
    }
  ]

  // Mock data for quick stats
  const quickStats = [
    {
      title: "Critical Inventory",
      value: "3 units",
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      trend: "decreasing"
    },
    {
      title: "Active Donors",
      value: "1,234",
      icon: <TrendingUp className="h-4 w-4 text-green-500" />,
      trend: "increasing"
    },
    {
      title: "Equipment Status",
      value: "98%",
      icon: <Activity className="h-4 w-4 text-blue-500" />,
      trend: "stable"
    }
  ]

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Blood Bank Portal</h1>
              <p className="text-muted-foreground">Manage your blood bank operations efficiently</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            {quickStats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Portal Sections */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {portalSections.map((section) => (
              <Link key={section.id} href={`/${locale}${section.href}`}>
                <Card className="h-full hover:bg-muted/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        {section.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold">{section.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
} 