"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { getEnhancedBloodRequestService } from "@/lib/enhanced-blood-request-service"
import { useI18n } from "@/lib/i18n/client"
import {
  Heart,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  User,
  Building,
  Calendar,
  DollarSign,
  Shield,
  Plus,
  Save,
  Send
} from "lucide-react"

interface EnhancedBloodRequestFormProps {
  onSuccess?: (requestId: string) => void
  onCancel?: () => void
  initialData?: any
  isEmergency?: boolean
}

export function EnhancedBloodRequestForm({
  onSuccess,
  onCancel,
  initialData,
  isEmergency = false
}: EnhancedBloodRequestFormProps) {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { user } = useEnhancedAuth()
  const t = useI18n()
  const bloodRequestService = getEnhancedBloodRequestService()

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    patient_name: initialData?.patient_name || "",
    hospital_name: initialData?.hospital_name || "",
    blood_type: initialData?.blood_type || "",
    units_needed: initialData?.units_needed || 1,
    urgency: initialData?.urgency || "normal",
    contact_name: initialData?.contact_name || "",
    contact_phone: initialData?.contact_phone || "",
    additional_info: initialData?.additional_info || "",
    location: initialData?.location || "",
    latitude: initialData?.latitude || null,
    longitude: initialData?.longitude || null,
    urgency_level: initialData?.urgency_level || (isEmergency ? "critical" : "normal"),
    request_type: initialData?.request_type || (isEmergency ? "emergency" : "donation"),
    estimated_cost: initialData?.estimated_cost || null,
    insurance_info: initialData?.insurance_info || null,
    medical_notes: initialData?.medical_notes || "",
    donor_requirements: initialData?.donor_requirements || null,
    completion_deadline: initialData?.completion_deadline || "",
    emergency_contact: initialData?.emergency_contact || null,
    tags: initialData?.tags || []
  })

  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [priorityScore, setPriorityScore] = useState(1)

  const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
  const urgencyLevels = [
    { value: "normal", label: "Normal", color: "bg-green-100 text-green-800" },
    { value: "urgent", label: "Urgent", color: "bg-yellow-100 text-yellow-800" },
    { value: "critical", label: "Critical", color: "bg-orange-100 text-orange-800" },
    { value: "emergency", label: "Emergency", color: "bg-red-100 text-red-800" }
  ]

  const requestTypes = [
    { value: "donation", label: "Regular Donation" },
    { value: "emergency", label: "Emergency" },
    { value: "scheduled", label: "Scheduled Surgery" },
    { value: "reserve", label: "Reserve Stock" }
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleNumberChange = (name: string, value: string) => {
    const numValue = parseInt(value) || 0
    setFormData(prev => ({ ...prev, [name]: numValue }))
  }

  const calculatePriority = () => {
    let score = 1

    // Urgency level scoring
    switch (formData.urgency_level) {
      case "emergency":
        score += 10
        break
      case "critical":
        score += 8
        break
      case "urgent":
        score += 6
        break
      case "normal":
        score += 1
        break
    }

    // Request type scoring
    switch (formData.request_type) {
      case "emergency":
        score += 5
        break
      case "scheduled":
        score += 2
        break
      case "reserve":
        score += 1
        break
    }

    // Blood type rarity scoring
    const rareBloodTypes = ["AB-", "B-", "A-"]
    if (rareBloodTypes.includes(formData.blood_type)) {
      score += 3
    }

    // Units needed scoring
    if (formData.units_needed > 5) {
      score += 2
    }

    setPriorityScore(score)
  }

  useEffect(() => {
    calculatePriority()
  }, [formData.urgency_level, formData.request_type, formData.blood_type, formData.units_needed])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const requestData = {
        ...formData,
        requester_id: user?.id,
        institution_id: user?.institution?.id,
        priority_score: priorityScore
      }

      const result = await bloodRequestService.createBloodRequest(requestData)

      if (result.success && result.data) {
        toast({
          title: "Request Created",
          description: "Blood request has been created successfully.",
        })

        // Log the request creation
        await bloodRequestService.logRequestUpdate(
          result.data.id,
          user?.id || "",
          "note",
          undefined,
          undefined,
          "Blood request created"
        )

        if (onSuccess) {
          onSuccess(result.data.id)
        } else {
          router.push(`/${locale}/requests`)
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create blood request.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const canAccessAdvancedFeatures = user?.role === "emergency_responder" || 
                                  user?.role === "hospital_staff" || 
                                  user?.role === "blood_bank_staff"

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
              <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {isEmergency ? "Emergency Blood Request" : "Create Blood Request"}
              </CardTitle>
              <CardDescription>
                {isEmergency 
                  ? "Create an urgent blood request for emergency situations"
                  : "Submit a new blood request for donation or medical needs"
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Priority Score Display */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-600" />
                  <span className="font-semibold">Priority Score</span>
                </div>
                <Badge variant="outline" className="text-lg font-bold">
                  {priorityScore}/10
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Higher priority requests will be processed first
              </p>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="patient_name">Patient Name *</Label>
                <Input
                  id="patient_name"
                  name="patient_name"
                  value={formData.patient_name}
                  onChange={handleChange}
                  placeholder="Enter patient name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hospital_name">Hospital/Institution *</Label>
                <Input
                  id="hospital_name"
                  name="hospital_name"
                  value={formData.hospital_name}
                  onChange={handleChange}
                  placeholder="Enter hospital name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blood_type">Blood Type *</Label>
                <Select
                  value={formData.blood_type}
                  onValueChange={(value) => handleSelectChange("blood_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood type" />
                  </SelectTrigger>
                  <SelectContent>
                    {bloodTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="units_needed">Units Needed *</Label>
                <Input
                  id="units_needed"
                  name="units_needed"
                  type="number"
                  min="1"
                  value={formData.units_needed}
                  onChange={(e) => handleNumberChange("units_needed", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency_level">Urgency Level *</Label>
                <Select
                  value={formData.urgency_level}
                  onValueChange={(value) => handleSelectChange("urgency_level", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency level" />
                  </SelectTrigger>
                  <SelectContent>
                    {urgencyLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <Badge className={level.color}>{level.label}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="request_type">Request Type *</Label>
                <Select
                  value={formData.request_type}
                  onValueChange={(value) => handleSelectChange("request_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name *</Label>
                <Input
                  id="contact_name"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="Enter contact person name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone *</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  placeholder="Enter contact phone number"
                  required
                />
              </div>
            </div>

            {/* Location Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Enter location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="completion_deadline">Completion Deadline</Label>
                <Input
                  id="completion_deadline"
                  name="completion_deadline"
                  type="datetime-local"
                  value={formData.completion_deadline}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-2">
              <Label htmlFor="additional_info">Additional Information</Label>
              <Textarea
                id="additional_info"
                name="additional_info"
                value={formData.additional_info}
                onChange={handleChange}
                placeholder="Any additional information about the request..."
                rows={3}
              />
            </div>

            {/* Advanced Fields (for authorized users) */}
            {canAccessAdvancedFeatures && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {showAdvancedFields ? "Hide" : "Show"} Advanced Fields
                  </Button>
                </div>

                {showAdvancedFields && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="estimated_cost">Estimated Cost</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="estimated_cost"
                          name="estimated_cost"
                          type="number"
                          value={formData.estimated_cost || ""}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            estimated_cost: parseFloat(e.target.value) || null 
                          }))}
                          className="pl-10"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="medical_notes">Medical Notes</Label>
                      <Textarea
                        id="medical_notes"
                        name="medical_notes"
                        value={formData.medical_notes}
                        onChange={handleChange}
                        placeholder="Medical notes and requirements..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Emergency Alert */}
            {isEmergency && (
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  This is an emergency request. It will be prioritized and processed immediately.
                  Emergency responders will be notified automatically.
                </AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating Request...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {isEmergency ? "Send Emergency Request" : "Create Request"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 