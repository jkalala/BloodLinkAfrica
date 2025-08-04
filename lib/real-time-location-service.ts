// Real-time location service for tracking donors and blood requests
export interface LocationUpdate {
  id: string
  type: 'donor' | 'blood_bank' | 'request'
  location: {
    lat: number
    lng: number
    address: string
  }
  status: string
  timestamp: string
  metadata?: unknown
}

export interface DonorLocation {
  id: string
  name: string
  bloodType: string
  location: {
    lat: number
    lng: number
    address: string
  }
  status: 'available' | 'unavailable' | 'donating' | 'traveling'
  lastUpdate: string
  phone: string
  rating: number
  verified: boolean
  distance?: number
  estimatedArrival?: string
}

export interface BloodRequestLocation {
  id: string
  patientName: string
  bloodType: string
  urgency: 'normal' | 'urgent' | 'critical'
  location: {
    lat: number
    lng: number
    address: string
  }
  hospital: string
  unitsNeeded: number
  status: 'pending' | 'matched' | 'completed' | 'expired'
  createdAt: string
  matchedDonors?: string[]
}

class RealTimeLocationService {
  private donors: Map<string, DonorLocation> = new Map()
  private requests: Map<string, BloodRequestLocation> = new Map()
  private listeners: Set<(updates: LocationUpdate[]) => void> = new Set()
  private updateInterval: NodeJS.Timeout | null = null

  constructor() {
    this.initializeMockData()
    this.startRealTimeUpdates()
  }

  private initializeMockData() {
    // Mock donors with real-time locations
    const mockDonors: DonorLocation[] = [
      {
        id: "1",
        name: "John Doe",
        bloodType: "O+",
        location: { lat: -1.2921, lng: 36.8219, address: "Nairobi, Kenya" },
        status: "available",
        lastUpdate: new Date().toISOString(),
        phone: "+254700123456",
        rating: 4.8,
        verified: true,
        distance: 2.5
      },
      {
        id: "2",
        name: "Jane Smith",
        bloodType: "A+",
        location: { lat: -1.2850, lng: 36.8150, address: "Westlands, Nairobi" },
        status: "traveling",
        lastUpdate: new Date().toISOString(),
        phone: "+254700123457",
        rating: 4.9,
        verified: true,
        distance: 3.2,
        estimatedArrival: "15 minutes"
      },
      {
        id: "3",
        name: "Mike Johnson",
        bloodType: "B+",
        location: { lat: -1.3000, lng: 36.8300, address: "Eastleigh, Nairobi" },
        status: "donating",
        lastUpdate: new Date().toISOString(),
        phone: "+254700123458",
        rating: 4.7,
        verified: false,
        distance: 1.8
      }
    ]

    // Mock blood requests
    const mockRequests: BloodRequestLocation[] = [
      {
        id: "req1",
        patientName: "Sarah Wilson",
        bloodType: "O+",
        urgency: "urgent",
        location: { lat: -1.2950, lng: 36.8250, address: "Kenyatta National Hospital" },
        hospital: "Kenyatta National Hospital",
        unitsNeeded: 2,
        status: "pending",
        createdAt: new Date().toISOString()
      },
      {
        id: "req2",
        patientName: "David Kimani",
        bloodType: "A+",
        urgency: "critical",
        location: { lat: -1.2800, lng: 36.8100, address: "Aga Khan Hospital" },
        hospital: "Aga Khan Hospital",
        unitsNeeded: 4,
        status: "matched",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        matchedDonors: ["1", "2"]
      }
    ]

    mockDonors.forEach(donor => this.donors.set(donor.id, donor))
    mockRequests.forEach(request => this.requests.set(request.id, request))
  }

  private startRealTimeUpdates() {
    // Simulate real-time location updates every 30 seconds
    this.updateInterval = setInterval(() => {
      this.simulateLocationUpdates()
    }, 30000)
  }

  private simulateLocationUpdates() {
    const updates: LocationUpdate[] = []

    // Simulate donor movement
    this.donors.forEach((donor, id) => {
      if (donor.status === 'traveling') {
        // Simulate movement towards a destination
        const newLat = donor.location.lat + (Math.random() - 0.5) * 0.001
        const newLng = donor.location.lng + (Math.random() - 0.5) * 0.001
        
        donor.location.lat = newLat
        donor.location.lng = newLng
        donor.lastUpdate = new Date().toISOString()

        updates.push({
          id,
          type: 'donor',
          location: donor.location,
          status: donor.status,
          timestamp: donor.lastUpdate,
          metadata: {
            name: donor.name,
            bloodType: donor.bloodType,
            estimatedArrival: donor.estimatedArrival
          }
        })
      }
    })

    // Notify listeners
    if (updates.length > 0) {
      this.notifyListeners(updates)
    }
  }

  private notifyListeners(updates: LocationUpdate[]) {
    this.listeners.forEach(listener => {
      try {
        listener(updates)
      } catch (error) {
        console.error('Error notifying location listener:', error)
      }
    })
  }

  // Public API methods
  public getDonors(): DonorLocation[] {
    return Array.from(this.donors.values())
  }

  public getRequests(): BloodRequestLocation[] {
    return Array.from(this.requests.values())
  }

  public getDonor(id: string): DonorLocation | undefined {
    return this.donors.get(id)
  }

  public getRequest(id: string): BloodRequestLocation | undefined {
    return this.requests.get(id)
  }

  public updateDonorLocation(id: string, location: { lat: number; lng: number; address: string }, status?: string) {
    const donor = this.donors.get(id)
    if (donor) {
      donor.location = location
      donor.lastUpdate = new Date().toISOString()
      if (status) donor.status = status as DonorLocation['status']

      this.notifyListeners([{
        id,
        type: 'donor',
        location: donor.location,
        status: donor.status,
        timestamp: donor.lastUpdate,
        metadata: {
          name: donor.name,
          bloodType: donor.bloodType
        }
      }])
    }
  }

  public addLocationListener(listener: (updates: LocationUpdate[]) => void) {
    this.listeners.add(listener)
  }

  public removeLocationListener(listener: (updates: LocationUpdate[]) => void) {
    this.listeners.delete(listener)
  }

  public getNearbyDonors(location: { lat: number; lng: number }, radius: number = 50): DonorLocation[] {
    return this.getDonors().filter(donor => {
      const distance = this.calculateDistance(
        location.lat, location.lng,
        donor.location.lat, donor.location.lng
      )
      return distance <= radius
    })
  }

  public getNearbyRequests(location: { lat: number; lng: number }, radius: number = 50): BloodRequestLocation[] {
    return this.getRequests().filter(request => {
      const distance = this.calculateDistance(
        location.lat, location.lng,
        request.location.lat, request.location.lng
      )
      return distance <= radius
    })
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLng = this.toRadians(lng2 - lng1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  public destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.listeners.clear()
  }
}

// Export singleton instance
export const realTimeLocationService = new RealTimeLocationService() 