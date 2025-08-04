"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { getSupabase } from "@/lib/supabase"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { Calendar, Clock, MapPin, Building, AlertCircle, CheckCircle, Loader2 } from "lucide-react"

export default function SchedulePage() {
  const { user } = useEnhancedAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bloodBanks, setBloodBanks] = useState<any[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([])
  const [formData, setFormData] = useState({
    blood_bank_id: "",
    date: "",
    time_slot: "",
    notes: "",
    donation_type: "whole_blood",
  })
  const [userProfile, setUserProfile] = useState<any>(null)
  const [existingAppointments, setExistingAppointments] = useState<any[]>([])

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchData = async () => {
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

        // Fetch blood banks
        const { data: bloodBanksData, error: bloodBanksError } = await supabase
          .from("blood_banks")
          .select("*")
          .order("name")

        if (bloodBanksError) throw bloodBanksError

        // Fetch existing appointments
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from("donation_appointments")
          .select("*, blood_banks(*)")
          .eq("user_id", user.id)
          .gte("appointment_date", new Date().toISOString().split("T")[0])
          .order("appointment_date", { ascending: true })

        if (appointmentsError) throw appointmentsError

        setUserProfile(profileData)
        setBloodBanks(bloodBanksData || [])
        setExistingAppointments(appointmentsData || [])

        // Generate available dates (next 14 days)
        const dates = []
        const today = new Date()
        for (let i = 1; i <= 14; i++) {
          const date = new Date()
          date.setDate(today.getDate() + i)
          // Skip Sundays (0 is Sunday in JavaScript)
          if (date.getDay() !== 0) {
            dates.push(date.toISOString().split("T")[0])
          }
        }
        setAvailableDates(dates)

        // Generate time slots (9 AM to 5 PM, hourly)
        const timeSlots = []
        for (let hour = 9; hour <= 16; hour++) {
          timeSlots.push(`${hour}:00`)
        }
        setAvailableTimeSlots(timeSlots)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load necessary data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validate form
    if (!formData.blood_bank_id || !formData.date || !formData.time_slot) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = getSupabase()

      // Format appointment date and time
      const appointmentDate = `${formData.date}T${formData.time_slot}:00`

      // Check if the time slot is available
      const { data: existingSlots, error: slotCheckError } = await supabase
        .from("donation_appointments")
        .select("id")
        .eq("blood_bank_id", formData.blood_bank_id)
        .eq("appointment_date", appointmentDate)
        .eq("status", "confirmed")

      if (slotCheckError) throw slotCheckError

      if (existingSlots && existingSlots.length >= 3) {
        toast({
          title: "Time Slot Unavailable",
          description: "This time slot is fully booked. Please select another time.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // Create the appointment
      const { error } = await supabase.from("donation_appointments").insert({
        user_id: user.id,
        blood_bank_id: formData.blood_bank_id,
        appointment_date: appointmentDate,
        notes: formData.notes,
        donation_type: formData.donation_type,
        status: "confirmed",
        blood_type: userProfile.blood_type,
      })

      if (error) throw error

      toast({
        title: "Appointment Scheduled",
        description: "Your donation appointment has been successfully scheduled.",
      })

      // Refresh the existing appointments
      const { data: updatedAppointments } = await supabase
        .from("donation_appointments")
        .select("*, blood_banks(*)")
        .eq("user_id", user.id)
        .gte("appointment_date", new Date().toISOString().split("T")[0])
        .order("appointment_date", { ascending: true })

      if (updatedAppointments) {
        setExistingAppointments(updatedAppointments)
      }

      // Reset form
      setFormData({
        blood_bank_id: "",
        date: "",
        time_slot: "",
        notes: "",
        donation_type: "whole_blood",
      })
    } catch (error) {
      console.error("Error scheduling appointment:", error)
      toast({
        title: "Scheduling Failed",
        description: "Failed to schedule appointment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const supabase = getSupabase()

      const { error } = await supabase
        .from("donation_appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId)

      if (error) throw error

      toast({
        title: "Appointment Cancelled",
        description: "Your donation appointment has been cancelled.",
      })

      // Update the appointments list
      setExistingAppointments((prev) =>
        prev.map((app) => (app.id === appointmentId ? { ...app, status: "cancelled" } : app)),
      )
    } catch (error) {
      console.error("Error cancelling appointment:", error)
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return {
      date: date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    }
  }

  const getDonationTypeLabel = (type: string) => {
    switch (type) {
      case "whole_blood":
        return "Whole Blood"
      case "plasma":
        return "Plasma"
      case "platelets":
        return "Platelets"
      case "double_red_cells":
        return "Double Red Cells"
      default:
        return type
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col">
        <MobileNav />
        <div className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <div>
            <h1 className="text-2xl font-bold">Schedule Donation</h1>
            <p className="text-muted-foreground">Schedule your next blood donation appointment</p>
          </div>

          {existingAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Your Upcoming Appointments
                </CardTitle>
                <CardDescription>Manage your scheduled donation appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {existingAppointments.map((appointment) => {
                    const { date, time } = formatDateTime(appointment.appointment_date)
                    const isPast = new Date(appointment.appointment_date) < new Date()

                    return (
                      <div
                        key={appointment.id}
                        className={`flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg ${
                          appointment.status === "cancelled" ? "bg-gray-50 dark:bg-gray-900/50" : ""
                        }`}
                      >
                        <div className="flex items-start space-x-4">
                          <div
                            className={`p-2 rounded-full ${
                              appointment.status === "cancelled"
                                ? "bg-gray-100 dark:bg-gray-800"
                                : "bg-red-100 dark:bg-red-900/30"
                            }`}
                          >
                            <Calendar
                              className={`h-5 w-5 ${
                                appointment.status === "cancelled"
                                  ? "text-gray-500 dark:text-gray-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            />
                          </div>
                          <div>
                            <h4
                              className={`font-medium ${
                                appointment.status === "cancelled" ? "text-gray-500 dark:text-gray-400" : ""
                              }`}
                            >
                              {appointment.blood_banks?.name || "Blood Bank"}
                            </h4>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3.5 w-3.5 mr-1" />
                              {appointment.blood_banks?.location || "Unknown location"}
                            </div>
                            <div className="flex items-center mt-2">
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                                {getDonationTypeLabel(appointment.donation_type)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end mt-4 md:mt-0">
                          <div className="text-right">
                            <div className="flex items-center text-sm">
                              <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                              {date}
                            </div>
                            <div className="flex items-center text-sm mt-1">
                              <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                              {time}
                            </div>
                          </div>

                          {appointment.status === "confirmed" && !isPast && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 text-red-600 dark:text-red-500 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => handleCancelAppointment(appointment.id)}
                            >
                              Cancel
                            </Button>
                          )}

                          {appointment.status === "cancelled" && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-3">Cancelled</span>
                          )}

                          {appointment.status === "completed" && (
                            <span className="text-xs text-green-600 dark:text-green-500 mt-3 flex items-center">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Schedule New Appointment
              </CardTitle>
              <CardDescription>Fill in the details to schedule your blood donation</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="blood_bank_id">Blood Bank</Label>
                  <Select
                    value={formData.blood_bank_id}
                    onValueChange={(value) => handleSelectChange("blood_bank_id", value)}
                  >
                    <SelectTrigger id="blood_bank_id">
                      <SelectValue placeholder="Select a blood bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodBanks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Select value={formData.date} onValueChange={(value) => handleSelectChange("date", value)}>
                      <SelectTrigger id="date">
                        <SelectValue placeholder="Select a date" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDates.map((date) => (
                          <SelectItem key={date} value={date}>
                            {new Date(date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time_slot">Time</Label>
                    <Select
                      value={formData.time_slot}
                      onValueChange={(value) => handleSelectChange("time_slot", value)}
                    >
                      <SelectTrigger id="time_slot">
                        <SelectValue placeholder="Select a time" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTimeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {`${time} ${Number.parseInt(time.split(":")[0]) < 12 ? "AM" : "PM"}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Donation Type</Label>
                  <RadioGroup
                    value={formData.donation_type}
                    onValueChange={(value) => handleSelectChange("donation_type", value)}
                    className="grid grid-cols-2 gap-4 pt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="whole_blood" id="whole_blood" />
                      <Label htmlFor="whole_blood" className="cursor-pointer">
                        Whole Blood
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="plasma" id="plasma" />
                      <Label htmlFor="plasma" className="cursor-pointer">
                        Plasma
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="platelets" id="platelets" />
                      <Label htmlFor="platelets" className="cursor-pointer">
                        Platelets
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="double_red_cells" id="double_red_cells" />
                      <Label htmlFor="double_red_cells" className="cursor-pointer">
                        Double Red Cells
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any special requirements or medical information"
                    rows={3}
                  />
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 mt-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800 dark:text-amber-500">Important Information</h4>
                      <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-400 space-y-1 mt-1">
                        <li>Please bring a valid ID for verification</li>
                        <li>Eat a healthy meal before your appointment</li>
                        <li>Stay hydrated by drinking plenty of water</li>
                        <li>Get a good night's sleep before donation</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Scheduling..." : "Schedule Appointment"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-medium mb-2 flex items-center">
              <Building className="h-4 w-4 mr-2" />
              About Blood Donation
            </h3>
            <p className="text-sm text-muted-foreground">
              Regular blood donation is vital for maintaining adequate supplies for patients in need. Most healthy
              adults can donate blood every 8-12 weeks. The donation process typically takes about an hour, with the
              actual blood draw lasting only 8-10 minutes.
            </p>
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  )
}
