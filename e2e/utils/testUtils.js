/**
 * E2E Test Utilities
 * 
 * Comprehensive utilities for mobile E2E testing including
 * app navigation, data management, and device interactions
 */

const { device, element, by, waitFor } = require('detox')
const fs = require('fs').promises
const path = require('path')

class TestUtils {
  static async initializeTestEnvironment() {
    console.log('🔧 Initializing test environment...')
    
    // Ensure app is installed and launched
    await device.installApp()
    await device.launchApp({
      newInstance: true,
      permissions: {
        notifications: 'YES',
        camera: 'YES',
        photos: 'YES',
        location: 'inuse',
        contacts: 'YES'
      }
    })
    
    // Wait for app to be ready
    await this.waitForAppToLoad()
    
    // Setup test user if needed
    await this.setupTestUser()
  }

  static async waitForAppToLoad(timeout = 30000) {
    console.log('⏳ Waiting for app to load...')
    
    try {
      // Wait for main navigation or splash screen to disappear
      await waitFor(element(by.id('app-loading')))
        .not.toBeVisible()
        .withTimeout(timeout)
      
      // Wait for main content to be visible
      await waitFor(element(by.id('main-content')))
        .toBeVisible()
        .withTimeout(timeout)
        
      console.log('✅ App loaded successfully')
    } catch (error) {
      console.error('❌ App failed to load:', error)
      throw error
    }
  }

  static async setupTestUser() {
    console.log('👤 Setting up test user...')
    
    try {
      // Check if user is already logged in
      const isLoggedIn = await this.isUserLoggedIn()
      
      if (!isLoggedIn) {
        await this.loginTestUser()
      }
      
      console.log('✅ Test user setup completed')
    } catch (error) {
      console.error('❌ Failed to setup test user:', error)
      throw error
    }
  }

  static async isUserLoggedIn() {
    try {
      // Check for user profile or dashboard elements
      await waitFor(element(by.id('user-profile')))
        .toBeVisible()
        .withTimeout(5000)
      return true
    } catch (error) {
      return false
    }
  }

  static async loginTestUser() {
    console.log('🔐 Logging in test user...')
    
    const testUser = {
      email: 'test@bloodlink.africa',
      password: 'TestPassword123!'
    }
    
    try {
      // Navigate to login screen
      await this.navigateToLogin()
      
      // Fill login form
      await element(by.id('email-input')).typeText(testUser.email)
      await element(by.id('password-input')).typeText(testUser.password)
      
      // Submit login
      await element(by.id('login-button')).tap()
      
      // Wait for login to complete
      await waitFor(element(by.id('dashboard')))
        .toBeVisible()
        .withTimeout(10000)
        
      console.log('✅ Test user logged in successfully')
    } catch (error) {
      console.error('❌ Failed to login test user:', error)
      throw error
    }
  }

  static async navigateToLogin() {
    try {
      // Check if login button is visible on welcome screen
      const loginButton = element(by.id('welcome-login-button'))
      await waitFor(loginButton).toBeVisible().withTimeout(5000)
      await loginButton.tap()
    } catch (error) {
      // Try alternative navigation paths
      try {
        await element(by.id('menu-button')).tap()
        await element(by.id('login-menu-item')).tap()
      } catch (altError) {
        console.error('Failed to navigate to login:', error)
        throw error
      }
    }
  }

  static async resetAppState() {
    console.log('🔄 Resetting app state...')
    
    try {
      // Reset to home/dashboard
      await this.navigateToHome()
      
      // Clear any modals or overlays
      await this.dismissModals()
      
      // Reset scroll positions
      await this.resetScrollPositions()
      
      console.log('✅ App state reset completed')
    } catch (error) {
      console.warn('⚠️  App state reset partially failed:', error)
    }
  }

  static async navigateToHome() {
    try {
      // Try to tap home tab or button
      const homeTab = element(by.id('home-tab'))
      await homeTab.tap()
    } catch (error) {
      // Alternative navigation
      try {
        await device.pressBack() // Android back button
      } catch (backError) {
        // iOS or other navigation
        const backButton = element(by.id('back-button'))
        await backButton.tap()
      }
    }
  }

  static async dismissModals() {
    const modalSelectors = [
      'modal-overlay',
      'popup-overlay',
      'alert-overlay',
      'notification-overlay'
    ]
    
    for (const selector of modalSelectors) {
      try {
        const modal = element(by.id(selector))
        await waitFor(modal).toBeVisible().withTimeout(1000)
        
        // Try to dismiss modal
        const closeButton = element(by.id(`${selector}-close`))
        await closeButton.tap()
      } catch (error) {
        // Modal not present or already dismissed
      }
    }
  }

  static async resetScrollPositions() {
    const scrollableSelectors = [
      'main-scroll-view',
      'list-scroll-view',
      'content-scroll-view'
    ]
    
    for (const selector of scrollableSelectors) {
      try {
        const scrollView = element(by.id(selector))
        await scrollView.scrollTo('top')
      } catch (error) {
        // Scroll view not present
      }
    }
  }

  static async clearTestData() {
    console.log('🗑️  Clearing test data...')
    
    try {
      // Clear app data through device settings or app reset
      await device.clearKeychain()
      
      // Clear any cached data
      await this.clearAppCache()
      
      console.log('✅ Test data cleared')
    } catch (error) {
      console.warn('⚠️  Failed to clear some test data:', error)
    }
  }

  static async clearAppCache() {
    // Platform-specific cache clearing
    const platform = device.getPlatform()
    
    if (platform === 'ios') {
      // iOS cache clearing
      await device.shake() // Trigger developer menu if available
    } else if (platform === 'android') {
      // Android cache clearing
      await device.pressBack()
    }
  }

  static async setupiOSSpecificConfig() {
    console.log('🍎 Setting up iOS-specific configuration...')
    
    // iOS-specific permissions and settings
    await device.setURLBlacklist(['.*facebook.*', '.*google-analytics.*'])
    
    // Disable iOS animations for faster testing
    await device.setStatusBar({
      time: '12:34',
      dataNetwork: 'wifi',
      wifiMode: 'active',
      batteryState: 'charged',
      batteryLevel: 100
    })
  }

  static async setupAndroidSpecificConfig() {
    console.log('🤖 Setting up Android-specific configuration...')
    
    // Android-specific permissions and settings
    await device.setURLBlacklist(['.*facebook.*', '.*google-analytics.*'])
    
    // Disable Android animations
    await device.setDemoMode(true)
  }

  static async collectDebugInfo(testName) {
    console.log(`🔍 Collecting debug info for: ${testName}`)
    
    const debugInfo = {
      testName,
      timestamp: new Date().toISOString(),
      device: await device.name,
      platform: device.getPlatform(),
      appState: await this.getAppState(),
      deviceLogs: await this.getDeviceLogs(),
      networkState: await this.getNetworkState()
    }
    
    // Save debug info to file
    const debugPath = path.join(__dirname, '../artifacts/debug', `${testName}_debug.json`)
    await this.ensureDirectoryExists(path.dirname(debugPath))
    await fs.writeFile(debugPath, JSON.stringify(debugInfo, null, 2))
    
    console.log(`💾 Debug info saved to: ${debugPath}`)
  }

  static async getAppState() {
    try {
      // Get current screen/view information
      return {
        currentScreen: await this.getCurrentScreen(),
        visibleElements: await this.getVisibleElements(),
        appVersion: await this.getAppVersion()
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  static async getCurrentScreen() {
    // Try to identify current screen by visible elements
    const screenIdentifiers = [
      { id: 'dashboard', name: 'Dashboard' },
      { id: 'donor-list', name: 'Donor List' },
      { id: 'appointment-calendar', name: 'Appointments' },
      { id: 'donation-form', name: 'Donation Form' },
      { id: 'profile-screen', name: 'Profile' },
      { id: 'login-screen', name: 'Login' }
    ]
    
    for (const screen of screenIdentifiers) {
      try {
        await waitFor(element(by.id(screen.id)))
          .toBeVisible()
          .withTimeout(1000)
        return screen.name
      } catch (error) {
        // Screen not visible
      }
    }
    
    return 'Unknown'
  }

  static async getVisibleElements() {
    // This would require platform-specific implementation
    // For now, return a placeholder
    return ['placeholder-element']
  }

  static async getAppVersion() {
    try {
      // Try to get version from settings or about screen
      return 'v1.0.0' // Placeholder
    } catch (error) {
      return 'unknown'
    }
  }

  static async getDeviceLogs() {
    try {
      // Get device logs (platform-specific)
      const platform = device.getPlatform()
      
      if (platform === 'ios') {
        // iOS system logs
        return 'iOS logs not implemented'
      } else if (platform === 'android') {
        // Android logcat
        return 'Android logs not implemented'
      }
      
      return 'No logs available'
    } catch (error) {
      return `Failed to get logs: ${error.message}`
    }
  }

  static async getNetworkState() {
    try {
      // Check network connectivity
      return {
        isConnected: true, // Placeholder
        connectionType: 'wifi' // Placeholder
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  static async generateTestReport(data) {
    console.log('📊 Generating test report...')
    
    const report = {
      timestamp: new Date().toISOString(),
      device: await device.name,
      platform: device.getPlatform(),
      testSummary: {
        totalTests: data.performanceMetrics.length,
        screenshots: data.screenshots.length,
        accessibilityResults: data.accessibilityResults.length
      },
      performanceMetrics: data.performanceMetrics,
      screenshots: data.screenshots,
      accessibilityResults: data.accessibilityResults
    }
    
    const reportPath = path.join(__dirname, '../reports/test-report.json')
    await this.ensureDirectoryExists(path.dirname(reportPath))
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    console.log(`📋 Test report saved to: ${reportPath}`)
  }

  static async cleanupTestData() {
    console.log('🧹 Cleaning up test data...')
    
    try {
      // Logout test user
      await this.logoutTestUser()
      
      // Clear app data
      await this.clearTestData()
      
      // Reset app to initial state
      await device.launchApp({ newInstance: true })
      
      console.log('✅ Test data cleanup completed')
    } catch (error) {
      console.warn('⚠️  Test cleanup partially failed:', error)
    }
  }

  static async logoutTestUser() {
    try {
      // Navigate to profile/settings
      await element(by.id('profile-tab')).tap()
      
      // Find and tap logout button
      await element(by.id('logout-button')).tap()
      
      // Confirm logout if needed
      try {
        await element(by.id('confirm-logout')).tap()
      } catch (error) {
        // No confirmation needed
      }
      
      // Wait for logout to complete
      await waitFor(element(by.id('welcome-screen')))
        .toBeVisible()
        .withTimeout(10000)
        
      console.log('✅ Test user logged out')
    } catch (error) {
      console.warn('⚠️  Failed to logout test user:', error)
    }
  }

  static async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath)
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  // Navigation helpers
  static async navigateToScreen(screenId) {
    console.log(`🧭 Navigating to screen: ${screenId}`)
    
    try {
      await element(by.id(`${screenId}-tab`)).tap()
    } catch (error) {
      // Try alternative navigation
      await element(by.id('menu-button')).tap()
      await element(by.id(`${screenId}-menu-item`)).tap()
    }
    
    // Wait for screen to load
    await waitFor(element(by.id(screenId)))
      .toBeVisible()
      .withTimeout(10000)
  }

  // Form helpers
  static async fillForm(formData) {
    for (const [fieldId, value] of Object.entries(formData)) {
      await element(by.id(fieldId)).typeText(value)
    }
  }

  static async submitForm(formId = 'submit-button') {
    await element(by.id(formId)).tap()
  }

  // List helpers
  static async scrollToElement(elementId, direction = 'down') {
    const scrollView = element(by.id('main-scroll-view'))
    
    for (let i = 0; i < 10; i++) {
      try {
        await waitFor(element(by.id(elementId)))
          .toBeVisible()
          .withTimeout(1000)
        return // Element found
      } catch (error) {
        // Continue scrolling
        await scrollView.scroll(200, direction)
      }
    }
    
    throw new Error(`Element ${elementId} not found after scrolling`)
  }

  // Wait helpers
  static async waitForElement(elementId, timeout = 10000) {
    await waitFor(element(by.id(elementId)))
      .toBeVisible()
      .withTimeout(timeout)
  }

  static async waitForElementToDisappear(elementId, timeout = 10000) {
    await waitFor(element(by.id(elementId)))
      .not.toBeVisible()
      .withTimeout(timeout)
  }
}

module.exports = TestUtils
