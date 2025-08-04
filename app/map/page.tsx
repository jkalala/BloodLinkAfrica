"use client"

import { useState, useEffect } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapView } from "@/components/map-view"
import { getSupabase } from "@/lib/supabase"
import { MapPin, Phone, Clock } from "lucide-react"

export default function MapPage() {
  const [bloodBanks, setBloodBanks] = useState<any[]>([])
  const [selectedBank, setSelectedBank] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabase()

  useEffect(() => {
    const fetchBloodBanks = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from("blood_banks").select("*")

        if (error) throw error
        setBloodBanks(data || [])
      } catch (error) {
        console.error("Error fetching blood banks:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBloodBanks()
  }, [supabase])

  const handleMarkerClick = (id: string) => {
    setSelectedBank(id)
    // Scroll to the bank card
    const element = document.getElementById(`bank-${id}`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  const mapMarkers = bloodBanks
    .filter((bank) => bank.latitude && bank.longitude)
    .map((bank) => ({
      id: bank.id,
      name: bank.name,
      latitude: bank.latitude,
      longitude: bank.longitude,
      type: "bank" as const,
    }))

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Blood Bank Map</h1>
            <p className="text-muted-foreground">Find donation centers near you</p>
          </div>

          <Card>
            <CardContent className="p-0">
              <MapView markers={mapMarkers} height="300px" zoom={12} onMarkerClick={handleMarkerClick} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              bloodBanks.map((bank) => (
                <Card
                  key={bank.id}
                  id={`bank-${bank.id}`}
                  className={selectedBank === bank.id ? "border-red-500 ring-2 ring-red-500 ring-opacity-50" : ""}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium">{bank.name}</h3>
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

                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>{bank.address}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>{bank.hours}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>{bank.phone}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                      <Button
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        size="sm"
                        onClick={() => {
                          if (bank.latitude && bank.longitude) {
                            window.open(
                              `https://www.google.com/maps/dir/?api=1&destination=${bank.latitude},${bank.longitude}`,
                              "_blank",
                            )
                          }
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Directions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
