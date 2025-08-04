/**
 * Input Validation Schemas using Zod
 * Provides type-safe validation for all user inputs
 */

import { z } from 'zod'

// Common validation patterns
const phoneNumberRegex = /^\+[1-9]\d{1,14}$/
const bloodTypeEnum = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
const priorityEnum = ['low', 'medium', 'high', 'critical'] as const
const statusEnum = ['pending', 'active', 'fulfilled', 'cancelled', 'expired'] as const
const roleEnum = ['donor', 'staff', 'admin', 'emergency_responder'] as const
const stakeholderTypeEnum = ['donor', 'blood_bank', 'hospital', 'clinic'] as const

// User-related schemas
export const userRegistrationSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ÿĀ-žа-я\s'-]+$/, 'Name contains invalid characters'),
  
  phone: z.string()
    .regex(phoneNumberRegex, 'Phone number must be in international format (+1234567890)'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  blood_type: z.enum(bloodTypeEnum).optional(),
  
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location must not exceed 200 characters')
    .optional(),
})

export const userProfileUpdateSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ÿĀ-žа-я\s'-]+$/, 'Name contains invalid characters')
    .optional(),
  
  blood_type: z.enum(bloodTypeEnum).optional(),
  
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location must not exceed 200 characters')
    .optional(),
  
  allow_location: z.boolean().optional(),
  receive_alerts: z.boolean().optional(),
  available: z.boolean().optional(),
  
  medical_conditions: z.string()
    .max(1000, 'Medical conditions must not exceed 1000 characters')
    .optional()
    .nullable(),
})

export const userLoginSchema = z.object({
  phone: z.string()
    .regex(phoneNumberRegex, 'Phone number must be in international format (+1234567890)'),
  
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must not exceed 128 characters'),
})

// Blood request schemas
export const bloodRequestSchema = z.object({
  patient_name: z.string()
    .min(2, 'Patient name must be at least 2 characters')
    .max(100, 'Patient name must not exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ÿĀ-žа-я\s'-]+$/, 'Patient name contains invalid characters'),
  
  blood_type: z.enum(bloodTypeEnum, {
    errorMap: () => ({ message: 'Invalid blood type. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-' })
  }),
  
  units_needed: z.number()
    .int('Units needed must be a whole number')
    .min(1, 'At least 1 unit is required')
    .max(20, 'Cannot request more than 20 units at once'),
  
  priority: z.enum(priorityEnum).default('medium'),
  
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location must not exceed 200 characters'),
  
  contact_phone: z.string()
    .regex(phoneNumberRegex, 'Contact phone must be in international format (+1234567890)'),
  
  medical_facility: z.string()
    .min(2, 'Medical facility name must be at least 2 characters')
    .max(200, 'Medical facility name must not exceed 200 characters'),
  
  urgency_reason: z.string()
    .min(10, 'Urgency reason must be at least 10 characters')
    .max(1000, 'Urgency reason must not exceed 1000 characters'),
  
  expires_at: z.string()
    .datetime('Invalid expiry date format')
    .refine((date) => new Date(date) > new Date(), 'Expiry date must be in the future'),
})

export const bloodRequestUpdateSchema = z.object({
  units_needed: z.number()
    .int('Units needed must be a whole number')
    .min(1, 'At least 1 unit is required')
    .max(20, 'Cannot request more than 20 units at once')
    .optional(),
  
  priority: z.enum(priorityEnum).optional(),
  
  status: z.enum(statusEnum).optional(),
  
  urgency_reason: z.string()
    .min(10, 'Urgency reason must be at least 10 characters')
    .max(1000, 'Urgency reason must not exceed 1000 characters')
    .optional(),
  
  expires_at: z.string()
    .datetime('Invalid expiry date format')
    .refine((date) => new Date(date) > new Date(), 'Expiry date must be in the future')
    .optional(),
})

// Verification schemas
export const verificationCodeRequestSchema = z.object({
  phone: z.string()
    .regex(phoneNumberRegex, 'Phone number must be in international format (+1234567890)'),
})

export const verificationCodeVerifySchema = z.object({
  phone: z.string()
    .regex(phoneNumberRegex, 'Phone number must be in international format (+1234567890)'),
  
  code: z.string()
    .regex(/^\d{6}$/, 'Verification code must be 6 digits'),
})

// Notification schemas
export const notificationSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must not exceed 200 characters'),
  
  message: z.string()
    .min(1, 'Message is required')
    .max(1000, 'Message must not exceed 1000 characters'),
  
  type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
})

// WhatsApp/SMS messaging schemas
export const messageSchema = z.object({
  phone: z.string()
    .regex(phoneNumberRegex, 'Phone number must be in international format (+1234567890)'),
  
  message: z.string()
    .min(1, 'Message is required')
    .max(1600, 'Message must not exceed 1600 characters'), // WhatsApp limit
  
  type: z.enum(['sms', 'whatsapp']).default('sms'),
})

// Institution schemas
export const institutionSchema = z.object({
  name: z.string()
    .min(2, 'Institution name must be at least 2 characters')
    .max(200, 'Institution name must not exceed 200 characters'),
  
  type: z.enum(['hospital', 'clinic', 'blood_bank', 'emergency_service']),
  
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location must not exceed 200 characters'),
  
  contact_phone: z.string()
    .regex(phoneNumberRegex, 'Contact phone must be in international format (+1234567890)'),
  
  contact_email: z.string()
    .email('Invalid email format')
    .max(320, 'Email must not exceed 320 characters')
    .optional(),
  
  license_number: z.string()
    .min(3, 'License number must be at least 3 characters')
    .max(50, 'License number must not exceed 50 characters')
    .optional(),
})

// Mobile money payment schemas
export const mobileMoneyPaymentSchema = z.object({
  phone: z.string()
    .regex(phoneNumberRegex, 'Phone number must be in international format (+1234567890)'),
  
  amount: z.number()
    .positive('Amount must be positive')
    .max(10000, 'Amount cannot exceed 10,000')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  
  currency: z.enum(['USD', 'EUR', 'GBP', 'AOA', 'XAF', 'XOF']).default('USD'),
  
  provider: z.enum(['mtn', 'orange', 'airtel', 'moov']),
  
  description: z.string()
    .min(5, 'Description must be at least 5 characters')
    .max(200, 'Description must not exceed 200 characters'),
})

// Search and filter schemas
export const bloodRequestSearchSchema = z.object({
  blood_type: z.enum(bloodTypeEnum).optional(),
  priority: z.enum(priorityEnum).optional(),
  status: z.enum(statusEnum).optional(),
  location: z.string().max(200).optional(),
  radius: z.number().min(1).max(1000).optional(), // km
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
})

export const userSearchSchema = z.object({
  blood_type: z.enum(bloodTypeEnum).optional(),
  location: z.string().max(200).optional(),
  radius: z.number().min(1).max(1000).optional(), // km
  available: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
})

// API response schemas
export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
})

export const apiSuccessSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
})

// Utility function to validate and sanitize input
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean
  data?: T
  errors?: string[]
} {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(err => 
        `${err.path.join('.')}: ${err.message}`
      )
      return { success: false, errors }
    }
    return { success: false, errors: ['Validation failed'] }
  }
}

// Sanitization helper functions
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function sanitizePhone(phone: string): string {
  // Remove all non-digit and non-plus characters
  const cleaned = phone.replace(/[^\d+]/g, '')
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    return '+' + cleaned
  }
  
  return cleaned
}

export function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\p{L}\p{M}\s'-]/gu, '') // Keep only letters, marks, spaces, hyphens, apostrophes
}

// Type exports for TypeScript usage
export type UserRegistration = z.infer<typeof userRegistrationSchema>
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>
export type UserLogin = z.infer<typeof userLoginSchema>
export type BloodRequest = z.infer<typeof bloodRequestSchema>
export type BloodRequestUpdate = z.infer<typeof bloodRequestUpdateSchema>
export type VerificationCodeRequest = z.infer<typeof verificationCodeRequestSchema>
export type VerificationCodeVerify = z.infer<typeof verificationCodeVerifySchema>
export type Notification = z.infer<typeof notificationSchema>
export type Message = z.infer<typeof messageSchema>
export type Institution = z.infer<typeof institutionSchema>
export type MobileMoneyPayment = z.infer<typeof mobileMoneyPaymentSchema>
export type BloodRequestSearch = z.infer<typeof bloodRequestSearchSchema>
export type UserSearch = z.infer<typeof userSearchSchema>