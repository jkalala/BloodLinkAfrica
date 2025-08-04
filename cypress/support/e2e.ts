// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Import Cypress code coverage
import '@cypress/code-coverage/support'

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // that we expect in our application
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  if (err.message.includes('Non-Error promise rejection captured')) {
    return false
  }
  return true
})

// Custom commands for authentication
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type(email)
    cy.get('[data-testid="password-input"]').type(password)
    cy.get('[data-testid="login-button"]').click()
    cy.url().should('not.include', '/login')
    cy.get('[data-testid="user-menu"]').should('be.visible')
  })
})

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('admin@bloodlink.com', 'admin123')
})

Cypress.Commands.add('loginAsDonor', () => {
  cy.login('donor@bloodlink.com', 'donor123')
})

Cypress.Commands.add('loginAsHospital', () => {
  cy.login('hospital@bloodlink.com', 'hospital123')
})

Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
  cy.url().should('include', '/login')
})

// Custom commands for database operations
Cypress.Commands.add('seedDatabase', () => {
  cy.task('seedDatabase')
})

Cypress.Commands.add('cleanDatabase', () => {
  cy.task('cleanDatabase')
})

// Custom commands for API interactions
Cypress.Commands.add('apiRequest', (method: string, url: string, body?: any) => {
  return cy.request({
    method,
    url: `${Cypress.config('baseUrl')}/api${url}`,
    body,
    headers: {
      'Content-Type': 'application/json',
    },
    failOnStatusCode: false,
  })
})

// Custom commands for form interactions
Cypress.Commands.add('fillBloodRequestForm', (data: {
  bloodType: string
  unitsNeeded: number
  urgency: string
  location: string
  notes?: string
}) => {
  cy.get('[data-testid="blood-type-select"]').select(data.bloodType)
  cy.get('[data-testid="units-needed-input"]').clear().type(data.unitsNeeded.toString())
  cy.get('[data-testid="urgency-select"]').select(data.urgency)
  cy.get('[data-testid="location-input"]').clear().type(data.location)
  
  if (data.notes) {
    cy.get('[data-testid="notes-textarea"]').clear().type(data.notes)
  }
})

Cypress.Commands.add('fillDonorRegistrationForm', (data: {
  name: string
  email: string
  phone: string
  bloodType: string
  location: string
}) => {
  cy.get('[data-testid="name-input"]').clear().type(data.name)
  cy.get('[data-testid="email-input"]').clear().type(data.email)
  cy.get('[data-testid="phone-input"]').clear().type(data.phone)
  cy.get('[data-testid="blood-type-select"]').select(data.bloodType)
  cy.get('[data-testid="location-input"]').clear().type(data.location)
})

// Custom commands for UI interactions
Cypress.Commands.add('waitForSpinner', () => {
  cy.get('[data-testid="loading-spinner"]', { timeout: 1000 }).should('not.exist')
})

Cypress.Commands.add('waitForToast', (message?: string) => {
  if (message) {
    cy.get('[data-testid="toast"]').should('contain.text', message)
  } else {
    cy.get('[data-testid="toast"]').should('be.visible')
  }
  cy.get('[data-testid="toast"]').should('not.exist')
})

Cypress.Commands.add('checkAccessibility', () => {
  cy.injectAxe()
  cy.checkA11y(null, {
    rules: {
      'color-contrast': { enabled: false }, // Disable color contrast for now
    },
  })
})

// Custom commands for mobile testing
Cypress.Commands.add('setMobileViewport', () => {
  cy.viewport(375, 667) // iPhone SE
})

Cypress.Commands.add('setTabletViewport', () => {
  cy.viewport(768, 1024) // iPad
})

Cypress.Commands.add('setDesktopViewport', () => {
  cy.viewport(1280, 720) // Desktop
})

// Custom commands for geolocation
Cypress.Commands.add('mockGeolocation', (latitude: number, longitude: number) => {
  cy.window().then((win) => {
    cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
      success({
        coords: {
          latitude,
          longitude,
          accuracy: 10,
        },
      })
    })
  })
})

// Custom commands for notifications
Cypress.Commands.add('mockNotificationPermission', (permission: 'granted' | 'denied' | 'default') => {
  cy.window().then((win) => {
    cy.stub(win.Notification, 'permission').value(permission)
    cy.stub(win.Notification, 'requestPermission').resolves(permission)
  })
})

// Custom commands for file uploads
Cypress.Commands.add('uploadFile', (selector: string, fileName: string, fileType: string) => {
  cy.fixture(fileName, 'base64').then((fileContent) => {
    cy.get(selector).selectFile({
      contents: Cypress.Buffer.from(fileContent, 'base64'),
      fileName,
      mimeType: fileType,
    })
  })
})

// Custom commands for drag and drop
Cypress.Commands.add('dragAndDrop', (sourceSelector: string, targetSelector: string) => {
  cy.get(sourceSelector).trigger('mousedown', { which: 1 })
  cy.get(targetSelector).trigger('mousemove').trigger('mouseup')
})

// Custom commands for waiting
Cypress.Commands.add('waitForNetworkIdle', (timeout = 5000) => {
  let requestCount = 0
  
  cy.intercept('**', (req) => {
    requestCount++
    req.reply((res) => {
      requestCount--
      res.send()
    })
  })
  
  cy.waitUntil(() => requestCount === 0, { timeout })
})

// Type definitions for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      loginAsAdmin(): Chainable<void>
      loginAsDonor(): Chainable<void>
      loginAsHospital(): Chainable<void>
      logout(): Chainable<void>
      seedDatabase(): Chainable<void>
      cleanDatabase(): Chainable<void>
      apiRequest(method: string, url: string, body?: any): Chainable<Response>
      fillBloodRequestForm(data: {
        bloodType: string
        unitsNeeded: number
        urgency: string
        location: string
        notes?: string
      }): Chainable<void>
      fillDonorRegistrationForm(data: {
        name: string
        email: string
        phone: string
        bloodType: string
        location: string
      }): Chainable<void>
      waitForSpinner(): Chainable<void>
      waitForToast(message?: string): Chainable<void>
      checkAccessibility(): Chainable<void>
      setMobileViewport(): Chainable<void>
      setTabletViewport(): Chainable<void>
      setDesktopViewport(): Chainable<void>
      mockGeolocation(latitude: number, longitude: number): Chainable<void>
      mockNotificationPermission(permission: 'granted' | 'denied' | 'default'): Chainable<void>
      uploadFile(selector: string, fileName: string, fileType: string): Chainable<void>
      dragAndDrop(sourceSelector: string, targetSelector: string): Chainable<void>
      waitForNetworkIdle(timeout?: number): Chainable<void>
    }
  }
}
