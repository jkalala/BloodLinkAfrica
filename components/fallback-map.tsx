"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Users, AlertTriangle, Navigation, Phone } from "lucide-react"
import { realTimeLocationService, DonorLocation, BloodRequestLocation } from "@/lib/real-time-location-service"

interface FallbackMapProps {
  donors: DonorLocation[]
  bloodRequests: BloodRequestLocation[]
  onRetry: () => void
}

export default function FallbackMap({ donors, bloodRequests, onRetry }: FallbackMapProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Blood Donation Map (Fallback View)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Interactive Map Unavailable</h3>
            <p className="text-muted-foreground mb-4">
              Google Maps is currently unavailable. Here's a list of nearby donors and blood requests.
            </p>
            <Button onClick={onRetry} variant="outline">
              Retry Loading Map
            </Button>
          </div>

          {/* Donors List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Donors ({donors.filter(d => d.status === 'available').length})
            </h3>
            <div className="grid gap-4">
              {donors.filter(d => d.status === 'available').map((donor) => (
                <Card key={donor.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          donor.status === 'available' ? 'bg-green-500' : 
                          donor.status === 'donating' ? 'bg-yellow-500' : 
                          donor.status === 'traveling' ? 'bg-blue-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <h4 className="font-semibold">{donor.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {donor.bloodType} • {donor.location.address}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{donor.bloodType}</Badge>
                        <Button size="sm" variant="outline" onClick={() => window.open(`tel:${donor.phone}`)}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => window.open(`https://maps.google.com/maps?daddr=${donor.location.lat},${donor.location.lng}`)}>
                          <Navigation className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span>Distance: {donor.distance}km</span>
                      <span className="mx-2">•</span>
                      <span>Rating: {donor.rating}/5 ⭐</span>
                      {donor.verified && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="text-green-600">✓ Verified</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Blood Requests List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Blood Requests ({bloodRequests.filter(r => r.status === 'pending').length})
            </h3>
            <div className="grid gap-4">
              {bloodRequests.filter(r => r.status === 'pending').map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          request.urgency === 'critical' ? 'bg-red-500' : 
                          request.urgency === 'urgent' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <div>
                          <h4 className="font-semibold">{request.patientName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {request.hospital} • {request.bloodType}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          request.urgency === 'critical' ? 'destructive' : 
                          request.urgency === 'urgent' ? 'default' : 'secondary'
                        }>
                          {request.urgency}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => window.open(`https://maps.google.com/maps?daddr=${request.location.lat},${request.location.lng}`)}>
                          <Navigation className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span>Units needed: {request.unitsNeeded}</span>
                      <span className="mx-2">•</span>
                      <span>Created: {new Date(request.createdAt).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 