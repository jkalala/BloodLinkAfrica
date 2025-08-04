"use client"

import { useI18n } from "@/lib/i18n/client"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { useState } from "react"

const mockNotifications = [
  { id: 1, title: "New Blood Request", message: "A new urgent blood request is available near you." },
  { id: 2, title: "Donation Reminder", message: "It's time for your next donation." },
  { id: 3, title: "System Update", message: "BloodLink has been updated. New features are available." }
]

export default function PushNotificationsPage() {
  const t = useI18n()
  const [enabled, setEnabled] = useState(false)

  const toggleNotifications = () => {
    const newEnabled = !enabled
    setEnabled(newEnabled)
    toast({ title: newEnabled ? "Push notifications enabled" : "Push notifications disabled" })
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Push Notifications</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Notifications Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="toggle-push">Enable Push Notifications</Label>
                <Switch id="toggle-push" checked={enabled} onCheckedChange={toggleNotifications} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              {mockNotifications.length > 0 ? (
                <ul className="space-y-2">
                  {mockNotifications.map((notif) => (
                    <li key={notif.id} className="p-2 border rounded">
                      <h3 className="font-bold">{notif.title}</h3>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No notifications.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
