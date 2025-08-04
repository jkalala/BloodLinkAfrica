"use server"

import twilio from "twilio"

// Validate required environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const phoneNumber = process.env.TWILIO_PHONE_NUMBER

if (!accountSid || !authToken || !phoneNumber) {
  throw new Error(
    "Missing Twilio credentials. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.local"
  )
}

// Initialize Twilio client
const client = twilio(accountSid, authToken)

// Generate a random 6-digit verification code
export async function generateVerificationCode(): Promise<string> {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Send verification SMS
export async function sendVerificationSMS(phoneNumber: string, code: string): Promise<{ success: boolean; message?: string }> {
  try {
    // Validate phone number format
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      return {
        success: false,
        message: "Invalid phone number format. Please use E.164 format (e.g., +1234567890)",
      }
    }

    const message = await client.messages.create({
      body: `Your BloodLink verification code is: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    })

    console.log(`SMS sent successfully with SID: ${message.sid}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error sending SMS:", error)
    
    // Handle specific Twilio error codes
    if (error.code === 21211) {
      return {
        success: false,
        message: "Invalid phone number. Please check the number and try again.",
      }
    } else if (error.code === 21608) {
      return {
        success: false,
        message: "This phone number is not verified for testing. Please verify it in your Twilio console.",
      }
    } else if (error.code === 21614) {
      return {
        success: false,
        message: "This phone number is not mobile. Please provide a mobile number.",
      }
    }

    return {
      success: false,
      message: "Failed to send verification code. Please try again later.",
    }
  }
}

// Verify phone number with code
export async function verifyPhoneNumber(phoneNumber: string, code: string, storedCode: string): Promise<boolean> {
  // In a real app, you would retrieve the stored code from a database
  // For now, we'll just compare the codes directly
  return code === storedCode
}
