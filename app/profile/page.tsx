"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { getSupabase } from "@/lib/supabase"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { User, Settings, History, MapPin, Award, Calendar, Droplet, CheckCircle, XCircle, Clock } from "lucide-react"

export default function ProfilePage() {
  const { user } = useEnhancedAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    blood_type: "",
    location: "",
    allow_location: false,
    receive_alerts: false,
    last_donation: "",
    medical_conditions: "",
    available: true,
    points: 0,
  })
  const [donations, setDonations] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchProfileData = async () => {
      setIsLoading(true)
      try {
        const supabase = getSupabase()

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError) throw profileError

        // Fetch donations
        const { data: donationsData, error: donationsError } = await supabase
          .from("donations")
          .select("*, blood_requests(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (donationsError) throw donationsError

        // Fetch rewards
        const { data: rewardsData, error: rewardsError } = await supabase
          .from("user_rewards")
          .select("*, rewards(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (rewardsError) throw rewardsError

        setProfileData(profileData)
        setDonations(donationsData || [])
        setRewards(rewardsData || [])
      } catch (error) {
        console.error("Error fetching profile data:", error)
        toast({
          title: "Error",
          description: "Failed to load profile data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfileData()
  }, [user, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setProfileData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsSaving(true)
    try {
      const supabase = getSupabase()

      const { error } = await supabase
        .from("users")
        .update({
          name: profileData.name,
          blood_type: profileData.blood_type,
          location: profileData.location,
          allow_location: profileData.allow_location,
          receive_alerts: profileData.receive_alerts,
          last_donation: profileData.last_donation || null,
          medical_conditions: profileData.medical_conditions || null,
          available: profileData.available,
        })
        .eq("id", user.id)

      if (error) throw error

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col">
        <MobileNav />
        <div className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            <Skeleton className="h-10 w-full" />

            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src="/placeholder-user.jpg" alt={profileData.name} />
              <AvatarFallback>{getInitials(profileData.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{profileData.name}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900">
                  <Droplet className="h-3 w-3 mr-1" />
                  {profileData.blood_type}
                </Badge>
                <Badge variant="outline" className="border-amber-200 dark:border-amber-900">
                  <Award className="h-3 w-3 mr-1" />
                  {profileData.points} points
                </Badge>
              </div>
            </div>
          </div>

          <Tabs defaultValue="profile">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="donations">
                <History className="h-4 w-4 mr-2" />
                Donations
              </TabsTrigger>
              <TabsTrigger value="rewards">
                <Award className="h-4 w-4 mr-2" />
                Rewards
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-4">
              <form onSubmit={handleSubmit}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>Update your personal information and preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          name="name"
                          value={profileData.name}
                          onChange={handleChange}
                          placeholder="Your full name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" name="phone" value={profileData.phone} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">Contact support to change your phone number</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="blood_type">Blood Type</Label>
                        <Select
                          value={profileData.blood_type}
                          onValueChange={(value) => handleSelectChange("blood_type", value)}
                        >
                          <SelectTrigger id="blood_type">
                            <SelectValue placeholder="Select blood type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A+">A+</SelectItem>
                            <SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="AB+">AB+</SelectItem>
                            <SelectItem value="AB-">AB-</SelectItem>
                            <SelectItem value="O+">O+</SelectItem>
                            <SelectItem value="O-">O-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="last_donation">Last Donation Date</Label>
                        <Input
                          id="last_donation"
                          name="last_donation"
                          type="date"
                          value={profileData.last_donation}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        name="location"
                        value={profileData.location}
                        onChange={handleChange}
                        placeholder="Your location"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="medical_conditions">Medical Conditions</Label>
                      <Textarea
                        id="medical_conditions"
                        name="medical_conditions"
                        value={profileData.medical_conditions || ""}
                        onChange={handleChange}
                        placeholder="List any medical conditions that might affect donation"
                        rows={3}
                      />
                    </div>
                  </CardContent>

                  <CardHeader className="border-t">
                    <CardTitle className="flex items-center">
                      <Settings className="h-5 w-5 mr-2" />
                      Preferences
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="available">Available for Donation</Label>
                        <p className="text-sm text-muted-foreground">
                          Set your availability status for blood donation requests
                        </p>
                      </div>
                      <Switch
                        id="available"
                        checked={profileData.available}
                        onCheckedChange={(checked) => handleSwitchChange("available", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow_location">Share Location</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow the app to access your location for nearby donation requests
                        </p>
                      </div>
                      <Switch
                        id="allow_location"
                        checked={profileData.allow_location}
                        onCheckedChange={(checked) => handleSwitchChange("allow_location", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="receive_alerts">Receive Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notifications for urgent blood donation requests
                        </p>
                      </div>
                      <Switch
                        id="receive_alerts"
                        checked={profileData.receive_alerts}
                        onCheckedChange={(checked) => handleSwitchChange("receive_alerts", checked)}
                      />
                    </div>
                  </CardContent>

                  <CardFooter className="border-t pt-6">
                    <Button type="submit" disabled={isSaving} className="ml-auto">
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            </TabsContent>

            <TabsContent value="donations" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <History className="h-5 w-5 mr-2" />
                    Donation History
                  </CardTitle>
                  <CardDescription>Your blood donation history and impact</CardDescription>
                </CardHeader>
                <CardContent>
                  {donations.length > 0 ? (
                    <div className="space-y-4">
                      {donations.map((donation) => (
                        <div
                          key={donation.id}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-start space-x-4">
                            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                              <Droplet className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                              <h4 className="font-medium">{donation.blood_requests?.hospital_name || "Blood Bank"}</h4>
                              <p className="text-sm text-muted-foreground">
                                {donation.blood_requests?.location || "Unknown location"}
                              </p>
                              <div className="flex items-center mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {donation.blood_type}
                                </Badge>
                                <span className="text-xs text-muted-foreground ml-2">{donation.amount} ml</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center mt-4 md:mt-0">
                            <div className="text-right">
                              <div className="flex items-center text-sm">
                                <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                {formatDate(donation.created_at)}
                              </div>
                              <div className="flex items-center text-sm mt-1">
                                <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                {donation.location || "Unknown"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="bg-muted inline-flex rounded-full p-3 mb-4">
                        <Droplet className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium">No donations yet</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        You haven't made any blood donations yet. Start donating to save lives and track your impact.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rewards" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Award className="h-5 w-5 mr-2" />
                    Rewards & Points
                  </CardTitle>
                  <CardDescription>Your earned rewards and available points</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-r from-red-100 to-amber-100 dark:from-red-950/50 dark:to-amber-950/50 rounded-lg p-4 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Available Points</h3>
                        <p className="text-sm text-muted-foreground">Use your points to redeem rewards</p>
                      </div>
                      <div className="mt-4 md:mt-0">
                        <span className="text-3xl font-bold">{profileData.points}</span>
                        <span className="text-sm ml-1">points</span>
                      </div>
                    </div>
                  </div>

                  {rewards.length > 0 ? (
                    <div className="space-y-4">
                      {rewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-start space-x-4">
                            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
                              <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <h4 className="font-medium">{reward.rewards?.name || "Reward"}</h4>
                              <p className="text-sm text-muted-foreground">
                                {reward.rewards?.description || "No description"}
                              </p>
                              <div className="flex items-center mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {reward.points} points
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center mt-4 md:mt-0">
                            <div className="text-right">
                              <div className="flex items-center text-sm">
                                <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                {formatDate(reward.created_at)}
                              </div>
                              <div className="flex items-center text-sm mt-1">
                                {reward.status === "redeemed" ? (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1 text-green-500" />
                                    <span className="text-green-600 dark:text-green-500">Redeemed</span>
                                  </>
                                ) : reward.status === "expired" ? (
                                  <>
                                    <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" />
                                    <span className="text-red-600 dark:text-red-500">Expired</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3.5 w-3.5 mr-1 text-amber-500" />
                                    <span className="text-amber-600 dark:text-amber-500">Pending</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="bg-muted inline-flex rounded-full p-3 mb-4">
                        <Award className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium">No rewards yet</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        You haven't earned any rewards yet. Donate blood to earn points and redeem exciting rewards.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Toaster />
    </main>
  )
}
