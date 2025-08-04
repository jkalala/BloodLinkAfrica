"use server"

import { aiMatchingService } from "@/lib/ai-matching-service"
import { blockchainService } from "@/lib/blockchain-service"
import { iotService } from "@/lib/iot-service"
import { analyticsService } from "@/lib/analytics-service"

/**
 * AI-Powered Matching Actions
 */
export async function findOptimalDonors(
  requestId: string,
  bloodType: string,
  urgency: string,
  location: string
) {
  try {
    const predictions = await aiMatchingService.findOptimalDonors(
      requestId,
      bloodType,
      urgency,
      location
    )
    return { success: true, data: predictions }
  } catch (error: any) {
    console.error('Error finding optimal donors:', error)
    return { success: false, error: error.message }
  }
}

export async function updateDonorProfile(donorId: string) {
  try {
    await aiMatchingService.updateDonorProfile(donorId)
    return { success: true }
  } catch (error: any) {
    console.error('Error updating donor profile:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Blockchain Tracking Actions
 */
export async function trackBloodRequest(requestData: any) {
  try {
    await blockchainService.trackBloodRequest(requestData)
    return { success: true }
  } catch (error: any) {
    console.error('Error tracking blood request:', error)
    return { success: false, error: error.message }
  }
}

export async function trackDonorResponse(responseData: any) {
  try {
    await blockchainService.trackDonorResponse(responseData)
    return { success: true }
  } catch (error: any) {
    console.error('Error tracking donor response:', error)
    return { success: false, error: error.message }
  }
}

export async function trackDonationCompletion(completionData: any) {
  try {
    await blockchainService.trackDonationCompletion(completionData)
    return { success: true }
  } catch (error: any) {
    console.error('Error tracking donation completion:', error)
    return { success: false, error: error.message }
  }
}

export async function getDonationTrace(requestId: string) {
  try {
    const trace = await blockchainService.getDonationTrace(requestId)
    return { success: true, data: trace }
  } catch (error: any) {
    console.error('Error getting donation trace:', error)
    return { success: false, error: error.message }
  }
}

export async function verifyBlockchainIntegrity() {
  try {
    const result = await blockchainService.verifyBlockchainIntegrity()
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Error verifying blockchain integrity:', error)
    return { success: false, error: error.message }
  }
}

export async function getBlockchainStats() {
  try {
    const stats = await blockchainService.getBlockchainStats()
    return { success: true, data: stats }
  } catch (error: any) {
    console.error('Error getting blockchain stats:', error)
    return { success: false, error: error.message }
  }
}

/**
 * IoT Monitoring Actions
 */
export async function initializeIoTMonitoring() {
  try {
    await iotService.initializeIoTMonitoring()
    return { success: true }
  } catch (error: any) {
    console.error('Error initializing IoT monitoring:', error)
    return { success: false, error: error.message }
  }
}

export async function registerIoTDevice(deviceData: any) {
  try {
    const result = await iotService.registerDevice(deviceData)
    return result
  } catch (error: any) {
    console.error('Error registering IoT device:', error)
    return { success: false, error: error.message }
  }
}

export async function getIoTDashboardData() {
  try {
    const data = await iotService.getIoTDashboardData()
    return { success: true, data }
  } catch (error: any) {
    console.error('Error getting IoT dashboard data:', error)
    return { success: false, error: error.message }
  }
}

export async function getDeviceDetails(deviceId: string) {
  try {
    const details = await iotService.getDeviceDetails(deviceId)
    return { success: true, data: details }
  } catch (error: any) {
    console.error('Error getting device details:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Advanced Analytics Actions
 */
export async function getAnalyticsData() {
  try {
    const data = await analyticsService.getAnalyticsData()
    return { success: true, data }
  } catch (error: any) {
    console.error('Error getting analytics data:', error)
    return { success: false, error: error.message }
  }
}

export async function getDonorAnalytics(donorId: string) {
  try {
    const analytics = await analyticsService.getDonorAnalytics(donorId)
    return { success: true, data: analytics }
  } catch (error: any) {
    console.error('Error getting donor analytics:', error)
    return { success: false, error: error.message }
  }
}

export async function getRequestAnalytics(requestId: string) {
  try {
    const analytics = await analyticsService.getRequestAnalytics(requestId)
    return { success: true, data: analytics }
  } catch (error: any) {
    console.error('Error getting request analytics:', error)
    return { success: false, error: error.message }
  }
} 