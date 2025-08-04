"use client"

import localforage from "localforage"

// Initialize localforage instance for map tiles
const mapTilesStore = localforage.createInstance({
  name: "bloodlink-maps",
  storeName: "map-tiles",
})

// Initialize localforage instance for map data
const mapDataStore = localforage.createInstance({
  name: "bloodlink-maps",
  storeName: "map-data",
})

export interface MapRegion {
  id: string
  name: string
  bounds: [[number, number], [number, number]] // [[south, west], [north, east]]
  zoomLevels: number[]
  downloadSize: string
  downloaded: boolean
  lastUpdated?: Date
}

export interface MapTile {
  key: string // z/x/y format
  data: Blob
  timestamp: number
}

export class OfflineMapsService {
  private static instance: OfflineMapsService
  private availableRegions: MapRegion[] = [
    {
      id: "nairobi",
      name: "Nairobi",
      bounds: [
        [-1.3315, 36.6947],
        [-1.1887, 36.9339],
      ],
      zoomLevels: [10, 11, 12, 13, 14],
      downloadSize: "25MB",
      downloaded: false,
    },
    {
      id: "mombasa",
      name: "Mombasa",
      bounds: [
        [-4.0801, 39.5803],
        [-3.9301, 39.7303],
      ],
      zoomLevels: [10, 11, 12, 13, 14],
      downloadSize: "18MB",
      downloaded: false,
    },
    {
      id: "kisumu",
      name: "Kisumu",
      bounds: [
        [-0.13, 34.7],
        [0.02, 34.85],
      ],
      zoomLevels: [10, 11, 12, 13, 14],
      downloadSize: "15MB",
      downloaded: false,
    },
  ]

  private constructor() {
    // Private constructor to enforce singleton
  }

  public static getInstance(): OfflineMapsService {
    if (!OfflineMapsService.instance) {
      OfflineMapsService.instance = new OfflineMapsService()
    }
    return OfflineMapsService.instance
  }

  public async initialize(): Promise<void> {
    // Load downloaded status for regions
    for (const region of this.availableRegions) {
      const status = await mapDataStore.getItem<boolean>(`region-${region.id}-status`)
      region.downloaded = status === true

      const lastUpdated = await mapDataStore.getItem<number>(`region-${region.id}-updated`)
      if (lastUpdated) {
        region.lastUpdated = new Date(lastUpdated)
      }
    }
  }

  public getAvailableRegions(): MapRegion[] {
    return [...this.availableRegions]
  }

  public async downloadRegion(regionId: string, progressCallback?: (progress: number) => void): Promise<boolean> {
    const region = this.availableRegions.find((r) => r.id === regionId)
    if (!region) return false

    try {
      // Simulate downloading map tiles
      const totalTiles = this.estimateTileCount(region)
      let downloadedTiles = 0

      // Mark as downloading
      await mapDataStore.setItem(`region-${region.id}-downloading`, true)

      // In a real implementation, we would download actual map tiles here
      // For this demo, we'll simulate the download with a delay
      for (const zoom of region.zoomLevels) {
        const tilesAtZoom = this.estimateTileCountForZoom(region, zoom)

        // Simulate downloading tiles for this zoom level
        for (let i = 0; i < tilesAtZoom; i++) {
          // In a real implementation, we would download and store actual tiles
          // await this.downloadAndStoreTile(x, y, zoom)

          // Simulate a delay
          await new Promise((resolve) => setTimeout(resolve, 10))

          downloadedTiles++
          if (progressCallback) {
            progressCallback(Math.floor((downloadedTiles / totalTiles) * 100))
          }
        }
      }

      // Mark as downloaded and store timestamp
      region.downloaded = true
      region.lastUpdated = new Date()
      await mapDataStore.setItem(`region-${region.id}-status`, true)
      await mapDataStore.setItem(`region-${region.id}-updated`, Date.now())
      await mapDataStore.removeItem(`region-${region.id}-downloading`)

      return true
    } catch (error) {
      console.error("Error downloading region:", error)
      await mapDataStore.removeItem(`region-${region.id}-downloading`)
      return false
    }
  }

  public async deleteRegion(regionId: string): Promise<boolean> {
    const region = this.availableRegions.find((r) => r.id === regionId)
    if (!region) return false

    try {
      // In a real implementation, we would delete all tiles for this region
      // For this demo, we'll just update the status
      region.downloaded = false
      delete region.lastUpdated

      await mapDataStore.removeItem(`region-${region.id}-status`)
      await mapDataStore.removeItem(`region-${region.id}-updated`)

      return true
    } catch (error) {
      console.error("Error deleting region:", error)
      return false
    }
  }

  public async isRegionDownloading(regionId: string): Promise<boolean> {
    return (await mapDataStore.getItem<boolean>(`region-${regionId}-downloading`)) === true
  }

  public async getTile(z: number, x: number, y: number): Promise<Blob | null> {
    const key = `${z}/${x}/${y}`
    try {
      const tile = await mapTilesStore.getItem<MapTile>(key)
      return tile?.data || null
    } catch (error) {
      console.error("Error getting tile:", error)
      return null
    }
  }

  private estimateTileCount(region: MapRegion): number {
    let total = 0
    for (const zoom of region.zoomLevels) {
      total += this.estimateTileCountForZoom(region, zoom)
    }
    return total
  }

  private estimateTileCountForZoom(region: MapRegion, zoom: number): number {
    // This is a simplified estimation - in a real app, you'd calculate the actual tiles
    const [[south, west], [north, east]] = region.bounds

    const tilesX = Math.ceil(Math.abs(this.lng2tile(east, zoom) - this.lng2tile(west, zoom)))
    const tilesY = Math.ceil(Math.abs(this.lat2tile(north, zoom) - this.lat2tile(south, zoom)))

    return tilesX * tilesY
  }

  private lng2tile(lng: number, zoom: number): number {
    return ((lng + 180) / 360) * Math.pow(2, zoom)
  }

  private lat2tile(lat: number, zoom: number): number {
    return (
      (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) *
      Math.pow(2, zoom - 1)
    )
  }
}

// Singleton getter
export function getOfflineMapsService(): OfflineMapsService {
  return OfflineMapsService.getInstance()
}
