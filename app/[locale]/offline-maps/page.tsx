"use client"

import { useI18n } from "@/lib/i18n/client"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { Download, Map, Trash2, WifiOff } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useState } from "react"

interface OfflineMap {
  id: string
  name: string
  size: string
  downloaded: boolean
  progress: number
}

export default function OfflineMapsPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string
  const [maps, setMaps] = useState<OfflineMap[]>([
    {
      id: "1",
      name: "Luanda Region",
      size: "45MB",
      downloaded: true,
      progress: 100
    },
    {
      id: "2",
      name: "Benguela Region",
      size: "38MB",
      downloaded: false,
      progress: 0
    }
  ])

  const handleDownload = (mapId: string) => {
    setMaps(maps.map(map => {
      if (map.id === mapId) {
        // Simulate download progress
        const interval = setInterval(() => {
          setMaps(currentMaps => 
            currentMaps.map(m => {
              if (m.id === mapId && m.progress < 100) {
                return { ...m, progress: m.progress + 10 }
              }
              if (m.id === mapId && m.progress >= 100) {
                clearInterval(interval)
                return { ...m, downloaded: true }
              }
              return m
            })
          )
        }, 500)
        return { ...map, progress: 0 }
      }
      return map
    }))
  }

  const handleDelete = (mapId: string) => {
    setMaps(maps.map(map => 
      map.id === mapId ? { ...map, downloaded: false, progress: 0 } : map
    ))
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Offline Maps</h1>
              <p className="text-muted-foreground">Download maps for offline use</p>
            </div>
          </div>

          <div className="grid gap-4">
            {maps.map((map) => (
              <Card key={map.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Map className="h-5 w-5" />
                      <CardTitle>{map.name}</CardTitle>
                    </div>
                    <span className="text-sm text-muted-foreground">{map.size}</span>
                  </div>
                  <CardDescription>
                    {map.downloaded ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <WifiOff className="h-4 w-4" />
                        Available offline
                      </span>
                    ) : (
                      "Not downloaded"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!map.downloaded && map.progress === 0 ? (
                    <Button 
                      onClick={() => handleDownload(map.id)}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Map
                    </Button>
                  ) : map.progress < 100 ? (
                    <div className="space-y-2">
                      <Progress value={map.progress} />
                      <p className="text-sm text-muted-foreground text-center">
                        Downloading... {map.progress}%
                      </p>
                    </div>
                  ) : (
                    <Button 
                      variant="destructive"
                      onClick={() => handleDelete(map.id)}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Map
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
} 