import { getSupabase } from "./supabase"

export interface WhatsAppMessage {
  to: string
  type: 'text' | 'template' | 'interactive' | 'media'
  content?: unknown
  template?: unknown
  language?: string
}

export interface WhatsAppTemplate {
  name: string
  language: string
  components: unknown[]
}

export interface WhatsAppInteractive {
  type: 'button' | 'list' | 'product' | 'product_list'
  header?: unknown
  body: unknown
  footer?: unknown
  action: unknown
}

export interface BloodRequest {
  blood_type: string;
  hospital_name: string;
  created_at: string;
}

export class WhatsAppBusinessService {
  private supabase = getSupabase()
  private apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0'
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
  private accessToken = process.env.WHATSAPP_ACCESS_TOKEN || ''

  /**
   * Send blood request notification via WhatsApp
   */
  async sendBloodRequestNotification(phoneNumber: string, requestData: Record<string, unknown>): Promise<boolean> {
    try {
      const message = {
        to: phoneNumber,
        type: 'interactive' as const,
        content: {
          type: 'button',
          header: {
            type: 'text',
            text: '🩸 Blood Request Alert'
          },
          body: {
            text: `New blood request in your area!\n\nBlood Type: ${requestData.blood_type}\nHospital: ${requestData.hospital_name}\nPatient: ${requestData.patient_name}\nUnits: ${requestData.units_needed}\nUrgency: ${requestData.emergency_level}`
          },
          footer: {
            text: 'BloodLink Africa'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: `accept_${requestData.id}`,
                  title: '✅ Accept'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: `decline_${requestData.id}`,
                  title: '❌ Decline'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: `details_${requestData.id}`,
                  title: '📋 Details'
                }
              }
            ]
          }
        }
      }

      return await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending blood request notification:', error)
      return false
    }
  }

  /**
   * Send emergency alert via WhatsApp
   */
  async sendEmergencyAlert(phoneNumber: string, alertData: Record<string, unknown>): Promise<boolean> {
    try {
      const message = {
        to: phoneNumber,
        type: 'interactive' as const,
        content: {
          type: 'button',
          header: {
            type: 'text',
            text: '🚨 EMERGENCY ALERT'
          },
          body: {
            text: `URGENT: ${alertData.type}\n\nLocation: ${alertData.location}\nBlood Type: ${alertData.blood_type}\nUnits Needed: ${alertData.units_needed}\nContact: ${alertData.contact_phone}`
          },
          footer: {
            text: 'BloodLink Africa - Emergency Response'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: `emergency_accept_${alertData.id}`,
                  title: '🚨 RESPOND NOW'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: `emergency_details_${alertData.id}`,
                  title: '📋 Full Details'
                }
              }
            ]
          }
        }
      }

      return await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending emergency alert:', error)
      return false
    }
  }

  /**
   * Send donor match notification
   */
  async sendDonorMatchNotification(phoneNumber: string, matchData: Record<string, unknown>): Promise<boolean> {
    try {
      const message = {
        to: phoneNumber,
        type: 'interactive' as const,
        content: {
          type: 'list',
          header: {
            type: 'text',
            text: '🎯 Donor Match Found!'
          },
          body: {
            text: `Great news! We found a compatible donor for your request.\n\nDonor: ${matchData.donor_name}\nBlood Type: ${matchData.blood_type}\nLocation: ${matchData.location}\nResponse Time: ${matchData.response_time} minutes`
          },
          footer: {
            text: 'BloodLink Africa'
          },
          action: {
            button: 'View Details',
            sections: [
              {
                title: 'Match Details',
                rows: [
                  {
                    id: `contact_donor_${matchData.id}`,
                    title: '📞 Contact Donor',
                    description: 'Call or message the donor directly'
                  },
                  {
                    id: `view_profile_${matchData.id}`,
                    title: '👤 View Profile',
                    description: 'See donor details and history'
                  },
                  {
                    id: `schedule_meeting_${matchData.id}`,
                    title: '📅 Schedule Meeting',
                    description: 'Arrange donation time and location'
                  }
                ]
              }
            ]
          }
        }
      }

      return await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending donor match notification:', error)
      return false
    }
  }

  /**
   * Send donation reminder
   */
  async sendDonationReminder(phoneNumber: string, reminderData: Record<string, unknown>): Promise<boolean> {
    try {
      const message = {
        to: phoneNumber,
        type: 'template' as const,
        template: {
          name: 'donation_reminder',
          language: {
            code: 'en'
          },
          components: [
            {
              type: 'header',
              parameters: [
                {
                  type: 'text',
                  text: reminderData.donor_name
                }
              ]
            },
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: reminderData.blood_type
                },
                {
                  type: 'text',
                  text: reminderData.location
                },
                {
                  type: 'text',
                  text: reminderData.date
                }
              ]
            },
            {
              type: 'button',
              sub_type: 'quick_reply',
              index: 0,
              parameters: [
                {
                  type: 'text',
                  text: 'Yes, I can donate'
                }
              ]
            }
          ]
        }
      }

      return await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending donation reminder:', error)
      return false
    }
  }

  /**
   * Send welcome message for new users
   */
  async sendWelcomeMessage(phoneNumber: string, userData: Record<string, unknown>): Promise<boolean> {
    try {
      const message = {
        to: phoneNumber,
        type: 'interactive' as const,
        content: {
          type: 'button',
          header: {
            type: 'text',
            text: '🩸 Welcome to BloodLink Africa!'
          },
          body: {
            text: `Hi ${userData.name}! Welcome to BloodLink Africa.\n\nYour blood type: ${userData.blood_type}\nLocation: ${userData.location}\n\nWe'll notify you about blood requests in your area.`
          },
          footer: {
            text: 'BloodLink Africa'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'update_profile',
                  title: '📝 Update Profile'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'view_requests',
                  title: '🩸 View Requests'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'help',
                  title: '❓ Help'
                }
              }
            ]
          }
        }
      }

      return await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending welcome message:', error)
      return false
    }
  }

  /**
   * Send blood request status update
   */
  async sendStatusUpdate(phoneNumber: string, statusData: Record<string, unknown>): Promise<boolean> {
    try {
      const statusEmoji = {
        'pending': '⏳',
        'in_progress': '🔄',
        'completed': '✅',
        'cancelled': '❌'
      }

      const message = {
        to: phoneNumber,
        type: 'text' as const,
        content: {
          text: `${statusEmoji[statusData.status as keyof typeof statusEmoji]} Blood Request Update\n\nRequest ID: ${statusData.request_id}\nStatus: ${statusData.status.toUpperCase()}\n\n${statusData.message || 'Your request has been updated.'}`
        }
      }

      return await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending status update:', error)
      return false
    }
  }

  /**
   * Send location-based blood request
   */
  async sendLocationBasedRequest(phoneNumber: string, requestData: Record<string, unknown>): Promise<boolean> {
    try {
      const message = {
        to: phoneNumber,
        type: 'interactive' as const,
        content: {
          type: 'button',
          header: {
            type: 'text',
            text: '📍 Nearby Blood Request'
          },
          body: {
            text: `Blood request near you!\n\nBlood Type: ${requestData.blood_type}\nDistance: ${requestData.distance}km\nHospital: ${requestData.hospital_name}\nUrgency: ${requestData.emergency_level}`
          },
          footer: {
            text: 'BloodLink Africa'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: `nearby_accept_${requestData.id}`,
                  title: '📍 I\'m Nearby'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: `nearby_details_${requestData.id}`,
                  title: '📋 Full Details'
                }
              }
            ]
          }
        }
      }

      return await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending location-based request:', error)
      return false
    }
  }

  /**
   * Handle incoming WhatsApp messages
   */
  async handleIncomingMessage(messageData: Record<string, unknown>): Promise<void> {
    try {
      const { from, text, type, interactive } = messageData

      if (type === 'text' && text) {
        await this.handleTextMessage(from, text.body)
      } else if (type === 'interactive' && interactive) {
        await this.handleInteractiveMessage(from, interactive)
      }
    } catch (error: any) {
      console.error('Error handling incoming message:', error)
    }
  }

  /**
   * Handle text messages
   */
  private async handleTextMessage(phoneNumber: string, text: string): Promise<void> {
    const lowerText = text.toLowerCase()

    if (lowerText.includes('help') || lowerText.includes('support')) {
      await this.sendHelpMessage(phoneNumber)
    } else if (lowerText.includes('status') || lowerText.includes('request')) {
      await this.sendRequestStatus(phoneNumber)
    } else if (lowerText.includes('donate') || lowerText.includes('available')) {
      await this.updateDonorStatus(phoneNumber, true)
    } else if (lowerText.includes('unavailable') || lowerText.includes('not available')) {
      await this.updateDonorStatus(phoneNumber, false)
    } else {
      await this.sendDefaultResponse(phoneNumber)
    }
  }

  /**
   * Handle interactive messages
   */
  private async handleInteractiveMessage(phoneNumber: string, interactive: Record<string, unknown>): Promise<void> {
    if (interactive.type === 'button_reply') {
      const buttonId = interactive.button_reply.id
      
      if (buttonId.startsWith('accept_')) {
        const requestId = buttonId.replace('accept_', '')
        await this.handleAcceptRequest(phoneNumber, requestId)
      } else if (buttonId.startsWith('decline_')) {
        const requestId = buttonId.replace('decline_', '')
        await this.handleDeclineRequest(phoneNumber, requestId)
      } else if (buttonId === 'update_profile') {
        await this.sendProfileUpdateMessage(phoneNumber)
      } else if (buttonId === 'help') {
        await this.sendHelpMessage(phoneNumber)
      }
    } else if (interactive.type === 'list_reply') {
      const listId = interactive.list_reply.id
      
      if (listId.startsWith('contact_donor_')) {
        const matchId = listId.replace('contact_donor_', '')
        await this.handleContactDonor(phoneNumber, matchId)
      }
    }
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(phoneNumber: string): Promise<void> {
    const message = {
      to: phoneNumber,
      type: 'text' as const,
      content: {
        text: `🩸 BloodLink Africa Help\n\nCommands:\n• "help" - Show this message\n• "status" - Check your requests\n• "donate" - Mark as available\n• "unavailable" - Mark as unavailable\n\nFor support: +1234567890`
      }
    }

    await this.sendMessage(message)
  }

  /**
   * Send request status
   */
  private async sendRequestStatus(phoneNumber: string): Promise<void> {
    try {
      const { data: requests } = await this.supabase
        .from('blood_requests')
        .select('*')
        .eq('contact_phone', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!requests || requests.length === 0) {
        const message = {
          to: phoneNumber,
          type: 'text' as const,
          content: {
            text: 'You have no active blood requests.'
          }
        }
        await this.sendMessage(message)
        return
      }

      let statusText = '🩸 Your Recent Requests:\n\n'
      requests.forEach((request: BloodRequest, index: number) => {
        statusText += `${index + 1}. ${request.blood_type} - ${request.status}\n   Hospital: ${request.hospital_name}\n   Date: ${new Date(request.created_at).toLocaleDateString()}\n\n`
      })

      const message = {
        to: phoneNumber,
        type: 'text' as const,
        content: {
          text: statusText
        }
      }

      await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error sending request status:', error)
    }
  }

  /**
   * Update donor status
   */
  private async updateDonorStatus(phoneNumber: string, available: boolean): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ available })
        .eq('phone', phoneNumber)

      if (error) throw error

      const status = available ? 'Available' : 'Not Available'
      const message = {
        to: phoneNumber,
        type: 'text' as const,
        content: {
          text: `✅ Status updated! You are now ${status} to donate blood.`
        }
      }

      await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error updating donor status:', error)
    }
  }

  /**
   * Send default response
   */
  private async sendDefaultResponse(phoneNumber: string): Promise<void> {
    const message = {
      to: phoneNumber,
      type: 'text' as const,
      content: {
        text: 'Thank you for your message! Type "help" for available commands or contact support for assistance.'
      }
    }

    await this.sendMessage(message)
  }

  /**
   * Handle accept request
   */
  private async handleAcceptRequest(phoneNumber: string, requestId: string): Promise<void> {
    try {
      // Get donor user
      const { data: donor } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone', phoneNumber)
        .single()

      if (!donor) {
        await this.sendMessage({
          to: phoneNumber,
          type: 'text' as const,
          content: {
            text: 'Please register first to respond to requests.'
          }
        })
        return
      }

      // Create donor response
      const { error } = await this.supabase
        .from('donor_responses')
        .insert({
          request_id: requestId,
          donor_id: donor.id,
          response_type: 'accept',
          eta_minutes: 60
        })

      if (error) throw error

      const message = {
        to: phoneNumber,
        type: 'text' as const,
        content: {
          text: '✅ Thank you! Your response has been recorded. The requester will be notified.'
        }
      }

      await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error handling accept request:', error)
    }
  }

  /**
   * Handle decline request
   */
  private async handleDeclineRequest(phoneNumber: string, requestId: string): Promise<void> {
    try {
      // Get donor user
      const { data: donor } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone', phoneNumber)
        .single()

      if (!donor) {
        await this.sendMessage({
          to: phoneNumber,
          type: 'text' as const,
          content: {
            text: 'Please register first to respond to requests.'
          }
        })
        return
      }

      // Create donor response
      const { error } = await this.supabase
        .from('donor_responses')
        .insert({
          request_id: requestId,
          donor_id: donor.id,
          response_type: 'decline'
        })

      if (error) throw error

      const message = {
        to: phoneNumber,
        type: 'text' as const,
        content: {
          text: 'Thank you for your response. We\'ll continue looking for other donors.'
        }
      }

      await this.sendMessage(message)
    } catch (error: any) {
      console.error('Error handling decline request:', error)
    }
  }

  /**
   * Send profile update message
   */
  private async sendProfileUpdateMessage(phoneNumber: string): Promise<void> {
    const message = {
      to: phoneNumber,
      type: 'text' as const,
      content: {
        text: 'To update your profile, please visit our website or contact support. You can also use our USSD service by dialing *123#'
      }
    }

    await this.sendMessage(message)
  }

  /**
   * Handle contact donor
   */
  private async handleContactDonor(phoneNumber: string, matchId: string): Promise<void> {
    const message = {
      to: phoneNumber,
      type: 'text' as const,
      content: {
        text: 'We\'ll connect you with the donor shortly. Please wait for their contact information.'
      }
    }

    await this.sendMessage(message)
  }

  /**
   * Send message via WhatsApp Business API
   */
  private async sendMessage(message: WhatsAppMessage): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to,
          type: message.type,
          [message.type]: message.content
        })
      })

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status}`)
      }

      const result = await response.json()
      console.log('WhatsApp message sent:', result)
      return true
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error)
      return false
    }
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageId: string): Promise<unknown> {
    try {
      const url = `${this.apiUrl}/${messageId}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status}`)
      }

      return await response.json()
    } catch (error: any) {
      console.error('Error getting message status:', error)
      return null
    }
  }

  /**
   * Get messaging statistics
   */
  async getMessagingStats(): Promise<unknown> {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}?fields=messaging_product,display_phone_number,quality_rating`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status}`)
      }

      return await response.json()
    } catch (error: any) {
      console.error('Error getting messaging stats:', error)
      return null
    }
  }
}

// Export singleton instance
export const whatsAppBusinessService = new WhatsAppBusinessService() 