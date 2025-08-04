"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import { getOfflineMapsService } from "@/lib/offline-maps-service"

// Import Leaflet CSS
import "leaflet/dist/leaflet.css"

interface LeafletMapProps {
  center: [number, number]
  zoom: number
  markers?: Array<{
    id: string
    name: string
    latitude: number
    longitude: number
    type?: "bank" | "donor" | "request"
  }>
  height: string
  onMarkerClick?: (id: string) => void
  offlineMode?: boolean
}

export default function LeafletMap({
  center,
  zoom,
  markers = [],
  height,
  onMarkerClick,
  offlineMode = false,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [offlineAvailable, setOfflineAvailable] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    // Check if offline maps are available for the current location
    const checkOfflineMaps = async () => {
      try {
        const mapsService = getOfflineMapsService()
        await mapsService.initialize()

        const regions = mapsService.getAvailableRegions()
        const availableRegion = regions.find((region) => {
          const [[south, west], [north, east]] = region.bounds
          return region.downloaded && center[0] >= south && center[0] <= north && center[1] >= west && center[1] <= east
        })

        setOfflineAvailable(!!availableRegion)
      } catch (error) {
        console.error("Error checking offline maps:", error)
        setOfflineAvailable(false)
      }
    }

    checkOfflineMaps()
  }, [center])

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map if it doesn't exist
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom)

      // Add tile layer based on online status
      if (isOnline && !offlineMode) {
        // Online tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(leafletMap.current)
      } else if (offlineAvailable) {
        // Custom offline tile layer
        const offlineTileLayer = L.tileLayer("", {
          attribution: 'Offline Maps | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })

        // Override the createTile method to use cached tiles
        // @ts-ignore - Extending the prototype
        offlineTileLayer.createTile = (coords: any, done: any) => {
          const tile = document.createElement("img")

          // Get tile from offline storage
          getOfflineMapsService()
            .getTile(coords.z, coords.x, coords.y)
            .then((blob) => {
              if (blob) {
                tile.src = URL.createObjectURL(blob)
                done(null, tile)
              } else {
                // Fallback for missing tiles
                tile.src =
                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDYtMTNUMTQ6MTI6MDErMDI6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIzLTA2LTEzVDE0OjEyOjI3KzAyOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIzLTA2LTEzVDE0OjEyOjI3KzAyOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjY0ZGY4YjdiLTM2MTYtNDRkNy04MTI3LTlhODFiNmI0OTc4YyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo2NGRmOGI3Yi0zNjE2LTQ0ZDctODEyNy05YTgxYjZiNDk3OGMiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2NGRmOGI3Yi0zNjE2LTQ0ZDctODEyNy05YTgxYjZiNDk3OGMiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjY0ZGY4YjdiLTM2MTYtNDRkNy04MTI3LTlhODFiNmI0OTc4YyIgc3RFdnQ6d2hlbj0iMjAyMy0wNi0xM1QxNDoxMjowMSswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKE1hY2ludG9zaCkiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+MFT6lwAAA7hJREFUeJzt1jEBACAMwDDAv+dxIoEeiYKe3TOzAJJ+HQBQMQCQZgAgzQBAmgGANAMAaQYA0gwApBkASDMAkGYAIM0AQJoBgDQDAGkGANIMAKQZAEgzAJBmACDNAECaAYA0AwBpBgDSDAC"
                done(null, tile)
              }
            })
            .catch((error) => {
              console.error("Error loading offline tile:", error)
              // Fallback for errors
              tile.src =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDYtMTNUMTQ6MTI6MDErMDI6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIzLTA2LTEzVDE0OjEyOjI3KzAyOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIzLTA2LTEzVDE0OjEyOjI3KzAyOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjY0ZGY4YjdiLTM2MTYtNDRkNy04MTI3LTlhODFiNmI0OTc4YyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo2NGRmOGI3Yi0zNjE2LTQ0ZDctODEyNy05YTgxYjZiNDk3OGMiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2NGRmOGI3Yi0zNjE2LTQ0ZDctODEyNy05YTgxYjZiNDk3OGMiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjY0ZGY4YjdiLTM2MTYtNDRkNy04MTI3LTlhODFiNmI0OTc4YyIgc3RFdnQ6d2hlbj0iMjAyMy0wNi0xM1QxNDoxMjowMSswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKE1hY2ludG9zaCkiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+MFT6lwAAA7hJREFUeJzt1jEBACAMwDDAv+dxIoEeiYKe3TOzAJJ+HQBQMQCQZgAgzQBAmgGANAMAaQYA0gwApBkASDMAkGYAIM0AQJoBgDQDAGkGANIMAKQZAEgzAJBmACDNAECaAYA0AwBpBgDSDAC"
              done(null, tile)
            })

          return tile
        }

        offlineTileLayer.addTo(leafletMap.current)
      } else {
        // Fallback for offline with no cached tiles
        L.tileLayer("", {
          attribution: "Offline Mode - No cached maps available",
        }).addTo(leafletMap.current)

        // Add a message overlay
        const offlineMessage = L.control({ position: "bottomcenter" })
        offlineMessage.onAdd = () => {
          const div = L.DomUtil.create("div", "offline-message")
          div.innerHTML =
            '<div class="bg-yellow-100 text-yellow-800 p-2 rounded text-center text-sm">No offline maps available for this area</div>'
          return div
        }
        offlineMessage.addTo(leafletMap.current)
      }

      // Add user location marker
      L.marker(center, {
        icon: L.divIcon({
          className: "user-marker",
          html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>`,
          iconSize: [20, 20],
        }),
      })
        .addTo(leafletMap.current)
        .bindPopup("Your location")
    } else {
      // Update center and zoom if map already exists
      leafletMap.current.setView(center, zoom)
    }

    // Add markers
    if (markers.length > 0 && leafletMap.current) {
      // Clear existing markers except user location
      leafletMap.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          leafletMap.current?.removeLayer(layer)
        }
      })

      // Add user location marker again
      L.marker(center, {
        icon: L.divIcon({
          className: "user-marker",
          html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>`,
          iconSize: [20, 20],
        }),
      })
        .addTo(leafletMap.current)
        .bindPopup("Your location")

      // Add new markers
      markers.forEach((marker) => {
        const markerColor = marker.type === "bank" ? "red" : marker.type === "donor" ? "green" : "orange"

        const markerIcon = L.divIcon({
          className: "custom-marker",
          html: `<div class="w-4 h-4 bg-${markerColor}-500 rounded-full border-2 border-white"></div>`,
          iconSize: [20, 20],
        })

        const mapMarker = L.marker([marker.latitude, marker.longitude], { icon: markerIcon })
          .addTo(leafletMap.current!)
          .bindPopup(marker.name)

        if (onMarkerClick) {
          mapMarker.on("click", () => onMarkerClick(marker.id))
        }
      })
    }

    // Cleanup
    return () => {
      if (leafletMap.current) {
        // We don't destroy the map to avoid re-initialization issues
        // Just clean up markers if needed
      }
    }
  }, [center, zoom, markers, onMarkerClick, isOnline, offlineMode, offlineAvailable])

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full rounded-md overflow-hidden" style={{ height }} />
      {!isOnline && !offlineAvailable && (
        <div className="absolute bottom-2 left-0 right-0 mx-auto w-max">
          <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium shadow">
            No offline maps available for this area
          </div>
        </div>
      )}
      {offlineMode && offlineAvailable && (
        <div className="absolute top-2 right-2">
          <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium shadow">Offline Maps</div>
        </div>
      )}
    </div>
  )
}
