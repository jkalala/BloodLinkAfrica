import { getSupabase } from "./supabase"
import { createServerSupabaseClient } from "./supabase"
import type { Database } from "@/types/supabase"

export interface BloodRequest {
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
  latitude?: number
  longitude?: number
  status: 'pending' | 'matched' | 'completed' | 'expired' | 'cancelled'
  matched_donor_id?: string
  matched_at?: string
  expires_at: string
  response_count: number
  emergency_level: 'normal' | 'urgent' | 'critical'
  escalation_count: number
  created_at: string
}

export interface DonorResponse {
  id: string
  donor_id: string
  request_id: string
  response_type: 'accept' | 'decline' | 'maybe'
  eta_minutes?: number
  notes?: string
  status: 'pending' | 'confirmed' | 'cancelled'
  confirmed_at?: string
  created_at: string
}

export interface DonorMatch {
  donor_id: string
  donor_name: string
  donor_phone: string
  blood_type: string
  location: string
  distance_km: number
  eta_minutes: number
  last_donation?: string
  available: boolean
  compatibility_score: number
}

export class BloodRequestService {
  private supabase = getSupabase()

  /**
   * Create a new blood request
   */
  async createRequest(requestData: Omit<BloodRequest, 'id' | 'status' | 'matched_donor_id' | 'matched_at' | 'expires_at' | 'response_count' | 'emergency_level' | 'escalation_count' | 'created_at'>): Promise<{ success: boolean; data?: BloodRequest; error?: string }> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        return { success: false, error: "User not authenticated" }
      }

      // Calculate expiration time based on urgency
      const expirationHours = {
        normal: 24,
        urgent: 6,
        critical: 2
      }
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expirationHours[requestData.urgency])

      const { data, error } = await this.supabase
        .from('blood_requests')
        .insert({
          ...requestData,
          user_id: user.id,
          expires_at: expiresAt.toISOString(),
          emergency_level: requestData.urgency,
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating blood request:', error)
        return { success: false, error: error.message }
      }

      // Find compatible donors and send notifications
      await this.findCompatibleDonors(data.id)

      return { success: true, data }
    } catch (error: unknown) {
      console.error('Error in createRequest:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Find compatible donors for a blood request
   */
  async findCompatibleDonors(requestId: string): Promise<DonorMatch[]> {
    try {
      // Get the blood request
      const { data: request, error: requestError } = await this.supabase
        .from('blood_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (requestError || !request) {
        console.error('Error fetching request:', requestError)
        return []
      }

      // Blood type compatibility matrix
      const compatibilityMatrix: Record<string, string[]> = {
        'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
        'O+': ['O+', 'A+', 'B+', 'AB+'],
        'A-': ['A-', 'A+', 'AB-', 'AB+'],
        'A+': ['A+', 'AB+'],
        'B-': ['B-', 'B+', 'AB-', 'AB+'],
        'B+': ['B+', 'AB+'],
        'AB-': ['AB-', 'AB+'],
        'AB+': ['AB+']
      }

      const compatibleTypes = compatibilityMatrix[request.blood_type] || []

      // Find compatible donors
      const { data: donors, error: donorsError } = await this.supabase
        .from('users')
        .select(`
          id,
          name,
          phone,
          blood_type,
          location,
          allow_location,
          available,
          last_donation,
          receive_alerts,
          latitude,
          longitude
        `)
        .in('blood_type', compatibleTypes)
        .eq('available', true)
        .eq('receive_alerts', true)

      if (donorsError) {
        console.error('Error fetching donors:', donorsError)
        return []
      }

      // Calculate compatibility scores and distances
      const donorMatches: DonorMatch[] = donors.map((donor: Donor) => {
        // If we don't have coordinates, use a default distance
        const distance = (request.latitude && request.longitude && donor.latitude && donor.longitude) 
          ? this.calculateDistance(
              request.latitude,
              request.longitude,
              donor.latitude,
              donor.longitude
            )
          : 5; // Default 5km if no coordinates

        const compatibilityScore = this.calculateCompatibilityScore(
          donor.blood_type,
          request.blood_type,
          distance,
          donor.last_donation
        )

        return {
          donor_id: donor.id,
          donor_name: donor.name,
          donor_phone: donor.phone,
          blood_type: donor.blood_type,
          location: donor.location,
          distance_km: distance,
          eta_minutes: Math.round(distance * 2), // Rough estimate: 2 min per km
          last_donation: donor.last_donation,
          available: donor.available,
          compatibility_score: compatibilityScore
        }
      })

      // Sort by compatibility score (highest first)
      donorMatches.sort((a, b) => b.compatibility_score - a.compatibility_score)

      // Send notifications to top 10 donors
      const topDonors = donorMatches.slice(0, 10)
      await this.notifyDonors(topDonors, request)

      return donorMatches
    } catch (error: unknown) {
      console.error('Error in findCompatibleDonors:', error)
      return []
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Calculate compatibility score for donor matching
   */
  private calculateCompatibilityScore(
    donorBloodType: string,
    requiredBloodType: string,
    distance: number,
    lastDonation?: string
  ): number {
    let score = 100

    // Perfect match bonus
    if (donorBloodType === requiredBloodType) {
      score += 50
    }

    // Distance penalty (0-30 points)
    const distancePenalty = Math.min(distance * 2, 30)
    score -= distancePenalty

    // Recent donation bonus (0-20 points)
    if (lastDonation) {
      const lastDonationDate = new Date(lastDonation)
      const daysSinceDonation = (Date.now() - lastDonationDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceDonation >= 56) { // 8 weeks minimum
        score += 20
      } else if (daysSinceDonation >= 42) { // 6 weeks
        score += 10
      }
    }

    return Math.max(score, 0)
  }

  /**
   * Send notifications to compatible donors
   */
  async notifyDonors(donors: DonorMatch[], request: BloodRequest): Promise<void> {
    try {
      const notifications = donors.map(donor => ({
        user_id: donor.donor_id,
        notification_type: 'blood_request' as const,
        title: `Urgent Blood Request - ${request.blood_type}`,
        message: `${request.blood_type} blood needed at ${request.hospital_name}. Distance: ${donor.distance_km.toFixed(1)}km. Can you help?`,
        data: {
          request_id: request.id,
          blood_type: request.blood_type,
          hospital: request.hospital_name,
          distance: donor.distance_km,
          eta: donor.eta_minutes
        }
      }))

      const { error } = await this.supabase
        .from('notification_queue')
        .insert(notifications)

      if (error) {
        console.error('Error queuing notifications:', error)
      }
    } catch (error: unknown) {
      console.error('Error in notifyDonors:', error)
    }
  }

  /**
   * Respond to a blood request as a donor
   */
  async respondToRequest(
    requestId: string,
    responseType: 'accept' | 'decline' | 'maybe',
    etaMinutes?: number,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        return { success: false, error: "User not authenticated" }
      }

      // Check if user already responded
      const { data: existingResponse } = await this.supabase
        .from('donor_responses')
        .select('id')
        .eq('donor_id', user.id)
        .eq('request_id', requestId)
        .single()

      if (existingResponse) {
        // Update existing response
        const { error } = await this.supabase
          .from('donor_responses')
          .update({
            response_type: responseType,
            eta_minutes: etaMinutes,
            notes: notes,
            status: 'pending'
          })
          .eq('id', existingResponse.id)

        if (error) {
          return { success: false, error: error.message }
        }
      } else {
        // Create new response
        const { error } = await this.supabase
          .from('donor_responses')
          .insert({
            donor_id: user.id,
            request_id: requestId,
            response_type: responseType,
            eta_minutes: etaMinutes,
            notes: notes
          })

        if (error) {
          return { success: false, error: error.message }
        }
      }

      // Get current response count and increment
      const { data: currentRequest } = await this.supabase
        .from('blood_requests')
        .select('response_count')
        .eq('id', requestId)
        .single()

      if (currentRequest) {
        await this.supabase
          .from('blood_requests')
          .update({ response_count: (currentRequest.response_count || 0) + 1 })
          .eq('id', requestId)
      }

      // If accepted, try to match immediately
      if (responseType === 'accept') {
        await this.tryMatchRequest(requestId, user.id)
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error in respondToRequest:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Try to match a request with an accepted donor
   */
  async tryMatchRequest(requestId: string, donorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if request is still pending
      const { data: request, error: requestError } = await this.supabase
        .from('blood_requests')
        .select('status, matched_donor_id')
        .eq('id', requestId)
        .single()

      if (requestError || !request) {
        return { success: false, error: "Request not found" }
      }

      if (request.status !== 'pending') {
        return { success: false, error: "Request already matched or completed" }
      }

      // Update request as matched
      const { error: updateError } = await this.supabase
        .from('blood_requests')
        .update({
          status: 'matched',
          matched_donor_id: donorId,
          matched_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Notify the request creator
      await this.notifyRequestCreator(requestId, donorId)

      return { success: true }
    } catch (error: unknown) {
      console.error('Error in tryMatchRequest:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Notify the request creator about a match
   */
  async notifyRequestCreator(requestId: string, donorId: string): Promise<void> {
    try {
      // Get request and donor details
      const { data: request } = await this.supabase
        .from('blood_requests')
        .select('contact_phone, hospital_name, blood_type')
        .eq('id', requestId)
        .single()

      const { data: donor } = await this.supabase
        .from('users')
        .select('name, phone')
        .eq('id', donorId)
        .single()

      if (request && donor) {
        // Create notification for request creator
        await this.supabase
          .from('notification_queue')
          .insert({
            user_id: donorId, // This should be the request creator's user ID
            notification_type: 'donor_match',
            title: 'Donor Found!',
            message: `${donor.name} has accepted your blood request for ${request.blood_type} at ${request.hospital_name}`,
            data: {
              request_id: requestId,
              donor_id: donorId,
              donor_name: donor.name,
              donor_phone: donor.phone
            }
          })
      }
    } catch (error: unknown) {
      console.error('Error in notifyRequestCreator:', error)
    }
  }

  /**
   * Get all blood requests (with optional filtering)
   */
  async getBloodRequests(filters?: {
    status?: string
    bloodType?: string
    urgency?: string
    location?: string
  }): Promise<{ success: boolean; data?: BloodRequest[]; error?: string }> {
    try {
      let query = this.supabase
        .from('blood_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.bloodType) {
        query = query.eq('blood_type', filters.bloodType)
      }
      if (filters?.urgency) {
        query = query.eq('emergency_level', filters.urgency)
      }
      if (filters?.location) {
        query = query.ilike('location', `%${filters.location}%`)
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error: unknown) {
      console.error('Error in getBloodRequests:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get donor responses for a request
   */
  async getDonorResponses(requestId: string): Promise<{ success: boolean; data?: DonorResponse[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('donor_responses')
        .select(`
          *,
          users!donor_responses_donor_id_fkey (
            name,
            phone,
            blood_type,
            location
          )
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error: unknown) {
      console.error('Error in getDonorResponses:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Complete a blood request
   */
  async completeRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('blood_requests')
        .update({
          status: 'completed'
        })
        .eq('id', requestId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error in completeRequest:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Cancel a blood request
   */
  async cancelRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('blood_requests')
        .update({
          status: 'cancelled'
        })
        .eq('id', requestId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error in cancelRequest:', error)
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const bloodRequestService = new BloodRequestService()

// Export getter function for consistency with other services
export const getBloodRequestService = () => bloodRequestService 