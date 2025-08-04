import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

// Mock providers for testing
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="mock-auth-provider">
      {children}
    </div>
  )
}

const MockLocationProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="mock-location-provider">
      {children}
    </div>
  )
}

const MockNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="mock-notification-provider">
      {children}
    </div>
  )
}

// All the providers wrapper
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MockAuthProvider>
        <MockLocationProvider>
          <MockNotificationProvider>
            {children}
            <Toaster />
          </MockNotificationProvider>
        </MockLocationProvider>
      </MockAuthProvider>
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Custom matchers
export const expectToBeInTheDocument = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument()
}

export const expectToHaveClass = (element: HTMLElement | null, className: string) => {
  expect(element).toHaveClass(className)
}

export const expectToHaveAttribute = (element: HTMLElement | null, attribute: string, value?: string) => {
  if (value) {
    expect(element).toHaveAttribute(attribute, value)
  } else {
    expect(element).toHaveAttribute(attribute)
  }
}

// Mock data generators
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  blood_type: 'O+',
  location: 'Test Location',
  phone: '+1234567890',
  available: true,
  role: 'donor',
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createMockBloodRequest = (overrides = {}) => ({
  id: 'test-request-id',
  blood_type: 'O+',
  units_needed: 2,
  urgency: 'high',
  location: 'Test Hospital',
  status: 'active',
  created_at: new Date().toISOString(),
  requester_id: 'test-requester-id',
  ...overrides,
})

export const createMockDonor = (overrides = {}) => ({
  id: 'test-donor-id',
  name: 'Test Donor',
  blood_type: 'O+',
  location: 'Test Location',
  available: true,
  last_donation: null,
  total_donations: 0,
  response_rate: 0.95,
  avg_response_time: 30,
  success_rate: 0.90,
  ...overrides,
})

// Test helpers
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export const mockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK',
})

// Mock API responses
export const mockApiResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

// Form testing helpers
export const fillForm = async (user: any, formData: Record<string, string>) => {
  for (const [field, value] of Object.entries(formData)) {
    const input = document.querySelector(`[name="${field}"]`) as HTMLInputElement
    if (input) {
      await user.clear(input)
      await user.type(input, value)
    }
  }
}

export const submitForm = async (user: any, formSelector = 'form') => {
  const form = document.querySelector(formSelector) as HTMLFormElement
  if (form) {
    await user.click(form.querySelector('[type="submit"]') as HTMLElement)
  }
}

// Accessibility testing helpers
export const checkAccessibility = (container: HTMLElement) => {
  // Check for basic accessibility attributes
  const buttons = container.querySelectorAll('button')
  buttons.forEach(button => {
    if (!button.getAttribute('aria-label') && !button.textContent?.trim()) {
      console.warn('Button without accessible name found:', button)
    }
  })

  const inputs = container.querySelectorAll('input')
  inputs.forEach(input => {
    if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
      const label = container.querySelector(`label[for="${input.id}"]`)
      if (!label) {
        console.warn('Input without accessible label found:', input)
      }
    }
  })
}

// Performance testing helpers
export const measureRenderTime = (renderFn: () => void) => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }
}

// Mock geolocation
export const mockGeolocation = () => {
  const mockGeolocation = {
    getCurrentPosition: jest.fn((success) => {
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      })
    }),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  }

  Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
  })

  return mockGeolocation
}

// Mock fetch
export const mockFetch = (response: any, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  ) as jest.Mock
}

// Cleanup helpers
export const cleanup = () => {
  // Reset all mocks
  jest.clearAllMocks()
  
  // Clear localStorage
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
    window.sessionStorage.clear()
  }
}

// Test data factories
export const TestDataFactory = {
  user: createMockUser,
  bloodRequest: createMockBloodRequest,
  donor: createMockDonor,
  
  // Create multiple items
  users: (count: number, overrides = {}) => 
    Array.from({ length: count }, (_, i) => createMockUser({ id: `user-${i}`, ...overrides })),
  
  bloodRequests: (count: number, overrides = {}) =>
    Array.from({ length: count }, (_, i) => createMockBloodRequest({ id: `request-${i}`, ...overrides })),
  
  donors: (count: number, overrides = {}) =>
    Array.from({ length: count }, (_, i) => createMockDonor({ id: `donor-${i}`, ...overrides })),
}

// Custom hooks testing
export const renderHook = (hook: () => any) => {
  let result: any
  let error: any

  const TestComponent = () => {
    try {
      result = hook()
    } catch (e) {
      error = e
    }
    return null
  }

  render(<TestComponent />)

  return {
    result: { current: result },
    error,
    rerender: (newHook?: () => any) => {
      if (newHook) {
        const NewTestComponent = () => {
          try {
            result = newHook()
          } catch (e) {
            error = e
          }
          return null
        }
        render(<NewTestComponent />)
      }
    },
  }
}
