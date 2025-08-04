"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { useI18n } from "@/lib/i18n/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  MapPin, 
  Phone, 
  Clock, 
  Heart, 
  Users, 
  AlertTriangle, 
  Navigation,
  Filter,
  Search,
  User,
  Shield,
  Activity,
  Zap,
  TrendingUp,
  RefreshCw
} from "lucide-react"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { realTimeLocationService, DonorLocation, BloodRequestLocation, LocationUpdate } from "@/lib/real-time-location-service"
import FallbackMap from "./fallback-map"

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyD70d12Z53Ah6diehNl4PBCO3VwljXlrsw"

// TypeScript declarations for Google Maps
declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
}

interface MapState {
  center: { lat: number; lng: number }
  zoom: number
  selectedDonor?: DonorLocation
  selectedRequest?: BloodRequestLocation
  showDonors: boolean
  showBanks: boolean
  showRequests: boolean
  filterBloodType: string
  filterDistance: number
  realTimeMode: boolean
}

export default function GoogleMap() {
  const t = useI18n()
  const { user } = useEnhancedAuth()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const [mapState, setMapState] = useState<MapState>({
    center: { lat: -1.2921, lng: 36.8219 }, // Nairobi, Kenya
    zoom: 10,
    showDonors: true,
    showBanks: true,
    showRequests: true,
    filterBloodType: 'all',
    filterDistance: 50,
    realTimeMode: true
  })
  const [donors, setDonors] = useState<DonorLocation[]>([])
  const [bloodRequests, setBloodRequests] = useState<BloodRequestLocation[]>([])
  const [bloodBanks, setBloodBanks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [realTimeUpdates, setRealTimeUpdates] = useState<LocationUpdate[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // Fetch real data from APIs
  const fetchMapData = useCallback(async () => {
    if (!userLocation) return

    setDataLoading(true)
    try {
      const authToken = user?.session?.access_token || localStorage.getItem('supabase.auth.token')
      
      if (!authToken) {
        console.warn('No auth token available for API calls')
        return
      }

      const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }

      // Fetch nearby donors
      if (mapState.showDonors) {
        try {
          const donorsResponse = await fetch(
            `/api/location/nearby-donors?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${mapState.filterDistance}&bloodType=${mapState.filterBloodType !== 'all' ? mapState.filterBloodType : ''}`,
            { headers }
          )
          
          if (donorsResponse.ok) {
            const donorsData = await donorsResponse.json()
            if (donorsData.success && donorsData.data?.donors) {
              // Convert API response to DonorLocation format
              const mappedDonors: DonorLocation[] = donorsData.data.donors.map((donor: any) => ({
                id: donor.id,
                name: donor.name,
                bloodType: donor.bloodType,
                coordinates: donor.coordinates,
                status: donor.status,
                distance: donor.distance,
                responseRate: donor.responseRate,
                lastSeen: donor.lastUpdate,
                verified: donor.verified,
                emergencyContact: donor.phone,
                currentLocation: donor.address
              }))
              setDonors(mappedDonors)
            }
          }
        } catch (err) {
          console.error('Error fetching donors:', err)
        }
      }

      // Fetch blood banks
      if (mapState.showBanks) {
        try {
          const banksResponse = await fetch(
            `/api/location/blood-banks?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${mapState.filterDistance}&bloodType=${mapState.filterBloodType !== 'all' ? mapState.filterBloodType : ''}`,
            { headers }
          )
          
          if (banksResponse.ok) {
            const banksData = await banksResponse.json()
            if (banksData.success && banksData.data?.bloodBanks) {
              setBloodBanks(banksData.data.bloodBanks)
            }
          }
        } catch (err) {
          console.error('Error fetching blood banks:', err)
        }
      }

      // Fetch blood requests
      if (mapState.showRequests) {
        try {
          const requestsResponse = await fetch(
            `/api/location/blood-requests?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${mapState.filterDistance}`,
            { headers }
          )
          
          if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json()
            if (requestsData.success && requestsData.data?.bloodRequests) {
              // Convert API response to BloodRequestLocation format
              const mappedRequests: BloodRequestLocation[] = requestsData.data.bloodRequests.map((request: any) => ({
                id: request.id,
                patientName: request.patient_name,
                bloodType: request.blood_type,
                urgency: request.urgency,
                coordinates: request.coordinates,
                hospitalName: request.hospital_name,
                unitsNeeded: request.units_needed,
                contactPhone: request.contact_phone,
                requestTime: request.created_at,
                status: request.status
              }))
              setBloodRequests(mappedRequests)
            }
          }
        } catch (err) {
          console.error('Error fetching blood requests:', err)
        }
      }

    } catch (error) {
      console.error('Error fetching map data:', error)
    } finally {
      setDataLoading(false)
    }
  }, [userLocation, mapState, user])

  // Load Google Maps API
  const loadGoogleMapsAPI = useCallback(async () => {
    if (typeof window === 'undefined' || !mapRef.current) return

    try {
      setLoading(true)
      setError(null)

      // Validate API key
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error("Google Maps API key is not configured")
      }

      console.log("Loading Google Maps API with key:", GOOGLE_MAPS_API_KEY.substring(0, 20) + "...")

      // Check if Google Maps API is already loaded
      if (window.google && window.google.maps) {
        console.log("Google Maps API already loaded")
        initializeMap()
        return
      }

      // Load Google Maps API script
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=initGoogleMaps`
        script.async = true
        script.defer = true
        
        console.log("Loading script:", script.src)
        
        // Create global callback function
        window.initGoogleMaps = () => {
          try {
            console.log("Google Maps API loaded successfully")
            initializeMap()
            resolve()
          } catch (err) {
            console.error("Error initializing map:", err)
            setError("Failed to initialize Google Maps")
            setLoading(false)
            reject(err)
          }
        }
        
        script.onerror = (event) => {
          console.error("Failed to load Google Maps script:", event)
          setError("Failed to load Google Maps API. Please check your internet connection and API key.")
          setLoading(false)
          reject(new Error("Failed to load Google Maps API"))
        }
        
        document.head.appendChild(script)
      })

    } catch (error) {
      console.error("Error loading Google Maps:", error)
      setError(`Failed to load Google Maps: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setLoading(false)
    }
  }, [])

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) {
      setError("Google Maps API not available")
      setLoading(false)
      return
    }

    try {
      // Initialize map
      const map = new window.google.maps.Map(mapRef.current, {
        center: mapState.center,
        zoom: mapState.zoom,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ],
        zoomControl: true,
        mapTypeControl: true,
        scaleControl: true,
        streetViewControl: true,
        rotateControl: true,
        fullscreenControl: true
      })

      mapInstanceRef.current = map
      infoWindowRef.current = new window.google.maps.InfoWindow()

      // Add user location if available
      if (userLocation) {
        new window.google.maps.Marker({
          position: userLocation,
          map: map,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(24, 24)
          },
          title: "Your Location"
        })
      }

      // Add markers
      addDonorMarkers(map)
      addRequestMarkers(map)

      setLoading(false)
    } catch (err) {
      console.error("Error initializing map:", err)
      setError("Failed to initialize map")
      setLoading(false)
    }
  }

  const addDonorMarkers = (map: any) => {
    donors.forEach(donor => {
      if (!mapState.showDonors) return
      if (mapState.filterBloodType !== 'all' && donor.bloodType !== mapState.filterBloodType) return

      const marker = new window.google.maps.Marker({
        position: donor.location,
        map: map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="${donor.status === 'available' ? '#10B981' : donor.status === 'donating' ? '#F59E0B' : donor.status === 'traveling' ? '#3B82F6' : '#EF4444'}" stroke="white" stroke-width="2"/>
              <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${donor.bloodType}</text>
              ${donor.status === 'traveling' ? '<circle cx="16" cy="16" r="6" fill="white" opacity="0.8"><animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/></circle>' : ''}
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 32)
        },
        title: `${donor.name} (${donor.bloodType}) - ${donor.status}`
      })

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          const statusColor = donor.status === 'available' ? '#10B981' : 
                            donor.status === 'donating' ? '#F59E0B' : 
                            donor.status === 'traveling' ? '#3B82F6' : '#EF4444'
          
          infoWindowRef.current.setContent(`
            <div style="padding: 8px; min-width: 250px;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold;">${donor.name}</h3>
              <p style="margin: 4px 0; color: #666;">
                <strong>Blood Type:</strong> ${donor.bloodType}<br>
                <strong>Status:</strong> <span style="color: ${statusColor}">${donor.status}</span><br>
                <strong>Phone:</strong> ${donor.phone}<br>
                <strong>Last Update:</strong> ${new Date(donor.lastUpdate).toLocaleTimeString()}<br>
                <strong>Distance:</strong> ${donor.distance}km<br>
                <strong>Rating:</strong> ${donor.rating}/5 ⭐
                ${donor.estimatedArrival ? `<br><strong>ETA:</strong> ${donor.estimatedArrival}` : ''}
                ${donor.verified ? '<br><strong>✓ Verified Donor</strong>' : ''}
              </p>
              <div style="margin-top: 8px;">
                <button onclick="window.open('tel:${donor.phone}')" style="background: #10B981; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 4px;">Call</button>
                <button onclick="window.open('https://maps.google.com/maps?daddr=${donor.location.lat},${donor.location.lng}')" style="background: #3B82F6; color: white; border: none; padding: 4px 8px; border-radius: 4px;">Directions</button>
              </div>
            </div>
          `)
          infoWindowRef.current.open(map, marker)
        }
      })

      markersRef.current.push(marker)
    })
  }

  const addRequestMarkers = (map: any) => {
    bloodRequests.forEach(request => {
      if (!mapState.showRequests) return

      const urgencyColor = request.urgency === 'critical' ? '#EF4444' : 
                          request.urgency === 'urgent' ? '#F59E0B' : '#10B981'

      const marker = new window.google.maps.Marker({
        position: request.location,
        map: map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="24" height="24" rx="4" fill="${urgencyColor}" stroke="white" stroke-width="2"/>
              <text x="16" y="18" text-anchor="middle" fill="white" font-size="10" font-weight="bold">R</text>
              ${request.status === 'pending' ? '<circle cx="16" cy="16" r="6" fill="white" opacity="0.8"><animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite"/></circle>' : ''}
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 32)
        },
        title: `${request.patientName} - ${request.bloodType} (${request.urgency})`
      })

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding: 8px; min-width: 250px;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold;">${request.patientName}</h3>
              <p style="margin: 4px 0; color: #666;">
                <strong>Blood Type:</strong> ${request.bloodType}<br>
                <strong>Urgency:</strong> <span style="color: ${urgencyColor}">${request.urgency}</span><br>
                <strong>Hospital:</strong> ${request.hospital}<br>
                <strong>Units Needed:</strong> ${request.unitsNeeded}<br>
                <strong>Status:</strong> ${request.status}<br>
                <strong>Created:</strong> ${new Date(request.createdAt).toLocaleString()}
                ${request.matchedDonors ? `<br><strong>Matched Donors:</strong> ${request.matchedDonors.length}` : ''}
              </p>
              <div style="margin-top: 8px;">
                <button onclick="window.open('https://maps.google.com/maps?daddr=${request.location.lat},${request.location.lng}')" style="background: #3B82F6; color: white; border: none; padding: 4px 8px; border-radius: 4px;">Directions</button>
              </div>
            </div>
          `)
          infoWindowRef.current.open(map, marker)
        }
      })

      markersRef.current.push(marker)
    })
  }

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ lat: latitude, lng: longitude })
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat: latitude, lng: longitude })
          mapInstanceRef.current.setZoom(14)
        }
      },
      (error) => {
        let errorMessage = "Unable to get location"
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location services and try again."
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable."
            break
          case error.TIMEOUT:
            errorMessage = "Location request timed out."
            break
          default:
            errorMessage = "An unknown error occurred while retrieving location."
            break
        }
        
        console.warn("Location error:", errorMessage, error)
        // Optionally show a toast notification here
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    )
  }, [])

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []
  }

  const refreshMap = () => {
    if (mapInstanceRef.current) {
      clearMarkers()
      addDonorMarkers(mapInstanceRef.current)
      addRequestMarkers(mapInstanceRef.current)
    }
  }

  const retryLoadMap = () => {
    setError(null)
    setLoading(true)
    loadGoogleMapsAPI()
  }

  // Real-time location updates
  useEffect(() => {
    const handleLocationUpdates = (updates: LocationUpdate[]) => {
      setRealTimeUpdates(updates)
      
      // Update markers in real-time
      if (mapInstanceRef.current) {
        updates.forEach(update => {
          if (update.type === 'donor') {
            // Find and update donor marker
            const donor = donors.find(d => d.id === update.id)
            if (donor) {
              donor.location = update.location
              donor.lastUpdate = update.timestamp
              if (update.metadata?.estimatedArrival) {
                donor.estimatedArrival = update.metadata.estimatedArrival
              }
            }
          }
        })
        
        // Refresh map to show updated positions
        refreshMap()
      }
    }

    realTimeLocationService.addLocationListener(handleLocationUpdates)

    return () => {
      realTimeLocationService.removeLocationListener(handleLocationUpdates)
    }
  }, [donors])

  useEffect(() => {
    // Load initial data
    setDonors(realTimeLocationService.getDonors())
    setBloodRequests(realTimeLocationService.getRequests())
    loadGoogleMapsAPI()
  }, [loadGoogleMapsAPI])

  useEffect(() => {
    refreshMap()
  }, [mapState.showDonors, mapState.showRequests, mapState.filterBloodType, donors, bloodRequests])

  if (error) {
    return (
      <FallbackMap 
        donors={donors}
        bloodRequests={bloodRequests}
        onRetry={retryLoadMap}
      />
    )
  }

  if (loading) {
    return (
      <div className="h-[500px] w-full bg-muted animate-pulse rounded-lg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Loading Google Maps...</p>
          <p className="text-sm text-muted-foreground">This may take a few moments</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Map Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("map.title")}
            {mapState.realTimeMode && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Live
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showDonors"
                checked={mapState.showDonors}
                onChange={(e) => setMapState(prev => ({ ...prev, showDonors: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="showDonors" className="text-sm font-medium flex items-center gap-1">
                <Users className="h-4 w-4" />
                {t("map.donors")}
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showRequests"
                checked={mapState.showRequests}
                onChange={(e) => setMapState(prev => ({ ...prev, showRequests: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="showRequests" className="text-sm font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Blood Requests
              </label>
            </div>

            <Select value={mapState.filterBloodType} onValueChange={(value) => setMapState(prev => ({ ...prev, filterBloodType: value }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Blood Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A-">A-</SelectItem>
                <SelectItem value="B+">B+</SelectItem>
                <SelectItem value="B-">B-</SelectItem>
                <SelectItem value="O+">O+</SelectItem>
                <SelectItem value="O-">O-</SelectItem>
                <SelectItem value="AB+">AB+</SelectItem>
                <SelectItem value="AB-">AB-</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={getUserLocation} variant="outline" size="sm" className="flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              My Location
            </Button>

            <Button 
              onClick={() => setMapState(prev => ({ ...prev, realTimeMode: !prev.realTimeMode }))}
              variant={mapState.realTimeMode ? "default" : "outline"}
              size="sm" 
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {mapState.realTimeMode ? "Live" : "Static"}
            </Button>
          </div>

          {/* Map Container */}
          <div 
            ref={mapRef} 
            className="h-[500px] w-full rounded-lg overflow-hidden border"
          />
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Available Donors</p>
                <p className="text-2xl font-bold">{donors.filter(d => d.status === 'available').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Traveling</p>
                <p className="text-2xl font-bold">{donors.filter(d => d.status === 'traveling').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Active Requests</p>
                <p className="text-2xl font-bold">{bloodRequests.filter(r => r.status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Live Updates</p>
                <p className="text-2xl font-bold">{realTimeUpdates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 