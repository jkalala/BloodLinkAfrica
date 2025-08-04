describe('Blood Donation Flow', () => {
  beforeEach(() => {
    cy.seedDatabase()
    cy.visit('/')
  })

  afterEach(() => {
    cy.cleanDatabase()
  })

  describe('Donor Registration and Login', () => {
    it('should allow new donor to register', () => {
      cy.visit('/register')
      
      cy.fillDonorRegistrationForm({
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        bloodType: 'O+',
        location: 'New York, NY',
      })
      
      cy.get('[data-testid="terms-checkbox"]').check()
      cy.get('[data-testid="register-button"]').click()
      
      cy.waitForSpinner()
      cy.url().should('include', '/verify')
      cy.get('[data-testid="verification-message"]').should('contain', 'verification code')
    })

    it('should allow existing donor to login', () => {
      cy.loginAsDonor()
      cy.url().should('include', '/dashboard')
      cy.get('[data-testid="welcome-message"]').should('contain', 'Welcome back')
    })

    it('should handle login errors gracefully', () => {
      cy.visit('/login')
      cy.get('[data-testid="email-input"]').type('invalid@example.com')
      cy.get('[data-testid="password-input"]').type('wrongpassword')
      cy.get('[data-testid="login-button"]').click()
      
      cy.waitForToast('Invalid credentials')
      cy.url().should('include', '/login')
    })
  })

  describe('Blood Request Creation', () => {
    beforeEach(() => {
      cy.loginAsHospital()
    })

    it('should create urgent blood request', () => {
      cy.visit('/request')
      
      cy.fillBloodRequestForm({
        bloodType: 'O+',
        unitsNeeded: 3,
        urgency: 'high',
        location: 'General Hospital, NYC',
        notes: 'Emergency surgery patient',
      })
      
      cy.get('[data-testid="submit-request-button"]').click()
      cy.waitForSpinner()
      
      cy.waitForToast('Blood request created successfully')
      cy.url().should('include', '/requests')
      
      // Verify request appears in list
      cy.get('[data-testid="request-list"]').should('contain', 'O+')
      cy.get('[data-testid="request-list"]').should('contain', '3 units')
      cy.get('[data-testid="request-list"]').should('contain', 'High Priority')
    })

    it('should validate required fields', () => {
      cy.visit('/request')
      
      cy.get('[data-testid="submit-request-button"]').click()
      
      cy.get('[data-testid="blood-type-error"]').should('contain', 'Blood type is required')
      cy.get('[data-testid="units-needed-error"]').should('contain', 'Units needed is required')
      cy.get('[data-testid="location-error"]').should('contain', 'Location is required')
    })

    it('should show real-time donor matching', () => {
      cy.visit('/request')
      
      cy.fillBloodRequestForm({
        bloodType: 'O+',
        unitsNeeded: 2,
        urgency: 'medium',
        location: 'City Hospital',
      })
      
      // Mock geolocation
      cy.mockGeolocation(40.7128, -74.0060)
      
      cy.get('[data-testid="find-donors-button"]').click()
      cy.waitForSpinner()
      
      cy.get('[data-testid="donor-matches"]').should('be.visible')
      cy.get('[data-testid="donor-card"]').should('have.length.at.least', 1)
      
      // Check donor information
      cy.get('[data-testid="donor-card"]').first().within(() => {
        cy.get('[data-testid="donor-name"]').should('be.visible')
        cy.get('[data-testid="donor-blood-type"]').should('contain', 'O+')
        cy.get('[data-testid="donor-distance"]').should('be.visible')
        cy.get('[data-testid="compatibility-score"]').should('be.visible')
      })
    })
  })

  describe('Donor Response Flow', () => {
    beforeEach(() => {
      cy.loginAsDonor()
    })

    it('should show available blood requests', () => {
      cy.visit('/dashboard')
      
      cy.get('[data-testid="available-requests"]').should('be.visible')
      cy.get('[data-testid="request-card"]').should('have.length.at.least', 1)
      
      cy.get('[data-testid="request-card"]').first().within(() => {
        cy.get('[data-testid="blood-type"]').should('be.visible')
        cy.get('[data-testid="urgency-badge"]').should('be.visible')
        cy.get('[data-testid="location"]').should('be.visible')
        cy.get('[data-testid="distance"]').should('be.visible')
      })
    })

    it('should allow donor to respond to request', () => {
      cy.visit('/dashboard')
      
      cy.get('[data-testid="request-card"]').first().within(() => {
        cy.get('[data-testid="respond-button"]').click()
      })
      
      cy.get('[data-testid="response-modal"]').should('be.visible')
      cy.get('[data-testid="availability-select"]').select('available')
      cy.get('[data-testid="estimated-time-input"]').type('30')
      cy.get('[data-testid="notes-textarea"]').type('I can donate immediately')
      
      cy.get('[data-testid="confirm-response-button"]').click()
      cy.waitForSpinner()
      
      cy.waitForToast('Response sent successfully')
      cy.get('[data-testid="response-modal"]').should('not.exist')
    })

    it('should show donation history', () => {
      cy.visit('/history')
      
      cy.get('[data-testid="donation-history"]').should('be.visible')
      cy.get('[data-testid="history-item"]').should('have.length.at.least', 1)
      
      cy.get('[data-testid="history-item"]').first().within(() => {
        cy.get('[data-testid="donation-date"]').should('be.visible')
        cy.get('[data-testid="recipient-info"]').should('be.visible')
        cy.get('[data-testid="donation-status"]').should('be.visible')
      })
    })
  })

  describe('Real-time Features', () => {
    it('should show real-time notifications', () => {
      cy.loginAsDonor()
      cy.mockNotificationPermission('granted')
      
      // Simulate receiving a notification
      cy.window().then((win) => {
        win.postMessage({
          type: 'BLOOD_REQUEST_NOTIFICATION',
          data: {
            id: 'request-123',
            bloodType: 'O+',
            urgency: 'high',
            location: 'Emergency Hospital',
          },
        }, '*')
      })
      
      cy.get('[data-testid="notification-toast"]').should('be.visible')
      cy.get('[data-testid="notification-toast"]').should('contain', 'Urgent blood request')
      cy.get('[data-testid="notification-toast"]').should('contain', 'O+')
    })

    it('should update request status in real-time', () => {
      cy.loginAsHospital()
      cy.visit('/requests')
      
      // Create a request
      cy.get('[data-testid="create-request-button"]').click()
      cy.fillBloodRequestForm({
        bloodType: 'A+',
        unitsNeeded: 1,
        urgency: 'medium',
        location: 'Test Hospital',
      })
      cy.get('[data-testid="submit-request-button"]').click()
      cy.waitForSpinner()
      
      // Check initial status
      cy.get('[data-testid="request-status"]').first().should('contain', 'Active')
      
      // Simulate status update from another user
      cy.window().then((win) => {
        win.postMessage({
          type: 'REQUEST_STATUS_UPDATE',
          data: {
            id: 'request-123',
            status: 'in_progress',
          },
        }, '*')
      })
      
      // Verify status updated
      cy.get('[data-testid="request-status"]').first().should('contain', 'In Progress')
    })
  })

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      cy.setMobileViewport()
    })

    it('should work on mobile devices', () => {
      cy.loginAsDonor()
      cy.visit('/dashboard')
      
      // Check mobile navigation
      cy.get('[data-testid="mobile-menu-button"]').should('be.visible')
      cy.get('[data-testid="mobile-menu-button"]').click()
      cy.get('[data-testid="mobile-menu"]').should('be.visible')
      
      // Check responsive layout
      cy.get('[data-testid="request-card"]').should('be.visible')
      cy.get('[data-testid="request-card"]').should('have.css', 'width')
    })

    it('should handle touch interactions', () => {
      cy.loginAsDonor()
      cy.visit('/dashboard')
      
      // Test swipe gestures on request cards
      cy.get('[data-testid="request-card"]').first()
        .trigger('touchstart', { touches: [{ clientX: 100, clientY: 100 }] })
        .trigger('touchmove', { touches: [{ clientX: 200, clientY: 100 }] })
        .trigger('touchend')
      
      cy.get('[data-testid="swipe-actions"]').should('be.visible')
    })
  })

  describe('Accessibility', () => {
    it('should be accessible to screen readers', () => {
      cy.loginAsDonor()
      cy.visit('/dashboard')
      cy.checkAccessibility()
    })

    it('should support keyboard navigation', () => {
      cy.visit('/login')
      
      // Tab through form elements
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'email-input')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'password-input')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'login-button')
    })

    it('should have proper ARIA labels', () => {
      cy.visit('/request')
      
      cy.get('[data-testid="blood-type-select"]').should('have.attr', 'aria-label')
      cy.get('[data-testid="urgency-select"]').should('have.attr', 'aria-label')
      cy.get('[data-testid="submit-request-button"]').should('have.attr', 'aria-label')
    })
  })

  describe('Performance', () => {
    it('should load pages quickly', () => {
      const startTime = Date.now()
      
      cy.visit('/dashboard')
      cy.get('[data-testid="dashboard-content"]').should('be.visible')
      
      cy.then(() => {
        const loadTime = Date.now() - startTime
        expect(loadTime).to.be.lessThan(3000) // Should load in less than 3 seconds
      })
    })

    it('should handle large datasets efficiently', () => {
      cy.loginAsAdmin()
      cy.visit('/admin/users')
      
      // Load page with many users
      cy.get('[data-testid="user-list"]').should('be.visible')
      cy.get('[data-testid="user-row"]').should('have.length.at.least', 50)
      
      // Test virtual scrolling
      cy.get('[data-testid="user-list"]').scrollTo('bottom')
      cy.get('[data-testid="loading-more"]').should('be.visible')
      cy.get('[data-testid="user-row"]').should('have.length.at.least', 100)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      cy.intercept('GET', '/api/blood-requests', { forceNetworkError: true })
      
      cy.loginAsDonor()
      cy.visit('/dashboard')
      
      cy.get('[data-testid="error-message"]').should('be.visible')
      cy.get('[data-testid="error-message"]').should('contain', 'network error')
      cy.get('[data-testid="retry-button"]').should('be.visible')
    })

    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '/api/blood-requests', { statusCode: 500, body: { error: 'Server error' } })
      
      cy.loginAsDonor()
      cy.visit('/dashboard')
      
      cy.get('[data-testid="error-message"]').should('be.visible')
      cy.get('[data-testid="error-message"]').should('contain', 'server error')
    })

    it('should handle session expiration', () => {
      cy.loginAsDonor()
      
      // Simulate session expiration
      cy.intercept('GET', '/api/profile', { statusCode: 401, body: { error: 'Unauthorized' } })
      
      cy.visit('/profile')
      
      cy.url().should('include', '/login')
      cy.waitForToast('Session expired')
    })
  })
})
