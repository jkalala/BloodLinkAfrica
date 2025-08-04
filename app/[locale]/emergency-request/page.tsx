"use client"

import { ResponsiveLayout } from "@/components/responsive-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { EnhancedBloodRequestForm } from "@/components/enhanced-blood-request-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Shield, Clock } from "lucide-react"

export default function EmergencyRequestPage() {
  return (
    <ProtectedRoute requiredRole="emergency_responder">
      <ResponsiveLayout>
        <div className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Emergency Alert Banner */}
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="font-semibold">
                EMERGENCY BLOOD REQUEST - This request will be prioritized and processed immediately.
                Emergency responders and nearby donors will be notified automatically.
              </AlertDescription>
            </Alert>

            {/* Emergency Information Card */}
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                    <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-red-800 dark:text-red-200">
                      Emergency Blood Request Protocol
                    </CardTitle>
                    <CardDescription className="text-red-700 dark:text-red-300">
                      This form is for emergency situations only
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Immediate Processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Priority Alert</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Emergency Response</span>
                  </div>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Emergency requests will automatically trigger notifications to all available donors 
                  and emergency responders in the area. The system will prioritize matching based on 
                  blood type compatibility and proximity.
                </p>
              </CardContent>
            </Card>

            {/* Enhanced Blood Request Form */}
            <EnhancedBloodRequestForm isEmergency={true} />
          </div>
        </div>
      </ResponsiveLayout>
    </ProtectedRoute>
  )
} 