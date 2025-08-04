"use client"

import { getSupabase } from "./supabase"

export interface USSDRequest {
  sessionId: string
  phoneNumber: string
  serviceCode: string
  text: string
  networkCode: string
}

export interface USSDResponse {
  sessionId: string
  message: string
  shouldClose: boolean
}

export interface USSDMenu {
  id: string
  title: string
  options: USSDMenuItem[]
}

export interface USSDMenuItem {
  key: string
  text: string
  action: string
  nextMenu?: string
}

export interface USSDSessionData {
  phoneNumber: string
  networkCode: string
  currentMenu: string
  userData: Record<string, unknown>
  step: number
  bloodType?: string
  patientName?: string
  hospitalName?: string
  unitsNeeded?: number
  user?: unknown
  requests?: unknown[]
}

export interface BloodRequest {
  id: string;
  blood_type: string;
  status: string;
  created_at: string;
}

export class USSDService {
  private supabase = getSupabase()
  private sessionData = new Map<string, USSDSessionData>()

  /**
   * Handle USSD request and return appropriate response
   */
  async handleUSSDRequest(request: USSDRequest): Promise<USSDResponse> {
    try {
      const { sessionId, phoneNumber, serviceCode, text, networkCode } = request
      
      // Parse the USSD text to determine current menu level
      const menuLevel = this.parseMenuLevel(text)
      const userInput = this.getLastUserInput(text)
      
      // Get or create session data
      let sessionData = this.sessionData.get(sessionId) || {
        phoneNumber,
        networkCode,
        currentMenu: 'main',
        userData: {},
        step: 0
      }

      // Handle based on menu level
      switch (menuLevel) {
        case 0:
          return this.showMainMenu(sessionId, sessionData)
        
        case 1:
          return this.handleMainMenuSelection(sessionId, sessionData, userInput)
        
        case 2:
          return this.handleSubMenuSelection(sessionId, sessionData, userInput)
        
        case 3:
          return this.handleFormInput(sessionId, sessionData, userInput)
        
        default:
          return this.showErrorMenu(sessionId, sessionData)
      }
    } catch (error: unknown) {
      console.error('USSD request error:', error)
      return {
        sessionId: request.sessionId,
        message: 'Sorry, an error occurred. Please try again.',
        shouldClose: true
      }
    }
  }

  /**
   * Show main USSD menu
   */
  private showMainMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
BloodLink Africa
================

1. Request Blood
2. Donate Blood
3. Check Status
4. Emergency Alert
5. My Profile
6. Help

Reply with option number
    `.trim()

    sessionData.currentMenu = 'main'
    sessionData.step = 0
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Handle main menu selection
   */
  private async handleMainMenuSelection(sessionId: string, sessionData: USSDSessionData, userInput: string): Promise<USSDResponse> {
    const option = parseInt(userInput)
    
    switch (option) {
      case 1:
        return this.showBloodRequestMenu(sessionId, sessionData)
      
      case 2:
        return this.showDonateBloodMenu(sessionId, sessionData)
      
      case 3:
        return this.showCheckStatusMenu(sessionId, sessionData)
      
      case 4:
        return this.showEmergencyAlertMenu(sessionId, sessionData)
      
      case 5:
        return this.showProfileMenu(sessionId, sessionData)
      
      case 6:
        return this.showHelpMenu(sessionId, sessionData)
      
      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Show blood request menu
   */
  private showBloodRequestMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
Blood Request
=============

1. A+ Blood
2. A- Blood
3. B+ Blood
4. B- Blood
5. AB+ Blood
6. AB- Blood
7. O+ Blood
8. O- Blood

Reply with blood type number
    `.trim()

    sessionData.currentMenu = 'blood_request'
    sessionData.step = 1
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Show donate blood menu
   */
  private showDonateBloodMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
Donate Blood
============

1. Available to Donate
2. Not Available
3. Schedule Donation
4. Check Eligibility

Reply with option number
    `.trim()

    sessionData.currentMenu = 'donate_blood'
    sessionData.step = 1
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Show check status menu
   */
  private async showCheckStatusMenu(sessionId: string, sessionData: USSDSessionData): Promise<USSDResponse> {
    try {
      // Get user's recent requests
      const { data: requests } = await this.supabase
        .from('blood_requests')
        .select('*')
        .eq('contact_phone', sessionData.phoneNumber)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!requests || requests.length === 0) {
        return {
          sessionId,
          message: 'No blood requests found for this number.',
          shouldClose: true
        }
      }

      let menu = 'Recent Blood Requests\n==================\n\n'
      
      requests.forEach((request: BloodRequest, index: number) => {
        const status = request.status === 'completed' ? 'COMPLETED' : 
                      request.status === 'in_progress' ? 'IN PROGRESS' : 'PENDING'
        const date = new Date(request.created_at).toLocaleDateString()
        
        menu += `${index + 1}. ${request.blood_type} - ${status}\n   Date: ${date}\n\n`
      })

      menu += 'Reply with request number for details'

      sessionData.currentMenu = 'check_status'
      sessionData.requests = requests
      this.sessionData.set(sessionId, sessionData)

      return {
        sessionId,
        message: menu,
        shouldClose: false
      }
    } catch (error: unknown) {
      console.error('Error checking status:', error)
      return {
        sessionId,
        message: 'Error retrieving status. Please try again.',
        shouldClose: true
      }
    }
  }

  /**
   * Show emergency alert menu
   */
  private showEmergencyAlertMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
Emergency Alert
===============

1. Critical Blood Need
2. Natural Disaster
3. Mass Casualty
4. Hospital Emergency

Reply with emergency type
    `.trim()

    sessionData.currentMenu = 'emergency_alert'
    sessionData.step = 1
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Show profile menu
   */
  private async showProfileMenu(sessionId: string, sessionData: USSDSessionData): Promise<USSDResponse> {
    try {
      // Get user profile
      const { data: user } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone', sessionData.phoneNumber)
        .single()

      if (!user) {
        return {
          sessionId,
          message: 'Profile not found. Please register first.',
          shouldClose: true
        }
      }

      const menu = `
My Profile
==========

Name: ${user.name}
Blood Type: ${user.blood_type}
Location: ${user.location}
Status: ${user.available ? 'Available' : 'Not Available'}

1. Update Status
2. Change Location
3. View History
4. Back to Main Menu

Reply with option number
      `.trim()

      sessionData.currentMenu = 'profile'
      sessionData.user = user
      this.sessionData.set(sessionId, sessionData)

      return {
        sessionId,
        message: menu,
        shouldClose: false
      }
    } catch (error: unknown) {
      console.error('Error showing profile:', error)
      return {
        sessionId,
        message: 'Error loading profile. Please try again.',
        shouldClose: true
      }
    }
  }

  /**
   * Show help menu
   */
  private showHelpMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
Help & Support
==============

1. How to Request Blood
2. How to Donate Blood
3. Emergency Procedures
4. Contact Support
5. Back to Main Menu

Reply with option number
    `.trim()

    sessionData.currentMenu = 'help'
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Handle sub-menu selection
   */
  private async handleSubMenuSelection(sessionId: string, sessionData: USSDSessionData, userInput: string): Promise<USSDResponse> {
    const { currentMenu } = sessionData

    switch (currentMenu) {
      case 'blood_request':
        return this.handleBloodTypeSelection(sessionId, sessionData, userInput)
      
      case 'donate_blood':
        return this.handleDonateBloodSelection(sessionId, sessionData, userInput)
      
      case 'emergency_alert':
        return this.handleEmergencyAlertSelection(sessionId, sessionData, userInput)
      
      case 'profile':
        return this.handleProfileSelection(sessionId, sessionData, userInput)
      
      case 'help':
        return this.handleHelpSelection(sessionId, sessionData, userInput)
      
      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Handle blood type selection for request
   */
  private async handleBloodTypeSelection(sessionId: string, sessionData: USSDSessionData, userInput: string): Promise<USSDResponse> {
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    const selectedIndex = parseInt(userInput) - 1

    if (selectedIndex < 0 || selectedIndex >= bloodTypes.length) {
      return this.showInvalidOption(sessionId, sessionData)
    }

    const bloodType = bloodTypes[selectedIndex]
    sessionData.bloodType = bloodType
    sessionData.step = 2

    const menu = `
Blood Type: ${bloodType}

Enter patient name:
    `.trim()

    sessionData.currentMenu = 'blood_request_form'
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Handle donate blood selection
   */
  private async handleDonateBloodSelection(sessionId: string, sessionData: USSDSessionData, userInput: string): Promise<USSDResponse> {
    const option = parseInt(userInput)

    switch (option) {
      case 1:
        // Available to donate
        return this.updateDonorStatus(sessionId, sessionData, true)
      
      case 2:
        // Not available
        return this.updateDonorStatus(sessionId, sessionData, false)
      
      case 3:
        return this.showScheduleDonationMenu(sessionId, sessionData)
      
      case 4:
        return this.showEligibilityCheck(sessionId, sessionData)
      
      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Update donor availability status
   */
  private async updateDonorStatus(sessionId: string, sessionData: USSDSessionData, available: boolean): Promise<USSDResponse> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ available })
        .eq('phone', sessionData.phoneNumber)

      if (error) throw error

      const status = available ? 'Available' : 'Not Available'
      const message = `
Status Updated
==============

You are now: ${status}

Thank you for updating your status!
      `.trim()

      return {
        sessionId,
        message,
        shouldClose: true
      }
    } catch (error: unknown) {
      console.error('Error updating donor status:', error)
      return {
        sessionId,
        message: 'Error updating status. Please try again.',
        shouldClose: true
      }
    }
  }

  /**
   * Handle form input
   */
  private async handleFormInput(sessionId: string, sessionData: USSDSessionData, userInput: string): Promise<USSDResponse> {
    const { currentMenu } = sessionData

    switch (currentMenu) {
      case 'blood_request_form':
        return this.handleBloodRequestForm(sessionId, sessionData, userInput)
      
      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Handle blood request form
   */
  private async handleBloodRequestForm(sessionId: string, sessionData: USSDSessionData, userInput: string): Promise<USSDResponse> {
    const { step } = sessionData

    switch (step) {
      case 2:
        // Patient name
        sessionData.patientName = userInput
        sessionData.step = 3
        
        const menu = `
Patient Name: ${userInput}

Enter hospital name:
        `.trim()

        sessionData.currentMenu = 'blood_request_form'
        this.sessionData.set(sessionId, sessionData)

        return {
          sessionId,
          message: menu,
          shouldClose: false
        }

      case 3:
        // Hospital name
        sessionData.hospitalName = userInput
        sessionData.step = 4
        
        const menu2 = `
Hospital: ${userInput}

Enter units needed (1-10):
        `.trim()

        sessionData.currentMenu = 'blood_request_form'
        this.sessionData.set(sessionId, sessionData)

        return {
          sessionId,
          message: menu2,
          shouldClose: false
        }

      case 4:
        // Units needed
        const units = parseInt(userInput)
        if (units < 1 || units > 10) {
          return {
            sessionId,
            message: 'Please enter a number between 1 and 10.',
            shouldClose: false
          }
        }

        sessionData.unitsNeeded = units
        return this.submitBloodRequest(sessionId, sessionData)

      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Submit blood request
   */
  private async submitBloodRequest(sessionId: string, sessionData: USSDSessionData): Promise<USSDResponse> {
    try {
      const { bloodType, patientName, hospitalName, unitsNeeded, phoneNumber } = sessionData

      const { data, error } = await this.supabase
        .from('blood_requests')
        .insert({
          blood_type: bloodType,
          patient_name: patientName,
          hospital_name: hospitalName,
          units_needed: unitsNeeded,
          contact_phone: phoneNumber,
          emergency_level: 'normal',
          status: 'pending',
          location: 'Unknown', // Will be updated when location is available
        })
        .select()

      if (error) throw error

      const requestId = data && data.length > 0 ? data[0].id : 'N/A'
      
      const message = `
Blood Request Submitted
======================

Blood Type: ${bloodType}
Patient: ${patientName}
Hospital: ${hospitalName}
Units: ${unitsNeeded}

Request ID: ${requestId}

We will notify you when donors are found.
      `.trim()

      return {
        sessionId,
        message,
        shouldClose: true
      }
    } catch (error: unknown) {
      console.error('Error submitting blood request:', error)
      return {
        sessionId,
        message: 'Error submitting request. Please try again.',
        shouldClose: true
      }
    }
  }

  /**
   * Show invalid option message
   */
  private showInvalidOption(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    return {
      sessionId,
      message: 'Invalid option. Please try again.',
      shouldClose: false
    }
  }

  /**
   * Show error menu
   */
  private showErrorMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    return {
      sessionId,
      message: 'An error occurred. Please try again.',
      shouldClose: true
    }
  }

  /**
   * Parse menu level from USSD text
   */
  private parseMenuLevel(text: string): number {
    if (!text) return 0
    return text.split('*').length
  }

  /**
   * Get last user input from USSD text
   */
  private getLastUserInput(text: string): string {
    if (!text) return ''
    const parts = text.split('*')
    return parts[parts.length - 1]
  }

  /**
   * Clean up session data
   */
  cleanupSession(sessionId: string): void {
    this.sessionData.delete(sessionId)
  }

  /**
   * Handle emergency alert selection
   */
  private handleEmergencyAlertSelection(sessionId: string, sessionData: USSDSessionData, userInput: string): USSDResponse {
    const option = parseInt(userInput)
    
    switch (option) {
      case 1:
      case 2:
      case 3:
      case 4:
        const emergencyTypes = ['Critical Blood Need', 'Natural Disaster', 'Mass Casualty', 'Hospital Emergency']
        const selectedType = emergencyTypes[option - 1]
        
        const message = `
Emergency Alert Sent
===================

Type: ${selectedType}
Status: Processing

Emergency services have been notified.
        `.trim()
        
        return {
          sessionId,
          message,
          shouldClose: true
        }
      
      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Handle profile selection
   */
  private handleProfileSelection(sessionId: string, sessionData: USSDSessionData, userInput: string): USSDResponse {
    const option = parseInt(userInput)
    
    switch (option) {
      case 1:
        return this.showUpdateStatusMenu(sessionId, sessionData)
      case 2:
        return this.showChangeLocationMenu(sessionId, sessionData)
      case 3:
        return this.showHistoryMenu(sessionId, sessionData)
      case 4:
        return this.showMainMenu(sessionId, sessionData)
      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Handle help selection
   */
  private handleHelpSelection(sessionId: string, sessionData: USSDSessionData, userInput: string): USSDResponse {
    const option = parseInt(userInput)
    
    switch (option) {
      case 1:
      case 2:
      case 3:
      case 4:
        const helpTopics = [
          'How to Request Blood',
          'How to Donate Blood', 
          'Emergency Procedures',
          'Contact Support'
        ]
        const selectedTopic = helpTopics[option - 1]
        
        const message = `
${selectedTopic}
================

For detailed information, please visit our website or contact support.
        `.trim()
        
        return {
          sessionId,
          message,
          shouldClose: true
        }
      
      case 5:
        return this.showMainMenu(sessionId, sessionData)
      
      default:
        return this.showInvalidOption(sessionId, sessionData)
    }
  }

  /**
   * Show schedule donation menu
   */
  private showScheduleDonationMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
Schedule Donation
=================

1. Today
2. Tomorrow
3. This Week
4. Next Week

Reply with option number
    `.trim()

    sessionData.currentMenu = 'schedule_donation'
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Show eligibility check
   */
  private showEligibilityCheck(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const message = `
Eligibility Check
=================

You are eligible to donate blood if:
- Age 18-65 years
- Weight > 50kg
- No recent illness
- No tattoos in last 6 months

Contact nearest blood bank for full screening.
    `.trim()

    return {
      sessionId,
      message,
      shouldClose: true
    }
  }

  /**
   * Show update status menu
   */
  private showUpdateStatusMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
Update Status
=============

1. Available to Donate
2. Not Available
3. Temporarily Unavailable

Reply with option number
    `.trim()

    sessionData.currentMenu = 'update_status'
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Show change location menu
   */
  private showChangeLocationMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const menu = `
Change Location
===============

Enter your new location:
    `.trim()

    sessionData.currentMenu = 'change_location'
    this.sessionData.set(sessionId, sessionData)

    return {
      sessionId,
      message: menu,
      shouldClose: false
    }
  }

  /**
   * Show history menu
   */
  private showHistoryMenu(sessionId: string, sessionData: USSDSessionData): USSDResponse {
    const message = `
Donation History
================

Contact support for detailed history.
    `.trim()

    return {
      sessionId,
      message,
      shouldClose: true
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): { totalSessions: number; activeSessions: number } {
    return {
      totalSessions: this.sessionData.size,
      activeSessions: this.sessionData.size
    }
  }
}

// Export singleton instance
export const ussdService = new USSDService() 