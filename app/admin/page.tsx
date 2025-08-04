import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSupabase } from "@/lib/supabase"
import { Droplet, Users, Building, Award } from "lucide-react"

export const dynamic = "force-dynamic"

async function getData() {
  const supabase = getSupabase()

  try {
    // Get users count
    const { count: usersCount } = await supabase.from("users").select("*", { count: "exact", head: true })

    // Get blood requests count
    const { count: requestsCount } = await supabase.from("blood_requests").select("*", { count: "exact", head: true })

    // Get donations count
    const { count: donationsCount } = await supabase.from("donations").select("*", { count: "exact", head: true })

    // Get blood banks count
    const { count: banksCount } = await supabase.from("blood_banks").select("*", { count: "exact", head: true })

    // Get recent blood requests
    const { data: recentRequests } = await supabase
      .from("blood_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    return {
      usersCount: usersCount || 0,
      requestsCount: requestsCount || 0,
      donationsCount: donationsCount || 0,
      banksCount: banksCount || 0,
      recentRequests: recentRequests || [],
    }
  } catch (error) {
    console.error("Error fetching admin data:", error)
    return {
      usersCount: 0,
      requestsCount: 0,
      donationsCount: 0,
      banksCount: 0,
      recentRequests: [],
    }
  }
}

export default async function AdminDashboardPage() {
  const data = await getData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your blood donation system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.usersCount}</div>
            <p className="text-xs text-muted-foreground">Registered donors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blood Requests</CardTitle>
            <Droplet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.requestsCount}</div>
            <p className="text-xs text-muted-foreground">Total requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Donations</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.donationsCount}</div>
            <p className="text-xs text-muted-foreground">Completed donations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blood Banks</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.banksCount}</div>
            <p className="text-xs text-muted-foreground">Registered facilities</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Blood Requests</CardTitle>
              <CardDescription>Latest blood donation requests in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-2 text-left font-medium">Patient</th>
                      <th className="py-3 px-2 text-left font-medium">Hospital</th>
                      <th className="py-3 px-2 text-left font-medium">Blood Type</th>
                      <th className="py-3 px-2 text-left font-medium">Units</th>
                      <th className="py-3 px-2 text-left font-medium">Urgency</th>
                      <th className="py-3 px-2 text-left font-medium">Status</th>
                      <th className="py-3 px-2 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRequests.map((request) => (
                      <tr key={request.id} className="border-b">
                        <td className="py-3 px-2">{request.patient_name}</td>
                        <td className="py-3 px-2">{request.hospital_name}</td>
                        <td className="py-3 px-2">{request.blood_type}</td>
                        <td className="py-3 px-2">{request.units_needed}</td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs ${
                              request.urgency === "emergency"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : request.urgency === "urgent"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs ${
                              request.status === "completed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : request.status === "pending"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                            }`}
                          >
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-2">{new Date(request.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {data.recentRequests.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-3 px-2 text-center text-muted-foreground">
                          No recent blood requests
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Blood Type Distribution</CardTitle>
                <CardDescription>Distribution of donors by blood type</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8">
                  <span className="block text-muted-foreground mb-2">Chart visualization will be available soon</span>
                  <span className="block text-sm text-muted-foreground">
                    We're working on implementing interactive charts for better data visualization
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Donations</CardTitle>
                <CardDescription>Donation trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8">
                  <span className="block text-muted-foreground mb-2">Chart visualization will be available soon</span>
                  <span className="block text-sm text-muted-foreground">
                    We're working on implementing interactive charts for better data visualization
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Analytics</CardTitle>
              <CardDescription>Detailed statistics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">Advanced analytics features coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
