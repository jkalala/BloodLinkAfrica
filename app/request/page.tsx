"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { getSupabase } from "@/lib/supabase"
import { getLocationService } from "@/lib/location-service"
import { getOfflineSync } from "@/lib/offline-sync"
import { AlertCircle } from "lucide-react"

export default function RequestPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    patientName: "",
    hospitalName: "",
    bloodType: "",
    unitsNeeded: "1",
    urgency: "normal",
    contactName: "",
    contactPhone: "",
    additionalInfo: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = getSupabase()
      const offlineSync = getOfflineSync()
      const locationService = getLocationService()

      // Try to get location
      let latitude = null
      let longitude = null
      let location = null

      try {
        const coords = await locationService.getCurrentLocation()
        latitude = coords.latitude
        longitude = coords.longitude
        location = "Current location"
      } catch (error) {
        console.log("Location access denied or unavailable")
      }

      const requestData = {
        patient_name: formData.patientName,
        hospital_name: formData.hospitalName,
        blood_type: formData.bloodType,
        units_needed: Number.parseInt(formData.unitsNeeded),
        urgency: formData.urgency,
        contact_name: formData.contactName,
        contact_phone: formData.contactPhone,
        additional_info: formData.additionalInfo,
        location,
        latitude,
        longitude,
        status: "pending",
      }

      // Check if we're online
      if (navigator.onLine) {
        // Submit request data to Supabase
        const { error } = await supabase.from("blood_requests").insert([requestData])

        if (error) {
          console.error("Error submitting request:", error)
          // Store for offline sync if online submission fails
          offlineSync.addToQueue("request", requestData)
          toast({
            title: "Request saved offline",
            description: "Your request will be submitted when you're back online.",
          })
        } else {
          toast({
            title: "Request Submitted",
            description: "Your blood request has been successfully submitted.",
          })
          router.push("/request-status")
        }
      } else {
        // Store for offline sync
        offlineSync.addToQueue("request", requestData)
        toast({
          title: "Request saved offline",
          description: "Your request will be submitted when you're back online.",
        })
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Request Blood</h1>
            <p className="text-muted-foreground">Fill out this form to request blood donation</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Blood Request Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Name</Label>
                  <Input
                    id="patientName"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    placeholder="Enter patient name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hospitalName">Hospital Name</Label>
                  <Input
                    id="hospitalName"
                    name="hospitalName"
                    value={formData.hospitalName}
                    onChange={handleChange}
                    placeholder="Enter hospital name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bloodType">Blood Type Needed</Label>
                  <Select
                    value={formData.bloodType}
                    onValueChange={(value) => handleSelectChange("bloodType", value)}
                    required
                  >
                    <SelectTrigger id="bloodType">
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
                  <Label htmlFor="unitsNeeded">Units Needed</Label>
                  <Select
                    value={formData.unitsNeeded}
                    onValueChange={(value) => handleSelectChange("unitsNeeded", value)}
                    required
                  >
                    <SelectTrigger id="unitsNeeded">
                      <SelectValue placeholder="Select units needed" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Unit</SelectItem>
                      <SelectItem value="2">2 Units</SelectItem>
                      <SelectItem value="3">3 Units</SelectItem>
                      <SelectItem value="4">4 Units</SelectItem>
                      <SelectItem value="5">5+ Units</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Urgency Level</Label>
                  <RadioGroup
                    value={formData.urgency}
                    onValueChange={(value) => handleSelectChange("urgency", value)}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="normal" id="normal" />
                      <Label htmlFor="normal">Normal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="urgent" id="urgent" />
                      <Label htmlFor="urgent">Urgent</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="emergency" id="emergency" />
                      <Label htmlFor="emergency">Emergency</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="Enter contact person name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="Enter contact phone number"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInfo">Additional Information</Label>
                  <Textarea
                    id="additionalInfo"
                    name="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={handleChange}
                    placeholder="Any additional details or requirements"
                    rows={3}
                  />
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-md p-3 flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p>Your request will be sent to nearby donors with matching blood types.</p>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                  disabled={isLoading}
                >
                  {isLoading ? "Submitting..." : "Submit Blood Request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster />
    </main>
  )
}
