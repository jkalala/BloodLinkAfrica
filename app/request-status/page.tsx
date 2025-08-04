"use client"

import { useState, useEffect } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle, Clock, AlertCircle, Phone } from "lucide-react"

export default function RequestStatusPage() {
  const [progress, setProgress] = useState(0)
  const [donors, setDonors] = useState([
    { id: 1, name: "John D.", status: "accepted", distance: "2.3km", eta: "15 min" },
    { id: 2, name: "Sarah M.", status: "pending", distance: "3.1km", eta: "20 min" },
    { id: 3, name: "David K.", status: "pending", distance: "4.5km", eta: "25 min" },
  ])

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(30)
      // Simulate a donor accepting the request
      setTimeout(() => {
        setDonors((prev) => prev.map((donor) => (donor.id === 2 ? { ...donor, status: "accepted" } : donor)))
        setProgress(60)
      }, 5000)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Request Status</h1>
            <p className="text-muted-foreground">Blood type: O+ • 2 units • Emergency</p>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Finding donors...</span>
                    <Badge variant={progress >= 60 ? "success" : "outline"}>
                      {progress >= 60 ? "2 Donors Found" : "Searching"}
                    </Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-medium mb-2">Donor Responses</h3>
                  <div className="space-y-3">
                    {donors.map((donor) => (
                      <div key={donor.id} className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarFallback>{donor.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{donor.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {donor.distance} away • ETA: {donor.eta}
                            </p>
                          </div>
                        </div>
                        <div>
                          {donor.status === "accepted" ? (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Accepted
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Hospital Information</h3>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="font-medium">Central Hospital</p>
                  <p className="text-sm text-muted-foreground">123 Medical Avenue, Nairobi</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 mr-1 text-red-600" />
                    <span>Emergency Department, Room 4</span>
                  </div>
                  <Button variant="outline" className="w-full mt-2">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Hospital
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              Cancel Request
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700">Update Details</Button>
          </div>
        </div>
      </div>
    </main>
  )
}
