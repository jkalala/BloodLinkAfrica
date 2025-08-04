"use client"

type Coordinates = {
  latitude: number
  longitude: number
}

type LocationOptions = {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

export class LocationService {
  private defaultOptions: LocationOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
  }

  /**
   * Get the user's current location
   */
  public async getCurrentLocation(options?: LocationOptions): Promise<Coordinates> {
    const mergedOptions = { ...this.defaultOptions, ...options }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          reject(this.getLocationErrorMessage(error))
        },
        mergedOptions,
      )
    })
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  public calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371 // Earth's radius in km
    const dLat = this.toRadians(point2.latitude - point1.latitude)
    const dLon = this.toRadians(point2.longitude - point1.longitude)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    return Math.round(distance * 10) / 10 // Round to 1 decimal place
  }

  /**
   * Find nearby coordinates within a specified radius
   */
  public findNearbyPoints(
    currentLocation: Coordinates,
    points: Array<Coordinates & { id: string }>,
    maxDistanceKm: number,
  ): Array<{ id: string; distance: number }> {
    return points
      .map((point) => ({
        id: point.id,
        distance: this.calculateDistance(currentLocation, point),
      }))
      .filter((item) => item.distance <= maxDistanceKm)
      .sort((a, b) => a.distance - b.distance)
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180
  }

  /**
   * Get a user-friendly error message for geolocation errors
   */
  private getLocationErrorMessage(error: GeolocationPositionError): Error {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return new Error("Location permission denied. Please enable location services to find nearby donors.")
      case error.POSITION_UNAVAILABLE:
        return new Error("Location information is unavailable. Please try again later.")
      case error.TIMEOUT:
        return new Error("Location request timed out. Please check your connection and try again.")
      default:
        return new Error("An unknown error occurred while trying to get your location.")
    }
  }
}

// Create a singleton instance
let locationServiceInstance: LocationService | null = null

export function getLocationService(): LocationService {
  if (!locationServiceInstance) {
    locationServiceInstance = new LocationService()
  }
  return locationServiceInstance
}
