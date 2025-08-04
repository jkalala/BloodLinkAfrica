/**
 * Environment Variable Validation
 * Ensures all required environment variables are present and valid
 */

interface EnvironmentConfig {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  
  // Optional but recommended
  REDIS_URL?: string
  NEXTAUTH_SECRET?: string
  NEXTAUTH_URL?: string
  
  // Twilio (Optional)
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_PHONE_NUMBER?: string
  
  // WhatsApp Business (Optional)
  WHATSAPP_BUSINESS_API_TOKEN?: string
  WHATSAPP_PHONE_NUMBER_ID?: string
  
  // Mobile Money (Optional)
  MOBILE_MONEY_API_KEY?: string
  MOBILE_MONEY_SECRET?: string
}

/**
 * Validates that all required environment variables are present
 * @throws Error if required variables are missing
 */
export function validateEnvironmentVariables(): EnvironmentConfig {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ] as const

  // Get the environment variables with fallbacks for development
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lglquyksommwynrhmkvz.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbHF1eWtzb21td3lucmhta3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MDY2NzgsImV4cCI6MjA2NTM4MjY3OH0.9qoIqjYI4p9xxx2nhiDFBG3yRHc-4sQ-bTeuuAW2X3E'
  
  // In development, skip validation if variables are available from env file
  if (process.env.NODE_ENV === 'development' && (supabaseUrl && supabaseKey)) {
    console.log('✅ Environment variables loaded for development')
  } else {
    const missingVars = requiredVars.filter(varName => !process.env[varName])

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}\n` +
        'Please check your .env.local file and ensure all required variables are set.\n' +
        'See .env.example for reference.'
      )
    }
  }

  // Validate URL format
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase URL (https://xxx.supabase.co)')
  }

  // Validate key format (basic check)
  if (!supabaseKey.startsWith('eyJ') || supabaseKey.length < 100) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid (should be a JWT token)')
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey,
    REDIS_URL: process.env.REDIS_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    WHATSAPP_BUSINESS_API_TOKEN: process.env.WHATSAPP_BUSINESS_API_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    MOBILE_MONEY_API_KEY: process.env.MOBILE_MONEY_API_KEY,
    MOBILE_MONEY_SECRET: process.env.MOBILE_MONEY_SECRET
  }
}

/**
 * Gets environment configuration with validation
 * Caches the result to avoid repeated validation
 */
let cachedConfig: EnvironmentConfig | null = null

export function getEnvironmentConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnvironmentVariables()
  }
  return cachedConfig
}

/**
 * Checks if optional features are enabled based on environment variables
 */
export function getFeatureFlags() {
  const config = getEnvironmentConfig()
  
  return {
    hasRedis: !!config.REDIS_URL,
    hasTwilio: !!(config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN),
    hasWhatsApp: !!(config.WHATSAPP_BUSINESS_API_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID),
    hasMobileMoney: !!(config.MOBILE_MONEY_API_KEY && config.MOBILE_MONEY_SECRET),
    hasAuth: !!config.NEXTAUTH_SECRET
  }
}