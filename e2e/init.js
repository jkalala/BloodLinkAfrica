/**
 * E2E Test Initialization
 * 
 * Setup and configuration for Detox E2E tests including
 * custom matchers, utilities, and test environment preparation
 */

const { DetoxCircusEnvironment, SpecReporter, WorkerAssignReporter } = require('detox/runners/jest-circus')
const adapter = require('detox/runners/jest-circus/adapter')
const { device } = require('detox')

// Custom test utilities
const TestUtils = require('./utils/testUtils')
const ScreenshotUtils = require('./utils/screenshotUtils')
const PerformanceUtils = require('./utils/performanceUtils')
const AccessibilityUtils = require('./utils/accessibilityUtils')

// Test data and fixtures
const TestData = require('./fixtures/testData')
const MockData = require('./fixtures/mockData')

// Global test configuration
const TEST_CONFIG = {
  defaultTimeout: 10000,
  longTimeout: 30000,
  shortTimeout: 5000,
  retryAttempts: 3,
  screenshotOnFailure: true,
  performanceMonitoring: true,
  accessibilityTesting: true,
  visualRegressionTesting: process.env.VISUAL_REGRESSION === 'true'
}

// Global test state
global.testState = {
  currentTest: null,
  testStartTime: null,
  screenshots: [],
  performanceMetrics: [],
  accessibilityResults: []
}

// Setup global test utilities
global.TestUtils = TestUtils
global.ScreenshotUtils = ScreenshotUtils
global.PerformanceUtils = PerformanceUtils
global.AccessibilityUtils = AccessibilityUtils
global.TestData = TestData
global.MockData = MockData
global.TEST_CONFIG = TEST_CONFIG

// Custom Jest matchers for mobile testing
expect.extend({
  // Element visibility matchers
  async toBeVisibleOnScreen(element) {
    try {
      await expect(element).toBeVisible()
      return {
        message: () => 'Element is visible on screen',
        pass: true
      }
    } catch (error) {
      return {
        message: () => `Element is not visible on screen: ${error.message}`,
        pass: false
      }
    }
  },

  // Text content matchers
  async toHaveTextContent(element, expectedText) {
    try {
      await expect(element).toHaveText(expectedText)
      return {
        message: () => `Element has expected text content: ${expectedText}`,
        pass: true
      }
    } catch (error) {
      return {
        message: () => `Element does not have expected text content: ${error.message}`,
        pass: false
      }
    }
  },

  // Accessibility matchers
  async toBeAccessible(element) {
    try {
      const accessibilityResult = await AccessibilityUtils.checkElementAccessibility(element)
      if (accessibilityResult.isAccessible) {
        return {
          message: () => 'Element meets accessibility requirements',
          pass: true
        }
      } else {
        return {
          message: () => `Element fails accessibility requirements: ${accessibilityResult.issues.join(', ')}`,
          pass: false
        }
      }
    } catch (error) {
      return {
        message: () => `Accessibility check failed: ${error.message}`,
        pass: false
      }
    }
  },

  // Performance matchers
  async toLoadWithinTime(action, maxTime) {
    try {
      const startTime = Date.now()
      await action()
      const loadTime = Date.now() - startTime
      
      if (loadTime <= maxTime) {
        return {
          message: () => `Action completed within ${maxTime}ms (actual: ${loadTime}ms)`,
          pass: true
        }
      } else {
        return {
          message: () => `Action took too long: ${loadTime}ms (expected: ≤${maxTime}ms)`,
          pass: false
        }
      }
    } catch (error) {
      return {
        message: () => `Performance test failed: ${error.message}`,
        pass: false
      }
    }
  },

  // Visual regression matchers
  async toMatchVisualSnapshot(element, snapshotName) {
    if (!TEST_CONFIG.visualRegressionTesting) {
      return {
        message: () => 'Visual regression testing is disabled',
        pass: true
      }
    }

    try {
      const screenshot = await ScreenshotUtils.takeElementScreenshot(element, snapshotName)
      const comparisonResult = await ScreenshotUtils.compareWithBaseline(screenshot, snapshotName)
      
      if (comparisonResult.isMatch) {
        return {
          message: () => `Visual snapshot matches baseline: ${snapshotName}`,
          pass: true
        }
      } else {
        return {
          message: () => `Visual snapshot differs from baseline: ${snapshotName} (diff: ${comparisonResult.diffPercentage}%)`,
          pass: false
        }
      }
    } catch (error) {
      return {
        message: () => `Visual regression test failed: ${error.message}`,
        pass: false
      }
    }
  }
})

// Global test hooks
beforeAll(async () => {
  console.log('🚀 Starting E2E test suite...')
  
  // Initialize test environment
  await TestUtils.initializeTestEnvironment()
  
  // Setup mock data if needed
  if (process.env.USE_MOCK_DATA === 'true') {
    await MockData.setupMockData()
  }
  
  // Clear any existing test data
  await TestUtils.clearTestData()
  
  console.log('✅ E2E test environment initialized')
})

beforeEach(async () => {
  const testName = expect.getState().currentTestName
  global.testState.currentTest = testName
  global.testState.testStartTime = Date.now()
  
  console.log(`📱 Starting test: ${testName}`)
  
  // Take initial screenshot
  if (TEST_CONFIG.screenshotOnFailure) {
    await ScreenshotUtils.takeScreenshot(`${testName}_start`)
  }
  
  // Start performance monitoring
  if (TEST_CONFIG.performanceMonitoring) {
    await PerformanceUtils.startMonitoring()
  }
  
  // Reset app state
  await TestUtils.resetAppState()
})

afterEach(async () => {
  const testName = global.testState.currentTest
  const testDuration = Date.now() - global.testState.testStartTime
  
  console.log(`⏱️  Test completed: ${testName} (${testDuration}ms)`)
  
  // Stop performance monitoring
  if (TEST_CONFIG.performanceMonitoring) {
    const metrics = await PerformanceUtils.stopMonitoring()
    global.testState.performanceMetrics.push({
      testName,
      duration: testDuration,
      metrics
    })
  }
  
  // Take final screenshot
  if (TEST_CONFIG.screenshotOnFailure) {
    await ScreenshotUtils.takeScreenshot(`${testName}_end`)
  }
  
  // Handle test failure
  const testState = expect.getState()
  if (testState.assertionCalls > testState.numPassingAsserts) {
    console.log(`❌ Test failed: ${testName}`)
    
    // Take failure screenshot
    await ScreenshotUtils.takeScreenshot(`${testName}_failure`)
    
    // Collect debug information
    await TestUtils.collectDebugInfo(testName)
  }
})

afterAll(async () => {
  console.log('🏁 E2E test suite completed')
  
  // Generate test report
  await TestUtils.generateTestReport({
    screenshots: global.testState.screenshots,
    performanceMetrics: global.testState.performanceMetrics,
    accessibilityResults: global.testState.accessibilityResults
  })
  
  // Cleanup test data
  await TestUtils.cleanupTestData()
  
  console.log('✅ E2E test cleanup completed')
})

// Error handling
process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  
  // Take emergency screenshot
  try {
    await ScreenshotUtils.takeScreenshot('unhandled_rejection')
  } catch (error) {
    console.error('Failed to take emergency screenshot:', error)
  }
})

// Device-specific setup
const setupDeviceSpecificConfig = async () => {
  const platform = device.getPlatform()
  const deviceName = await device.name
  
  console.log(`📱 Device: ${deviceName} (${platform})`)
  
  // Platform-specific configurations
  if (platform === 'ios') {
    // iOS-specific setup
    await TestUtils.setupiOSSpecificConfig()
  } else if (platform === 'android') {
    // Android-specific setup
    await TestUtils.setupAndroidSpecificConfig()
  }
  
  // Device-specific timeouts
  if (deviceName.includes('iPad') || deviceName.includes('Tablet')) {
    TEST_CONFIG.defaultTimeout = 15000 // Tablets may be slower
  }
}

// Initialize device-specific configuration
setupDeviceSpecificConfig().catch(error => {
  console.error('Failed to setup device-specific configuration:', error)
})

// Export configuration for use in tests
module.exports = {
  TEST_CONFIG,
  TestUtils,
  ScreenshotUtils,
  PerformanceUtils,
  AccessibilityUtils,
  TestData,
  MockData
}
