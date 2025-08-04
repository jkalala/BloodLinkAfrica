"use client"

import React, { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n/client"
import { ResponsiveLayout } from "@/components/responsive-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heart, Clock, AlertTriangle, CheckCircle, XCircle, MapPin, Phone, User } from "lucide-react"
import { getBloodRequests, respondToBloodRequest } from "@/app/actions/blood-request-actions"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { toast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"

interface BloodRequest {
  id: string
  patient_name: string
  hospital_name: string
  blood_type: string
  units_needed: number
  urgency: 'normal' | 'urgent' | 'critical'
  contact_name: string
  contact_phone: string
  additional_info?: string
  location?: string
  status: 'pending' | 'matched' | 'completed' | 'expired' | 'cancelled'
  created_at: string
  response_count: number
}

export default function RequestsPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string
  const { user } = useEnhancedAuth()
  const [bloodRequests, setBloodRequests] = useState<BloodRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)

  useEffect(() => {
    loadBloodRequests()
  }, [])

  const loadBloodRequests = async () => {
    try {
      setLoading(true)
      const result = await getBloodRequests()
      if (result.success && 'data' in result && result.data) {
        setBloodRequests(result.data)
      } else {
        toast({
          title: "Error",
          description: 'error' in result ? result.error : "Failed to load blood requests",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading blood requests:", error)
      toast({
        title: "Error",
        description: "Failed to load blood requests",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async (requestId: string, responseType: 'accept' | 'decline' | 'maybe') => {
    try {
      setRespondingTo(requestId)
      const result = await respondToBloodRequest(requestId, responseType)
      
      if (result.success) {
        toast({
          title: "Response submitted",
          description: `You ${responseType}ed the blood request`,
        })
        // Reload requests to update status
        await loadBloodRequests()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to respond to request",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error responding to request:", error)
      toast({
        title: "Error",
        description: "Failed to respond to request",
        variant: "destructive",
      })
    } finally {
      setRespondingTo(null)
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'destructive'
      case 'urgent':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'expired':
      case 'cancelled':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{t("dashboard.bloodRequests")}</h1>
                <p className="text-muted-foreground">{t("dashboard.bloodRequestsDesc")}</p>
              </div>
            </div>
            <div className="text-center py-8">
              <p>Loading blood requests...</p>
            </div>
          </div>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("dashboard.bloodRequests")}</h1>
              <p className="text-muted-foreground">{t("dashboard.bloodRequestsDesc")}</p>
            </div>
            <Button onClick={loadBloodRequests} variant="outline">
              Refresh
            </Button>
          </div>

          {bloodRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No blood requests found</h3>
                <p className="text-muted-foreground">
                  There are currently no active blood requests in your area.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bloodRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        {request.blood_type}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={getUrgencyColor(request.urgency)}>
                          {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
                        </Badge>
                        <Badge variant={getStatusColor(request.status)}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {request.hospital_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {request.response_count} responses
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Patient:</span> {request.patient_name}
                        </div>
                        <div>
                          <span className="font-medium">Units needed:</span> {request.units_needed}
                        </div>
                        <div>
                          <span className="font-medium">Contact:</span> {request.contact_name}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {request.contact_phone}
                        </div>
                      </div>
                      
                      {request.additional_info && (
                        <div className="text-sm">
                          <span className="font-medium">Notes:</span> {request.additional_info}
                        </div>
                      )}

                      {request.status === 'pending' && user && (
                        <div className="flex gap-2 pt-4">
                          <Button
                            size="sm"
                            onClick={() => handleRespond(request.id, 'accept')}
                            disabled={respondingTo === request.id}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRespond(request.id, 'maybe')}
                            disabled={respondingTo === request.id}
                          >
                            Maybe
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRespond(request.id, 'decline')}
                            disabled={respondingTo === request.id}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </ResponsiveLayout>
  )
} 