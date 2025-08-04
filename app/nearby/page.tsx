"use client"

import { useState, useEffect } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { MapPin, Phone, Clock, ExternalLink, Search } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { getLocationService } from "@/lib/location-service"
import { MapView } from "@/components/map-view"
import Link from "next/link"

export default function NearbyPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [bloodBanks, setBloodBanks] = useState<any[]>([])
  const [bloodInventory, setBloodInventory] = useState<any[]>([])
  const [selectedBank, setSelectedBank] = useState<string | null>(null)
  const supabase = getSupabase()
  const locationService = getLocationService()

  useEffect(() => {
    if (!supabase) return

    const fetchBloodBanks = async () => {
      setLoading(true)
      try {
        // Fetch blood banks
        const { data: banksData, error: banksError } = await supabase.from("blood_banks").select("*")

        if (banksError) throw banksError

        // Fetch blood inventory
        const { data: inventoryData, error: inventoryError } = await supabase.from("blood_inventory").select("*")

        if (inventoryError) throw inventoryError

        // Try to get user's location
        let userLocation = null
        try {
          userLocation = await locationService.getCurrentLocation()
        } catch (error) {
          console.log("Location access denied or unavailable")
        }

        // Calculate distances if location is available
        const banksWithDistance = banksData.map((bank) => {
          let distance = null
          if (userLocation && bank.latitude && bank.longitude) {
            distance = locationService.calculateDistance(userLocation, {
              latitude: bank.latitude,
              longitude: bank.longitude,
            })
          }
          return {
            ...bank,
            distance: distance ? `${distance}km` : null,
          }
        })

        setBloodBanks(banksWithDistance)
        setBloodInventory(inventoryData)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBloodBanks()
  }, [supabase])

  const getBloodInventoryForBank = (bankId: string) => {
    return bloodInventory.filter((item) => item.blood_bank_id === bankId)
  }

  const filteredBanks = bloodBanks.filter(
    (bank) =>
      bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bank.address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const mapMarkers = filteredBanks
    .filter((bank) => bank.latitude && bank.longitude)
    .map((bank) => ({
      id: bank.id,
      name: bank.name,
      latitude: bank.latitude,
      longitude: bank.longitude,
      type: "bank" as const,
    }))

  const handleMarkerClick = (id: string) => {
    setSelectedBank(id)
    // Scroll to the bank card
    const element = document.getElementById(`bank-${id}`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Nearby Blood Banks</h1>
            <p className="text-muted-foreground">Find donation centers near you</p>
          </div>

          <Card>
            <CardContent className="p-0">
              <MapView markers={mapMarkers} height="250px" zoom={12} onMarkerClick={handleMarkerClick} />
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name or location"
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button asChild variant="outline" className="ml-2">
              <Link href="/map">
                <MapPin className="h-4 w-4 mr-1" />
                Full Map
              </Link>
            </Button>
          </div>

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
            <div className="space-y-4">
              {filteredBanks.length > 0 ? (
                filteredBanks.map((bank) => (
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
                        {bank.distance && (
                          <div className="flex items-center text-sm font-medium text-red-600 dark:text-red-400">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span>{bank.distance} away</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Blood Inventory:</p>
                        <div className="flex flex-wrap gap-2">
                          {getBloodInventoryForBank(bank.id).map((blood) => (
                            <Badge
                              key={blood.id}
                              variant={
                                blood.status === "critical"
                                  ? "destructive"
                                  : blood.status === "low"
                                    ? "outline"
                                    : "secondary"
                              }
                              className={
                                blood.status === "critical"
                                  ? "border-red-500 dark:border-red-400"
                                  : blood.status === "low"
                                    ? "border-amber-500 dark:border-amber-400"
                                    : ""
                              }
                            >
                              {blood.blood_type}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Phone className="h-4 w-4 mr-1" />
                          Call
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
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
                        <Button className="flex-1 bg-red-600 hover:bg-red-700" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Visit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No blood banks found matching your search</p>
                  <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                    Clear search
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Blood Type Compatibility</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">O-:</span> Universal donor (can donate to all types)
              </p>
              <p>
                <span className="font-medium">O+:</span> Can donate to O+, A+, B+, AB+
              </p>
              <p>
                <span className="font-medium">A-:</span> Can donate to A-, A+, AB-, AB+
              </p>
              <p>
                <span className="font-medium">A+:</span> Can donate to A+, AB+
              </p>
              <p>
                <span className="font-medium">B-:</span> Can donate to B-, B+, AB-, AB+
              </p>
              <p>
                <span className="font-medium">B+:</span> Can donate to B+, AB+
              </p>
              <p>
                <span className="font-medium">AB-:</span> Can donate to AB-, AB+
              </p>
              <p>
                <span className="font-medium">AB+:</span> Can donate to AB+ only
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
