"use client"

import { useI18n } from "@/lib/i18n/client"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { ResponsiveLayout } from "@/components/responsive-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Heart, MapPin, Calendar, Award, Shield, Bell, Settings } from "lucide-react"
import { useState } from "react"
import { toast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const t = useI18n()
  const { user, updateProfile } = useEnhancedAuth()
  const [name, setName] = useState(user?.name || "")
  const [address, setAddress] = useState(user?.location || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      console.log('🔄 Updating profile with name:', name, 'and location:', address)
      
      const result = await updateProfile({
        name: name.trim(),
        location: address.trim()
      })

      if (result.success) {
        toast({ 
          title: "Profile updated!", 
          description: `Your name is now: ${name}` 
        })
        // The context will automatically update the user data
      } else {
        toast({ 
          title: "Failed to update", 
          description: result.error, 
          variant: "destructive" 
        })
      }
    } catch (e: any) {
      console.error('Profile update error:', e)
      toast({ 
        title: "Error", 
        description: e.message, 
        variant: "destructive" 
      })
    } finally {
      setSaving(false)
    }
  }

  const userProfile = {
    name: user?.name || user?.full_name || "Anonymous Donor",
    bloodType: user?.blood_type || "Unknown",
    lastDonation: user?.last_donation || "N/A",
    phone: user?.phone || "",
    address: user?.location || ""
  }

  return (
    <ResponsiveLayout>
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("dashboard.profile")}</h1>
              <p className="text-muted-foreground">{t("dashboard.profileDesc")}</p>
            </div>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {/* AvatarImage can be updated if you add avatar_url to your user model */}
                    <AvatarFallback>{userProfile.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{userProfile.name}</CardTitle>
                    <CardDescription>{userProfile.bloodType}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Blood Type</Label>
                      <Input value={userProfile.bloodType} disabled />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Last Donation</Label>
                      <Input value={userProfile.lastDonation} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={userProfile.phone} readOnly />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Total Donations</p>
                      {/* You can add total donations if you add it to your user model */}
                    </div>
                    <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Update Profile"}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  )
} 