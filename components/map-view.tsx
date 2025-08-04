"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getLocationService } from "@/lib/location-service"
import dynamic from "next/dynamic"

// Dynamically import Leaflet with no SSR
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full min-h-[250px]" />,
})

interface MapViewProps {
  markers?: Array<{
    id: string
    name: string
    latitude: number
    longitude: number
    type?: "bank" | "donor" | "request"
  }>
  height?: string
  zoom?: number
  onMarkerClick?: (id: string) => void
}

export function MapView({ markers = [], height = "400px", zoom = 13, onMarkerClick }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const locationService = getLocationService()
        const location = await locationService.getCurrentLocation()
        setUserLocation(location)
      } catch (err: any) {
        console.error("Failed to get location:", err)
        // Default to a central location if user location is not available
        setUserLocation({ latitude: -1.286389, longitude: 36.817223 }) // Nairobi
        setError("Location access denied. Using default location.")
      } finally {
        setIsLoading(false)
      }
    }

    getUserLocation()
  }, [])

  if (error) {
    return (
      <Card className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground p-4 text-center text-sm">{error}</p>
      </Card>
    )
  }

  if (isLoading || !userLocation) {
    return <Skeleton className="w-full" style={{ height }} />
  }

  return (
    <LeafletMap
      center={[userLocation.latitude, userLocation.longitude]}
      zoom={zoom}
      markers={markers}
      height={height}
      onMarkerClick={onMarkerClick}
    />
  )
}
