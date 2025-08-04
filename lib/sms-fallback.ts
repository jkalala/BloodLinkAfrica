"use client"

type SMSConfig = {
  apiKey?: string
  useUSSD: boolean
  phoneNumber?: string
}

export class SMSFallback {
  private config: SMSConfig

  constructor(config: SMSConfig) {
    this.config = {
      useUSSD: true,
      ...config,
    }
  }

  /**
   * Send an emergency blood request via SMS
   */
  public async sendEmergencyRequest(data: {
    bloodType: string
    hospital: string
    units: number
    contactPhone: string
  }): Promise<boolean> {
    try {
      // In a real app, this would use an SMS gateway API
      // For now, we'll just simulate the SMS sending

      const message = this.formatEmergencyMessage(data)

      if (this.config.useUSSD) {
        return this.simulateUSSDRequest(message)
      } else {
        return this.simulateSMSSend(message)
      }
    } catch (error) {
      console.error("Failed to send SMS:", error)
      return false
    }
  }

  /**
   * Send a notification to a donor via SMS
   */
  public async notifyDonor(data: {
    donorPhone: string
    bloodType: string
    hospital: string
    urgency: "normal" | "urgent" | "emergency"
  }): Promise<boolean> {
    try {
      const message = this.formatDonorMessage(data)
      return this.simulateSMSSend(message, data.donorPhone)
    } catch (error) {
      console.error("Failed to notify donor via SMS:", error)
      return false
    }
  }

  /**
   * Process an incoming SMS response from a donor
   */
  public processDonorResponse(
    message: string,
    fromNumber: string,
  ): {
    accepted: boolean
    donorPhone: string
    requestId?: string
  } {
    // Simple parsing of SMS responses
    // In a real app, this would be more sophisticated
    const accepted = message.trim().toLowerCase() === "yes"

    // Extract request ID if present (format: "YES #12345")
    let requestId: string | undefined
    const match = message.match(/#(\w+)/)
    if (match && match[1]) {
      requestId = match[1]
    }

    return {
      accepted,
      donorPhone: fromNumber,
      requestId,
    }
  }

  private formatEmergencyMessage(data: unknown): string {
    return `URGENT: ${data.bloodType} blood needed at ${data.hospital}. ${data.units} unit(s) required. Contact: ${data.contactPhone}. Reply YES to confirm.`
  }

  private formatDonorMessage(data: unknown): string {
    const urgencyText = data.urgency === "emergency" ? "EMERGENCY" : data.urgency === "urgent" ? "Urgent" : "Request"

    return `${urgencyText}: ${data.bloodType} blood needed at ${data.hospital}. Reply YES to confirm you can donate.`
  }

  private simulateSMSSend(message: string, toNumber?: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`Sending SMS to ${toNumber || "recipients"}:`, message)
      setTimeout(() => {
        resolve(true)
      }, 1000)
    })
  }

  private simulateUSSDRequest(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`Sending USSD request:`, message)
      setTimeout(() => {
        resolve(true)
      }, 1000)
    })
  }
}

// Create a factory function for the SMS fallback
export function createSMSFallback(config: SMSConfig): SMSFallback {
  return new SMSFallback(config)
}
