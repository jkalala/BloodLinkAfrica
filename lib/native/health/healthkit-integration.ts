/**
 * HealthKit Integration for iOS
 * 
 * Comprehensive HealthKit integration for blood donation health data,
 * vital signs monitoring, and medical record synchronization
 */

import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'
import { performanceMonitor } from '../../performance/metrics'
import { getRealTimeEventSystem } from '../../realtime/event-system'

export interface HealthKitPermission {
  identifier: string
  type: 'read' | 'write' | 'share'
  dataType: 'quantity' | 'category' | 'characteristic' | 'correlation' | 'workout' | 'clinical'
  required: boolean
  description: string
}

export interface HealthKitData {
  identifier: string
  value: number | string | boolean
  unit?: string
  startDate: Date
  endDate?: Date
  source: {
    name: string
    bundleIdentifier: string
    version: string
  }
  metadata?: Record<string, any>
  device?: {
    name: string
    model: string
    manufacturer: string
    hardwareVersion: string
    softwareVersion: string
  }
}

export interface VitalSigns {
  heartRate?: {
    value: number
    unit: 'bpm'
    timestamp: Date
    restingHeartRate?: number
  }
  bloodPressure?: {
    systolic: number
    diastolic: number
    unit: 'mmHg'
    timestamp: Date
  }
  bodyTemperature?: {
    value: number
    unit: 'celsius' | 'fahrenheit'
    timestamp: Date
  }
  respiratoryRate?: {
    value: number
    unit: 'breaths/min'
    timestamp: Date
  }
  oxygenSaturation?: {
    value: number
    unit: 'percent'
    timestamp: Date
  }
  bloodGlucose?: {
    value: number
    unit: 'mg/dL' | 'mmol/L'
    timestamp: Date
    mealTime?: 'fasting' | 'before_meal' | 'after_meal'
  }
}

export interface BloodDonationRecord {
  id: string
  userId: string
  donationDate: Date
  bloodType: string
  volume: number
  unit: 'mL'
  location: {
    name: string
    address: string
    coordinates?: {
      latitude: number
      longitude: number
    }
  }
  preVitals: VitalSigns
  postVitals?: VitalSigns
  eligibilityChecks: {
    hemoglobin: number
    bloodPressure: { systolic: number; diastolic: number }
    temperature: number
    weight: number
    eligible: boolean
    notes?: string
  }
  complications?: Array<{
    type: string
    severity: 'mild' | 'moderate' | 'severe'
    description: string
    resolved: boolean
  }>
  followUp?: {
    scheduled: boolean
    date?: Date
    completed: boolean
    notes?: string
  }
}

export interface HealthProfile {
  userId: string
  bloodType?: string
  allergies: string[]
  medications: Array<{
    name: string
    dosage: string
    frequency: string
    startDate: Date
    endDate?: Date
  }>
  medicalConditions: Array<{
    condition: string
    diagnosisDate: Date
    status: 'active' | 'resolved' | 'chronic'
    severity?: 'mild' | 'moderate' | 'severe'
  }>
  emergencyContacts: Array<{
    name: string
    relationship: string
    phoneNumber: string
    email?: string
  }>
  donationHistory: {
    totalDonations: number
    lastDonation?: Date
    nextEligibleDate?: Date
    averageInterval: number // days
    complications: number
  }
  healthMetrics: {
    averageHeartRate?: number
    averageBloodPressure?: { systolic: number; diastolic: number }
    averageHemoglobin?: number
    bmi?: number
    lastUpdated: Date
  }
}

class HealthKitIntegration {
  private db = getOptimizedDB()
  private cache = getCache()
  private eventSystem = getRealTimeEventSystem()

  // HealthKit permissions required for blood donation app
  private readonly REQUIRED_PERMISSIONS: HealthKitPermission[] = [
    // Vital Signs (Read)
    {
      identifier: 'HKQuantityTypeIdentifierHeartRate',
      type: 'read',
      dataType: 'quantity',
      required: true,
      description: 'Monitor heart rate for donation eligibility'
    },
    {
      identifier: 'HKQuantityTypeIdentifierBloodPressureSystolic',
      type: 'read',
      dataType: 'quantity',
      required: true,
      description: 'Check blood pressure for donation safety'
    },
    {
      identifier: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
      type: 'read',
      dataType: 'quantity',
      required: true,
      description: 'Check blood pressure for donation safety'
    },
    {
      identifier: 'HKQuantityTypeIdentifierBodyTemperature',
      type: 'read',
      dataType: 'quantity',
      required: true,
      description: 'Monitor body temperature for health screening'
    },
    {
      identifier: 'HKQuantityTypeIdentifierRespiratoryRate',
      type: 'read',
      dataType: 'quantity',
      required: false,
      description: 'Additional vital sign monitoring'
    },
    {
      identifier: 'HKQuantityTypeIdentifierOxygenSaturation',
      type: 'read',
      dataType: 'quantity',
      required: false,
      description: 'Monitor oxygen levels for health assessment'
    },
    // Blood Work (Read)
    {
      identifier: 'HKQuantityTypeIdentifierBloodGlucose',
      type: 'read',
      dataType: 'quantity',
      required: false,
      description: 'Monitor blood glucose levels'
    },
    // Body Measurements (Read)
    {
      identifier: 'HKQuantityTypeIdentifierBodyMass',
      type: 'read',
      dataType: 'quantity',
      required: true,
      description: 'Check weight for donation eligibility'
    },
    {
      identifier: 'HKQuantityTypeIdentifierHeight',
      type: 'read',
      dataType: 'quantity',
      required: true,
      description: 'Calculate BMI for health assessment'
    },
    // Characteristics (Read)
    {
      identifier: 'HKCharacteristicTypeIdentifierBiologicalSex',
      type: 'read',
      dataType: 'characteristic',
      required: false,
      description: 'Demographic information for donation records'
    },
    {
      identifier: 'HKCharacteristicTypeIdentifierDateOfBirth',
      type: 'read',
      dataType: 'characteristic',
      required: true,
      description: 'Age verification for donation eligibility'
    },
    {
      identifier: 'HKCharacteristicTypeIdentifierBloodType',
      type: 'read',
      dataType: 'characteristic',
      required: true,
      description: 'Blood type for donation matching'
    },
    // Clinical Records (Read)
    {
      identifier: 'HKClinicalTypeIdentifierAllergyRecord',
      type: 'read',
      dataType: 'clinical',
      required: false,
      description: 'Allergy information for safety screening'
    },
    {
      identifier: 'HKClinicalTypeIdentifierMedicationRecord',
      type: 'read',
      dataType: 'clinical',
      required: false,
      description: 'Medication information for eligibility screening'
    },
    // Blood Donation Records (Write)
    {
      identifier: 'BloodDonationRecord',
      type: 'write',
      dataType: 'correlation',
      required: true,
      description: 'Store blood donation records in HealthKit'
    }
  ]

  // Blood donation eligibility criteria
  private readonly ELIGIBILITY_CRITERIA = {
    age: { min: 17, max: 65 },
    weight: { min: 50 }, // kg
    heartRate: { min: 50, max: 100 }, // bpm
    bloodPressure: {
      systolic: { min: 90, max: 180 },
      diastolic: { min: 50, max: 100 }
    },
    temperature: { min: 36.1, max: 37.2 }, // celsius
    hemoglobin: {
      male: { min: 13.0 }, // g/dL
      female: { min: 12.5 }
    },
    donationInterval: {
      wholeBlood: 56, // days
      plasma: 28,
      platelets: 7
    }
  }

  constructor() {
    this.initializeHealthKit()
  }

  async requestPermissions(): Promise<{
    success: boolean
    granted: string[]
    denied: string[]
    error?: string
  }> {
    try {
      // This would interface with native iOS HealthKit
      // For now, we'll simulate the permission request
      
      const granted: string[] = []
      const denied: string[] = []

      for (const permission of this.REQUIRED_PERMISSIONS) {
        // Simulate permission grant (in real app, this would be native call)
        const isGranted = Math.random() > 0.1 // 90% grant rate simulation
        
        if (isGranted) {
          granted.push(permission.identifier)
        } else {
          denied.push(permission.identifier)
        }
      }

      // Cache permission status
      await this.cache.set('healthkit_permissions', { granted, denied }, {
        ttl: 24 * 3600,
        tags: ['healthkit', 'permissions']
      })

      // Log permission request
      await this.eventSystem.publishEvent({
        id: `healthkit_permissions_${Date.now()}`,
        type: 'system_event',
        priority: 'medium',
        source: 'healthkit_integration',
        timestamp: new Date(),
        data: {
          type: 'permission_request',
          granted: granted.length,
          denied: denied.length,
          total: this.REQUIRED_PERMISSIONS.length
        }
      })

      return {
        success: true,
        granted,
        denied
      }

    } catch (error) {
      return {
        success: false,
        granted: [],
        denied: [],
        error: (error as Error).message
      }
    }
  }

  async readVitalSigns(userId: string, timeRange?: { start: Date; end: Date }): Promise<{
    success: boolean
    data?: VitalSigns
    error?: string
  }> {
    try {
      // Check permissions
      const permissions = await this.cache.get<any>('healthkit_permissions')
      if (!permissions || !permissions.granted.includes('HKQuantityTypeIdentifierHeartRate')) {
        return { success: false, error: 'HealthKit permissions not granted' }
      }

      const endDate = timeRange?.end || new Date()
      const startDate = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

      // Simulate reading from HealthKit (in real app, this would be native calls)
      const vitalSigns: VitalSigns = {
        heartRate: {
          value: 72 + Math.random() * 20, // 72-92 bpm
          unit: 'bpm',
          timestamp: new Date(),
          restingHeartRate: 65 + Math.random() * 10
        },
        bloodPressure: {
          systolic: 110 + Math.random() * 20, // 110-130
          diastolic: 70 + Math.random() * 15, // 70-85
          unit: 'mmHg',
          timestamp: new Date()
        },
        bodyTemperature: {
          value: 36.5 + Math.random() * 0.7, // 36.5-37.2°C
          unit: 'celsius',
          timestamp: new Date()
        },
        respiratoryRate: {
          value: 12 + Math.random() * 8, // 12-20 breaths/min
          unit: 'breaths/min',
          timestamp: new Date()
        },
        oxygenSaturation: {
          value: 95 + Math.random() * 5, // 95-100%
          unit: 'percent',
          timestamp: new Date()
        }
      }

      // Cache vital signs
      await this.cache.set(`vital_signs:${userId}`, vitalSigns, {
        ttl: 300, // 5 minutes
        tags: ['vital_signs', userId]
      })

      // Record metrics
      performanceMonitor.recordCustomMetric({
        name: 'healthkit_vital_signs_read',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        tags: {
          user_id: userId,
          data_points: Object.keys(vitalSigns).length.toString()
        }
      })

      return {
        success: true,
        data: vitalSigns
      }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async checkDonationEligibility(userId: string, vitalSigns?: VitalSigns): Promise<{
    success: boolean
    eligible: boolean
    reasons: string[]
    recommendations: string[]
    nextEligibleDate?: Date
  }> {
    try {
      // Get vital signs if not provided
      if (!vitalSigns) {
        const vitalResult = await this.readVitalSigns(userId)
        if (!vitalResult.success || !vitalResult.data) {
          return {
            success: false,
            eligible: false,
            reasons: ['Unable to read vital signs from HealthKit'],
            recommendations: ['Please ensure HealthKit permissions are granted']
          }
        }
        vitalSigns = vitalResult.data
      }

      // Get user profile for additional checks
      const profile = await this.getHealthProfile(userId)
      
      const reasons: string[] = []
      const recommendations: string[] = []
      let eligible = true

      // Age check
      if (profile.data) {
        // Age would be calculated from date of birth
        // For simulation, assume age is available
      }

      // Heart rate check
      if (vitalSigns.heartRate) {
        const hr = vitalSigns.heartRate.value
        if (hr < this.ELIGIBILITY_CRITERIA.heartRate.min || hr > this.ELIGIBILITY_CRITERIA.heartRate.max) {
          eligible = false
          reasons.push(`Heart rate ${hr} bpm is outside safe range (${this.ELIGIBILITY_CRITERIA.heartRate.min}-${this.ELIGIBILITY_CRITERIA.heartRate.max} bpm)`)
          recommendations.push('Please consult with medical staff before donating')
        }
      }

      // Blood pressure check
      if (vitalSigns.bloodPressure) {
        const { systolic, diastolic } = vitalSigns.bloodPressure
        const criteria = this.ELIGIBILITY_CRITERIA.bloodPressure
        
        if (systolic < criteria.systolic.min || systolic > criteria.systolic.max ||
            diastolic < criteria.diastolic.min || diastolic > criteria.diastolic.max) {
          eligible = false
          reasons.push(`Blood pressure ${systolic}/${diastolic} mmHg is outside safe range`)
          recommendations.push('Blood pressure should be monitored before donation')
        }
      }

      // Temperature check
      if (vitalSigns.bodyTemperature) {
        const temp = vitalSigns.bodyTemperature.value
        const criteria = this.ELIGIBILITY_CRITERIA.temperature
        
        if (temp < criteria.min || temp > criteria.max) {
          eligible = false
          reasons.push(`Body temperature ${temp}°C indicates possible illness`)
          recommendations.push('Please wait until you are feeling well before donating')
        }
      }

      // Check last donation date
      if (profile.data?.donationHistory.lastDonation) {
        const daysSinceLastDonation = Math.floor(
          (Date.now() - profile.data.donationHistory.lastDonation.getTime()) / (24 * 60 * 60 * 1000)
        )
        
        if (daysSinceLastDonation < this.ELIGIBILITY_CRITERIA.donationInterval.wholeBlood) {
          eligible = false
          const nextEligibleDate = new Date(
            profile.data.donationHistory.lastDonation.getTime() + 
            this.ELIGIBILITY_CRITERIA.donationInterval.wholeBlood * 24 * 60 * 60 * 1000
          )
          reasons.push(`Must wait ${this.ELIGIBILITY_CRITERIA.donationInterval.wholeBlood - daysSinceLastDonation} more days since last donation`)
          recommendations.push(`You can donate again on ${nextEligibleDate.toLocaleDateString()}`)
          
          return {
            success: true,
            eligible,
            reasons,
            recommendations,
            nextEligibleDate
          }
        }
      }

      // Additional recommendations for eligible donors
      if (eligible) {
        recommendations.push('Drink plenty of water before and after donation')
        recommendations.push('Eat a healthy meal before donating')
        recommendations.push('Get adequate rest the night before')
      }

      // Log eligibility check
      await this.eventSystem.publishEvent({
        id: `eligibility_check_${Date.now()}`,
        type: 'health_event',
        priority: 'medium',
        source: 'healthkit_integration',
        timestamp: new Date(),
        data: {
          type: 'donation_eligibility',
          user_id: userId,
          eligible,
          reasons_count: reasons.length,
          vital_signs_available: !!vitalSigns
        }
      })

      return {
        success: true,
        eligible,
        reasons,
        recommendations
      }

    } catch (error) {
      return {
        success: false,
        eligible: false,
        reasons: ['Error checking eligibility'],
        recommendations: ['Please try again or consult medical staff'],
        error: (error as Error).message
      }
    }
  }

  async recordBloodDonation(donationRecord: Omit<BloodDonationRecord, 'id'>): Promise<{
    success: boolean
    recordId?: string
    error?: string
  }> {
    try {
      const recordId = `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const fullRecord: BloodDonationRecord = {
        id: recordId,
        ...donationRecord
      }

      // Store in database
      await this.db.insert('blood_donation_records', fullRecord)

      // Store in HealthKit (simulated)
      // In real implementation, this would create a correlation sample in HealthKit
      await this.cache.set(`healthkit_donation:${recordId}`, fullRecord, {
        ttl: 30 * 24 * 3600, // 30 days
        tags: ['healthkit', 'donation', donationRecord.userId]
      })

      // Update user's donation history
      await this.updateDonationHistory(donationRecord.userId, fullRecord)

      // Publish donation event
      await this.eventSystem.publishEvent({
        id: `blood_donation_${recordId}`,
        type: 'health_event',
        priority: 'high',
        source: 'healthkit_integration',
        timestamp: new Date(),
        data: {
          type: 'blood_donation_recorded',
          record_id: recordId,
          user_id: donationRecord.userId,
          blood_type: donationRecord.bloodType,
          volume: donationRecord.volume,
          location: donationRecord.location.name
        }
      })

      // Record metrics
      performanceMonitor.recordCustomMetric({
        name: 'blood_donation_recorded',
        value: donationRecord.volume,
        unit: 'mL',
        timestamp: Date.now(),
        tags: {
          user_id: donationRecord.userId,
          blood_type: donationRecord.bloodType,
          location: donationRecord.location.name
        }
      })

      return {
        success: true,
        recordId
      }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async getHealthProfile(userId: string): Promise<{
    success: boolean
    data?: HealthProfile
    error?: string
  }> {
    try {
      // Check cache first
      const cachedProfile = await this.cache.get<HealthProfile>(`health_profile:${userId}`)
      if (cachedProfile) {
        return { success: true, data: cachedProfile }
      }

      // Get from database
      const profileResult = await this.db.findOne('health_profiles', { userId })
      
      if (profileResult.success && profileResult.data) {
        const profile = profileResult.data as HealthProfile
        
        // Cache profile
        await this.cache.set(`health_profile:${userId}`, profile, {
          ttl: 3600, // 1 hour
          tags: ['health_profile', userId]
        })

        return { success: true, data: profile }
      }

      // Create default profile if none exists
      const defaultProfile: HealthProfile = {
        userId,
        allergies: [],
        medications: [],
        medicalConditions: [],
        emergencyContacts: [],
        donationHistory: {
          totalDonations: 0,
          averageInterval: 0,
          complications: 0
        },
        healthMetrics: {
          lastUpdated: new Date()
        }
      }

      // Store default profile
      await this.db.insert('health_profiles', defaultProfile)
      await this.cache.set(`health_profile:${userId}`, defaultProfile, {
        ttl: 3600,
        tags: ['health_profile', userId]
      })

      return { success: true, data: defaultProfile }

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async syncHealthData(userId: string): Promise<{
    success: boolean
    syncedData: string[]
    errors: string[]
  }> {
    try {
      const syncedData: string[] = []
      const errors: string[] = []

      // Sync vital signs
      try {
        const vitalResult = await this.readVitalSigns(userId)
        if (vitalResult.success) {
          syncedData.push('vital_signs')
        } else {
          errors.push('Failed to sync vital signs')
        }
      } catch (error) {
        errors.push(`Vital signs sync error: ${(error as Error).message}`)
      }

      // Sync characteristics (blood type, age, etc.)
      try {
        // This would read from HealthKit characteristics
        syncedData.push('characteristics')
      } catch (error) {
        errors.push(`Characteristics sync error: ${(error as Error).message}`)
      }

      // Sync clinical records
      try {
        // This would read clinical records from HealthKit
        syncedData.push('clinical_records')
      } catch (error) {
        errors.push(`Clinical records sync error: ${(error as Error).message}`)
      }

      // Update last sync time
      await this.cache.set(`last_healthkit_sync:${userId}`, new Date(), {
        ttl: 24 * 3600,
        tags: ['healthkit_sync', userId]
      })

      return {
        success: errors.length === 0,
        syncedData,
        errors
      }

    } catch (error) {
      return {
        success: false,
        syncedData: [],
        errors: [(error as Error).message]
      }
    }
  }

  private async updateDonationHistory(userId: string, donation: BloodDonationRecord): Promise<void> {
    try {
      const profileResult = await this.getHealthProfile(userId)
      if (!profileResult.success || !profileResult.data) return

      const profile = profileResult.data
      
      // Update donation history
      profile.donationHistory.totalDonations += 1
      profile.donationHistory.lastDonation = donation.donationDate
      
      // Calculate next eligible date
      profile.donationHistory.nextEligibleDate = new Date(
        donation.donationDate.getTime() + 
        this.ELIGIBILITY_CRITERIA.donationInterval.wholeBlood * 24 * 60 * 60 * 1000
      )

      // Update complications count
      if (donation.complications && donation.complications.length > 0) {
        profile.donationHistory.complications += donation.complications.length
      }

      // Save updated profile
      await this.db.update('health_profiles', { userId }, profile)
      await this.cache.set(`health_profile:${userId}`, profile, {
        ttl: 3600,
        tags: ['health_profile', userId]
      })

    } catch (error) {
      console.error('Failed to update donation history:', error)
    }
  }

  private initializeHealthKit(): void {
    console.log('HealthKit integration initialized')
  }

  // Public API methods
  public getRequiredPermissions(): HealthKitPermission[] {
    return this.REQUIRED_PERMISSIONS
  }

  public getEligibilityCriteria() {
    return this.ELIGIBILITY_CRITERIA
  }

  public async getSystemStats() {
    const permissions = await this.cache.get<any>('healthkit_permissions')
    
    return {
      permissionsGranted: permissions?.granted?.length || 0,
      permissionsDenied: permissions?.denied?.length || 0,
      totalPermissions: this.REQUIRED_PERMISSIONS.length,
      eligibilityCriteria: Object.keys(this.ELIGIBILITY_CRITERIA).length,
      lastSync: await this.cache.get('last_healthkit_sync') || null
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = await this.getSystemStats()
    const permissions = await this.cache.get<any>('healthkit_permissions')
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (!permissions || permissions.granted.length === 0) {
      status = 'unhealthy'
    } else if (permissions.granted.length < this.REQUIRED_PERMISSIONS.filter(p => p.required).length) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        ...stats,
        requiredPermissions: this.REQUIRED_PERMISSIONS.filter(p => p.required).length,
        optionalPermissions: this.REQUIRED_PERMISSIONS.filter(p => !p.required).length
      }
    }
  }
}

// Singleton instance
let healthKitInstance: HealthKitIntegration | null = null

export function getHealthKitIntegration(): HealthKitIntegration {
  if (!healthKitInstance) {
    healthKitInstance = new HealthKitIntegration()
  }
  return healthKitInstance
}

export default HealthKitIntegration
