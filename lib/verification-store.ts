/**
 * Secure Database-Backed Verification Store
 * Replaces the insecure in-memory Map with proper database storage
 */

import { createServerSupabaseClient } from './supabase'
import crypto from 'crypto'

interface VerificationData {
  phone_number: string
  code_hash: string
  expires_at: string
  attempts: number
  created_at: string
  ip_address?: string
  user_agent?: string
}

// Maximum verification attempts before blocking
const MAX_VERIFICATION_ATTEMPTS = 5
const VERIFICATION_TIMEOUT_MINUTES = 10
const RATE_LIMIT_ATTEMPTS = 3
const RATE_LIMIT_WINDOW_MINUTES = 5

/**
 * Hash verification code for secure storage
 */
function hashVerificationCode(code: string, phoneNumber: string): string {
  const salt = process.env.VERIFICATION_SALT || 'default-salt-change-in-production'
  return crypto.pbkdf2Sync(code, `${salt}:${phoneNumber}`, 10000, 32, 'sha256').toString('hex')
}

/**
 * Generate a secure 6-digit verification code
 */
function generateVerificationCode(): string {
  // Use crypto.randomInt for cryptographically secure random numbers
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Store verification code in database with security measures
 */
export async function storeVerificationCode(
  phoneNumber: string, 
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check rate limiting - max 3 attempts per phone in 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
    
    const { data: recentAttempts, error: rateCheckError } = await supabase
      .from('verification_codes')
      .select('id')
      .eq('phone_number', phoneNumber)
      .gte('created_at', fiveMinutesAgo)
    
    if (rateCheckError) {
      console.error('Rate check error:', rateCheckError)
      return { success: false, error: 'Rate limiting check failed' }
    }
    
    if (recentAttempts && recentAttempts.length >= RATE_LIMIT_ATTEMPTS) {
      return { success: false, error: 'Too many verification attempts. Please try again later.' }
    }
    
    // Generate secure verification code
    const code = generateVerificationCode()
    const codeHash = hashVerificationCode(code, phoneNumber)
    const expiresAt = new Date(Date.now() + VERIFICATION_TIMEOUT_MINUTES * 60 * 1000).toISOString()
    
    // Delete any existing verification codes for this phone number
    await supabase
      .from('verification_codes')
      .delete()
      .eq('phone_number', phoneNumber)
    
    // Insert new verification code
    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert([{
        phone_number: phoneNumber,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
        created_at: new Date().toISOString()
      }])
    
    if (insertError) {
      console.error('Verification code insert error:', insertError)
      return { success: false, error: 'Failed to store verification code' }
    }
    
    return { success: true, code }
  } catch (error) {
    console.error('Store verification code error:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Verify the provided code against stored hash
 */
export async function verifyCode(
  phoneNumber: string, 
  providedCode: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get verification record
    const { data: verificationRecord, error: fetchError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single()
    
    if (fetchError || !verificationRecord) {
      return { success: false, error: 'Verification code not found or expired' }
    }
    
    // Check if code has expired
    if (new Date(verificationRecord.expires_at) < new Date()) {
      // Clean up expired code
      await supabase
        .from('verification_codes')
        .delete()
        .eq('phone_number', phoneNumber)
      
      return { success: false, error: 'Verification code has expired' }
    }
    
    // Check attempt limit
    if (verificationRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return { success: false, error: 'Too many failed attempts. Please request a new code.' }
    }
    
    // Verify the code
    const providedHash = hashVerificationCode(providedCode, phoneNumber)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(verificationRecord.code_hash, 'hex'),
      Buffer.from(providedHash, 'hex')
    )
    
    if (!isValid) {
      // Increment attempt counter
      await supabase
        .from('verification_codes')
        .update({ attempts: verificationRecord.attempts + 1 })
        .eq('phone_number', phoneNumber)
      
      return { success: false, error: 'Invalid verification code' }
    }
    
    // Success - delete the verification code
    await supabase
      .from('verification_codes')
      .delete()
      .eq('phone_number', phoneNumber)
    
    // Log successful verification for audit
    await supabase
      .from('audit_log')
      .insert([{
        user_id: null, // No user ID yet during verification
        action: 'phone_verification_success',
        table_name: 'verification_codes',
        record_id: null,
        new_data: { phone_number: phoneNumber },
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
        created_at: new Date().toISOString()
      }])
    
    return { success: true }
  } catch (error) {
    console.error('Verify code error:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Clean up expired verification codes (should be run as a cron job)
 */
export async function cleanupExpiredCodes(): Promise<void> {
  try {
    const supabase = createServerSupabaseClient()
    
    const { error } = await supabase
      .from('verification_codes')
      .delete()
      .lt('expires_at', new Date().toISOString())
    
    if (error) {
      console.error('Cleanup expired codes error:', error)
    }
  } catch (error) {
    console.error('Cleanup expired codes error:', error)
  }
}

/**
 * Get verification attempts for a phone number (for admin/debugging)
 */
export async function getVerificationAttempts(phoneNumber: string): Promise<{
  hasActiveCode: boolean
  attempts: number
  expiresAt?: string
}> {
  try {
    const supabase = createServerSupabaseClient()
    
    const { data: verificationRecord } = await supabase
      .from('verification_codes')
      .select('attempts, expires_at')
      .eq('phone_number', phoneNumber)
      .single()
    
    if (!verificationRecord) {
      return { hasActiveCode: false, attempts: 0 }
    }
    
    const isExpired = new Date(verificationRecord.expires_at) < new Date()
    
    return {
      hasActiveCode: !isExpired,
      attempts: verificationRecord.attempts,
      expiresAt: verificationRecord.expires_at
    }
  } catch (error) {
    console.error('Get verification attempts error:', error)
    return { hasActiveCode: false, attempts: 0 }
  }
} 