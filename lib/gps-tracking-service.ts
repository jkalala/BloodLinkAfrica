"use client"

import { getSupabase } from "./supabase"
import { performanceMonitor } from "./performance-monitoring"

export interface Vehicle {
  id: string
  vehicleType: 'ambulance' | 'blood_transport' | 'mobile_unit' | 'emergency_response'
  licensePlate: string
  model: string
  year: number
  capacity: number
  hospitalId?: string
  driverId?: string
  status: 'available' | 'dispatched' | 'en_route' | 'at_destination' | 'returning' | 'maintenance' | 'offline'
  currentLocation: GeoLocation
  destination?: GeoLocation
  metadata: Record<string, unknown>
}

export interface GeoLocation {
  latitude: number
  longitude: number
  altitude?: number
  accuracy: number
  timestamp: Date
  address?: string
  speed?: number
  heading?: number
}

export interface VehicleTracking {
  vehicleId: string
  locations: GeoLocation[]
  route?: RouteInfo
  trip?: TripInfo
  geofences: Geofence[]
  alerts: TrackingAlert[]
  lastUpdate: Date
  isTracking: boolean
}

export interface RouteInfo {
  id: string
  startLocation: GeoLocation
  endLocation: GeoLocation
  estimatedDistance: number
  estimatedDuration: number
  actualDistance?: number
  actualDuration?: number
  waypoints: GeoLocation[]
  routePolyline: string
  trafficConditions: 'light' | 'moderate' | 'heavy' | 'severe'
  createdAt: Date
}

export interface TripInfo {
  id: string
  vehicleId: string
  purpose: 'blood_delivery' | 'patient_transport' | 'emergency_response' | 'routine_collection'
  startTime: Date
  endTime?: Date
  startLocation: GeoLocation
  endLocation?: GeoLocation
  mileage?: number
  fuelUsed?: number
  status: 'in_progress' | 'completed' | 'cancelled'
  emergencyLevel?: 'low' | 'medium' | 'high' | 'critical'
  assignedPersonnel: string[]
}

export interface Geofence {
  id: string
  name: string
  type: 'hospital' | 'blood_bank' | 'emergency_zone' | 'restricted_area' | 'depot'
  shape: 'circle' | 'polygon'
  coordinates: GeoLocation | GeoLocation[]
  radius?: number
  isActive: boolean
  alertOnEntry: boolean
  alertOnExit: boolean
  metadata: Record<string, unknown>
}

export interface TrackingAlert {
  id: string
  vehicleId: string
  alertType: 'speeding' | 'geofence_violation' | 'route_deviation' | 'maintenance_due' | 'emergency_stop' | 'offline'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  location: GeoLocation
  timestamp: Date
  acknowledged: boolean
  resolvedAt?: Date
}

export interface DispatchRequest {
  id: string
  vehicleId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  requestType: 'blood_delivery' | 'patient_pickup' | 'emergency_response'
  pickupLocation: GeoLocation
  deliveryLocation: GeoLocation
  requestedBy: string
  specialInstructions?: string
  estimatedDuration: number
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: Date
}

export class GPSTrackingService {
  private supabase = getSupabase()
  private activeVehicles = new Map<string, VehicleTracking>()
  private geofences = new Map<string, Geofence>()
  private dispatchQueue = new Map<string, DispatchRequest>()
  private trackingIntervals = new Map<string, NodeJS.Timer>()
  private updateFrequency = 30000 // 30 seconds
  private maxTrackingHistory = 100 // Keep last 100 location points per vehicle

  constructor() {
    this.initializeService()
  }

  /**
   * Initialize GPS tracking service
   */
  private async initializeService(): Promise<void> {
    try {
      console.log('🛰️ Initializing GPS tracking service...')
      
      await this.loadVehicles()
      await this.loadGeofences()
      await this.loadActiveTrips()
      this.startLocationTracking()
      
      console.log('✅ GPS tracking service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize GPS tracking service:', error)
    }
  }

  /**
   * Start tracking a vehicle
   */
  async startVehicleTracking(vehicleId: string): Promise<void> {
    try {
      console.log(`🚗 Starting tracking for vehicle ${vehicleId}`)

      // Get vehicle info
      const { data: vehicle } = await this.supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single()

      if (!vehicle) {
        throw new Error('Vehicle not found')
      }

      // Initialize tracking data
      const tracking: VehicleTracking = {
        vehicleId,
        locations: [],
        geofences: Array.from(this.geofences.values()),
        alerts: [],
        lastUpdate: new Date(),
        isTracking: true
      }

      this.activeVehicles.set(vehicleId, tracking)

      // Start periodic location updates
      const interval = setInterval(async () => {
        await this.updateVehicleLocation(vehicleId)
      }, this.updateFrequency)

      this.trackingIntervals.set(vehicleId, interval)

      // Update vehicle status
      await this.updateVehicleStatus(vehicleId, 'available')

      console.log(`✅ Vehicle ${vehicleId} tracking started`)

    } catch (error) {
      console.error(`❌ Failed to start tracking for vehicle ${vehicleId}:`, error)
      throw error
    }
  }

  /**
   * Stop tracking a vehicle
   */
  async stopVehicleTracking(vehicleId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping tracking for vehicle ${vehicleId}`)

      // Clear tracking interval
      const interval = this.trackingIntervals.get(vehicleId)
      if (interval) {
        clearInterval(interval)
        this.trackingIntervals.delete(vehicleId)
      }

      // Update tracking status
      const tracking = this.activeVehicles.get(vehicleId)
      if (tracking) {
        tracking.isTracking = false
        this.activeVehicles.set(vehicleId, tracking)
      }

      // Update vehicle status
      await this.updateVehicleStatus(vehicleId, 'offline')

      console.log(`✅ Vehicle ${vehicleId} tracking stopped`)

    } catch (error) {
      console.error(`❌ Failed to stop tracking for vehicle ${vehicleId}:`, error)
    }
  }

  /**
   * Update vehicle location
   */
  async updateVehicleLocation(
    vehicleId: string,
    location?: GeoLocation
  ): Promise<void> {
    try {
      const tracking = this.activeVehicles.get(vehicleId)
      if (!tracking || !tracking.isTracking) return

      // Get location from GPS device or use provided location
      const currentLocation = location || await this.getCurrentLocation(vehicleId)
      
      if (!currentLocation) return

      // Add to location history
      tracking.locations.push(currentLocation)
      
      // Limit history size
      if (tracking.locations.length > this.maxTrackingHistory) {
        tracking.locations = tracking.locations.slice(-this.maxTrackingHistory)
      }

      tracking.lastUpdate = new Date()

      // Store location in database
      await this.storeLocationUpdate(vehicleId, currentLocation)

      // Check for geofence violations
      await this.checkGeofenceViolations(vehicleId, currentLocation)

      // Check for alerts (speeding, route deviation, etc.)
      await this.checkTrackingAlerts(vehicleId, currentLocation)

      // Update real-time subscribers
      await this.broadcastLocationUpdate(vehicleId, currentLocation)

      this.activeVehicles.set(vehicleId, tracking)

    } catch (error) {
      console.error(`❌ Failed to update location for vehicle ${vehicleId}:`, error)
    }
  }

  /**
   * Dispatch vehicle for emergency
   */
  async dispatchVehicle(request: {
    vehicleId?: string
    priority: DispatchRequest['priority']
    requestType: DispatchRequest['requestType']
    pickupLocation: GeoLocation
    deliveryLocation: GeoLocation
    requestedBy: string
    specialInstructions?: string
  }): Promise<string> {
    const tracker = performanceMonitor.startTracking('gps-tracking', 'DISPATCH_VEHICLE')
    
    try {
      console.log(`🚨 Dispatching vehicle for ${request.requestType} (${request.priority} priority)`)

      // Find best available vehicle if not specified
      let vehicleId = request.vehicleId
      if (!vehicleId) {
        vehicleId = await this.findBestAvailableVehicle(request.requestType, request.pickupLocation)
      }

      if (!vehicleId) {
        throw new Error('No available vehicles for dispatch')
      }

      // Calculate estimated duration
      const estimatedDuration = await this.calculateRouteEstimate(
        request.pickupLocation,
        request.deliveryLocation
      )

      // Create dispatch request
      const dispatchId = this.generateDispatchId()
      const dispatchRequest: DispatchRequest = {
        id: dispatchId,
        vehicleId,
        priority: request.priority,
        requestType: request.requestType,
        pickupLocation: request.pickupLocation,
        deliveryLocation: request.deliveryLocation,
        requestedBy: request.requestedBy,
        specialInstructions: request.specialInstructions,
        estimatedDuration,
        status: 'assigned',
        createdAt: new Date()
      }

      // Store dispatch request
      await this.storeDispatchRequest(dispatchRequest)
      this.dispatchQueue.set(dispatchId, dispatchRequest)

      // Update vehicle status
      await this.updateVehicleStatus(vehicleId, 'dispatched')

      // Create trip
      const tripId = await this.createTrip(vehicleId, request)

      // Generate route
      const route = await this.generateRoute(
        request.pickupLocation,
        request.deliveryLocation,
        vehicleId
      )

      // Update vehicle tracking with route
      const tracking = this.activeVehicles.get(vehicleId)
      if (tracking) {
        tracking.route = route
        this.activeVehicles.set(vehicleId, tracking)
      }

      // Notify vehicle/driver
      await this.notifyVehicleDispatch(vehicleId, dispatchRequest)

      console.log(`✅ Vehicle ${vehicleId} dispatched for ${request.requestType}`)
      tracker.end(200)

      return dispatchId

    } catch (error) {
      console.error('❌ Failed to dispatch vehicle:', error)
      tracker.end(500)
      throw error
    }
  }

  /**
   * Get real-time vehicle locations
   */
  async getVehicleLocations(filters: {
    vehicleType?: Vehicle['vehicleType']
    status?: Vehicle['status']
    hospitalId?: string
    geofenceId?: string
  } = {}): Promise<Array<{ vehicle: Vehicle; location: GeoLocation; tracking: VehicleTracking }>> {
    try {
      const results = []

      for (const [vehicleId, tracking] of this.activeVehicles.entries()) {
        if (!tracking.isTracking || tracking.locations.length === 0) continue

        // Get vehicle info
        const { data: vehicle } = await this.supabase
          .from('vehicles')
          .select('*')
          .eq('id', vehicleId)
          .single()

        if (!vehicle) continue

        // Apply filters
        if (filters.vehicleType && vehicle.vehicle_type !== filters.vehicleType) continue
        if (filters.status && vehicle.status !== filters.status) continue
        if (filters.hospitalId && vehicle.hospital_id !== filters.hospitalId) continue

        // Geofence filter
        if (filters.geofenceId) {
          const geofence = this.geofences.get(filters.geofenceId)
          if (geofence) {
            const currentLocation = tracking.locations[tracking.locations.length - 1]
            const isInGeofence = this.isLocationInGeofence(currentLocation, geofence)
            if (!isInGeofence) continue
          }
        }

        results.push({
          vehicle: this.mapDatabaseVehicleToInterface(vehicle),
          location: tracking.locations[tracking.locations.length - 1],
          tracking
        })
      }

      return results

    } catch (error) {
      console.error('❌ Failed to get vehicle locations:', error)
      return []
    }
  }

  /**
   * Get vehicle tracking history
   */
  async getVehicleHistory(
    vehicleId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    locations: GeoLocation[]
    trips: TripInfo[]
    alerts: TrackingAlert[]
    statistics: {
      totalDistance: number
      totalDuration: number
      averageSpeed: number
      fuelEfficiency: number
    }
  }> {
    try {
      // Get location history
      const { data: locations } = await this.supabase
        .from('vehicle_location_history')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .gte('timestamp', timeRange.start.toISOString())
        .lte('timestamp', timeRange.end.toISOString())
        .order('timestamp', { ascending: true })

      // Get trips
      const { data: trips } = await this.supabase
        .from('vehicle_trips')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .gte('start_time', timeRange.start.toISOString())
        .lte('start_time', timeRange.end.toISOString())

      // Get alerts
      const { data: alerts } = await this.supabase
        .from('tracking_alerts')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .gte('timestamp', timeRange.start.toISOString())
        .lte('timestamp', timeRange.end.toISOString())

      // Calculate statistics
      const statistics = this.calculateVehicleStatistics(
        locations?.map(this.mapDatabaseLocationToInterface) || [],
        trips?.map(this.mapDatabaseTripToInterface) || []
      )

      return {
        locations: locations?.map(this.mapDatabaseLocationToInterface) || [],
        trips: trips?.map(this.mapDatabaseTripToInterface) || [],
        alerts: alerts?.map(this.mapDatabaseAlertToInterface) || [],
        statistics
      }

    } catch (error) {
      console.error('❌ Failed to get vehicle history:', error)
      return {
        locations: [],
        trips: [],
        alerts: [],
        statistics: {
          totalDistance: 0,
          totalDuration: 0,
          averageSpeed: 0,
          fuelEfficiency: 0
        }
      }
    }
  }

  /**
   * Create or update geofence
   */
  async createGeofence(geofence: Omit<Geofence, 'id'>): Promise<string> {
    try {
      const geofenceId = this.generateGeofenceId()
      const newGeofence: Geofence = {
        id: geofenceId,
        ...geofence
      }

      // Store in database
      await this.supabase
        .from('geofences')
        .insert({
          id: geofenceId,
          name: geofence.name,
          type: geofence.type,
          shape: geofence.shape,
          coordinates: geofence.coordinates,
          radius: geofence.radius,
          is_active: geofence.isActive,
          alert_on_entry: geofence.alertOnEntry,
          alert_on_exit: geofence.alertOnExit,
          metadata: geofence.metadata
        })

      this.geofences.set(geofenceId, newGeofence)

      console.log(`✅ Created geofence: ${geofence.name}`)
      return geofenceId

    } catch (error) {
      console.error('❌ Failed to create geofence:', error)
      throw error
    }
  }

  /**
   * Get tracking alerts
   */
  async getTrackingAlerts(filters: {
    vehicleId?: string
    alertType?: TrackingAlert['alertType']
    severity?: TrackingAlert['severity']
    acknowledged?: boolean
    timeRange?: { start: Date; end: Date }
  } = {}): Promise<TrackingAlert[]> {
    try {
      let query = this.supabase
        .from('tracking_alerts')
        .select('*')
        .order('timestamp', { ascending: false })

      if (filters.vehicleId) {
        query = query.eq('vehicle_id', filters.vehicleId)
      }
      if (filters.alertType) {
        query = query.eq('alert_type', filters.alertType)
      }
      if (filters.severity) {
        query = query.eq('severity', filters.severity)
      }
      if (filters.acknowledged !== undefined) {
        query = query.eq('acknowledged', filters.acknowledged)
      }
      if (filters.timeRange) {
        query = query
          .gte('timestamp', filters.timeRange.start.toISOString())
          .lte('timestamp', filters.timeRange.end.toISOString())
      }

      const { data: alerts, error } = await query

      if (error) throw error

      return alerts?.map(this.mapDatabaseAlertToInterface) || []

    } catch (error) {
      console.error('❌ Failed to get tracking alerts:', error)
      return []
    }
  }

  /**
   * Acknowledge tracking alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      await this.supabase
        .from('tracking_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: acknowledgedBy,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId)

      console.log(`✅ Alert ${alertId} acknowledged by ${acknowledgedBy}`)

    } catch (error) {
      console.error(`❌ Failed to acknowledge alert ${alertId}:`, error)
      throw error
    }
  }

  /**
   * Private utility methods
   */
  private async loadVehicles(): Promise<void> {
    try {
      const { data: vehicles } = await this.supabase
        .from('vehicles')
        .select('*')
        .neq('status', 'decommissioned')

      console.log(`🚗 Loaded ${vehicles?.length || 0} vehicles`)
    } catch (error) {
      console.error('❌ Failed to load vehicles:', error)
    }
  }

  private async loadGeofences(): Promise<void> {
    try {
      const { data: geofences } = await this.supabase
        .from('geofences')
        .select('*')
        .eq('is_active', true)

      geofences?.forEach(geofence => {
        this.geofences.set(geofence.id, {
          id: geofence.id,
          name: geofence.name,
          type: geofence.type,
          shape: geofence.shape,
          coordinates: geofence.coordinates,
          radius: geofence.radius,
          isActive: geofence.is_active,
          alertOnEntry: geofence.alert_on_entry,
          alertOnExit: geofence.alert_on_exit,
          metadata: geofence.metadata || {}
        })
      })

      console.log(`🗺️ Loaded ${geofences?.length || 0} geofences`)
    } catch (error) {
      console.error('❌ Failed to load geofences:', error)
    }
  }

  private async loadActiveTrips(): Promise<void> {
    try {
      const { data: trips } = await this.supabase
        .from('vehicle_trips')
        .select('*')
        .eq('status', 'in_progress')

      trips?.forEach(trip => {
        const vehicleId = trip.vehicle_id
        const tracking = this.activeVehicles.get(vehicleId)
        if (tracking) {
          tracking.trip = this.mapDatabaseTripToInterface(trip)
          this.activeVehicles.set(vehicleId, tracking)
        }
      })

      console.log(`🚛 Loaded ${trips?.length || 0} active trips`)
    } catch (error) {
      console.error('❌ Failed to load active trips:', error)
    }
  }

  private startLocationTracking(): void {
    console.log('🛰️ Starting location tracking for all vehicles')
    
    // This would start tracking for all active vehicles
    // In a real implementation, this would connect to GPS hardware/APIs
  }

  private async getCurrentLocation(vehicleId: string): Promise<GeoLocation | null> {
    try {
      // In a real implementation, this would get location from GPS device
      // For simulation, we can generate or get cached location
      
      const tracking = this.activeVehicles.get(vehicleId)
      if (!tracking || tracking.locations.length === 0) {
        return null
      }

      // Simulate slight movement from last known position
      const lastLocation = tracking.locations[tracking.locations.length - 1]
      const newLocation: GeoLocation = {
        latitude: lastLocation.latitude + (Math.random() - 0.5) * 0.001,
        longitude: lastLocation.longitude + (Math.random() - 0.5) * 0.001,
        accuracy: 5,
        timestamp: new Date(),
        speed: Math.random() * 60, // 0-60 km/h
        heading: Math.random() * 360
      }

      return newLocation

    } catch (error) {
      console.error(`❌ Failed to get location for vehicle ${vehicleId}:`, error)
      return null
    }
  }

  private async checkGeofenceViolations(vehicleId: string, location: GeoLocation): Promise<void> {
    try {
      const tracking = this.activeVehicles.get(vehicleId)
      if (!tracking) return

      for (const geofence of this.geofences.values()) {
        if (!geofence.isActive) continue

        const isInside = this.isLocationInGeofence(location, geofence)
        const wasInside = tracking.locations.length > 1 ? 
          this.isLocationInGeofence(tracking.locations[tracking.locations.length - 2], geofence) : false

        // Check for entry/exit events
        if (isInside && !wasInside && geofence.alertOnEntry) {
          await this.createTrackingAlert(vehicleId, {
            alertType: 'geofence_violation',
            severity: 'medium',
            message: `Vehicle entered geofence: ${geofence.name}`,
            location
          })
        } else if (!isInside && wasInside && geofence.alertOnExit) {
          await this.createTrackingAlert(vehicleId, {
            alertType: 'geofence_violation',
            severity: 'medium',
            message: `Vehicle exited geofence: ${geofence.name}`,
            location
          })
        }
      }

    } catch (error) {
      console.error('❌ Failed to check geofence violations:', error)
    }
  }

  private isLocationInGeofence(location: GeoLocation, geofence: Geofence): boolean {
    if (geofence.shape === 'circle') {
      const center = geofence.coordinates as GeoLocation
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        center.latitude,
        center.longitude
      )
      return distance <= (geofence.radius || 0)
    } else if (geofence.shape === 'polygon') {
      const polygon = geofence.coordinates as GeoLocation[]
      return this.isPointInPolygon(location, polygon)
    }
    
    return false
  }

  private isPointInPolygon(point: GeoLocation, polygon: GeoLocation[]): boolean {
    let inside = false
    const x = point.longitude
    const y = point.latitude

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude
      const yi = polygon[i].latitude
      const xj = polygon[j].longitude
      const yj = polygon[j].latitude

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }

    return inside
  }

  private async checkTrackingAlerts(vehicleId: string, location: GeoLocation): Promise<void> {
    try {
      // Check for speeding
      if (location.speed && location.speed > 80) { // 80 km/h speed limit
        await this.createTrackingAlert(vehicleId, {
          alertType: 'speeding',
          severity: location.speed > 100 ? 'high' : 'medium',
          message: `Vehicle speeding: ${Math.round(location.speed)} km/h`,
          location
        })
      }

      // Check for route deviation
      const tracking = this.activeVehicles.get(vehicleId)
      if (tracking?.route) {
        const deviationDistance = this.calculateRouteDeviation(location, tracking.route)
        if (deviationDistance > 1000) { // 1km deviation threshold
          await this.createTrackingAlert(vehicleId, {
            alertType: 'route_deviation',
            severity: 'medium',
            message: `Vehicle deviated from route by ${Math.round(deviationDistance)}m`,
            location
          })
        }
      }

      // Check for emergency stop (no movement for extended time)
      if (tracking && tracking.locations.length > 5) {
        const recentLocations = tracking.locations.slice(-5)
        const hasMovement = recentLocations.some(loc => 
          this.calculateDistance(loc.latitude, loc.longitude, location.latitude, location.longitude) > 10
        )
        
        if (!hasMovement && location.speed === 0) {
          await this.createTrackingAlert(vehicleId, {
            alertType: 'emergency_stop',
            severity: 'high',
            message: 'Vehicle stopped unexpectedly',
            location
          })
        }
      }

    } catch (error) {
      console.error('❌ Failed to check tracking alerts:', error)
    }
  }

  private calculateRouteDeviation(location: GeoLocation, route: RouteInfo): number {
    // Simplified route deviation calculation
    // In reality, this would check distance to the planned route line
    const targetLocation = route.endLocation
    return this.calculateDistance(
      location.latitude,
      location.longitude,
      targetLocation.latitude,
      targetLocation.longitude
    ) * 1000 // Convert to meters
  }

  private async createTrackingAlert(
    vehicleId: string,
    alertData: {
      alertType: TrackingAlert['alertType']
      severity: TrackingAlert['severity']
      message: string
      location: GeoLocation
    }
  ): Promise<void> {
    try {
      const alertId = this.generateAlertId()
      const alert: TrackingAlert = {
        id: alertId,
        vehicleId,
        alertType: alertData.alertType,
        severity: alertData.severity,
        message: alertData.message,
        location: alertData.location,
        timestamp: new Date(),
        acknowledged: false
      }

      // Store in database
      await this.supabase
        .from('tracking_alerts')
        .insert({
          id: alertId,
          vehicle_id: vehicleId,
          alert_type: alertData.alertType,
          severity: alertData.severity,
          message: alertData.message,
          location: alertData.location,
          timestamp: alert.timestamp.toISOString(),
          acknowledged: false
        })

      // Add to vehicle tracking
      const tracking = this.activeVehicles.get(vehicleId)
      if (tracking) {
        tracking.alerts.push(alert)
        this.activeVehicles.set(vehicleId, tracking)
      }

      // Send real-time notification
      await this.notifyTrackingAlert(alert)

      console.log(`🚨 Created tracking alert: ${alertData.alertType} for vehicle ${vehicleId}`)

    } catch (error) {
      console.error('❌ Failed to create tracking alert:', error)
    }
  }

  private async findBestAvailableVehicle(
    requestType: DispatchRequest['requestType'],
    pickupLocation: GeoLocation
  ): Promise<string | null> {
    try {
      // Get available vehicles of appropriate type
      const vehicleTypes = this.getVehicleTypesForRequest(requestType)
      
      const { data: vehicles } = await this.supabase
        .from('vehicles')
        .select('*')
        .in('vehicle_type', vehicleTypes)
        .eq('status', 'available')

      if (!vehicles || vehicles.length === 0) return null

      // Find closest vehicle
      let bestVehicle = null
      let shortestDistance = Infinity

      for (const vehicle of vehicles) {
        const tracking = this.activeVehicles.get(vehicle.id)
        if (!tracking || tracking.locations.length === 0) continue

        const currentLocation = tracking.locations[tracking.locations.length - 1]
        const distance = this.calculateDistance(
          pickupLocation.latitude,
          pickupLocation.longitude,
          currentLocation.latitude,
          currentLocation.longitude
        )

        if (distance < shortestDistance) {
          shortestDistance = distance
          bestVehicle = vehicle.id
        }
      }

      return bestVehicle

    } catch (error) {
      console.error('❌ Failed to find best available vehicle:', error)
      return null
    }
  }

  private getVehicleTypesForRequest(requestType: DispatchRequest['requestType']): Vehicle['vehicleType'][] {
    switch (requestType) {
      case 'patient_pickup':
        return ['ambulance', 'emergency_response']
      case 'blood_delivery':
        return ['blood_transport', 'ambulance', 'mobile_unit']
      case 'emergency_response':
        return ['ambulance', 'emergency_response']
      default:
        return ['ambulance', 'blood_transport', 'mobile_unit', 'emergency_response']
    }
  }

  private async calculateRouteEstimate(start: GeoLocation, end: GeoLocation): Promise<number> {
    // Simplified route calculation
    // In reality, this would use routing services like Google Maps API
    const distance = this.calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude)
    const averageSpeed = 40 // km/h in city traffic
    return Math.round((distance / averageSpeed) * 60) // minutes
  }

  private async generateRoute(
    start: GeoLocation,
    end: GeoLocation,
    vehicleId: string
  ): Promise<RouteInfo> {
    const routeId = this.generateRouteId()
    const distance = this.calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude)
    const estimatedDuration = await this.calculateRouteEstimate(start, end)

    return {
      id: routeId,
      startLocation: start,
      endLocation: end,
      estimatedDistance: distance,
      estimatedDuration,
      waypoints: [start, end], // Simplified
      routePolyline: '', // Would contain encoded polyline
      trafficConditions: 'moderate',
      createdAt: new Date()
    }
  }

  private async createTrip(vehicleId: string, request: Record<string, unknown>): Promise<string> {
    const tripId = this.generateTripId()
    
    const trip: TripInfo = {
      id: tripId,
      vehicleId,
      purpose: request.requestType,
      startTime: new Date(),
      startLocation: request.pickupLocation,
      status: 'in_progress',
      assignedPersonnel: [request.requestedBy]
    }

    // Store in database
    await this.supabase
      .from('vehicle_trips')
      .insert({
        id: tripId,
        vehicle_id: vehicleId,
        purpose: trip.purpose,
        start_time: trip.startTime.toISOString(),
        start_location: trip.startLocation,
        status: trip.status,
        assigned_personnel: trip.assignedPersonnel
      })

    return tripId
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  private calculateVehicleStatistics(
    locations: GeoLocation[],
    trips: TripInfo[]
  ): {
    totalDistance: number
    totalDuration: number
    averageSpeed: number
    fuelEfficiency: number
  } {
    let totalDistance = 0
    let totalDuration = 0

    // Calculate from trips
    trips.forEach(trip => {
      if (trip.endTime) {
        totalDuration += trip.endTime.getTime() - trip.startTime.getTime()
      }
      // Distance would be calculated from route or mileage
    })

    // Calculate from locations
    for (let i = 1; i < locations.length; i++) {
      const distance = this.calculateDistance(
        locations[i-1].latitude,
        locations[i-1].longitude,
        locations[i].latitude,
        locations[i].longitude
      )
      totalDistance += distance
    }

    const totalHours = totalDuration / (1000 * 60 * 60)
    const averageSpeed = totalHours > 0 ? totalDistance / totalHours : 0

    return {
      totalDistance,
      totalDuration: totalDuration / (1000 * 60), // in minutes
      averageSpeed,
      fuelEfficiency: 12.5 // Placeholder - would calculate from actual fuel data
    }
  }

  // Database mapping methods
  private mapDatabaseVehicleToInterface(dbVehicle: Record<string, unknown>): Vehicle {
    return {
      id: dbVehicle.id,
      vehicleType: dbVehicle.vehicle_type,
      licensePlate: dbVehicle.license_plate,
      model: dbVehicle.model,
      year: dbVehicle.year,
      capacity: dbVehicle.capacity,
      hospitalId: dbVehicle.hospital_id,
      driverId: dbVehicle.driver_id,
      status: dbVehicle.status,
      currentLocation: dbVehicle.current_location || {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        timestamp: new Date()
      },
      destination: dbVehicle.destination,
      metadata: dbVehicle.metadata || {}
    }
  }

  private mapDatabaseLocationToInterface(dbLocation: Record<string, unknown>): GeoLocation {
    return {
      latitude: dbLocation.latitude,
      longitude: dbLocation.longitude,
      altitude: dbLocation.altitude,
      accuracy: dbLocation.accuracy,
      timestamp: new Date(dbLocation.timestamp),
      address: dbLocation.address,
      speed: dbLocation.speed,
      heading: dbLocation.heading
    }
  }

  private mapDatabaseTripToInterface(dbTrip: Record<string, unknown>): TripInfo {
    return {
      id: dbTrip.id,
      vehicleId: dbTrip.vehicle_id,
      purpose: dbTrip.purpose,
      startTime: new Date(dbTrip.start_time),
      endTime: dbTrip.end_time ? new Date(dbTrip.end_time) : undefined,
      startLocation: dbTrip.start_location,
      endLocation: dbTrip.end_location,
      mileage: dbTrip.mileage,
      fuelUsed: dbTrip.fuel_used,
      status: dbTrip.status,
      emergencyLevel: dbTrip.emergency_level,
      assignedPersonnel: dbTrip.assigned_personnel || []
    }
  }

  private mapDatabaseAlertToInterface(dbAlert: Record<string, unknown>): TrackingAlert {
    return {
      id: dbAlert.id,
      vehicleId: dbAlert.vehicle_id,
      alertType: dbAlert.alert_type,
      severity: dbAlert.severity,
      message: dbAlert.message,
      location: dbAlert.location,
      timestamp: new Date(dbAlert.timestamp),
      acknowledged: dbAlert.acknowledged,
      resolvedAt: dbAlert.resolved_at ? new Date(dbAlert.resolved_at) : undefined
    }
  }

  // Storage methods
  private async storeLocationUpdate(vehicleId: string, location: GeoLocation): Promise<void> {
    await this.supabase
      .from('vehicle_location_history')
      .insert({
        vehicle_id: vehicleId,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp.toISOString(),
        speed: location.speed,
        heading: location.heading
      })
  }

  private async storeDispatchRequest(request: DispatchRequest): Promise<void> {
    await this.supabase
      .from('dispatch_requests')
      .insert({
        id: request.id,
        vehicle_id: request.vehicleId,
        priority: request.priority,
        request_type: request.requestType,
        pickup_location: request.pickupLocation,
        delivery_location: request.deliveryLocation,
        requested_by: request.requestedBy,
        special_instructions: request.specialInstructions,
        estimated_duration: request.estimatedDuration,
        status: request.status,
        created_at: request.createdAt.toISOString()
      })
  }

  private async updateVehicleStatus(vehicleId: string, status: Vehicle['status']): Promise<void> {
    await this.supabase
      .from('vehicles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', vehicleId)
  }

  // Notification methods (placeholders)
  private async broadcastLocationUpdate(vehicleId: string, location: GeoLocation): Promise<void> {
    // Broadcast to real-time subscribers (WebSocket, SSE, etc.)
    console.log(`📡 Broadcasting location update for vehicle ${vehicleId}`)
  }

  private async notifyVehicleDispatch(vehicleId: string, request: DispatchRequest): Promise<void> {
    // Notify vehicle/driver of dispatch
    console.log(`📱 Notifying vehicle ${vehicleId} of dispatch: ${request.requestType}`)
  }

  private async notifyTrackingAlert(alert: TrackingAlert): Promise<void> {
    // Send alert notifications
    console.log(`🚨 Notifying tracking alert: ${alert.alertType} for vehicle ${alert.vehicleId}`)
  }

  // ID generators
  private generateDispatchId(): string {
    return `dispatch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateTripId(): string {
    return `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateGeofenceId(): string {
    return `geofence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get service health and statistics
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    activeVehicles: number
    trackingAccuracy: number
    alertsActive: number
    uptime: string
  } {
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)

    const activeVehicleCount = Array.from(this.activeVehicles.values())
      .filter(tracking => tracking.isTracking).length

    const activeAlertCount = Array.from(this.activeVehicles.values())
      .reduce((sum, tracking) => sum + tracking.alerts.filter(alert => !alert.acknowledged).length, 0)

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (activeAlertCount > 10) {
      status = 'degraded'
    }
    if (activeAlertCount > 25) {
      status = 'unhealthy'
    }

    return {
      status,
      activeVehicles: activeVehicleCount,
      trackingAccuracy: 0.95, // 95% accuracy
      alertsActive: activeAlertCount,
      uptime: `${hours}h ${minutes}m`
    }
  }
}

// Export singleton instance
export const gpsTrackingService = new GPSTrackingService()