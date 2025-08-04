'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// TypeScript declarations for Google Maps
declare global {
  interface Window {
    google: any
    initGoogleMapsCallback: () => void
  }
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  MapPin, 
  Navigation, 
  Users, 
  Droplet, 
  Clock, 
  AlertTriangle,
  Zap,
  RefreshCw,
  Target,
  Route,
  Eye,
  EyeOff
} from 'lucide-react'

interface LocationCoordinates {
  lat: number
  lng: number
}

interface DonorMarker {
  id: string
  name: string
  bloodType: string
  coordinates: LocationCoordinates
  status: 'available' | 'unavailable' | 'traveling' | 'donating'
  distance: number
  estimatedArrival: string
  responseRate: number
  verified: boolean
}

interface BloodRequestMarker {
  id: string
  patientName: string
  bloodType: string
  urgency: 'normal' | 'urgent' | 'critical'
  coordinates: LocationCoordinates
  hospital: string
  unitsNeeded: number
  status: string
  createdAt: string
  matchedDonors: string[]
}

interface BloodBankMarker {
  id: string
  name: string
  coordinates: LocationCoordinates
  address: string
  isActive: boolean
  distance: number
  inventory: Record<string, number>
}

interface MapProps {
  center?: LocationCoordinates
  zoom?: number
  showDonors?: boolean
  showRequests?: boolean
  showBloodBanks?: boolean
  showTraffic?: boolean
  showRoutes?: boolean
  currentUserId?: string
  requestId?: string
  className?: string
}

export function EnhancedMap({
  center = { lat: -1.2921, lng: 36.8219 }, // Nairobi
  zoom = 12,
  showDonors = true,
  showRequests = true,
  showBloodBanks = true,
  showTraffic = false,
  showRoutes = false,
  currentUserId,
  requestId,
  className = ''
}: MapProps) {
  console.log("🎯 EnhancedMap component mounting...", { center, zoom, className })
  
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapContainerReady, setMapContainerReady] = useState(false)
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null)
  const [donors, setDonors] = useState<DonorMarker[]>([])
  const [requests, setRequests] = useState<BloodRequestMarker[]>([])
  const [bloodBanks, setBloodBanks] = useState<BloodBankMarker[]>([])
  const [selectedMarker, setSelectedMarker] = useState<any>(null)
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [routeDisplayed, setRouteDisplayed] = useState<string | null>(null)
  const [websocketConnected, setWebsocketConnected] = useState(false)
  const [markerClusters, setMarkerClusters] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // Callback ref to detect when the map container is ready
  const mapCallbackRef = useCallback((node: HTMLDivElement | null) => {
    console.log("🎯 Map callback ref called", { node: !!node })
    if (node) {
      mapRef.current = node
      setMapContainerReady(true)
    }
  }, [])

  // Initialize map when container is ready
  useEffect(() => {
    console.log("🚀 EnhancedMap useEffect triggered", { mapContainerReady, center, zoom })
    
    if (!mapContainerReady) {
      console.log("❌ Map container not ready yet")
      return
    }

    const initMap = async () => {
      try {
        console.log("🔄 Setting loading state and clearing errors")
        setLoading(true)
        setError(null)

        console.log("✅ Map container ready, starting initialization")
        console.log("📡 About to load Google Maps API...")
        
        // Load Google Maps API
        await loadGoogleMapsAPI()

      } catch (err) {
        console.error("❌ Error in initMap:", err)
        setError('Failed to initialize map')
        setLoading(false)
      }
    }

    console.log("🎬 Calling initMap function")
    initMap()
  }, [mapContainerReady, center, zoom])

  // Load Google Maps API
  const loadGoogleMapsAPI = async () => {
    const GOOGLE_MAPS_API_KEY = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY']
    
    console.log("🗺️ Starting Google Maps API loading...")
    console.log("🔑 API Key:", GOOGLE_MAPS_API_KEY ? GOOGLE_MAPS_API_KEY.substring(0, 20) + "..." : "NOT_FOUND")
    
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key is not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.")
    }

    // Check if Google Maps API is already loaded
    if (window.google && window.google.maps) {
      console.log("✅ Google Maps API already loaded")
      initializeGoogleMap()
      return
    }

    console.log("📡 Loading Google Maps API script...")

    // Load Google Maps API script
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=initGoogleMapsCallback`
      script.async = true
      script.defer = true
      
      console.log("📍 Script URL:", script.src)
      
      // Create global callback function
      window.initGoogleMapsCallback = () => {
        try {
          console.log("🎯 Google Maps API callback triggered")
          
          // Check if Google Maps API loaded properly
          if (!window.google || !window.google.maps) {
            throw new Error("Google Maps API did not load properly")
          }
          
          // Check for common API errors
          if (window.google.maps.InfoWindow === undefined) {
            throw new Error("Google Maps API key may be invalid or restricted")
          }
          
          initializeGoogleMap()
          resolve()
        } catch (err) {
          console.error("❌ Error in Google Maps callback:", err)
          let errorMessage = "Failed to initialize Google Maps. "
          
          if (err instanceof Error) {
            if (err.message.includes("InvalidKeyMapError")) {
              errorMessage += "Invalid API key."
            } else if (err.message.includes("RefererNotAllowedMapError")) {
              errorMessage += "Domain not allowed for this API key."
            } else if (err.message.includes("RequestDeniedMapError")) {
              errorMessage += "API request denied. Check if Maps JavaScript API is enabled."
            } else {
              errorMessage += err.message
            }
          }
          
          setError(errorMessage)
          setLoading(false)
          reject(err)
        }
      }
      
      script.onload = () => {
        console.log("✅ Google Maps script loaded successfully")
      }
      
      script.onerror = (event) => {
        console.error("❌ Failed to load Google Maps script:", event)
        console.error("❌ This could be due to:")
        console.error("   - Invalid API key")
        console.error("   - API key restrictions (check domains/IPs allowed)")
        console.error("   - Maps JavaScript API not enabled in Google Cloud Console")
        console.error("   - Billing not enabled for the Google Cloud project")
        console.error("   - Network connectivity issues")
        console.error("   - API quotas exceeded")
        console.error("❌ Script source:", script.src)
        
        // Try to determine the specific error
        let errorMessage = "Failed to load Google Maps API. "
        if (navigator.onLine === false) {
          errorMessage += "Check your internet connection."
        } else {
          errorMessage += "This is likely due to API key issues. Please check: 1) API key is valid, 2) Maps JavaScript API is enabled, 3) Billing is set up, 4) Domain restrictions are correct."
        }
        
        setError(errorMessage)
        setLoading(false)
        reject(new Error("Failed to load Google Maps API"))
      }
      
      // Add timeout to detect hanging script loads
      setTimeout(() => {
        if (!window.google || !window.google.maps) {
          console.warn("⚠️ Google Maps API taking longer than expected to load...")
          console.warn("⚠️ Checking for errors in Network tab or API key issues")
        }
      }, 10000) // 10 seconds timeout
      
      document.head.appendChild(script)
      console.log("📝 Script added to document head")
    })
  }

  // Initialize Google Map
  const initializeGoogleMap = async () => {
    console.log("🚀 Initializing Google Map...")
    console.log("📍 Map ref:", mapRef.current ? "✅ Available" : "❌ Not found")
    console.log("🌍 Google API:", window.google ? "✅ Available" : "❌ Not found")
    console.log("🗺️ Google Maps:", window.google?.maps ? "✅ Available" : "❌ Not found")
    console.log("📊 Center coordinates:", center)
    console.log("🔍 Zoom level:", zoom)
    
    if (!mapRef.current || !window.google || !window.google.maps) {
      console.error("❌ Google Maps API not available")
      setError("Google Maps API not available")
      setLoading(false)
      return
    }

    try {
      console.log("🎯 Creating Google Map instance...")
      
      // Initialize Google Map
      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: center,
        zoom: zoom,
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

      console.log("✅ Google Map created successfully:", googleMap)
      setMap(googleMap)
      setLoading(false)

      // Add error event listener to catch API key issues
      googleMap.addListener('error', (errorEvent: any) => {
        console.error("❌ Google Maps API Error:", errorEvent)
        let errorMessage = "Google Maps API Error: "
        
        if (errorEvent.code === 'INVALID_REQUEST') {
          errorMessage += "Invalid request. Check API key permissions."
        } else if (errorEvent.code === 'OVER_QUERY_LIMIT') {
          errorMessage += "API quota exceeded."
        } else if (errorEvent.code === 'REQUEST_DENIED') {
          errorMessage += "Request denied. Check if Maps JavaScript API is enabled."
        } else if (errorEvent.code === 'UNKNOWN_ERROR') {
          errorMessage += "Unknown error occurred."
        } else {
          errorMessage += errorEvent.message || "Unknown error"
        }
        
        setError(errorMessage)
      })

      // Initialize marker clustering
      initializeMarkerClustering(googleMap)

      // Load initial data
      console.log("📊 Loading initial map data...")
      await loadMapData()

    } catch (err) {
      console.error("❌ Error initializing Google Map:", err)
      let errorMsg = "Failed to initialize Google Map: "
      
      if (err instanceof Error) {
        if (err.message.includes("InvalidKeyMapError")) {
          errorMsg += "Invalid API key"
        } else if (err.message.includes("RefererNotAllowedMapError")) {
          errorMsg += "Domain not allowed for this API key"
        } else if (err.message.includes("RequestDeniedMapError")) {
          errorMsg += "API request denied - check if Maps JavaScript API is enabled"
        } else {
          errorMsg += err.message
        }
      } else {
        errorMsg += "Unknown error"
      }
      
      setError(errorMsg)
      setLoading(false)
    }
  }

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setUserLocation(location)
        },
        (error) => {
          console.warn('Could not get user location:', error)
        }
      )
    }
  }, [])

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!map || !currentUserId) return

    // Initialize WebSocket connection for real-time updates
    const initWebSocket = () => {
      try {
        const wsUrl = process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:3001'
        const ws = new WebSocket(`${wsUrl}/location-updates`)
        
        ws.onopen = () => {
          console.log('📡 WebSocket connected for real-time updates')
          setWebsocketConnected(true)
          
          // Subscribe to location updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'location-updates',
            userId: currentUserId
          }))
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            handleRealTimeUpdate(data)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        ws.onclose = () => {
          console.log('📡 WebSocket disconnected')
          setWebsocketConnected(false)
          
          // Reconnect after 5 seconds
          setTimeout(initWebSocket, 5000)
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          setWebsocketConnected(false)
        }

        wsRef.current = ws
        
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error)
        // Fallback to polling
        setTimeout(() => {
          if (trackingEnabled) {
            loadMapData()
          }
        }, 30000)
      }
    }

    initWebSocket()

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [map, currentUserId, trackingEnabled])

  // Handle real-time updates from WebSocket
  const handleRealTimeUpdate = (data: any) => {
    console.log('📍 Real-time update received:', data)
    
    switch (data.type) {
      case 'donor_location_update':
        setDonors(prev => prev.map(donor => 
          donor.id === data.userId 
            ? { ...donor, coordinates: data.coordinates, status: data.status }
            : donor
        ))
        break
        
      case 'new_blood_request':
        setRequests(prev => [...prev, {
          id: data.requestId,
          patientName: data.patientName,
          bloodType: data.bloodType,
          urgency: data.urgency,
          coordinates: data.coordinates,
          hospital: data.hospital,
          unitsNeeded: data.unitsNeeded,
          status: 'pending',
          createdAt: data.createdAt,
          matchedDonors: []
        }])
        break
        
      case 'request_status_update':
        setRequests(prev => prev.map(request =>
          request.id === data.requestId
            ? { ...request, status: data.status, matchedDonors: data.matchedDonors || request.matchedDonors }
            : request
        ))
        break
        
      default:
        console.log('Unknown real-time update type:', data.type)
    }
  }

  // Initialize marker clustering for performance
  const initializeMarkerClustering = (googleMap: any) => {
    try {
      console.log('🔗 Initializing marker clustering for map:', googleMap.getMapTypeId())
      
      // Marker clustering will be initialized when @googlemaps/markerclusterer is available
      // For now, we'll implement a simple clustering algorithm
      const clusters: any[] = []
      setMarkerClusters(clusters)
      
      console.log('✅ Marker clustering initialized')
    } catch (error) {
      console.error('❌ Error initializing marker clustering:', error)
    }
  }

  // Simple clustering algorithm for performance
  const clusterMarkers = (markers: any[], zoomLevel: number = 12) => {
    const clusters: any[] = []
    const clusterRadius = 100 / Math.pow(2, zoomLevel - 10) // Adjust cluster radius based on zoom
    
    markers.forEach(marker => {
      let addedToCluster = false
      
      // Try to add to existing cluster
      for (const cluster of clusters) {
        const distance = calculateDistance(
          marker.coordinates.lat,
          marker.coordinates.lng,
          cluster.center.lat,
          cluster.center.lng
        )
        
        if (distance < clusterRadius) {
          cluster.markers.push(marker)
          // Update cluster center (average position)
          cluster.center.lat = cluster.markers.reduce((sum: number, m: any) => sum + m.coordinates.lat, 0) / cluster.markers.length
          cluster.center.lng = cluster.markers.reduce((sum: number, m: any) => sum + m.coordinates.lng, 0) / cluster.markers.length
          addedToCluster = true
          break
        }
      }
      
      // Create new cluster if not added to existing one
      if (!addedToCluster) {
        clusters.push({
          id: `cluster_${clusters.length}`,
          center: { ...marker.coordinates },
          markers: [marker],
          type: marker.type || 'mixed'
        })
      }
    })
    
    return clusters
  }

  // Calculate distance between two coordinates (in km)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Update markers with clustering
  const updateMarkersOnMap = () => {
    
    if (!map) return

    // Combine all markers
    const allMarkers = [
      ...donors.map(d => ({ ...d, type: 'donor' })),
      ...requests.map(r => ({ ...r, type: 'request' })),
      ...bloodBanks.map(b => ({ ...b, type: 'blood_bank' }))
    ]

    // Apply clustering if there are many markers
    if (allMarkers.length > 20) {
      const clustered = clusterMarkers(allMarkers, map.getZoom())
      setMarkerClusters(clustered)
      console.log(`🔗 Clustered ${allMarkers.length} markers into ${clustered.length} clusters`)
    } else {
      // Show individual markers when count is low
      setMarkerClusters(allMarkers.map(marker => ({
        id: marker.id,
        center: marker.coordinates,
        markers: [marker],
        type: marker.type
      })))
    }
  }

  // Update markers when data changes
  useEffect(() => {
    updateMarkersOnMap()
  }, [donors, requests, bloodBanks, map])

  const loadMapData = async () => {
    try {
      setLoading(true)

      const promises = []

      if (showDonors) {
        promises.push(loadNearbyDonors())
      }

      if (showRequests) {
        promises.push(loadBloodRequests())
      }

      if (showBloodBanks) {
        promises.push(loadBloodBanks())
      }

      await Promise.all(promises)

    } catch (err) {
      setError('Failed to load map data')
    } finally {
      setLoading(false)
    }
  }

  const loadNearbyDonors = async () => {
    try {
      console.log('🩸 Loading nearby donors...')
      
      // Use user location if available, otherwise use map center
      const searchLocation = userLocation || center
      
      const response = await fetch('/api/location/nearby-donors?' + new URLSearchParams({
        lat: searchLocation.lat.toString(),
        lng: searchLocation.lng.toString(),
        radius: '15', // 15km radius
        maxResults: '50'
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.donors) {
          const donorMarkers: DonorMarker[] = data.data.donors.map((donor: any) => ({
            id: donor.id,
            name: donor.name || 'Anonymous Donor',
            bloodType: donor.bloodType || donor.blood_type,
            coordinates: donor.coordinates || { lat: donor.current_latitude, lng: donor.current_longitude },
            status: donor.status || 'available',
            distance: donor.distance || 0,
            estimatedArrival: donor.estimatedArrival || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            responseRate: donor.responseRate || donor.response_rate || 0.85,
            verified: donor.verified || false
          }))
          
          setDonors(donorMarkers)
          console.log(`✅ Loaded ${donorMarkers.length} donor markers`)
        }
      } else if (response.status === 401) {
        console.warn('⚠️ Authentication required for donor data')
        setError('Please log in to view donor locations')
      } else {
        console.error('❌ Failed to load donors:', response.status)
      }
    } catch (error) {
      console.error('Error loading donors:', error)
    }
  }

  const loadBloodRequests = async () => {
    try {
      console.log('🩸 Loading blood requests...')
      
      const searchLocation = userLocation || center
      
      const response = await fetch('/api/location/blood-requests?' + new URLSearchParams({
        lat: searchLocation.lat.toString(),
        lng: searchLocation.lng.toString(),
        radius: '20',
        maxResults: '30'
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.requests) {
          const requestMarkers: BloodRequestMarker[] = data.data.requests.map((request: any) => ({
            id: request.id,
            patientName: request.patientName,
            bloodType: request.bloodType,
            urgency: request.urgency,
            coordinates: request.coordinates,
            hospital: request.hospital,
            unitsNeeded: request.unitsNeeded,
            status: request.status,
            createdAt: request.createdAt,
            matchedDonors: [] // Will be populated by matching service
          }))
          
          setRequests(requestMarkers)
          console.log(`✅ Loaded ${requestMarkers.length} blood request markers`)
        }
      } else if (response.status === 401) {
        console.warn('⚠️ Authentication required for blood requests')
      }
    } catch (error) {
      console.error('Error loading requests:', error)
    }
  }

  const loadBloodBanks = async () => {
    try {
      console.log('🏥 Loading blood banks...')
      
      const searchLocation = userLocation || center
      
      const response = await fetch('/api/location/blood-banks?' + new URLSearchParams({
        lat: searchLocation.lat.toString(),
        lng: searchLocation.lng.toString(),
        radius: '25',
        isActive: 'true',
        maxResults: '20'
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.bloodBanks) {
          const bankMarkers: BloodBankMarker[] = data.data.bloodBanks.map((bank: any) => ({
            id: bank.id,
            name: bank.name,
            coordinates: bank.coordinates,
            address: bank.address,
            isActive: bank.isActive,
            distance: bank.distance,
            inventory: bank.inventory || {}
          }))
          
          setBloodBanks(bankMarkers)
          console.log(`✅ Loaded ${bankMarkers.length} blood bank markers`)
        }
      } else if (response.status === 401) {
        console.warn('⚠️ Authentication required for blood banks')
      }
    } catch (error) {
      console.error('Error loading blood banks:', error)
    }
  }

  const startLocationTracking = async () => {
    if (!currentUserId) return

    try {
      const response = await fetch('/api/location/tracking/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          type: 'donor',
          requestId,
          highAccuracy: true,
          updateInterval: 30000
        })
      })

      if (response.ok) {
        setTrackingEnabled(true)
      }
    } catch (error) {
      console.error('Error starting tracking:', error)
    }
  }

  const stopLocationTracking = async () => {
    // Implementation would stop tracking
    setTrackingEnabled(false)
  }

  const showRoute = async (donorId: string, requestId: string) => {
    try {
      const response = await fetch('/api/location/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donorId, requestId })
      })

      if (response.ok) {
        const routeData = await response.json()
        setRouteDisplayed(`${donorId}-${requestId}`)
        
        // In real implementation, would draw route on map
        console.log('Route data:', routeData)
      }
    } catch (error) {
      console.error('Error showing route:', error)
    }
  }

  const hideRoute = () => {
    setRouteDisplayed(null)
    // Remove route from map
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500'
      case 'urgent': return 'bg-orange-500'
      case 'normal': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500'
      case 'traveling': return 'bg-yellow-500'
      case 'donating': return 'bg-blue-500'
      case 'unavailable': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDistance = (distance: number) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`
    }
    return `${distance.toFixed(1)}km`
  }

  const formatTime = (timeString: string) => {
    const time = new Date(timeString)
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Handle error state with overlay instead of early return
  const errorOverlay = error && (
    <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button 
          onClick={() => {
            setError(null)
            setLoading(true)
            loadGoogleMapsAPI()
          }}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Loading Map
        </Button>
      </div>
    </div>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Map Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Real-time Blood Network Map</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMapData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              {currentUserId && (
                <Button
                  variant={trackingEnabled ? "destructive" : "default"}
                  size="sm"
                  onClick={trackingEnabled ? stopLocationTracking : startLocationTracking}
                >
                  {trackingEnabled ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1" />
                      Stop Tracking
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      Start Tracking
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            {showDonors && (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Donors ({donors.length})</span>
              </div>
            )}
            {showRequests && (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Requests ({requests.length})</span>
              </div>
            )}
            {showBloodBanks && (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Blood Banks ({bloodBanks.length})</span>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Map Container */}
      <Card>
        <CardContent className="p-0">
          <div className="relative">
            {/* Google Maps Container */}
            <div 
              ref={mapCallbackRef}
              className="w-full h-96 rounded-lg overflow-hidden"
            />

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                  <p>Loading Google Maps...</p>
                  <p className="text-xs text-muted-foreground">
                    {process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ? "API Key configured" : "API Key not configured"}
                  </p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {errorOverlay}

            {/* Tracking indicator */}
            {trackingEnabled && (
              <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                Live Tracking
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Nearby Donors */}
        {showDonors && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Users className="h-4 w-4 mr-2 text-green-600" />
                Nearby Donors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {donors.slice(0, 5).map((donor) => (
                <div key={donor.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(donor.status)}`}></div>
                    <div>
                      <div className="font-medium text-sm">{donor.name}</div>
                      <div className="text-xs text-gray-500 flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {donor.bloodType}
                        </Badge>
                        <span>{formatDistance(donor.distance)}</span>
                        {donor.verified && (
                          <span className="text-green-600">✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      ETA: {formatTime(donor.estimatedArrival)}
                    </div>
                    {requestId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1 text-xs"
                        onClick={() => showRoute(donor.id, requestId)}
                      >
                        <Route className="h-3 w-3 mr-1" />
                        Route
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {donors.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No donors nearby</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active Requests */}
        {showRequests && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Droplet className="h-4 w-4 mr-2 text-red-600" />
                Blood Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {requests.slice(0, 5).map((request) => (
                <div key={request.id} className="p-2 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getUrgencyColor(request.urgency)}`}></div>
                      <Badge variant="outline" className="text-xs">
                        {request.bloodType}
                      </Badge>
                      <Badge 
                        variant={request.urgency === 'critical' ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {request.urgency}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      {request.unitsNeeded} units
                    </div>
                  </div>
                  
                  <div className="text-sm font-medium">{request.hospital}</div>
                  <div className="text-xs text-gray-500 flex items-center justify-between">
                    <span>{formatTime(request.createdAt)}</span>
                    <span>{request.matchedDonors.length} matched</span>
                  </div>
                </div>
              ))}
              
              {requests.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Droplet className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No active requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Blood Banks */}
        {showBloodBanks && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                Blood Banks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {bloodBanks.slice(0, 5).map((bank) => (
                <div key={bank.id} className="p-2 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm">{bank.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatDistance(bank.distance)}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-2">
                    {bank.address}
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(bank.inventory).map(([bloodType, count]) => (
                      <Badge 
                        key={bloodType} 
                        variant={count > 5 ? "default" : count > 0 ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {bloodType}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              
              {bloodBanks.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No blood banks nearby</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Route display indicator */}
      {routeDisplayed && (
        <Alert>
          <Route className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Route displayed on map</span>
            <Button
              variant="outline"
              size="sm"
              onClick={hideRoute}
            >
              Hide Route
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}