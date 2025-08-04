
/**
 * Environment setup for tests
 * Mock environment variables needed for testing
 */

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.VERIFICATION_SALT = 'test-salt-for-verification'
process.env.NODE_ENV = 'test'
process.env.API_VERSION = '1.0.0'

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
const originalConsoleInfo = console.info

// Only show console errors that are not expected in tests
console.error = (...args: any[]) => {
  const message = args[0]
  
  // Suppress expected error messages in tests
  if (
    typeof message === 'string' && (
      message.includes('Redis not available') ||
      message.includes('Failed to log security event') ||
      message.includes('Rate check error') ||
      message.includes('Security logging error')
    )
  ) {
    return
  }
  
  originalConsoleError(...args)
}

console.warn = (...args: any[]) => {
  const message = args[0]
  
  // Suppress expected warning messages in tests
  if (
    typeof message === 'string' && (
      message.includes('Redis not configured') ||
      message.includes('SECURITY EVENT')
    )
  ) {
    return
  }
  
  originalConsoleWarn(...args)
}

console.info = (...args: any[]) => {
  const message = args[0]
  
  // Suppress info messages in tests
  if (
    typeof message === 'string' && (
      message.includes('Redis connected') ||
      message.includes('Redis not configured')
    )
  ) {
    return
  }
  
  originalConsoleInfo(...args)
}

// Restore console methods after tests
afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
  console.info = originalConsoleInfo
})

// Add a dummy test to satisfy Jest
describe('Environment Setup', () => {
  it('should run without errors', () => {
    expect(true).toBe(true)
  })
})
