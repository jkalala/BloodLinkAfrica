"use server"

import { notificationService } from "@/lib/notification-service"

/**
 * Get notifications for the current user
 */
export async function getUserNotifications(userId: string) {
  try {
    return await notificationService.getUserNotifications(userId)
  } catch (error: any) {
    console.error('Error in getUserNotifications action:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch notifications'
    }
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    return await notificationService.markNotificationAsRead(notificationId)
  } catch (error: any) {
    console.error('Error in markNotificationAsRead action:', error)
    return {
      success: false,
      error: error.message || 'Failed to mark notification as read'
    }
  }
}

/**
 * Send emergency alert
 */
export async function sendEmergencyAlert(
  bloodType: string,
  hospital: string,
  location: string,
  urgency: string
) {
  try {
    return await notificationService.sendEmergencyAlert(bloodType, hospital, location, urgency)
  } catch (error: any) {
    console.error('Error in sendEmergencyAlert action:', error)
    return {
      success: false,
      error: error.message || 'Failed to send emergency alert'
    }
  }
}

/**
 * Send blood request notification
 */
export async function sendBloodRequestNotification(
  requestId: string,
  bloodType: string,
  hospital: string,
  location: string,
  donors: Array<{ id: string; name: string; distance: number }>
) {
  try {
    return await notificationService.sendBloodRequestNotification(
      requestId,
      bloodType,
      hospital,
      location,
      donors
    )
  } catch (error: any) {
    console.error('Error in sendBloodRequestNotification action:', error)
    return {
      success: false,
      error: error.message || 'Failed to send blood request notification'
    }
  }
}

/**
 * Send donor match notification
 */
export async function sendDonorMatchNotification(
  requestId: string,
  donorId: string,
  donorName: string,
  bloodType: string,
  hospital: string
) {
  try {
    return await notificationService.sendDonorMatchNotification(
      requestId,
      donorId,
      donorName,
      bloodType,
      hospital
    )
  } catch (error: any) {
    console.error('Error in sendDonorMatchNotification action:', error)
    return {
      success: false,
      error: error.message || 'Failed to send donor match notification'
    }
  }
}

/**
 * Send donation reminder
 */
export async function sendDonationReminder(userId: string, userName: string) {
  try {
    return await notificationService.sendDonationReminder(userId, userName)
  } catch (error: any) {
    console.error('Error in sendDonationReminder action:', error)
    return {
      success: false,
      error: error.message || 'Failed to send donation reminder'
    }
  }
}

/**
 * Process pending notifications (background job)
 */
export async function processPendingNotifications() {
  try {
    return await notificationService.processPendingNotifications()
  } catch (error: any) {
    console.error('Error in processPendingNotifications action:', error)
    return {
      success: false,
      processed: 0,
      error: error.message || 'Failed to process notifications'
    }
  }
} 