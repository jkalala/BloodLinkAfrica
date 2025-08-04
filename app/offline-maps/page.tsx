"use client"

import { useEffect, useState } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Download, Trash2, Map, CheckCircle, AlertCircle, Wifi, WifiOff } from "lucide-react"
import { getOfflineMapsService, type MapRegion } from "@/lib/offline-maps-service"

export default function OfflineMapsPage() {
  const [regions, setRegions] = useState<MapRegion[]>([])
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})
  const [isOnline, setIsOnline] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

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
    const loadRegions = async () => {
      setIsLoading(true)
      try {
        const mapsService = getOfflineMapsService()
        await mapsService.initialize()
        setRegions(mapsService.getAvailableRegions())
      } catch (error) {
        console.error("Error loading map regions:", error)
        toast({
          title: "Error",
          description: "Failed to load offline map regions",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadRegions()
  }, [])

  const handleDownload = async (regionId: string) => {
    try {
      const mapsService = getOfflineMapsService()

      // Initialize progress
      setDownloadProgress((prev) => ({ ...prev, [regionId]: 0 }))

      const success = await mapsService.downloadRegion(regionId, (progress) => {
        setDownloadProgress((prev) => ({ ...prev, [regionId]: progress }))
      })

      if (success) {
        // Update regions list
        const updatedRegions = mapsService.getAvailableRegions()
        setRegions(updatedRegions)

        toast({
          title: "Download Complete",
          description: "Map region has been downloaded for offline use",
        })
      } else {
        throw new Error("Download failed")
      }
    } catch (error) {
      console.error("Error downloading region:", error)
      toast({
        title: "Download Failed",
        description: "Failed to download map region. Please try again.",
        variant: "destructive",
      })
    } finally {
      // Clear progress
      setDownloadProgress((prev) => {
        const newProgress = { ...prev }
        delete newProgress[regionId]
        return newProgress
      })
    }
  }

  const handleDelete = async (regionId: string) => {
    try {
      const mapsService = getOfflineMapsService()
      const success = await mapsService.deleteRegion(regionId)

      if (success) {
        // Update regions list
        const updatedRegions = mapsService.getAvailableRegions()
        setRegions(updatedRegions)

        toast({
          title: "Region Deleted",
          description: "Map region has been removed from offline storage",
        })
      } else {
        throw new Error("Delete failed")
      }
    } catch (error) {
      console.error("Error deleting region:", error)
      toast({
        title: "Delete Failed",
        description: "Failed to delete map region. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatDate = (date?: Date) => {
    if (!date) return "Never"
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Offline Maps</h1>
            <p className="text-muted-foreground">Download maps for offline use in areas with poor connectivity</p>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {isOnline
                ? "You're online. You can download map regions for offline use."
                : "You're offline. You can use previously downloaded maps."}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </CardContent>
                  <CardFooter>
                    <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {regions.map((region) => (
                <Card key={region.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Map className="h-5 w-5" />
                      {region.name}
                      {region.downloaded && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />}
                    </CardTitle>
                    <CardDescription>
                      {region.downloaded
                        ? `Downloaded on ${formatDate(region.lastUpdated)}`
                        : `${region.downloadSize} - Not downloaded`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      This region covers the {region.name} area and surroundings.
                      {region.downloaded
                        ? " Maps are available offline for this region."
                        : " Download to use maps when offline."}
                    </p>

                    {downloadProgress[region.id] !== undefined && (
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-xs">
                          <span>Downloading...</span>
                          <span>{downloadProgress[region.id]}%</span>
                        </div>
                        <Progress value={downloadProgress[region.id]} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    {region.downloaded ? (
                      <Button
                        variant="outline"
                        className="text-red-600 dark:text-red-500 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => handleDelete(region.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="text-blue-600 dark:text-blue-500 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950"
                        onClick={() => handleDownload(region.id)}
                        disabled={!isOnline || downloadProgress[region.id] !== undefined}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}

              {regions.length === 0 && (
                <div className="text-center p-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No regions available</h3>
                  <p className="text-muted-foreground mt-2">
                    There are no map regions available for download at this time.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
            <h3 className="font-medium flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              Offline Maps Usage
            </h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Downloaded maps will be stored on your device</li>
              <li>Maps will automatically be used when you're offline</li>
              <li>Consider downloading maps before traveling to areas with poor connectivity</li>
              <li>Each region requires storage space on your device</li>
            </ul>
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  )
}
