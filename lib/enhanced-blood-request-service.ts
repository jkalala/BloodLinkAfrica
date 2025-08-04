import { createServerSupabaseClient } from "./supabase"
import { performanceMonitor } from './performance-monitoring'
import { websocketService } from './websocket-service'
import { notificationService } from './notification-service'
import { aiMatchingService } from './ai-matching-service'
import { enhancedLocationService } from './enhanced-location-service'
import { inventoryManagementService } from './inventory-management-service'
import type { Database } from "@/types/supabase"

type BloodRequest = Database["public"]["Tables"]["blood_requests"]["Row"]
type BloodRequestInsert = Database["public"]["Tables"]["blood_requests"]["Insert"]
type BloodRequestUpdate = Database["public"]["Tables"]["blood_requests"]["Update"]
type EmergencyAlert = Database["public"]["Tables"]["emergency_blood_alerts"]["Row"]
type EmergencyAlertInsert = Database["public"]["Tables"]["emergency_blood_alerts"]["Insert"]
type InventoryTracking = Database["public"]["Tables"]["blood_inventory_tracking"]["Row"]
type DonationScheduling = Database["public"]["Tables"]["blood_donation_scheduling"]["Row"]

export interface CreateBloodRequestData {
  patient_name: string
  hospital_name: string
  blood_type: string
  units_needed: number
  urgency: string
  contact_name: string
  contact_phone: string
  additional_info?: string
  location?: string
  latitude?: number
  longitude?: number
  requester_id?: string
  institution_id?: string
  urgency_level?: 'normal' | 'urgent' | 'critical' | 'emergency'
  request_type?: 'donation' | 'emergency' | 'scheduled' | 'reserve'
  estimated_cost?: number
  insurance_info?: Record<string, unknown>
  medical_notes?: string
  donor_requirements?: Record<string, unknown>
  completion_deadline?: string
  emergency_contact?: Record<string, unknown>
  tags?: string[]
}

export interface DonorMatch {
  donor_id: string
  match_score: number
  criteria: Record<string, unknown>
}

export interface BloodBankMatch {
  blood_bank_id: string;
  blood_bank_name: string;
  available_units: number;
  distance_km: number;
  transport_time_minutes: number;
  compatibility_score: number;
  inventory_status: string;
}

export interface EmergencyAlertData {
  alert_type: 'mass_casualty' | 'natural_disaster' | 'transport_accident' | 'medical_emergency'
  severity: 'low' | 'medium' | 'high' | 'critical'
  affected_area: Record<string, unknown>
  blood_types_needed: Record<string, unknown>
  units_required: number
  deadline: string
  coordinator_id?: string
  notes?: string
}

export interface InventoryUpdateData {
  institution_id: string
  blood_type: string
  units_change: number
  updated_by: string
}

export interface DonationScheduleData {
  donor_id: string
  institution_id: string
  scheduled_date: string
  blood_type: string
  units_to_donate?: number
  notes?: string
}

export interface RequestStatistics {
  total_requests: number
  pending_requests: number
  fulfilled_requests: number
  average_response_time: number
  success_rate: number
}

class EnhancedBloodRequestService {
  private supabase = createServerSupabaseClient()

  // Create a new blood request with enhanced features and real-time matching
  async createBloodRequest(data: CreateBloodRequestData): Promise<{ success: boolean; data?: BloodRequest; matches?: { donor_matches: DonorMatch[]; blood_bank_matches: BloodBankMatch[]; total_notified: number }; error?: string }> {
    const tracker = performanceMonitor.startTracking('create-blood-request', 'POST')
    
    try {
      console.log(`🩸 Creating enhanced blood request for ${data.blood_type}`)

      const requestData: BloodRequestInsert = {
        patient_name: data.patient_name,
        hospital_name: data.hospital_name,
        blood_type: data.blood_type,
        units_needed: data.units_needed,
        urgency: data.urgency,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        additional_info: data.additional_info,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        requester_id: data.requester_id,
        institution_id: data.institution_id,
        urgency_level: data.urgency_level || 'normal',
        request_type: data.request_type || 'donation',
        estimated_cost: data.estimated_cost,
        insurance_info: data.insurance_info,
        medical_notes: data.medical_notes,
        donor_requirements: data.donor_requirements,
        completion_deadline: data.completion_deadline,
        emergency_contact: data.emergency_contact,
        tags: data.tags,
        status: 'pending',
        created_at: new Date().toISOString()
      }

      const { data: request, error } = await this.supabase
        .from('blood_requests')
        .insert(requestData)
        .select()
        .single()

      if (error) throw error

      console.log(`✅ Created blood request: ${request.id}`)

      // Calculate priority score
      if (request) {
        await this.calculateRequestPriority(request.id)
      }

      // Start real-time matching process
      const matches = await this.initiateRealTimeMatching(request)

      // Attempt inventory reservation if possible
      if (data.latitude && data.longitude) {
        await this.attemptInventoryReservation(request.id, data.blood_type, data.units_needed, {
          lat: data.latitude,
          lng: data.longitude
        })
      }

      // Broadcast the new request
      await this.broadcastRequest(request)

      // Schedule escalation for urgent requests
      if (['urgent', 'critical', 'emergency'].includes(data.urgency_level || 'normal')) {
        await this.scheduleEscalation(request.id, data.urgency_level || 'urgent')
      }

      tracker.end(200)
      return { success: true, data: request, matches }
    } catch (error: unknown) {
      console.error('Create blood request error:', error)
      tracker.end(500)
      return { success: false, error: error.message }
    }
  }

  // Get blood requests with role-based filtering
  async getBloodRequests(userId: string, userRole: string, institutionId?: string): Promise<{ success: boolean; data?: BloodRequest[]; error?: string }> {
    try {
      let query = this.supabase.from('blood_requests').select('*')

      // Apply role-based filtering
      if (userRole === 'emergency_responder') {
        // Emergency responders can see all requests
        query = query.order('priority_score', { ascending: false })
      } else if (userRole === 'hospital_staff' || userRole === 'blood_bank_staff') {
        // Institution staff can see their institution's requests
        query = query.eq('institution_id', institutionId)
      } else {
        // Regular users can only see their own requests
        query = query.eq('requester_id', userId)
      }

      const { data, error } = await query

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error: unknown) {
      console.error('Get blood requests error:', error)
      return { success: false, error: error.message }
    }
  }

  // Update blood request status and details
  async updateBloodRequest(requestId: string, updates: BloodRequestUpdate): Promise<{ success: boolean; data?: BloodRequest; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('blood_requests')
        .update(updates)
        .eq('id', requestId)
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error: unknown) {
      console.error('Update blood request error:', error)
      return { success: false, error: error.message }
    }
  }

  // Calculate priority score for a request
  async calculateRequestPriority(requestId: string): Promise<{ success: boolean; priority?: number; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .rpc('calculate_request_priority', { request_uuid: requestId })

      if (error) throw error

      return { success: true, priority: data }
    } catch (error: unknown) {
      console.error('Calculate priority error:', error)
      return { success: false, error: error.message }
    }
  }

  // Find matching donors for a request
  async findMatchingDonors(requestId: string): Promise<{ success: boolean; data?: DonorMatch[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .rpc('find_matching_donors', { request_uuid: requestId })

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error: unknown) {
      console.error('Find matching donors error:', error)
      return { success: false, error: error.message }
    }
  }

  // Create emergency blood alert
  async createEmergencyAlert(alertData: EmergencyAlertData): Promise<{ success: boolean; data?: EmergencyAlert; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .rpc('create_emergency_alert', {
          alert_type: alertData.alert_type,
          severity: alertData.severity,
          affected_area: alertData.affected_area,
          blood_types_needed: alertData.blood_types_needed,
          units_required: alertData.units_required,
          deadline: alertData.deadline,
          coordinator_uuid: alertData.coordinator_id || '',
          notes: alertData.notes
        })

      if (error) throw error

      // Get the created alert
      const { data: alert, error: fetchError } = await this.supabase
        .from('emergency_blood_alerts')
        .select('*')
        .eq('id', data)
        .single()

      if (fetchError) throw fetchError

      return { success: true, data: alert }
    } catch (error: unknown) {
      console.error('Create emergency alert error:', error)
      return { success: false, error: error.message }
    }
  }

  // Get active emergency alerts
  async getActiveEmergencyAlerts(): Promise<{ success: boolean; data?: EmergencyAlert[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('emergency_blood_alerts')
        .select('*')
        .eq('status', 'active')
        .order('severity', { ascending: false })

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error: unknown) {
      console.error('Get emergency alerts error:', error)
      return { success: false, error: error.message }
    }
  }

  // Update inventory stock
  async updateInventoryStock(updateData: InventoryUpdateData): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .rpc('update_inventory_stock', {
          institution_uuid: updateData.institution_id,
          blood_type: updateData.blood_type,
          units_change: updateData.units_change,
          updated_by_uuid: updateData.updated_by
        })

      if (error) throw error

      return { success: true }
    } catch (error: unknown) {
      console.error('Update inventory stock error:', error)
      return { success: false, error: error.message }
    }
  }

  // Get inventory summary
  async getInventorySummary(): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('blood_inventory_summary')
        .select('*')
        .order('institution_name')

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error: unknown) {
      console.error('Get inventory summary error:', error)
      return { success: false, error: error.message }
    }
  }

  // Schedule blood donation
  async scheduleDonation(scheduleData: DonationScheduleData): Promise<{ success: boolean; data?: DonationScheduling; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('blood_donation_scheduling')
        .insert({
          donor_id: scheduleData.donor_id,
          institution_id: scheduleData.institution_id,
          scheduled_date: scheduleData.scheduled_date,
          blood_type: scheduleData.blood_type,
          units_to_donate: scheduleData.units_to_donate || 1,
          notes: scheduleData.notes
        })
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error: unknown) {
      console.error('Schedule donation error:', error)
      return { success: false, error: error.message }
    }
  }

  // Get donation schedules for a donor
  async getDonationSchedules(donorId: string): Promise<{ success: boolean; data?: DonationScheduling[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('blood_donation_scheduling')
        .select('*')
        .eq('donor_id', donorId)
        .order('scheduled_date', { ascending: true })

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error: unknown) {
      console.error('Get donation schedules error:', error)
      return { success: false, error: error.message }
    }
  }

  // Get request statistics
  async getRequestStatistics(daysBack: number = 30): Promise<{ success: boolean; data?: RequestStatistics; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_request_statistics', { days_back: daysBack })

      if (error) throw error

      return { success: true, data: data?.[0] }
    } catch (error: unknown) {
      console.error('Get request statistics error:', error)
      return { success: false, error: error.message }
    }
  }

  // Get active blood requests with donor matching info
  async getActiveBloodRequests(): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('active_blood_requests')
        .select('*')
        .order('priority_score', { ascending: false })

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error: unknown) {
      console.error('Get active blood requests error:', error)
      return { success: false, error: error.message }
    }
  }

  // Assign coordinator to request
  async assignCoordinator(requestId: string, coordinatorId: string, role: 'primary' | 'secondary' | 'emergency' | 'backup' = 'primary'): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('blood_request_coordination')
        .insert({
          request_id: requestId,
          coordinator_id: coordinatorId,
          role: role
        })

      if (error) throw error

      // Update the request with assigned coordinator
      await this.updateBloodRequest(requestId, {
        assigned_coordinator: coordinatorId
      })

      return { success: true }
    } catch (error: unknown) {
      console.error('Assign coordinator error:', error)
      return { success: false, error: error.message }
    }
  }

  // Log request update
  async logRequestUpdate(requestId: string, updatedBy: string, updateType: 'status_change' | 'priority_change' | 'assignment' | 'note' | 'emergency_escalation', oldValue?: string, newValue?: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('blood_request_updates')
        .insert({
          request_id: requestId,
          updated_by: updatedBy,
          update_type: updateType,
          old_value: oldValue,
          new_value: newValue,
          notes: notes
        })

      if (error) throw error

      return { success: true }
    } catch (error: unknown) {
      console.error('Log request update error:', error)
      return { success: false, error: error.message }
    }
  }

  // Get request updates history
  async getRequestUpdates(requestId: string): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('blood_request_updates')
        .select(`
          *,
          updated_by_user:users!blood_request_updates_updated_by_fkey(name, phone)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return { success: true, data: data || [] }
    } catch (error: unknown) {
      console.error('Get request updates error:', error)
      return { success: false, error: error.message }
    }
  }

  // NEW REAL-TIME MATCHING METHODS

  /**
   * Initiate real-time matching process with AI and location services
   */
  async initiateRealTimeMatching(request: BloodRequest): Promise<{ donor_matches: DonorMatch[]; blood_bank_matches: BloodBankMatch[]; total_notified: number }> {
    try {
      console.log(`⚡ Initiating real-time matching for request ${request.id}`)

      if (!request.latitude || !request.longitude) {
        console.warn('Request has no coordinates, using basic matching')
        return await this.findMatchingDonors(request.id)
      }

      // Get AI-powered donor matches
      const aiDonorMatches = await aiMatchingService.findOptimalDonors(
        request.id,
        request.blood_type,
        request.urgency_level || 'normal',
        `${request.latitude},${request.longitude}`,
        15 // Top 15 donors
      )

      // Get nearby blood banks with inventory
      const nearbyBloodBanks = await this.findNearbyBloodBanks(
        { lat: request.latitude, lng: request.longitude },
        request.blood_type,
        request.units_needed
      )

      // Send notifications to top donors
      const notificationChannels = this.getNotificationChannels(request.urgency_level || 'normal')
      
      for (const donor of aiDonorMatches.slice(0, 8)) { // Notify top 8 first
        await notificationService.sendAlert({
          type: 'blood_request',
          title: `${(request.urgency_level || 'normal').toUpperCase()}: ${request.blood_type} Blood Needed`,
          message: `${request.patient_name} needs ${request.blood_type} blood at ${request.hospital_name}. Distance: ${donor.distance?.toFixed(1)}km`,
          recipients: [donor.donor_id],
          priority: request.urgency_level === 'emergency' ? 'critical' : 'high',
          channels: notificationChannels,
          data: {
            request_id: request.id,
            blood_type: request.blood_type,
            urgency: request.urgency_level,
            hospital: request.hospital_name,
            distance: donor.distance,
            eta: donor.response_time_prediction
          }
        })
      }

      // Update request with matching data
      await this.supabase
        .from('blood_requests')
        .update({
          ai_matches: aiDonorMatches.map(m => m.donor_id),
          blood_bank_matches: nearbyBloodBanks.map(b => b.blood_bank_id),
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)

      return {
        donor_matches: aiDonorMatches,
        blood_bank_matches: nearbyBloodBanks,
        total_notified: Math.min(aiDonorMatches.length, 8)
      }

    } catch (error) {
      console.error('Error initiating real-time matching:', error)
      return { donor_matches: [], blood_bank_matches: [], total_notified: 0 }
    }
  }

  /**
   * Find nearby blood banks with available inventory
   */
  async findNearbyBloodBanks(
    coordinates: { lat: number; lng: number },
    bloodType: string,
    unitsNeeded: number,
    radiusKm = 50
  ): Promise<BloodBankMatch[]> {
    try {
      // Get nearby blood banks using location service
      const nearbyBanks = await enhancedLocationService.findNearbyBloodBanks(
        coordinates,
        radiusKm
      )

      const matches: any[] = []

      for (const bank of nearbyBanks) {
        // Check inventory availability
        const { data: inventory } = await this.supabase
          .from('blood_inventory')
          .select('quantity, reserved_quantity')
          .eq('blood_bank_id', bank.id)
          .eq('blood_type', bloodType)
          .single()

        if (inventory) {
          const availableUnits = inventory.quantity - inventory.reserved_quantity
          
          if (availableUnits > 0) {
            const transportTime = Math.round(bank.distance * 3) // 3 minutes per km for transport
            
            matches.push({
              blood_bank_id: bank.id,
              blood_bank_name: bank.name,
              available_units: availableUnits,
              distance_km: bank.distance,
              transport_time_minutes: transportTime,
              compatibility_score: this.calculateBloodBankScore(availableUnits, unitsNeeded, bank.distance),
              inventory_status: availableUnits >= unitsNeeded ? 'available' : 
                               availableUnits >= Math.ceil(unitsNeeded / 2) ? 'limited' : 'critical'
            })
          }
        }
      }

      // Sort by compatibility score
      matches.sort((a, b) => b.compatibility_score - a.compatibility_score)

      console.log(`🏥 Found ${matches.length} blood bank matches`)
      return matches

    } catch (error) {
      console.error('Error finding nearby blood banks:', error)
      return []
    }
  }

  /**
   * Attempt to reserve blood units from inventory
   */
  async attemptInventoryReservation(
    requestId: string,
    bloodType: string,
    unitsNeeded: number,
    coordinates: { lat: number; lng: number }
  ): Promise<boolean> {
    try {
      console.log(`🔒 Attempting inventory reservation for request ${requestId}`)

      const reservation = await inventoryManagementService.reserveBloodUnits(
        bloodType,
        unitsNeeded,
        requestId
      )

      if (reservation.success) {
        // Update request with reservation info
        await this.supabase
          .from('blood_requests')
          .update({
            inventory_reserved: true,
            reserved_units: reservation.reservedUnits.map((unit: { id: string }) => unit.id),
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId)

        console.log(`✅ Reserved ${reservation.reservedUnits.length} units for request ${requestId}`)
        return true
      }

      return false

    } catch (error) {
      console.error('Error attempting inventory reservation:', error)
      return false
    }
  }

  /**
   * Handle donor response to blood request
   */
  async handleDonorResponse(
    requestId: string,
    donorId: string,
    responseType: 'accept' | 'decline' | 'maybe',
    responseData?: {
      eta_minutes?: number
      current_location?: { lat: number; lng: number }
      notes?: string
    }
  ): Promise<{ success: boolean; matched?: boolean; error?: string }> {
    const tracker = performanceMonitor.startTracking('donor-response', 'POST')

    try {
      console.log(`👤 Processing donor response: ${responseType} for request ${requestId}`)

      // Check if request is still active
      const { data: request } = await this.supabase
        .from('blood_requests')
        .select('status, units_needed, matched_donors')
        .eq('id', requestId)
        .single()

      if (!request || ['completed', 'cancelled', 'expired'].includes(request.status)) {
        return { success: false, error: 'Request is no longer active' }
      }

      // Create or update donor response
      const { data: response, error: responseError } = await this.supabase
        .from('donor_responses')
        .upsert({
          donor_id: donorId,
          request_id: requestId,
          response_type: responseType,
          eta_minutes: responseData?.eta_minutes,
          current_location: responseData?.current_location,
          notes: responseData?.notes,
          status: responseType === 'accept' ? 'confirmed' : 'pending',
          confirmed_at: responseType === 'accept' ? new Date().toISOString() : null,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (responseError) {
        throw new Error(`Failed to record response: ${responseError.message}`)
      }

      let matched = false

      if (responseType === 'accept') {
        // Start location tracking for accepted donor
        await enhancedLocationService.startLocationTracking(
          donorId,
          'donor',
          { requestId, highAccuracy: true, updateInterval: 15000 }
        )

        // Update matched donors list
        const updatedMatchedDonors = [...(request.matched_donors || []), donorId]
        
        await this.supabase
          .from('blood_requests')
          .update({
            matched_donors: updatedMatchedDonors,
            status: updatedMatchedDonors.length >= request.units_needed ? 'matched' : 'partially_fulfilled',
            matched_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId)

        matched = updatedMatchedDonors.length >= request.units_needed

        // Broadcast real-time update
        websocketService.broadcast('blood_request:update', {
          request_id: requestId,
          type: 'donor_accepted',
          donor_id: donorId,
          matched: matched
        })

        console.log(`✅ Donor accepted request ${requestId}${matched ? ' - Fully matched!' : ''}`)
      }

      tracker.end(200)
      return { success: true, matched }

    } catch (error) {
      console.error('Error handling donor response:', error)
      tracker.end(500)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Update request status with real-time broadcast
   */
  async updateRequestStatus(
    requestId: string, 
    status: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase
        .from('blood_requests')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...(metadata && { metadata })
        })
        .eq('id', requestId)

      // Broadcast status update
      websocketService.broadcast('blood_request:status', {
        request_id: requestId,
        status,
        timestamp: new Date().toISOString()
      })

      console.log(`📊 Updated request ${requestId} status to: ${status}`)

    } catch (error) {
      console.error('Error updating request status:', error)
    }
  }

  // Private helper methods

  private calculateBloodBankScore(availableUnits: number, neededUnits: number, distance: number): number {
    let score = 100

    // Availability score (0-50 points)
    const availabilityRatio = availableUnits / neededUnits
    if (availabilityRatio >= 1) score += 50
    else score += availabilityRatio * 50

    // Distance penalty (0-30 points)
    const distancePenalty = Math.min(distance * 2, 30)
    score -= distancePenalty

    // Reliability bonus (0-20 points) - would come from historical data
    score += 15 // Default reliability score

    return Math.max(score, 0)
  }

  private getNotificationChannels(urgency: string): string[] {
    switch (urgency) {
      case 'emergency': return ['push', 'sms', 'call', 'email']
      case 'critical': return ['push', 'sms', 'email']
      case 'urgent': return ['push', 'email']
      default: return ['push']
    }
  }

  private async broadcastRequest(request: BloodRequest): Promise<void> {
    websocketService.broadcast('blood_request:new', {
      request_id: request.id,
      blood_type: request.blood_type,
      urgency: request.urgency_level,
      location: request.location,
      units_needed: request.units_needed
    })
  }

  private async scheduleEscalation(requestId: string, urgency: string): Promise<void> {
    // Schedule automatic escalation for critical requests
    const escalationDelayMinutes = urgency === 'emergency' ? 10 : 30
    
    setTimeout(async () => {
      await this.escalateRequest(requestId)
    }, escalationDelayMinutes * 60 * 1000)
  }

  private async escalateRequest(requestId: string): Promise<void> {
    try {
      const { data: request } = await this.supabase
        .from('blood_requests')
        .select('status, escalation_count')
        .eq('id', requestId)
        .single()

      if (request && request.status === 'pending') {
        await this.supabase
          .from('blood_requests')
          .update({
            escalation_count: (request.escalation_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId)

        // Send escalation notifications
        console.log(`🚨 Escalating request ${requestId}`)
      }
    } catch (error) {
      console.error('Error escalating request:', error)
    }
  }
}

export const enhancedBloodRequestService = new EnhancedBloodRequestService()
export const getEnhancedBloodRequestService = () => enhancedBloodRequestService 