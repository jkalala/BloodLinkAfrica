"use client"

import { useState } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { AlertCircle, Bell, Calendar, MapPin, Clock, CheckCircle, XCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function AlertsPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(true)
  const [maxDistance, setMaxDistance] = useState(10)

  const handleAccept = (id: number) => {
    toast({
      title: "Alert Accepted",
      description: "Thank you for responding. Details have been sent to your phone.",
    })
  }

  const handleDecline = (id: number) => {
    toast({
      title: "Alert Declined",
      description: "No problem. We'll find another donor.",
    })
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Alerts</h1>
            <p className="text-muted-foreground">Manage your donation alerts</p>
          </div>

          <Tabs defaultValue="active">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 mt-4">
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <h3 className="font-medium">Emergency Request</h3>
                    <Badge variant="destructive" className="ml-auto">
                      Urgent
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm">Blood type O+ needed at Central Hospital</p>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      <span>2.3km away</span>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>Requested 15 minutes ago</span>
                    </div>
                  </div>

                  <div className="flex space-x-2 mt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDecline(1)}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                    <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleAccept(1)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5 text-amber-500" />
                    <h3 className="font-medium">Blood Drive</h3>
                    <Badge variant="outline" className="ml-auto">
                      Event
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm">Community blood drive this weekend at City Hall</p>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>Saturday, June 15 • 9:00 AM - 4:00 PM</span>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      <span>City Hall, Downtown</span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    Add to Calendar
                  </Button>
                </CardContent>
              </Card>

              <div className="text-center text-sm text-muted-foreground pt-2">No more active alerts</div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              {[
                {
                  id: 1,
                  type: "Emergency",
                  location: "Memorial Hospital",
                  date: "June 2, 2023",
                  status: "Accepted",
                },
                {
                  id: 2,
                  type: "Regular",
                  location: "Red Cross Center",
                  date: "May 15, 2023",
                  status: "Declined",
                },
                {
                  id: 3,
                  type: "Emergency",
                  location: "Children's Hospital",
                  date: "April 28, 2023",
                  status: "Accepted",
                },
              ].map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center">
                          <h3 className="font-medium">{alert.type} Request</h3>
                          <Badge variant={alert.status === "Accepted" ? "success" : "secondary"} className="ml-2">
                            {alert.status}
                          </Badge>
                        </div>
                        <p className="text-sm">{alert.location}</p>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>{alert.date}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="settings" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive alerts on your device</p>
                  </div>
                  <Switch id="notifications" checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sms">SMS Alerts</Label>
                    <p className="text-sm text-muted-foreground">Receive alerts via SMS when offline</p>
                  </div>
                  <Switch id="sms" checked={smsAlertsEnabled} onCheckedChange={setSmsAlertsEnabled} />
                </div>

                <div className="space-y-2">
                  <Label>Maximum Distance</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={maxDistance}
                      onChange={(e) => setMaxDistance(Number.parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm font-medium w-12">{maxDistance} km</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Only receive alerts for requests within this distance</p>
                </div>

                <div className="space-y-2">
                  <Label>Alert Types</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="emergency" defaultChecked />
                      <Label htmlFor="emergency">Emergency Requests</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="regular" defaultChecked />
                      <Label htmlFor="regular">Regular Donation Requests</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="drives" defaultChecked />
                      <Label htmlFor="drives">Blood Drives & Events</Label>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-red-600 hover:bg-red-700">Save Settings</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Toaster />
    </main>
  )
}
