"use client"

import { useState, useEffect } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, Award, MapPin, Calendar, AlertCircle } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { getSupabase } from "@/lib/supabase"

export default function DashboardPage() {
  const { user } = useEnhancedAuth()
  const [availability, setAvailability] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [donations, setDonations] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [nearbyBanks, setNearbyBanks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabase()

  useEffect(() => {
    if (!user) return

    const fetchUserData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch user profile
        const { data: userData, error: userError } = await supabase.from("users").select("*").eq("id", user.id).single()

        if (userError) {
          // If user doesn't exist in the users table, create a default profile
          if (userError.code === "PGRST116") {
            const defaultUserData = {
              id: user.id,
              name: user.user_metadata?.name || "User",
              phone: user.phone || "",
              blood_type: user.user_metadata?.blood_type || "Unknown",
              location: "Unknown",
              allow_location: true,
              receive_alerts: true,
              available: true,
              points: 0,
            }

            setUserData(defaultUserData)
            setAvailability(defaultUserData.available)

            // Try to insert the default user
            await supabase.from("users").insert([defaultUserData])
          } else {
            throw userError
          }
        } else {
          setUserData(userData)
          setAvailability(userData.available)
        }

        // Fetch user donations - handle empty results gracefully
        const { data: donationsData } = await supabase
          .from("donations")
          .select(`
            id,
            created_at,
            donation_type,
            hospital,
            points_earned,
            status
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        setDonations(donationsData || [])

        // Fetch active blood requests - handle empty results gracefully
        const { data: requestsData } = await supabase
          .from("blood_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5)

        setAlerts(requestsData || [])

        // Fetch nearby blood banks - handle empty results gracefully
        const { data: banksData } = await supabase
          .from("blood_banks")
          .select(`
            id,
            name,
            address,
            status,
            latitude,
            longitude
          `)
          .limit(3)

        setNearbyBanks(banksData || [])
      } catch (error: any) {
        console.error("Error fetching data:", error)
        setError(error.message || "Failed to load dashboard data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [user, supabase])

  const toggleAvailability = async () => {
    if (!user || !userData) return

    try {
      const newAvailability = !availability
      const { error } = await supabase.from("users").update({ available: newAvailability }).eq("id", user.id)

      if (error) throw error
      setAvailability(newAvailability)
    } catch (error) {
      console.error("Error updating availability:", error)
    }
  }

  // Show a fallback UI if there's an error
  if (error) {
    return (
      <ProtectedRoute>
        <main className="flex min-h-screen flex-col">
          <MobileNav />
          <div className="flex-1 p-4 flex items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </ProtectedRoute>
    )
  }

  // Show a loading skeleton instead of a spinner
  if (isLoading) {
    return (
      <ProtectedRoute>
        <main className="flex min-h-screen flex-col">
          <MobileNav />
          <div className="flex-1 p-4">
            <div className="max-w-md mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <div className="h-7 bg-gray-200 rounded w-32 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-48 mt-2 animate-pulse"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <div className="h-6 bg-gray-200 rounded w-36 animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                        <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>

              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </main>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col">
        <MobileNav />
        <div className="flex-1 p-4">
          <div className="max-w-md mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {userData?.name?.split(" ")[0] || "User"}</p>
              </div>
              <Badge
                variant={availability ? "success" : "secondary"}
                className="cursor-pointer"
                onClick={toggleAvailability}
              >
                {availability ? "Available" : "Unavailable"}
              </Badge>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Your Donor Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Blood Type</p>
                    <p className="font-medium text-lg">{userData?.blood_type || "Unknown"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Last Donation</p>
                    <p className="font-medium">{userData?.last_donation || "Never"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Donations</p>
                    <p className="font-medium">{donations.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Rewards Points</p>
                    <p className="font-medium">{userData?.points || 0} pts</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="alerts">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="alerts">Alerts</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="nearby">Nearby</TabsTrigger>
              </TabsList>

              <TabsContent value="alerts" className="space-y-4 mt-4">
                {alerts.length > 0 ? (
                  alerts.map((alert) => (
                    <Card
                      key={alert.id}
                      className={
                        alert.urgency === "emergency"
                          ? "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/50"
                          : ""
                      }
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center space-x-2">
                          <AlertCircle
                            className={`h-5 w-5 ${alert.urgency === "emergency" ? "text-red-600 dark:text-red-400" : "text-amber-500"}`}
                          />
                          <h3 className="font-medium">
                            {alert.urgency === "emergency"
                              ? "Emergency"
                              : alert.urgency === "urgent"
                                ? "Urgent"
                                : "Regular"}{" "}
                            Request
                          </h3>
                        </div>
                        <p className="text-sm">
                          Blood type {alert.blood_type} needed at {alert.hospital_name}
                          {alert.location && ` (${alert.location})`}
                        </p>
                        <div className="flex space-x-2 mt-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            Decline
                          </Button>
                          <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700">
                            Accept
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-muted-foreground">No active alerts at the moment</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-5 w-5 text-amber-500" />
                      <h3 className="font-medium">Blood Drive</h3>
                    </div>
                    <p className="text-sm">Community blood drive this weekend at City Hall</p>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>Saturday, June 15 • 9:00 AM - 4:00 PM</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {donations.length > 0 ? (
                    donations.map((donation) => (
                      <Card key={donation.id}>
                        <CardContent className="p-4 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{donation.hospital}</p>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 mr-1" />
                              <span>
                                {new Date(donation.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                          <Badge variant={donation.donation_type === "Emergency" ? "destructive" : "outline"}>
                            {donation.donation_type}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-muted-foreground">No donation history yet</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="nearby" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {nearbyBanks.length > 0 ? (
                    nearbyBanks.map((bank) => (
                      <Card key={bank.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{bank.name}</p>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span>{bank.address}</span>
                              </div>
                            </div>
                            <Badge
                              variant={
                                bank.status === "High Need"
                                  ? "destructive"
                                  : bank.status === "Normal"
                                    ? "outline"
                                    : "secondary"
                              }
                            >
                              {bank.status}
                            </Badge>
                          </div>
                          <Button variant="outline" size="sm" className="w-full mt-2">
                            Get Directions
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-muted-foreground">No nearby blood banks found</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Rewards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="font-medium">{userData?.points || 0} points</p>
                    <p className="text-xs text-muted-foreground">
                      {userData?.points < 300
                        ? `${300 - (userData?.points || 0)} points until next reward`
                        : "Eligible for rewards!"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/rewards">
                      <Award className="h-4 w-4 mr-2" />
                      Redeem
                    </a>
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress to next reward</span>
                    <span>{userData?.points || 0}/300</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-red-600 h-2.5 rounded-full"
                      style={{ width: `${Math.min(((userData?.points || 0) / 300) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  )
}
