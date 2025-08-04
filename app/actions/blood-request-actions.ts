"use server"

import { bloodRequestService, type BloodRequest } from "@/lib/blood-request-service"

/**
 * Create a new blood request
 */
export async function createBloodRequest(requestData: {
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
}) {
  try {
    const result = await bloodRequestService.createRequest(requestData)
    return result
  } catch (error: any) {
    console.error('Error in createBloodRequest action:', error)
    return {
      success: false,
      error: error.message || 'Failed to create blood request'
    }
  }
}

/**
 * Get all blood requests with optional filtering
 */
export async function getBloodRequests(filters?: {
  status?: string
  bloodType?: string
  urgency?: string
  location?: string
}) {
  try {
    return await bloodRequestService.getBloodRequests(filters)
  } catch (error: any) {
    console.error('Error in getBloodRequests action:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch blood requests'
    }
  }
}

/**
 * Respond to a blood request as a donor
 */
export async function respondToBloodRequest(
  requestId: string,
  responseType: 'accept' | 'decline' | 'maybe',
  etaMinutes?: number,
  notes?: string
) {
  try {
    const result = await bloodRequestService.respondToRequest(
      requestId,
      responseType,
      etaMinutes,
      notes
    )
    return result
  } catch (error: any) {
    console.error('Error in respondToBloodRequest action:', error)
    return {
      success: false,
      error: error.message || 'Failed to respond to blood request'
    }
  }
}

/**
 * Get donor responses for a specific request
 */
export async function getDonorResponses(requestId: string) {
  try {
    return await bloodRequestService.getDonorResponses(requestId)
  } catch (error: any) {
    console.error('Error in getDonorResponses action:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch donor responses'
    }
  }
}

/**
 * Complete a blood request
 */
export async function completeBloodRequest(requestId: string) {
  try {
    const result = await bloodRequestService.completeRequest(requestId)
    return result
  } catch (error: any) {
    console.error('Error in completeBloodRequest action:', error)
    return {
      success: false,
      error: error.message || 'Failed to complete blood request'
    }
  }
}

/**
 * Cancel a blood request
 */
export async function cancelBloodRequest(requestId: string) {
  try {
    const result = await bloodRequestService.cancelRequest(requestId)
    return result
  } catch (error: any) {
    console.error('Error in cancelBloodRequest action:', error)
    return {
      success: false,
      error: error.message || 'Failed to cancel blood request'
    }
  }
}

/**
 * Find compatible donors for a request
 */
export async function findCompatibleDonors(requestId: string) {
  try {
    return await bloodRequestService.findCompatibleDonors(requestId)
  } catch (error: any) {
    console.error('Error in findCompatibleDonors action:', error)
    return []
  }
} 