"use client"

import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { ResponsiveLayout } from "@/components/responsive-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Shield, Users, Building, Package, AlertTriangle, Heart } from "lucide-react"

export default function TestRBACPage() {
  const { 
    user, 
    userRole, 
    userPermissions, 
    institution, 
    hasPermission, 
    isEmergencyResponder,
    grantEmergencyAccess,
    revokeEmergencyAccess
  } = useEnhancedAuth()

  const testPermissions = [
    'view_own_profile',
    'update_own_profile',
    'view_blood_requests',
    'respond_to_requests',
    'create_blood_requests',
    'manage_hospital_requests',
    'manage_inventory',
    'emergency_access',
    'view_all_data'
  ]

  const handleGrantEmergencyAccess = async () => {
    const success = await grantEmergencyAccess('Testing emergency access')
    if (success) {
      toast({
        title: "Emergency Access Granted",
        description: "You now have emergency access privileges for 24 hours.",
      })
    } else {
      toast({
        title: "Access Denied",
        description: "Only emergency responders can request emergency access.",
        variant: "destructive",
      })
    }
  }

  const handleRevokeEmergencyAccess = async () => {
    const success = await revokeEmergencyAccess()
    if (success) {
      toast({
        title: "Emergency Access Revoked",
        description: "Your emergency access has been revoked.",
      })
    }
  }

  return (
    <ProtectedRoute>
      <ResponsiveLayout>
        <div className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">RBAC System Test</h1>
              <Badge variant="outline">Testing Mode</Badge>
            </div>

            {/* User Information */}
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Current user details and role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="text-lg">{user?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-lg">{user?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Role</p>
                    <p className="text-lg">{userRole || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Stakeholder Type</p>
                    <p className="text-lg">{user?.stakeholder_type || 'N/A'}</p>
                  </div>
                </div>

                {institution && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Institution</p>
                    <div className="flex items-center space-x-2">
                      <Building className="h-4 w-4 text-blue-600" />
                      <span>{institution.name}</span>
                      <Badge variant="secondary">{institution.type}</Badge>
                    </div>
                  </div>
                )}

                {user?.emergency_access && (
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="font-medium">Emergency Access Active</span>
                      <Badge variant="destructive">Active</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Permissions Test */}
            <Card>
              <CardHeader>
                <CardTitle>Permissions Test</CardTitle>
                <CardDescription>Test permission checking functionality</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {testPermissions.map((permission) => (
                      <div key={permission} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-2">
                          {hasPermission(permission) ? (
                            <Shield className="h-4 w-4 text-green-600" />
                          ) : (
                            <Shield className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm font-medium">{permission}</span>
                        </div>
                        <Badge variant={hasPermission(permission) ? "default" : "secondary"}>
                          {hasPermission(permission) ? "Granted" : "Denied"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Access Test */}
            <Card>
              <CardHeader>
                <CardTitle>Emergency Access Test</CardTitle>
                <CardDescription>Test emergency access functionality</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Emergency Responder Status</p>
                      <p className="text-sm text-gray-600">
                        {isEmergencyResponder() ? "You are an emergency responder" : "You are not an emergency responder"}
                      </p>
                    </div>
                    <Badge variant={isEmergencyResponder() ? "default" : "secondary"}>
                      {isEmergencyResponder() ? "Emergency Responder" : "Regular User"}
                    </Badge>
                  </div>

                  <div className="flex space-x-4">
                    <Button 
                      onClick={handleGrantEmergencyAccess}
                      disabled={!isEmergencyResponder()}
                      variant="outline"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Grant Emergency Access
                    </Button>
                    <Button 
                      onClick={handleRevokeEmergencyAccess}
                      disabled={!user?.emergency_access}
                      variant="destructive"
                    >
                      Revoke Emergency Access
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Role-Based Features Test */}
            <Card>
              <CardHeader>
                <CardTitle>Role-Based Features</CardTitle>
                <CardDescription>Test features based on your role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user?.stakeholder_type === 'donor' && (
                    <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <Heart className="h-5 w-5 text-red-600" />
                      <span>Donor-specific features available</span>
                    </div>
                  )}

                  {user?.stakeholder_type === 'hospital_staff' && (
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Building className="h-5 w-5 text-blue-600" />
                      <span>Hospital staff features available</span>
                    </div>
                  )}

                  {user?.stakeholder_type === 'blood_bank_staff' && (
                    <div className="flex items-center space-x-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <Package className="h-5 w-5 text-purple-600" />
                      <span>Blood bank staff features available</span>
                    </div>
                  )}

                  {user?.stakeholder_type === 'emergency_responder' && (
                    <div className="flex items-center space-x-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <span>Emergency responder features available</span>
                    </div>
                  )}

                  {user?.stakeholder_type === 'government_official' && (
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                      <Shield className="h-5 w-5 text-gray-600" />
                      <span>Government official features available</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* All Permissions List */}
            <Card>
              <CardHeader>
                <CardTitle>All User Permissions</CardTitle>
                <CardDescription>Complete list of your permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {userPermissions.length > 0 ? (
                    userPermissions.map((permission) => (
                      <div key={permission} className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span className="text-sm">{permission}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No permissions found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ResponsiveLayout>
    </ProtectedRoute>
  )
} 