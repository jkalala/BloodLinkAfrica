/**
 * Tests for validation schemas
 */

import {
  userRegistrationSchema,
  userProfileUpdateSchema,
  userLoginSchema,
  bloodRequestSchema,
  verificationCodeRequestSchema,
  verificationCodeVerifySchema,
  validateInput,
  sanitizeHtml,
  sanitizePhone,
  sanitizeName
} from '../../lib/validation-schemas'

describe('User Registration Schema', () => {
  it('should validate correct user registration data', () => {
    const validData = {
      name: 'John Doe',
      phone: '+1234567890',
      password: 'SecurePass123!',
      blood_type: 'O+',
      location: 'New York'
    }

    const result = validateInput(userRegistrationSchema, validData)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(validData)
  })

  it('should reject invalid phone numbers', () => {
    const invalidData = {
      name: 'John Doe',
      phone: '1234567890', // Missing +
      password: 'SecurePass123!',
      blood_type: 'O+',
      location: 'New York'
    }

    const result = validateInput(userRegistrationSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Phone number must be in international format')
  })

  it('should reject weak passwords', () => {
    const invalidData = {
      name: 'John Doe',
      phone: '+1234567890',
      password: 'weak', // Too weak
      blood_type: 'O+',
      location: 'New York'
    }

    const result = validateInput(userRegistrationSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Password must contain at least one')
  })

  it('should reject names with invalid characters', () => {
    const invalidData = {
      name: 'John123', // Contains numbers
      phone: '+1234567890',
      password: 'SecurePass123!',
      blood_type: 'O+',
      location: 'New York'
    }

    const result = validateInput(userRegistrationSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Name contains invalid characters')
  })

  it('should reject invalid blood types', () => {
    const invalidData = {
      name: 'John Doe',
      phone: '+1234567890',
      password: 'SecurePass123!',
      blood_type: 'X+', // Invalid blood type
      location: 'New York'
    }

    const result = validateInput(userRegistrationSchema, invalidData)
    expect(result.success).toBe(false)
  })
})

describe('Blood Request Schema', () => {
  it('should validate correct blood request data', () => {
    const validData = {
      patient_name: 'Jane Smith',
      blood_type: 'AB-',
      units_needed: 2,
      priority: 'high',
      location: 'Los Angeles',
      contact_phone: '+9876543210',
      medical_facility: 'City Hospital',
      urgency_reason: 'Emergency surgery required immediately',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    }

    const result = validateInput(bloodRequestSchema, validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid units needed', () => {
    const invalidData = {
      patient_name: 'Jane Smith',
      blood_type: 'AB-',
      units_needed: 0, // Invalid: must be at least 1
      priority: 'high',
      location: 'Los Angeles',
      contact_phone: '+9876543210',
      medical_facility: 'City Hospital',
      urgency_reason: 'Emergency surgery required immediately',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }

    const result = validateInput(bloodRequestSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('At least 1 unit is required')
  })

  it('should reject too many units', () => {
    const invalidData = {
      patient_name: 'Jane Smith',
      blood_type: 'AB-',
      units_needed: 25, // Invalid: max is 20
      priority: 'high',
      location: 'Los Angeles',
      contact_phone: '+9876543210',
      medical_facility: 'City Hospital',
      urgency_reason: 'Emergency surgery required immediately',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }

    const result = validateInput(bloodRequestSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Cannot request more than 20 units at once')
  })

  it('should reject past expiry dates', () => {
    const invalidData = {
      patient_name: 'Jane Smith',
      blood_type: 'AB-',
      units_needed: 2,
      priority: 'high',
      location: 'Los Angeles',
      contact_phone: '+9876543210',
      medical_facility: 'City Hospital',
      urgency_reason: 'Emergency surgery required immediately',
      expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
    }

    const result = validateInput(bloodRequestSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Expiry date must be in the future')
  })
})

describe('Verification Code Schemas', () => {
  it('should validate verification code request', () => {
    const validData = {
      phone: '+1234567890'
    }

    const result = validateInput(verificationCodeRequestSchema, validData)
    expect(result.success).toBe(true)
  })

  it('should validate verification code verification', () => {
    const validData = {
      phone: '+1234567890',
      code: '123456'
    }

    const result = validateInput(verificationCodeVerifySchema, validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid verification codes', () => {
    const invalidData = {
      phone: '+1234567890',
      code: '12345' // Too short
    }

    const result = validateInput(verificationCodeVerifySchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Verification code must be 6 digits')
  })

  it('should reject non-numeric verification codes', () => {
    const invalidData = {
      phone: '+1234567890',
      code: 'abcdef' // Not numeric
    }

    const result = validateInput(verificationCodeVerifySchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Verification code must be 6 digits')
  })
})

describe('Sanitization Functions', () => {
  describe('sanitizeHtml', () => {
    it('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>'
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      expect(sanitizeHtml(input)).toBe(expected)
    })

    it('should handle multiple dangerous characters', () => {
      const input = '<img src="x" onerror="alert(\'xss\')">'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
      expect(result).not.toContain('"')
      expect(result).not.toContain("'")
    })
  })

  describe('sanitizePhone', () => {
    it('should add + prefix if missing', () => {
      expect(sanitizePhone('1234567890')).toBe('+1234567890')
    })

    it('should preserve + prefix if present', () => {
      expect(sanitizePhone('+1234567890')).toBe('+1234567890')
    })

    it('should remove non-digit and non-plus characters', () => {
      expect(sanitizePhone('+1 (234) 567-8900')).toBe('+12345678900')
    })

    it('should handle spaces and special characters', () => {
      expect(sanitizePhone(' +1-234-567-8900 ')).toBe('+12345678900')
    })
  })

  describe('sanitizeName', () => {
    it('should trim whitespace', () => {
      expect(sanitizeName('  John Doe  ')).toBe('John Doe')
    })

    it('should replace multiple spaces with single space', () => {
      expect(sanitizeName('John    Doe')).toBe('John Doe')
    })

    it('should preserve valid characters', () => {
      expect(sanitizeName("Jean-Pierre O'Connor")).toBe("Jean-Pierre O'Connor")
    })

    it('should remove invalid characters', () => {
      expect(sanitizeName('John123Doe')).toBe('JohnDoe')
    })

    it('should handle international characters', () => {
      expect(sanitizeName('José María')).toBe('José María')
    })
  })
})

describe('User Login Schema', () => {
  it('should validate correct login data', () => {
    const validData = {
      phone: '+1234567890',
      password: 'password123'
    }

    const result = validateInput(userLoginSchema, validData)
    expect(result.success).toBe(true)
  })

  it('should reject empty password', () => {
    const invalidData = {
      phone: '+1234567890',
      password: ''
    }

    const result = validateInput(userLoginSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Password is required')
  })
})

describe('User Profile Update Schema', () => {
  it('should validate partial updates', () => {
    const validData = {
      name: 'Updated Name'
    }

    const result = validateInput(userProfileUpdateSchema, validData)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(validData)
  })

  it('should validate all fields together', () => {
    const validData = {
      name: 'John Doe',
      blood_type: 'A+',
      location: 'Boston',
      allow_location: true,
      receive_alerts: false,
      available: true,
      medical_conditions: 'No known allergies'
    }

    const result = validateInput(userProfileUpdateSchema, validData)
    expect(result.success).toBe(true)
  })

  it('should handle null medical conditions', () => {
    const validData = {
      name: 'John Doe',
      medical_conditions: null
    }

    const result = validateInput(userProfileUpdateSchema, validData)
    expect(result.success).toBe(true)
  })

  it('should reject too long medical conditions', () => {
    const invalidData = {
      name: 'John Doe',
      medical_conditions: 'A'.repeat(1001) // Too long
    }

    const result = validateInput(userProfileUpdateSchema, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Medical conditions must not exceed 1000 characters')
  })
})