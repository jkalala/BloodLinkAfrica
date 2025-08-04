"use server"

import { generateVerificationCode, sendVerificationSMS, verifyPhoneNumber } from "@/lib/twilio-service"
import { getSupabase } from "@/lib/supabase"
import { storeVerificationCode, getVerificationCode, deleteVerificationCode } from "@/lib/verification-store"

// Store verification code in cookies (in production, use a more secure method)
export async function initiateVerification(phoneNumber: string) {
  try {
    console.log("Initiating verification for phone:", phoneNumber)
    
    // Generate and store the verification code
    const code = await generateVerificationCode()
    storeVerificationCode(phoneNumber, code)
    console.log("Verification code generated and stored")

    // Send the SMS
    const result = await sendVerificationSMS(phoneNumber, code)
    console.log("SMS send result:", result)

    if (!result.success) {
      console.log("Failed to send SMS, deleting stored code")
      deleteVerificationCode(phoneNumber)
    }

    return {
      success: result.success,
      message: result.message || (result.success ? "Verification code sent" : "Failed to send verification code"),
    }
  } catch (error: any) {
    console.error("Error initiating verification:", error)
    return {
      success: false,
      message: error.message || "Failed to initiate verification",
    }
  }
}

export async function confirmVerification(phoneNumber: string, code: string) {
  try {
    console.log("Starting verification confirmation for phone:", phoneNumber)
    const storedCode = getVerificationCode(phoneNumber)

    if (!storedCode) {
      console.log("No stored code found for phone:", phoneNumber)
      return { success: false, message: "Verification expired or not found" }
    }

    console.log("Verifying code...")
    const isValid = await verifyPhoneNumber(phoneNumber, code, storedCode)

    if (isValid) {
      console.log("Code is valid, proceeding with verification")
      deleteVerificationCode(phoneNumber)

      const supabase = getSupabase()
      
      // Try to get the current user, but don't require it
      const { data: authUser } = await supabase.auth.getUser()
      console.log("Current auth user:", authUser?.user?.id)
      
      // Find user by phone number (works for both registration and post-login verification)
      console.log("Looking up user by phone number:", phoneNumber)
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, phone_verified")
        .eq("phone", phoneNumber)

      console.log("Users lookup result:", { users, usersError })

      if (usersError) {
        console.error("Error finding users:", usersError)
        // During registration, the user might not exist yet
        if (usersError.code === "PGRST116") {
          console.log("No user found (PGRST116), this is okay during registration")
          return { success: true, message: "Phone number verified. Please complete registration." }
        }
        return { 
          success: false, 
          message: `Error finding user profile: ${usersError.message}` 
        }
      }

      // Handle case where multiple users might have the same phone number
      if (!users || users.length === 0) {
        console.log("No user found with this phone number")
        // During registration, this is okay
        return { success: true, message: "Phone number verified. Please complete registration." }
      }

      if (users.length > 1) {
        console.error("Multiple users found with same phone number:", users)
        return { 
          success: false, 
          message: "Multiple accounts found with this phone number. Please contact support." 
        }
      }

      const user = users[0]
      console.log("Found user:", user)

      if (user.phone_verified) {
        console.log("User already verified:", user)
        return { success: true, message: "Phone number already verified" }
      }

      // Update verification status
      console.log("Updating phone_verified status for user:", user.id)
      const { data: updateData, error: updateError } = await supabase
        .from("users")
        .update({ phone_verified: true })
        .eq("id", user.id)
        .select()

      console.log("Update result:", { updateData, updateError })

      if (updateError) {
        console.error("Error updating verification status:", updateError)
        return { 
          success: false, 
          message: `Failed to update verification status: ${updateError.message}` 
        }
      }

      console.log("Verification successful for user:", user.id)
      return { success: true, message: "Phone number verified successfully" }
    } else {
      console.log("Invalid verification code for phone:", phoneNumber)
      return { success: false, message: "Invalid verification code" }
    }
  } catch (error: any) {
    console.error("Unexpected error during verification:", error)
    return { 
      success: false, 
      message: `Verification failed: ${error.message || "Unknown error"}` 
    }
  }
}
