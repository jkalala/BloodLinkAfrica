"use server"

import { getSupabase } from "./supabase"
import { BloodRequestService } from "./blood-request-service"
import { NotificationService } from "./notification-service"

export interface WhatsAppMessage {
  to: string
  type: 'text' | 'template' | 'interactive'
  text?: string
  template?: {
    name: string
    language: {
      code: string
    }
    components?: unknown[]
  }
  interactive?: {
    type: 'button' | 'list' | 'product' | 'product_list'
    body?: {
      text: string
    }
    action?: {
      buttons?: Array<{
        type: 'reply'
        reply: {
          id: string
          title: string
        }
      }>
      sections?: unknown[]
    }
  }
}

export interface WhatsAppResponse {
  messaging_product: string
  contacts: Array<{
    input: string
    wa_id: string
  }>
  messages: Array<{
    id: string
  }>
}

export interface BloodRequest {
  blood_type: string;
  hospital_name: string;
  created_at: string;
  status: string;
  response_count: number;
}

export class WhatsAppService {
  private supabase = getSupabase()
  private bloodRequestService = new BloodRequestService()
  private notificationService = new NotificationService()
  private apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0'
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
  private accessToken = process.env.WHATSAPP_ACCESS_TOKEN || ''

  constructor() {
    // Initialize service
  }

  private async sendMessage(message: WhatsAppMessage): Promise<WhatsAppResponse | null> {
    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        console.error('WhatsApp API error:', response.status, response.statusText)
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      return null
    }
  }

  public async sendBloodRequestNotification(request: Record<string, unknown>, donorPhone: string): Promise<boolean> {
    try {
      const urgencyEmoji = request.urgency === 'critical' ? '🚨' : request.urgency === 'urgent' ? '⚠️' : '🩸'
      
      const message: WhatsAppMessage = {
        to: donorPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: `${urgencyEmoji} BLOOD REQUEST\n\nBlood Type: ${request.blood_type}\nHospital: ${request.hospital_name}\nPatient: ${request.patient_name}\nUnits Needed: ${request.units_needed}\nUrgency: ${request.urgency.toUpperCase()}\n\nCan you help?`
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: `accept_${request.id}`,
                  title: '✅ Accept'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: `decline_${request.id}`,
                  title: '❌ Decline'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: `maybe_${request.id}`,
                  title: '🤔 Maybe'
                }
              }
            ]
          }
        }
      }

      const result = await this.sendMessage(message)
      return result !== null
    } catch (error) {
      console.error('Error sending blood request notification:', error)
      return false
    }
  }

  public async sendEmergencyAlert(alert: Record<string, unknown>, donorPhone: string): Promise<boolean> {
    try {
      const message: WhatsAppMessage = {
        to: donorPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: `🚨 EMERGENCY ALERT\n\n${alert.message}\n\nThis is a critical emergency requiring immediate response.`
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: `emergency_respond_${alert.id}`,
                  title: '🚨 Respond Now'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: `emergency_info_${alert.id}`,
                  title: 'ℹ️ More Info'
                }
              }
            ]
          }
        }
      }

      const result = await this.sendMessage(message)
      return result !== null
    } catch (error) {
      console.error('Error sending emergency alert:', error)
      return false
    }
  }

  public async sendDonorMatchNotification(request: Record<string, unknown>, donor: Record<string, unknown>): Promise<boolean> {
    try {
      const message: WhatsAppMessage = {
        to: request.contact_phone,
        type: 'text',
        text: `✅ DONOR FOUND!\n\nGreat news! ${donor.name} has accepted your blood request.\n\nBlood Type: ${request.blood_type}\nHospital: ${request.hospital_name}\n\nContact: ${donor.phone}\n\nPlease coordinate with the donor for donation details.`
      }

      const result = await this.sendMessage(message)
      return result !== null
    } catch (error) {
      console.error('Error sending donor match notification:', error)
      return false
    }
  }

  public async sendDonationReminder(user: Record<string, unknown>): Promise<boolean> {
    try {
      const message: WhatsAppMessage = {
        to: user.phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: `🩸 Donation Reminder\n\nHi ${user.name},\n\nIt's time for your next blood donation! Your last donation was ${user.last_donation || 'unknown'}.\n\nHelp save lives by donating blood.`
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'schedule_donation',
                  title: '📅 Schedule'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'find_center',
                  title: '🏥 Find Center'
                }
              }
            ]
          }
        }
      }

      const result = await this.sendMessage(message)
      return result !== null
    } catch (error) {
      console.error('Error sending donation reminder:', error)
      return false
    }
  }

  public async sendWelcomeMessage(user: Record<string, unknown>): Promise<boolean> {
    try {
      const message: WhatsAppMessage = {
        to: user.phone,
        type: 'text',
        text: `🎉 Welcome to BloodLink Africa!\n\nHi ${user.name},\n\nThank you for joining our blood donation community. You're now registered as a ${user.blood_type} donor.\n\nWe'll notify you when there are blood requests that match your type.\n\nTo update your availability, reply with:\n- AVAILABLE: Set yourself as available\n- UNAVAILABLE: Set yourself as unavailable\n- HELP: Get assistance\n\nThank you for helping save lives! 🩸`
      }

      const result = await this.sendMessage(message)
      return result !== null
    } catch (error) {
      console.error('Error sending welcome message:', error)
      return false
    }
  }

  public async handleIncomingMessage(from: string, message: string): Promise<void> {
    try {
      // Get user by phone number
      const { data: user } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone', from)
        .single()

      if (!user) {
        await this.sendMessage({
          to: from,
          type: 'text',
          text: 'Welcome to BloodLink Africa! Please register first by visiting our website or using USSD service.'
        })
        return
      }

      // Handle different message types
      const upperMessage = message.toUpperCase()
      
      if (upperMessage.includes('AVAILABLE')) {
        await this.handleAvailabilityUpdate(user, true)
      } else if (upperMessage.includes('UNAVAILABLE')) {
        await this.handleAvailabilityUpdate(user, false)
      } else if (upperMessage.includes('HELP')) {
        await this.sendHelpMessage(from)
      } else if (upperMessage.includes('REQUEST')) {
        await this.sendBloodRequestForm(from)
      } else if (upperMessage.includes('STATUS')) {
        await this.sendRequestStatus(from, user)
      } else {
        await this.sendDefaultResponse(from)
      }
    } catch (error) {
      console.error('Error handling incoming WhatsApp message:', error)
    }
  }

  private async handleAvailabilityUpdate(user: Record<string, unknown>, available: boolean): Promise<void> {
    try {
      // Update user availability
      const { error } = await this.supabase
        .from('users')
        .update({ available })
        .eq('id', user.id)

      if (error) throw error

      const status = available ? 'available' : 'unavailable'
      await this.sendMessage({
        to: user.phone,
        type: 'text',
        text: `✅ Status updated! You are now ${status} for blood donations.`
      })
    } catch (error) {
      console.error('Error updating availability:', error)
    }
  }

  private async sendHelpMessage(to: string): Promise<void> {
    const helpText = `🩸 BloodLink Africa Help

Available commands:
- AVAILABLE: Set yourself as available
- UNAVAILABLE: Set yourself as unavailable  
- REQUEST: Submit a blood request
- STATUS: Check your request status
- HELP: Show this help message

For urgent assistance, call: +1234567890

Thank you for helping save lives! 🩸`

    await this.sendMessage({
      to,
      type: 'text',
      text: helpText
    })
  }

  private async sendBloodRequestForm(to: string): Promise<void> {
    const formText = `🩸 Blood Request Form

To submit a blood request, please provide the following information:

Patient Name:
Hospital Name:
Blood Type (A+, A-, B+, B-, AB+, AB-, O+, O-):
Units Needed:
Urgency (Normal/Urgent/Critical):
Contact Name:

Please send all information in one message.`

    await this.sendMessage({
      to,
      type: 'text',
      text: formText
    })
  }

  private async sendRequestStatus(to: string, user: Record<string, unknown>): Promise<void> {
    try {
      const { data: requests } = await this.supabase
        .from('blood_requests')
        .select('*')
        .eq('contact_phone', user.phone)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!requests || requests.length === 0) {
        await this.sendMessage({
          to,
          type: 'text',
          text: 'You haven\'t made any blood requests yet.'
        })
        return
      }

      let statusText = '📋 Your Recent Requests:\n\n'
      requests.forEach((req: BloodRequest, index: number) => {
        statusText += `${index + 1}. ${req.blood_type} - ${req.hospital_name}\n`
        statusText += `   Status: ${req.status.toUpperCase()}\n`
        statusText += `   Responses: ${req.response_count || 0}\n\n`
      })

      await this.sendMessage({
        to,
        type: 'text',
        text: statusText
      })
    } catch (error) {
      console.error('Error sending request status:', error)
    }
  }

  private async sendDefaultResponse(to: string): Promise<void> {
    await this.sendMessage({
      to,
      type: 'text',
      text: 'Thank you for your message! Reply HELP for available commands or contact us for assistance.'
    })
  }

  public async broadcastEmergencyAlert(alert: Record<string, unknown>, bloodType: string): Promise<number> {
    try {
      // Get compatible donors
      const { data: donors } = await this.supabase
        .from('users')
        .select('phone, blood_type, available, receive_alerts')
        .eq('blood_type', bloodType)
        .eq('available', true)
        .eq('receive_alerts', true)

      if (!donors || donors.length === 0) {
        return 0
      }

      let successCount = 0
      for (const donor of donors) {
        const success = await this.sendEmergencyAlert(alert, donor.phone)
        if (success) successCount++
      }

      return successCount
    } catch (error) {
      console.error('Error broadcasting emergency alert:', error)
      return 0
    }
  }

  public async sendBulkNotification(message: string, phoneNumbers: string[]): Promise<number> {
    try {
      let successCount = 0
      
      for (const phone of phoneNumbers) {
        const success = await this.sendMessage({
          to: phone,
          type: 'text',
          text: message
        })
        
        if (success) successCount++
      }

      return successCount
    } catch (error) {
      console.error('Error sending bulk notification:', error)
      return 0
    }
  }
}

// Singleton instance
let whatsappService: WhatsAppService | null = null

export const getWhatsAppService = (): WhatsAppService => {
  if (!whatsappService) {
    whatsappService = new WhatsAppService()
  }
  return whatsappService
} 