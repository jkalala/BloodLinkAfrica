"use client"

import React, { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { useI18n } from "@/lib/i18n/client"
import { ThemeToggle } from "./theme-toggle"
import { 
  Heart, 
  User, 
  Building, 
  Package, 
  Shield, 
  AlertTriangle,
  ArrowRight,
  ChevronRight
} from "lucide-react"
import type { StakeholderType, Institution } from "@/types/supabase"

interface RegistrationStep {
  id: number
  title: string
  description: string
  component: React.ReactNode
}

export function MultiStakeholderRegistration() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { signUp } = useEnhancedAuth()
  const t = useI18n()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [stakeholderType, setStakeholderType] = useState<StakeholderType | ''>('')
  const [selectedInstitution, setSelectedInstitution] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
    bloodType: "",
    location: "",
    allowLocation: false,
    receiveAlerts: true,
    emergencyAccess: false,
    institutionId: "",
    department: "",
    position: "",
    emergencyContact: "",
    specialties: [] as string[],
    profileData: {} as Record<string, any>
  })

  const stakeholderTypes = [
    {
      value: 'donor' as StakeholderType,
      label: 'Blood Donor',
      description: 'Register as a blood donor to help save lives',
      icon: Heart,
      color: 'text-red-600'
    },
    {
      value: 'recipient' as StakeholderType,
      label: 'Blood Recipient/Family',
      description: 'Register to request blood for patients',
      icon: User,
      color: 'text-blue-600'
    },
    {
      value: 'hospital_staff' as StakeholderType,
      label: 'Hospital Staff',
      description: 'Register as hospital staff to manage blood requests',
      icon: Building,
      color: 'text-green-600'
    },
    {
      value: 'blood_bank_staff' as StakeholderType,
      label: 'Blood Bank Staff',
      description: 'Register as blood bank staff to manage inventory',
      icon: Package,
      color: 'text-purple-600'
    },
    {
      value: 'emergency_responder' as StakeholderType,
      label: 'Emergency Responder',
      description: 'Register as emergency responder for crisis situations',
      icon: AlertTriangle,
      color: 'text-orange-600'
    },
    {
      value: 'government_official' as StakeholderType,
      label: 'Government Official',
      description: 'Register as government official for public health monitoring',
      icon: Shield,
      color: 'text-gray-600'
    }
  ]

  // Mock institutions data - in real app, this would come from API
  const institutions = [
    { id: '1', name: 'Nairobi General Hospital', type: 'hospital' },
    { id: '2', name: 'Kenya Blood Bank', type: 'blood_bank' },
    { id: '3', name: 'Emergency Medical Services', type: 'emergency_service' },
    { id: '4', name: 'Ministry of Health Kenya', type: 'government_agency' }
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleStakeholderTypeSelect = (type: StakeholderType) => {
    setStakeholderType(type)
    setFormData(prev => ({ 
      ...prev, 
      profileData: {},
      institutionId: "",
      department: "",
      position: ""
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validate form data based on stakeholder type
      if (!validateFormData()) {
        return
      }

      const registrationData = {
        name: formData.name,
        phone: formData.phone,
        password: formData.password,
        stakeholderType: stakeholderType as StakeholderType,
        bloodType: formData.bloodType,
        institutionId: formData.institutionId || undefined,
        emergencyAccess: formData.emergencyAccess,
        profileData: {
          location: formData.location,
          allowLocation: formData.allowLocation,
          receiveAlerts: formData.receiveAlerts,
          department: formData.department,
          position: formData.position,
          emergencyContact: formData.emergencyContact,
          specialties: formData.specialties,
          ...formData.profileData
        }
      }

      const result = await signUp(registrationData)

      if (result.success) {
        toast({
          title: "Registration successful!",
          description: "Welcome to BloodLink Africa. Please verify your phone number.",
        })

        setTimeout(() => {
          router.push(`/${locale}/verify?phone=${encodeURIComponent(formData.phone)}&redirect=${encodeURIComponent(`/${locale}/dashboard`)}`)
        }, 1000)
      } else {
        toast({
          title: "Registration failed",
          description: result.error || "Please check your information and try again.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validateFormData = (): boolean => {
    if (!stakeholderType) {
      toast({
        title: "Missing Information",
        description: "Please select your stakeholder type.",
        variant: "destructive",
      })
      return false
    }

    if (!formData.name || !formData.phone || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      })
      return false
    }

    // Stakeholder-specific validations
    if (stakeholderType === 'donor' && !formData.bloodType) {
      toast({
        title: "Missing Information",
        description: "Please select your blood type.",
        variant: "destructive",
      })
      return false
    }

    if ((stakeholderType === 'hospital_staff' || stakeholderType === 'blood_bank_staff') && !formData.institutionId) {
      toast({
        title: "Missing Information",
        description: "Please select your institution.",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const renderStakeholderTypeSelection = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {stakeholderTypes.map((type) => {
          const Icon = type.icon
          return (
            <Card 
              key={type.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                stakeholderType === type.value 
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : ''
              }`}
              onClick={() => handleStakeholderTypeSelect(type.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Icon className={`h-6 w-6 ${type.color}`} />
                  <div className="flex-1">
                    <h3 className="font-semibold">{type.label}</h3>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )

  const renderBasicInfoForm = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+254700123456"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a password"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm your password"
            required
          />
        </div>
      </div>

      {stakeholderType === 'donor' && (
        <div className="space-y-2">
          <Label htmlFor="bloodType">Blood Type *</Label>
          <Select value={formData.bloodType} onValueChange={(value) => handleSelectChange("bloodType", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select your blood type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A-">A-</SelectItem>
              <SelectItem value="B+">B+</SelectItem>
              <SelectItem value="B-">B-</SelectItem>
              <SelectItem value="AB+">AB+</SelectItem>
              <SelectItem value="AB-">AB-</SelectItem>
              <SelectItem value="O+">O+</SelectItem>
              <SelectItem value="O-">O-</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )

  const renderInstitutionSelection = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="institution">Institution *</Label>
        <Select value={formData.institutionId} onValueChange={(value) => handleSelectChange("institutionId", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select your institution" />
          </SelectTrigger>
          <SelectContent>
            {institutions
              .filter(inst => {
                if (stakeholderType === 'hospital_staff') return inst.type === 'hospital'
                if (stakeholderType === 'blood_bank_staff') return inst.type === 'blood_bank'
                if (stakeholderType === 'emergency_responder') return inst.type === 'emergency_service'
                if (stakeholderType === 'government_official') return inst.type === 'government_agency'
                return true
              })
              .map(inst => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="Enter your department"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Input
            id="position"
            name="position"
            value={formData.position}
            onChange={handleChange}
            placeholder="Enter your position"
          />
        </div>
      </div>
    </div>
  )

  const renderAdditionalInfo = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="Enter your location"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContact">Emergency Contact</Label>
        <Input
          id="emergencyContact"
          name="emergencyContact"
          value={formData.emergencyContact}
          onChange={handleChange}
          placeholder="Emergency contact number"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="allowLocation"
          checked={formData.allowLocation}
          onCheckedChange={(checked) => handleCheckboxChange("allowLocation", checked as boolean)}
        />
        <Label htmlFor="allowLocation">Allow location access</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="receiveAlerts"
          checked={formData.receiveAlerts}
          onCheckedChange={(checked) => handleCheckboxChange("receiveAlerts", checked as boolean)}
        />
        <Label htmlFor="receiveAlerts">Receive alerts and notifications</Label>
      </div>

      {(stakeholderType === 'emergency_responder' || stakeholderType === 'government_official') && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="emergencyAccess"
            checked={formData.emergencyAccess}
            onCheckedChange={(checked) => handleCheckboxChange("emergencyAccess", checked as boolean)}
          />
          <Label htmlFor="emergencyAccess">Request emergency access privileges</Label>
        </div>
      )}
    </div>
  )

  const steps: RegistrationStep[] = [
    {
      id: 1,
      title: "Select Your Role",
      description: "Choose how you'll be using BloodLink Africa",
      component: renderStakeholderTypeSelection()
    },
    {
      id: 2,
      title: "Basic Information",
      description: "Provide your basic account information",
      component: renderBasicInfoForm()
    },
    {
      id: 3,
      title: "Institution Details",
      description: "Select your institution and role",
      component: renderInstitutionSelection()
    },
    {
      id: 4,
      title: "Additional Information",
      description: "Provide additional details and preferences",
      component: renderAdditionalInfo()
    }
  ]

  const currentStepData = steps.find(step => step.id === currentStep)

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Floating Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">Join BloodLink Africa</h1>
        <p className="text-center text-muted-foreground">
          Register as a stakeholder to help save lives through blood donation
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step.id <= currentStep 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {step.id < currentStep ? '✓' : step.id}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-16 h-1 mx-2 ${
                step.id < currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentStepData?.title}</CardTitle>
          <CardDescription>{currentStepData?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStepData?.component}

            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                Previous
              </Button>

              {currentStep < steps.length ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={
                    (currentStep === 1 && !stakeholderType) ||
                    (currentStep === 2 && (!formData.name || !formData.phone || !formData.password))
                  }
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 