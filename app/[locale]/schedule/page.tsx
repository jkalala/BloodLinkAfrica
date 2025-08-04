"use client"

import { ResponsiveLayout } from "@/components/responsive-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Calendar as CalendarIcon, Clock, MapPin, Heart, Users, AlertTriangle } from "lucide-react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { format } from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const timeSlots = [
  "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"
]

const locations = [
  { id: "1", name: "Central Blood Bank", address: "123 Main St" },
  { id: "2", name: "City Hospital", address: "456 Health Ave" },
  { id: "3", name: "Community Center", address: "789 Unity Blvd" }
]

export default function SchedulePage() {
  const params = useParams()
  const locale = params.locale as string
  const [date, setDate] = useState<Date>()
  const [time, setTime] = useState<string>()
  const [location, setLocation] = useState<string>()

  const handleSchedule = () => {
    if (!date || !time || !location) return
    // Here you would typically make an API call to schedule the appointment
    console.log("Scheduling appointment:", { date, time, location })
  }

  return (
    <ResponsiveLayout>
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Schedule Donation</h1>
              <p className="text-muted-foreground">Book your next blood donation appointment</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
                <CardDescription>Choose a convenient date for your donation</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-md border"
                  disabled={(date) => date < new Date()}
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select Time</CardTitle>
                  <CardDescription>Choose an available time slot</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={setTime} value={time}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {slot}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Select Location</CardTitle>
                  <CardDescription>Choose a donation center</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={setLocation} value={location}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          <div>
                            <div className="font-medium">{loc.name}</div>
                            <div className="text-sm text-muted-foreground">{loc.address}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Button 
                className="w-full"
                onClick={handleSchedule}
                disabled={!date || !time || !location}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Schedule Appointment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  )
} 