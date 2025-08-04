/**
 * Donor Registration E2E Test
 * 
 * Comprehensive end-to-end testing for donor registration flow
 * including accessibility, performance, and visual regression testing
 */

const { device, element, by, waitFor } = require('detox')

describe('Donor Registration Flow', () => {
  beforeAll(async () => {
    console.log('🚀 Starting Donor Registration E2E Tests')
    
    // Ensure app is ready
    await TestUtils.waitForAppToLoad()
    
    // Navigate to registration
    await TestUtils.navigateToScreen('registration')
  })

  beforeEach(async () => {
    // Reset form state before each test
    await TestUtils.resetAppState()
    await TestUtils.navigateToScreen('registration')
  })

  describe('Registration Form Validation', () => {
    it('should display validation errors for empty required fields', async () => {
      console.log('📝 Testing form validation for empty fields')
      
      // Try to submit empty form
      await element(by.id('submit-registration')).tap()
      
      // Check for validation errors
      await expect(element(by.id('first-name-error'))).toBeVisible()
      await expect(element(by.id('last-name-error'))).toBeVisible()
      await expect(element(by.id('email-error'))).toBeVisible()
      await expect(element(by.id('phone-error'))).toBeVisible()
      
      // Take screenshot for visual verification
      await ScreenshotUtils.takeScreenshot('validation_errors_empty_fields')
    })

    it('should validate email format', async () => {
      console.log('📧 Testing email format validation')
      
      // Enter invalid email
      await element(by.id('email-input')).typeText('invalid-email')
      await element(by.id('submit-registration')).tap()
      
      // Check for email format error
      await expect(element(by.id('email-error'))).toBeVisible()
      await expect(element(by.id('email-error'))).toHaveText('Please enter a valid email address')
      
      // Clear and enter valid email
      await element(by.id('email-input')).clearText()
      await element(by.id('email-input')).typeText('donor@bloodlink.africa')
      
      // Error should disappear
      await expect(element(by.id('email-error'))).not.toBeVisible()
    })

    it('should validate phone number format', async () => {
      console.log('📱 Testing phone number validation')
      
      // Enter invalid phone number
      await element(by.id('phone-input')).typeText('123')
      await element(by.id('submit-registration')).tap()
      
      // Check for phone format error
      await expect(element(by.id('phone-error'))).toBeVisible()
      
      // Enter valid phone number
      await element(by.id('phone-input')).clearText()
      await element(by.id('phone-input')).typeText('+254712345678')
      
      // Error should disappear
      await expect(element(by.id('phone-error'))).not.toBeVisible()
    })

    it('should validate age requirements', async () => {
      console.log('🎂 Testing age validation')
      
      // Enter birth date for someone under 18
      await element(by.id('birth-date-input')).tap()
      await element(by.id('date-picker-year')).tap()
      await element(by.text('2010')).tap() // Makes them ~14 years old
      await element(by.id('date-picker-confirm')).tap()
      
      await element(by.id('submit-registration')).tap()
      
      // Check for age error
      await expect(element(by.id('age-error'))).toBeVisible()
      await expect(element(by.id('age-error'))).toHaveText('You must be at least 18 years old to donate blood')
    })
  })

  describe('Registration Form Completion', () => {
    it('should successfully register a new donor with valid information', async () => {
      console.log('✅ Testing successful donor registration')
      
      // Start performance monitoring
      await PerformanceUtils.startMonitoring()
      
      const donorData = {
        'first-name-input': 'John',
        'last-name-input': 'Doe',
        'email-input': 'john.doe@bloodlink.africa',
        'phone-input': '+254712345678'
      }
      
      // Fill out the form
      await TestUtils.fillForm(donorData)
      
      // Set birth date
      await element(by.id('birth-date-input')).tap()
      await element(by.id('date-picker-year')).tap()
      await element(by.text('1990')).tap()
      await element(by.id('date-picker-month')).tap()
      await element(by.text('May')).tap()
      await element(by.id('date-picker-day')).tap()
      await element(by.text('15')).tap()
      await element(by.id('date-picker-confirm')).tap()
      
      // Select blood type
      await element(by.id('blood-type-dropdown')).tap()
      await element(by.text('O+')).tap()
      
      // Select gender
      await element(by.id('gender-male')).tap()
      
      // Fill address
      await element(by.id('address-input')).typeText('123 Main Street')
      await element(by.id('city-input')).typeText('Nairobi')
      
      // Accept terms and conditions
      await element(by.id('terms-checkbox')).tap()
      
      // Take screenshot before submission
      await ScreenshotUtils.takeScreenshot('registration_form_completed')
      
      // Submit form
      await element(by.id('submit-registration')).tap()
      
      // Wait for success message
      await waitFor(element(by.id('registration-success')))
        .toBeVisible()
        .withTimeout(10000)
      
      // Verify success message
      await expect(element(by.id('registration-success'))).toBeVisible()
      await expect(element(by.id('success-message')))
        .toHaveText('Registration successful! Welcome to BloodLink Africa.')
      
      // Take screenshot of success state
      await ScreenshotUtils.takeScreenshot('registration_success')
      
      // Stop performance monitoring and check metrics
      const metrics = await PerformanceUtils.stopMonitoring()
      expect(metrics.app.averageApiResponseTime).toBeLessThan(3000) // API should respond within 3 seconds
      
      // Verify navigation to dashboard
      await waitFor(element(by.id('dashboard')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('should handle duplicate email registration gracefully', async () => {
      console.log('🔄 Testing duplicate email handling')
      
      const existingDonorData = {
        'first-name-input': 'Jane',
        'last-name-input': 'Smith',
        'email-input': 'existing@bloodlink.africa', // Assume this email already exists
        'phone-input': '+254712345679'
      }
      
      // Fill out form with existing email
      await TestUtils.fillForm(existingDonorData)
      
      // Complete other required fields
      await element(by.id('birth-date-input')).tap()
      await element(by.id('date-picker-year')).tap()
      await element(by.text('1985')).tap()
      await element(by.id('date-picker-confirm')).tap()
      
      await element(by.id('blood-type-dropdown')).tap()
      await element(by.text('A+')).tap()
      
      await element(by.id('gender-female')).tap()
      await element(by.id('terms-checkbox')).tap()
      
      // Submit form
      await element(by.id('submit-registration')).tap()
      
      // Check for duplicate email error
      await waitFor(element(by.id('email-exists-error')))
        .toBeVisible()
        .withTimeout(5000)
      
      await expect(element(by.id('email-exists-error')))
        .toHaveText('An account with this email already exists. Please use a different email or sign in.')
      
      // Verify form is still visible (not navigated away)
      await expect(element(by.id('registration-form'))).toBeVisible()
    })
  })

  describe('Accessibility Testing', () => {
    it('should meet accessibility requirements for registration form', async () => {
      console.log('♿ Testing registration form accessibility')
      
      // Test screen-level accessibility
      const accessibilityResult = await AccessibilityUtils.checkScreenAccessibility('registration')
      
      // Verify overall accessibility score
      expect(accessibilityResult.overallScore).toBeGreaterThan(85)
      
      // Check specific form elements
      await expect(element(by.id('first-name-input'))).toBeAccessible()
      await expect(element(by.id('email-input'))).toBeAccessible()
      await expect(element(by.id('submit-registration'))).toBeAccessible()
      
      // Test with screen reader simulation
      await AccessibilityUtils.testWithScreenReader(true)
      
      // Verify form can be navigated with screen reader
      await element(by.id('first-name-input')).tap()
      await element(by.id('first-name-input')).typeText('John')
      
      // Navigate to next field using accessibility
      await device.pressKey('tab') // Move to next field
      await element(by.id('last-name-input')).typeText('Doe')
      
      await AccessibilityUtils.testWithScreenReader(false)
    })

    it('should work with high contrast mode', async () => {
      console.log('🎨 Testing high contrast mode compatibility')
      
      // Enable high contrast mode
      await AccessibilityUtils.testWithHighContrast(true)
      
      // Take screenshot in high contrast mode
      await ScreenshotUtils.takeScreenshot('registration_high_contrast')
      
      // Verify form is still usable
      await element(by.id('first-name-input')).typeText('Test')
      await expect(element(by.id('first-name-input'))).toHaveText('Test')
      
      // Disable high contrast mode
      await AccessibilityUtils.testWithHighContrast(false)
    })

    it('should work with large text mode', async () => {
      console.log('📝 Testing large text mode compatibility')
      
      // Enable large text mode
      await AccessibilityUtils.testWithLargeText(true)
      
      // Take screenshot in large text mode
      await ScreenshotUtils.takeScreenshot('registration_large_text')
      
      // Verify form layout adapts properly
      await expect(element(by.id('registration-form'))).toBeVisible()
      await expect(element(by.id('submit-registration'))).toBeVisible()
      
      // Test scrolling if needed
      await TestUtils.scrollToElement('submit-registration')
      
      // Disable large text mode
      await AccessibilityUtils.testWithLargeText(false)
    })
  })

  describe('Visual Regression Testing', () => {
    it('should match visual baseline for registration form', async () => {
      console.log('📸 Testing visual regression for registration form')
      
      // Take screenshot and compare with baseline
      const visualResult = await ScreenshotUtils.runVisualRegressionTest(
        'registration_form_baseline',
        element(by.id('registration-form')),
        { threshold: 0.05 } // 5% difference threshold
      )
      
      expect(visualResult.isMatch).toBe(true)
      
      if (!visualResult.isMatch) {
        console.warn(`Visual regression detected: ${visualResult.diffPercentage}% difference`)
      }
    })

    it('should match visual baseline for validation errors', async () => {
      console.log('📸 Testing visual regression for validation errors')
      
      // Trigger validation errors
      await element(by.id('submit-registration')).tap()
      
      // Wait for errors to appear
      await waitFor(element(by.id('first-name-error')))
        .toBeVisible()
        .withTimeout(2000)
      
      // Compare with baseline
      const visualResult = await ScreenshotUtils.runVisualRegressionTest(
        'registration_validation_errors',
        element(by.id('registration-form')),
        { threshold: 0.05 }
      )
      
      expect(visualResult.isMatch).toBe(true)
    })

    it('should match visual baseline for success state', async () => {
      console.log('📸 Testing visual regression for success state')
      
      // Complete registration successfully
      const donorData = {
        'first-name-input': 'Visual',
        'last-name-input': 'Test',
        'email-input': 'visual.test@bloodlink.africa',
        'phone-input': '+254712345680'
      }
      
      await TestUtils.fillForm(donorData)
      
      // Complete other fields quickly
      await element(by.id('birth-date-input')).tap()
      await element(by.text('1990')).tap()
      await element(by.id('date-picker-confirm')).tap()
      
      await element(by.id('blood-type-dropdown')).tap()
      await element(by.text('B+')).tap()
      
      await element(by.id('gender-male')).tap()
      await element(by.id('terms-checkbox')).tap()
      
      await element(by.id('submit-registration')).tap()
      
      // Wait for success state
      await waitFor(element(by.id('registration-success')))
        .toBeVisible()
        .withTimeout(10000)
      
      // Compare success state with baseline
      const visualResult = await ScreenshotUtils.runVisualRegressionTest(
        'registration_success_state',
        element(by.id('registration-success')),
        { threshold: 0.05 }
      )
      
      expect(visualResult.isMatch).toBe(true)
    })
  })

  describe('Performance Testing', () => {
    it('should load registration form within performance thresholds', async () => {
      console.log('⚡ Testing registration form load performance')
      
      // Measure form load time
      const loadTime = await PerformanceUtils.measureActionPerformance(
        'Load Registration Form',
        async () => {
          await TestUtils.navigateToScreen('registration')
          await waitFor(element(by.id('registration-form')))
            .toBeVisible()
            .withTimeout(5000)
        }
      )
      
      // Form should load within 2 seconds
      expect(loadTime.duration).toBeLessThan(2000)
      expect(loadTime.success).toBe(true)
    })

    it('should submit registration within performance thresholds', async () => {
      console.log('⚡ Testing registration submission performance')
      
      // Fill form first
      const donorData = {
        'first-name-input': 'Performance',
        'last-name-input': 'Test',
        'email-input': 'performance.test@bloodlink.africa',
        'phone-input': '+254712345681'
      }
      
      await TestUtils.fillForm(donorData)
      
      // Complete required fields
      await element(by.id('birth-date-input')).tap()
      await element(by.text('1988')).tap()
      await element(by.id('date-picker-confirm')).tap()
      
      await element(by.id('blood-type-dropdown')).tap()
      await element(by.text('AB+')).tap()
      
      await element(by.id('gender-female')).tap()
      await element(by.id('terms-checkbox')).tap()
      
      // Measure submission time
      const submissionTime = await PerformanceUtils.measureActionPerformance(
        'Submit Registration',
        async () => {
          await element(by.id('submit-registration')).tap()
          await waitFor(element(by.id('registration-success')))
            .toBeVisible()
            .withTimeout(10000)
        }
      )
      
      // Submission should complete within 5 seconds
      expect(submissionTime.duration).toBeLessThan(5000)
      expect(submissionTime.success).toBe(true)
    })

    it('should maintain good performance during form interaction', async () => {
      console.log('⚡ Testing form interaction performance')
      
      await PerformanceUtils.startMonitoring()
      
      // Simulate realistic form interaction
      await element(by.id('first-name-input')).typeText('Interactive')
      await element(by.id('last-name-input')).typeText('Performance')
      await element(by.id('email-input')).typeText('interactive@bloodlink.africa')
      
      // Test dropdown interaction
      await element(by.id('blood-type-dropdown')).tap()
      await element(by.text('O-')).tap()
      
      // Test date picker interaction
      await element(by.id('birth-date-input')).tap()
      await element(by.id('date-picker-year')).tap()
      await element(by.text('1992')).tap()
      await element(by.id('date-picker-confirm')).tap()
      
      const metrics = await PerformanceUtils.stopMonitoring()
      
      // Check performance metrics
      expect(metrics.fps.average).toBeGreaterThan(45) // Maintain good FPS
      expect(metrics.memory.appPeak).toBeLessThan(200) // Keep memory usage reasonable
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      console.log('🌐 Testing network error handling')
      
      // Simulate network disconnection
      await device.setURLBlacklist(['.*'])
      
      // Fill and submit form
      const donorData = {
        'first-name-input': 'Network',
        'last-name-input': 'Error',
        'email-input': 'network.error@bloodlink.africa',
        'phone-input': '+254712345682'
      }
      
      await TestUtils.fillForm(donorData)
      
      // Complete form
      await element(by.id('birth-date-input')).tap()
      await element(by.text('1987')).tap()
      await element(by.id('date-picker-confirm')).tap()
      
      await element(by.id('blood-type-dropdown')).tap()
      await element(by.text('A-')).tap()
      
      await element(by.id('gender-male')).tap()
      await element(by.id('terms-checkbox')).tap()
      
      await element(by.id('submit-registration')).tap()
      
      // Check for network error message
      await waitFor(element(by.id('network-error')))
        .toBeVisible()
        .withTimeout(10000)
      
      await expect(element(by.id('network-error')))
        .toHaveText('Network error. Please check your connection and try again.')
      
      // Verify retry button is available
      await expect(element(by.id('retry-button'))).toBeVisible()
      
      // Restore network
      await device.setURLBlacklist([])
      
      // Test retry functionality
      await element(by.id('retry-button')).tap()
      
      // Should now succeed
      await waitFor(element(by.id('registration-success')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should handle server errors gracefully', async () => {
      console.log('🔧 Testing server error handling')
      
      // This would require mocking server responses
      // For now, we'll test the UI behavior
      
      // Fill form
      const donorData = {
        'first-name-input': 'Server',
        'last-name-input': 'Error',
        'email-input': 'server.error@bloodlink.africa',
        'phone-input': '+254712345683'
      }
      
      await TestUtils.fillForm(donorData)
      
      // Complete form
      await element(by.id('birth-date-input')).tap()
      await element(by.text('1986')).tap()
      await element(by.id('date-picker-confirm')).tap()
      
      await element(by.id('blood-type-dropdown')).tap()
      await element(by.text('B-')).tap()
      
      await element(by.id('gender-female')).tap()
      await element(by.id('terms-checkbox')).tap()
      
      await element(by.id('submit-registration')).tap()
      
      // In a real test, we would mock a server error response
      // For now, we'll verify the form handles submission attempts
      
      // Should either succeed or show appropriate error
      try {
        await waitFor(element(by.id('registration-success')))
          .toBeVisible()
          .withTimeout(10000)
        console.log('✅ Registration succeeded')
      } catch (error) {
        // Check for error message
        await expect(element(by.id('server-error'))).toBeVisible()
        console.log('✅ Server error handled gracefully')
      }
    })
  })

  afterEach(async () => {
    // Take final screenshot for each test
    const testName = expect.getState().currentTestName
    await ScreenshotUtils.takeScreenshot(`${testName}_final`)
  })

  afterAll(async () => {
    console.log('🏁 Donor Registration E2E Tests Completed')
    
    // Generate accessibility summary
    await AccessibilityUtils.generateAccessibilitySummary()
    
    // Generate screenshot report
    await ScreenshotUtils.generateScreenshotReport(global.testState.screenshots)
    
    // Clean up test data
    await TestUtils.cleanupTestData()
  })
})
