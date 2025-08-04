"use client"

import { useState } from "react"
import { ResponsiveLayout } from "@/components/responsive-layout"
import { EnhancedMap } from "@/components/enhanced-map"
import { Button } from "@/components/ui/button"
import { Navigation } from "lucide-react"
import { useParams } from "next/navigation"
import { useI18n } from "@/lib/i18n/client"

export default function MapPage() {
  const params = useParams()
  const locale = params.locale as string
  const t = useI18n()
  
  const [showDonors, setShowDonors] = useState(true)
  const [showRequests, setShowRequests] = useState(true)
  const [showBloodBanks, setShowBloodBanks] = useState(true)
  const [showTraffic, setShowTraffic] = useState(false)
  const [showRoutes, setShowRoutes] = useState(false)

  return (
    <ResponsiveLayout>
      <div className="flex-1 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("map.title")}</h1>
              <p className="text-muted-foreground">
                AI-powered real-time blood network with location tracking and route optimization
              </p>
            </div>
            <Button className="flex items-center space-x-2">
              <Navigation className="h-4 w-4" />
              <span>Find Nearby</span>
            </Button>
          </div>

          {/* Map Controls */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showDonors ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDonors(!showDonors)}
            >
              {showDonors ? "Hide" : "Show"} Donors
            </Button>
            <Button
              variant={showRequests ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRequests(!showRequests)}
            >
              {showRequests ? "Hide" : "Show"} Requests
            </Button>
            <Button
              variant={showBloodBanks ? "default" : "outline"}
              size="sm"
              onClick={() => setShowBloodBanks(!showBloodBanks)}
            >
              {showBloodBanks ? "Hide" : "Show"} Blood Banks
            </Button>
            <Button
              variant={showTraffic ? "default" : "outline"}
              size="sm"
              onClick={() => setShowTraffic(!showTraffic)}
            >
              {showTraffic ? "Hide" : "Show"} Traffic
            </Button>
            <Button
              variant={showRoutes ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRoutes(!showRoutes)}
            >
              {showRoutes ? "Hide" : "Show"} Routes
            </Button>
          </div>

          {/* Enhanced Map */}
          <EnhancedMap
            center={{ lat: -1.2921, lng: 36.8219 }}
            zoom={12}
            showDonors={showDonors}
            showRequests={showRequests}
            showBloodBanks={showBloodBanks}
            showTraffic={showTraffic}
            showRoutes={showRoutes}
            className="w-full"
          />
        </div>
      </div>
    </ResponsiveLayout>
  )
} 