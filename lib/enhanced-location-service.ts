/**
 * Enhanced Real-time Location Service
 * Provides comprehensive location tracking, geofencing, and mapping capabilities
 */

import { createServerSupabaseClient } from './supabase'
import { performanceMonitor } from './performance-monitoring'
import { websocketService } from './websocket-service'

export interface LocationCoordinates {
  lat: number
  lng: number
  accuracy?: number
  altitude?: number
  speed?: number
  heading?: number
}

export interface LocationUpdate {
  id: string
  userId: string
  type: 'donor' | 'blood_bank' | 'request' | 'transport'
  coordinates: LocationCoordinates
  address: string
  status: string
  timestamp: string
  metadata?: {
    requestId?: string
    transportId?: string
    eta?: string
    batteryLevel?: number
    networkType?: string
  }
}

export interface DonorLocation {
  id: string
  name: string
  bloodType: string
  coordinates: LocationCoordinates
  address: string
  status: 'available' | 'unavailable' | 'donating' | 'traveling' | 'offline'
  lastUpdate: string
  phone: string
  rating: number
  verified: boolean
  distance?: number
  estimatedArrival?: string
  responseRate?: number
  averageResponseTime?: number
}

export interface BloodRequestLocation {
  id: string
  patientName: string
  bloodType: string
  urgency: 'normal' | 'urgent' | 'critical'
  coordinates: LocationCoordinates
  address: string
  hospital: string
  unitsNeeded: number
  status: 'pending' | 'matched' | 'in_progress' | 'completed' | 'expired'
  createdAt: string
  updatedAt: string
  matchedDonors?: string[]
  estimatedCollectionTime?: string
}

export interface GeofenceZone {
  id: string
  name: string
  type: 'hospital' | 'blood_bank' | 'emergency_zone' | 'restricted'
  center: LocationCoordinates
  radius: number // in meters
  isActive: boolean
  alerts: {
    onEnter: boolean
    onExit: boolean
    notifyUsers: string[]
  }
}

export interface RouteOptimization {
  requestId: string
  donorId: string
  origin: LocationCoordinates
  destination: LocationCoordinates
  route: {
    distance: number // in meters
    duration: number // in seconds
    polyline: string
    waypoints: LocationCoordinates[]
  }
  traffic: {
    condition: 'light' | 'moderate' | 'heavy' | 'severe'
    delayMinutes: number
  }
  estimatedArrival: string
}

export class EnhancedLocationService {
  private supabase = createServerSupabaseClient()
  private locationUpdates: Map<string, LocationUpdate> = new Map()
  private geofences: Map<string, GeofenceZone> = new Map()
  private trackingIntervals: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.initializeGeofences()
  }

  /**
   * Start real-time location tracking for a user
   */
  async startLocationTracking(
    userId: string, 
    type: LocationUpdate['type'],
    options: {
      highAccuracy?: boolean
      updateInterval?: number
      requestId?: string
    } = {}
  ): Promise<{ success: boolean; trackingId: string }> {
    const tracker = performanceMonitor.startTracking('location-tracking', 'START')
    
    try {
      const trackingId = `track_${userId}_${Date.now()}`
      const updateInterval = options.updateInterval || 30000 // 30 seconds default

      console.log(`📍 Starting location tracking for user ${userId}`)

      // Store tracking configuration
      await this.supabase
        .from('location_tracking')
        .insert([{
          id: trackingId,
          user_id: userId,
          type,
          status: 'active',
          request_id: options.requestId,
          high_accuracy: options.highAccuracy || false,
          update_interval: updateInterval,
          started_at: new Date().toISOString()
        }])

      // Set up periodic location updates (in real app, this would be client-side)
      const interval = setInterval(async () => {
        await this.updateLocationPeriodically(userId, type, options.requestId)
      }, updateInterval)

      this.trackingIntervals.set(trackingId, interval)

      tracker.end(200)
      return { success: true, trackingId }

    } catch (error) {
      console.error('Error starting location tracking:', error)
      tracker.end(500)
      return { success: false, trackingId: '' }
    }
  }

  /**
   * Update user location in real-time
   */
  async updateLocation(
    userId: string,
    coordinates: LocationCoordinates,
    type: LocationUpdate['type'],
    requestId?: string
  ): Promise<{ success: boolean; address?: string }> {
    try {
      // Reverse geocode to get address
      const address = await this.reverseGeocode(coordinates)

      const locationUpdate: LocationUpdate = {
        id: `loc_${userId}_${Date.now()}`,
        userId,
        type,
        coordinates,
        address,
        status: 'active',
        timestamp: new Date().toISOString(),
        metadata: requestId ? { requestId } : undefined
      }

      // Store in database
      await this.supabase
        .from('location_updates')
        .insert([{
          id: locationUpdate.id,
          user_id: userId,
          type,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          accuracy: coordinates.accuracy,
          address,
          status: 'active',
          request_id: requestId,
          created_at: locationUpdate.timestamp
        }])

      // Update user's current location
      await this.supabase
        .from('users')
        .update({
          current_latitude: coordinates.lat,
          current_longitude: coordinates.lng,
          current_address: address,
          last_location_update: locationUpdate.timestamp
        })
        .eq('id', userId)

      // Cache location update
      this.locationUpdates.set(userId, locationUpdate)

      // Check geofences
      await this.checkGeofences(userId, coordinates)

      // Broadcast to interested parties
      await this.broadcastLocationUpdate(locationUpdate)

      return { success: true, address }

    } catch (error) {
      console.error('Error updating location:', error)
      return { success: false }
    }
  }

  /**
   * Find nearby donors for a blood request
   */
  async findNearbyDonors(
    requestCoordinates: LocationCoordinates,
    bloodType: string,
    radiusKm: number = 10,
    maxResults: number = 20
  ): Promise<DonorLocation[]> {
    const tracker = performanceMonitor.startTracking('location-search', 'NEARBY_DONORS')

    try {
      // Get blood type compatibility
      const compatibleTypes = this.getCompatibleBloodTypes(bloodType)

      // Query nearby donors using PostGIS
      const { data: donors } = await this.supabase
        .rpc('find_nearby_donors', {
          request_lat: requestCoordinates.lat,
          request_lng: requestCoordinates.lng,
          radius_km: radiusKm,
          blood_types: compatibleTypes,
          max_results: maxResults
        })

      const donorLocations: DonorLocation[] = []

      for (const donor of donors || []) {
        const distance = this.calculateDistance(
          requestCoordinates,
          { lat: donor.latitude, lng: donor.longitude }
        )

        const estimatedArrival = this.estimateArrivalTime(
          { lat: donor.latitude, lng: donor.longitude },
          requestCoordinates
        )

        donorLocations.push({
          id: donor.id,
          name: donor.name,
          bloodType: donor.blood_type,
          coordinates: {
            lat: donor.latitude,
            lng: donor.longitude
          },
          address: donor.current_address || donor.location,
          status: donor.available ? 'available' : 'unavailable',
          lastUpdate: donor.last_location_update || donor.updated_at,
          phone: donor.phone,
          rating: donor.rating || 5.0,
          verified: donor.verified || false,
          distance,
          estimatedArrival,
          responseRate: donor.response_rate,
          averageResponseTime: donor.avg_response_time
        })
      }

      // Sort by distance and ML score if available
      donorLocations.sort((a, b) => {
        const scoreA = this.calculateDonorScore(a)
        const scoreB = this.calculateDonorScore(b)
        return scoreB - scoreA
      })

      console.log(`📍 Found ${donorLocations.length} nearby donors within ${radiusKm}km`)
      tracker.end(200)

      return donorLocations

    } catch (error) {
      console.error('Error finding nearby donors:', error)
      tracker.end(500)
      return []
    }
  }

  /**
   * Get real-time blood requests on map
   */
  async getActiveBloodRequests(
    centerCoordinates?: LocationCoordinates,
    radiusKm?: number
  ): Promise<BloodRequestLocation[]> {
    try {
      let query = this.supabase
        .from('blood_requests')
        .select(`
          *,
          matched_donors:donor_responses(user_id, status)
        `)
        .in('status', ['pending', 'matched', 'in_progress'])
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      // If center coordinates provided, filter by radius
      if (centerCoordinates && radiusKm) {
        const { data: requests } = await this.supabase
          .rpc('find_nearby_requests', {
            center_lat: centerCoordinates.lat,
            center_lng: centerCoordinates.lng,
            radius_km: radiusKm
          })
        
        return this.mapToBloodRequestLocations(requests || [])
      }

      const { data: requests } = await query.order('created_at', { ascending: false })
      return this.mapToBloodRequestLocations(requests || [])

    } catch (error) {
      console.error('Error getting active blood requests:', error)
      return []
    }
  }

  /**
   * Optimize route between donor and request location
   */
  async optimizeRoute(
    donorId: string,
    requestId: string
  ): Promise<RouteOptimization | null> {
    try {
      // Get donor and request locations
      const [donorLocation, requestLocation] = await Promise.all([
        this.getUserLocation(donorId),
        this.getRequestLocation(requestId)
      ])

      if (!donorLocation || !requestLocation) {
        throw new Error('Could not find donor or request location')
      }

      // Calculate optimal route (simplified - would use routing service in production)
      const distance = this.calculateDistance(donorLocation, requestLocation)
      const duration = this.estimateTravelTime(distance)
      
      // Get traffic conditions (mock data - would use real traffic API)
      const traffic = await this.getTrafficConditions(donorLocation, requestLocation)
      
      const routeOptimization: RouteOptimization = {
        requestId,
        donorId,
        origin: donorLocation,
        destination: requestLocation,
        route: {
          distance: distance * 1000, // Convert to meters
          duration: duration * 60, // Convert to seconds
          polyline: this.generatePolyline(donorLocation, requestLocation),
          waypoints: [donorLocation, requestLocation]
        },
        traffic,
        estimatedArrival: new Date(Date.now() + (duration + traffic.delayMinutes) * 60 * 1000).toISOString()
      }

      // Store route optimization
      await this.supabase
        .from('route_optimizations')
        .insert([{
          request_id: requestId,
          donor_id: donorId,
          distance: routeOptimization.route.distance,
          duration: routeOptimization.route.duration,
          traffic_delay: traffic.delayMinutes,
          estimated_arrival: routeOptimization.estimatedArrival,
          polyline: routeOptimization.route.polyline
        }])

      return routeOptimization

    } catch (error) {
      console.error('Error optimizing route:', error)
      return null
    }
  }

  /**
   * Set up geofencing for locations
   */
  async createGeofence(geofence: Omit<GeofenceZone, 'id'>): Promise<string> {
    try {
      const geofenceId = `geofence_${Date.now()}`
      
      const { error } = await this.supabase
        .from('geofences')
        .insert([{
          id: geofenceId,
          name: geofence.name,
          type: geofence.type,
          center_lat: geofence.center.lat,
          center_lng: geofence.center.lng,
          radius: geofence.radius,
          is_active: geofence.isActive,
          alert_on_enter: geofence.alerts.onEnter,
          alert_on_exit: geofence.alerts.onExit,
          notify_users: geofence.alerts.notifyUsers
        }])

      if (error) throw error

      // Cache geofence
      this.geofences.set(geofenceId, { ...geofence, id: geofenceId })

      return geofenceId

    } catch (error) {
      console.error('Error creating geofence:', error)
      throw error
    }
  }

  /**
   * Stop location tracking for a user
   */
  async stopLocationTracking(trackingId: string): Promise<void> {
    try {
      // Clear interval
      const interval = this.trackingIntervals.get(trackingId)
      if (interval) {
        clearInterval(interval)
        this.trackingIntervals.delete(trackingId)
      }

      // Update database
      await this.supabase
        .from('location_tracking')
        .update({
          status: 'stopped',
          stopped_at: new Date().toISOString()
        })
        .eq('id', trackingId)

      console.log(`📍 Stopped location tracking: ${trackingId}`)

    } catch (error) {
      console.error('Error stopping location tracking:', error)
    }
  }

  /**
   * Get location history for analysis
   */
  async getLocationHistory(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<LocationUpdate[]> {
    try {
      const { data: locations } = await this.supabase
        .from('location_updates')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })

      return (locations || []).map(loc => ({
        id: loc.id,
        userId: loc.user_id,
        type: loc.type,
        coordinates: {
          lat: loc.latitude,
          lng: loc.longitude,
          accuracy: loc.accuracy
        },
        address: loc.address,
        status: loc.status,
        timestamp: loc.created_at,
        metadata: {
          requestId: loc.request_id
        }
      }))

    } catch (error) {
      console.error('Error getting location history:', error)
      return []
    }
  }

  // Private helper methods

  private async updateLocationPeriodically(
    userId: string, 
    type: LocationUpdate['type'],
    requestId?: string
  ): Promise<void> {
    // In a real app, this would get GPS coordinates from the device
    // For now, we'll simulate with small random movements
    const currentLocation = await this.getUserLocation(userId)
    if (!currentLocation) return

    const newCoordinates: LocationCoordinates = {
      lat: currentLocation.lat + (Math.random() - 0.5) * 0.001, // Small random movement
      lng: currentLocation.lng + (Math.random() - 0.5) * 0.001,
      accuracy: 10 + Math.random() * 20
    }

    await this.updateLocation(userId, newCoordinates, type, requestId)
  }

  private async reverseGeocode(coordinates: LocationCoordinates): Promise<string> {
    // In production, this would use a real geocoding service
    // For now, return a mock address
    return `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`
  }

  private async checkGeofences(userId: string, coordinates: LocationCoordinates): Promise<void> {
    for (const [geofenceId, geofence] of this.geofences) {
      if (!geofence.isActive) continue

      const distance = this.calculateDistance(coordinates, geofence.center)
      const isInside = distance <= geofence.radius / 1000 // Convert meters to km

      // Check for entry/exit events
      const wasInside = await this.wasUserInGeofence(userId, geofenceId)
      
      if (isInside && !wasInside && geofence.alerts.onEnter) {
        await this.triggerGeofenceAlert(userId, geofenceId, 'enter')
      } else if (!isInside && wasInside && geofence.alerts.onExit) {
        await this.triggerGeofenceAlert(userId, geofenceId, 'exit')
      }

      // Update geofence status
      await this.updateGeofenceStatus(userId, geofenceId, isInside)
    }
  }

  private async broadcastLocationUpdate(locationUpdate: LocationUpdate): Promise<void> {
    // Broadcast to WebSocket subscribers
    websocketService.broadcast(`location:${locationUpdate.userId}`, {
      type: 'location_update',
      data: locationUpdate
    })

    // If it's a donor update, notify relevant blood requests
    if (locationUpdate.type === 'donor') {
      await this.notifyRelevantRequests(locationUpdate)
    }
  }

  private async notifyRelevantRequests(locationUpdate: LocationUpdate): Promise<void> {
    // Find active blood requests within range
    const nearbyRequests = await this.getActiveBloodRequests(
      locationUpdate.coordinates,
      10 // 10km radius
    )

    for (const request of nearbyRequests) {
      websocketService.broadcast(`request:${request.id}`, {
        type: 'nearby_donor_update',
        data: {
          donorId: locationUpdate.userId,
          location: locationUpdate.coordinates,
          distance: this.calculateDistance(locationUpdate.coordinates, request.coordinates)
        }
      })
    }
  }

  private getCompatibleBloodTypes(bloodType: string): string[] {
    const compatibilityMatrix: Record<string, string[]> = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+']
    }

    return compatibilityMatrix[bloodType] || []
  }

  private calculateDistance(coord1: LocationCoordinates, coord2: LocationCoordinates): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.deg2rad(coord2.lat - coord1.lat)
    const dLon = this.deg2rad(coord2.lng - coord1.lng)
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(coord1.lat)) * Math.cos(this.deg2rad(coord2.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180)
  }

  private estimateArrivalTime(origin: LocationCoordinates, destination: LocationCoordinates): string {
    const distance = this.calculateDistance(origin, destination)
    const travelTimeMinutes = this.estimateTravelTime(distance)
    return new Date(Date.now() + travelTimeMinutes * 60 * 1000).toISOString()
  }

  private estimateTravelTime(distanceKm: number): number {
    // Estimate travel time based on distance (assuming average speed of 30 km/h in city)
    return Math.round(distanceKm / 30 * 60) // Returns minutes
  }

  private calculateDonorScore(donor: DonorLocation): number {
    let score = 100

    // Distance factor (closer is better)
    if (donor.distance) {
      score -= donor.distance * 2 // Penalty for distance
    }

    // Response rate factor
    if (donor.responseRate) {
      score += donor.responseRate * 50
    }

    // Rating factor
    score += donor.rating * 10

    // Verification bonus
    if (donor.verified) {
      score += 20
    }

    // Status factor
    if (donor.status === 'available') {
      score += 30
    }

    return score
  }

  private async getUserLocation(userId: string): Promise<LocationCoordinates | null> {
    try {
      const { data: user } = await this.supabase
        .from('users')
        .select('current_latitude, current_longitude')
        .eq('id', userId)
        .single()

      if (!user || !user.current_latitude || !user.current_longitude) {
        return null
      }

      return {
        lat: user.current_latitude,
        lng: user.current_longitude
      }
    } catch (error) {
      return null
    }
  }

  private async getRequestLocation(requestId: string): Promise<LocationCoordinates | null> {
    try {
      const { data: request } = await this.supabase
        .from('blood_requests')
        .select('latitude, longitude')
        .eq('id', requestId)
        .single()

      if (!request || !request.latitude || !request.longitude) {
        return null
      }

      return {
        lat: request.latitude,
        lng: request.longitude
      }
    } catch (error) {
      return null
    }
  }

  private async getTrafficConditions(
    origin: LocationCoordinates, 
    destination: LocationCoordinates
  ): Promise<{ condition: 'light' | 'moderate' | 'heavy' | 'severe'; delayMinutes: number }> {
    // Mock traffic data - in production would use real traffic API
    const conditions = ['light', 'moderate', 'heavy', 'severe'] as const
    const condition = conditions[Math.floor(Math.random() * conditions.length)]
    
    const delays = { light: 0, moderate: 5, heavy: 15, severe: 30 }
    
    return {
      condition,
      delayMinutes: delays[condition]
    }
  }

  private generatePolyline(origin: LocationCoordinates, destination: LocationCoordinates): string {
    // Simplified polyline generation - in production would use routing service
    return `${origin.lat},${origin.lng};${destination.lat},${destination.lng}`
  }

  private mapToBloodRequestLocations(requests: any[]): BloodRequestLocation[] {
    return requests.map(request => ({
      id: request.id,
      patientName: request.patient_name,
      bloodType: request.blood_type,
      urgency: request.urgency,
      coordinates: {
        lat: request.latitude,
        lng: request.longitude
      },
      address: request.location,
      hospital: request.hospital_name,
      unitsNeeded: request.units_needed,
      status: request.status,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
      matchedDonors: request.matched_donors?.map((m: { user_id: string }) => m.user_id) || []
    }))
  }

  private async initializeGeofences(): Promise<void> {
    try {
      const { data: geofences } = await this.supabase
        .from('geofences')
        .select('*')
        .eq('is_active', true)

      for (const gf of geofences || []) {
        this.geofences.set(gf.id, {
          id: gf.id,
          name: gf.name,
          type: gf.type,
          center: { lat: gf.center_lat, lng: gf.center_lng },
          radius: gf.radius,
          isActive: gf.is_active,
          alerts: {
            onEnter: gf.alert_on_enter,
            onExit: gf.alert_on_exit,
            notifyUsers: gf.notify_users || []
          }
        })
      }

      console.log(`📍 Initialized ${this.geofences.size} geofences`)
    } catch (error) {
      console.error('Error initializing geofences:', error)
    }
  }

  private async wasUserInGeofence(userId: string, geofenceId: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('geofence_status')
        .select('is_inside')
        .eq('user_id', userId)
        .eq('geofence_id', geofenceId)
        .single()

      return data?.is_inside || false
    } catch (error) {
      return false
    }
  }

  private async triggerGeofenceAlert(userId: string, geofenceId: string, eventType: 'enter' | 'exit'): Promise<void> {
    const geofence = this.geofences.get(geofenceId)
    if (!geofence) return

    console.log(`🚨 Geofence alert: User ${userId} ${eventType}ed ${geofence.name}`)

    // Store geofence event
    await this.supabase
      .from('geofence_events')
      .insert([{
        user_id: userId,
        geofence_id: geofenceId,
        event_type: eventType,
        timestamp: new Date().toISOString()
      }])

    // Notify relevant users
    for (const notifyUserId of geofence.alerts.notifyUsers) {
      websocketService.broadcast(`user:${notifyUserId}`, {
        type: 'geofence_alert',
        data: {
          userId,
          geofenceName: geofence.name,
          eventType,
          timestamp: new Date().toISOString()
        }
      })
    }
  }

  private async updateGeofenceStatus(userId: string, geofenceId: string, isInside: boolean): Promise<void> {
    await this.supabase
      .from('geofence_status')
      .upsert([{
        user_id: userId,
        geofence_id: geofenceId,
        is_inside: isInside,
        updated_at: new Date().toISOString()
      }])
  }
}

// Export singleton instance
export const enhancedLocationService = new EnhancedLocationService()