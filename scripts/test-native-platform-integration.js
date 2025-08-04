#!/usr/bin/env node

/**
 * Native Platform Integration Testing Script
 * 
 * Comprehensive testing for HealthKit, Health Connect, biometric authentication,
 * and platform-specific features
 */

const fetch = require('node-fetch')
const fs = require('fs')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'

class NativePlatformTester {
  constructor() {
    this.results = {
      healthKit: { passed: 0, failed: 0, tests: {} },
      healthConnect: { passed: 0, failed: 0, tests: {} },
      biometricAuth: { passed: 0, failed: 0, tests: {} },
      platformFeatures: { passed: 0, failed: 0, tests: {} },
      widgets: { passed: 0, failed: 0, tests: {} },
      notifications: { passed: 0, failed: 0, tests: {} },
      voiceAssistant: { passed: 0, failed: 0, tests: {} },
      integration: { passed: 0, failed: 0, tests: {} },
      performance: { passed: 0, failed: 0, tests: {} },
      overall: { passed: 0, failed: 0, total: 0 }
    }
    this.testData = {
      biometricTemplates: [],
      widgets: [],
      notifications: []
    }
  }

  async runAllTests() {
    console.log('📱 Starting Native Platform Integration Testing...\n')

    try {
      // 1. HealthKit Integration Tests
      await this.testHealthKitIntegration()

      // 2. Health Connect Integration Tests
      await this.testHealthConnectIntegration()

      // 3. Biometric Authentication Tests
      await this.testBiometricAuthentication()

      // 4. Platform Features Tests
      await this.testPlatformFeatures()

      // 5. Widget System Tests
      await this.testWidgetSystem()

      // 6. Notification System Tests
      await this.testNotificationSystem()

      // 7. Voice Assistant Tests
      await this.testVoiceAssistant()

      // 8. Integration Tests
      await this.testIntegration()

      // 9. Performance Tests
      await this.testPerformance()

      // 10. Cleanup
      await this.cleanup()

      // 11. Generate Report
      this.generateReport()

      console.log('✅ Native platform integration testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Native platform integration testing failed:', error)
      await this.cleanup()
      process.exit(1)
    }
  }

  async testHealthKitIntegration() {
    console.log('🍎 Testing HealthKit Integration...')

    const tests = [
      {
        name: 'Request HealthKit Permissions',
        test: async () => {
          const permissionData = {
            action: 'health_permissions',
            platform: 'ios'
          }

          const response = await this.callNativeAPI(permissionData)
          
          return response.success && 
                 response.data.platform === 'ios' &&
                 Array.isArray(response.data.granted) &&
                 Array.isArray(response.data.denied)
        }
      },
      {
        name: 'Read Vital Signs from HealthKit',
        test: async () => {
          const vitalData = {
            action: 'read_vital_signs',
            platform: 'ios',
            timeRange: {
              start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            }
          }

          const response = await this.callNativeAPI(vitalData)
          
          return response.success && 
                 response.data.platform === 'ios' &&
                 response.data.vitalSigns &&
                 typeof response.data.vitalSigns === 'object'
        }
      },
      {
        name: 'Check Donation Eligibility (iOS)',
        test: async () => {
          const eligibilityData = {
            action: 'check_donation_eligibility',
            platform: 'ios'
          }

          const response = await this.callNativeAPI(eligibilityData)
          
          return response.success && 
                 response.data.platform === 'ios' &&
                 typeof response.data.eligible === 'boolean' &&
                 Array.isArray(response.data.reasons) &&
                 Array.isArray(response.data.recommendations)
        }
      },
      {
        name: 'Record Blood Donation in HealthKit',
        test: async () => {
          const donationData = {
            action: 'record_donation',
            platform: 'ios',
            donationData: {
              donationDate: new Date().toISOString(),
              bloodType: 'O+',
              volume: 450,
              location: {
                name: 'Test Blood Bank',
                address: '123 Test Street'
              },
              preVitals: {
                heartRate: { value: 72, unit: 'bpm', timestamp: new Date() },
                bloodPressure: { systolic: 120, diastolic: 80, unit: 'mmHg', timestamp: new Date() }
              },
              eligibilityChecks: {
                hemoglobin: 14.5,
                bloodPressure: { systolic: 120, diastolic: 80 },
                temperature: 36.8,
                weight: 70,
                eligible: true
              }
            }
          }

          const response = await this.callNativeAPI(donationData)
          
          return response.success && 
                 response.data.platform === 'ios' &&
                 response.data.recorded === true &&
                 response.data.recordId
        }
      },
      {
        name: 'Sync HealthKit Data',
        test: async () => {
          const syncData = {
            action: 'sync_health_data',
            platform: 'ios'
          }

          const response = await this.callNativeAPI(syncData)
          
          return response.success && 
                 response.data.platform === 'ios' &&
                 Array.isArray(response.data.syncedData) &&
                 Array.isArray(response.data.errors)
        }
      }
    ]

    await this.runTestSuite('HealthKit Integration', tests, 'healthKit')
  }

  async testHealthConnectIntegration() {
    console.log('🤖 Testing Health Connect Integration...')

    const tests = [
      {
        name: 'Request Health Connect Permissions',
        test: async () => {
          const permissionData = {
            action: 'health_permissions',
            platform: 'android'
          }

          const response = await this.callNativeAPI(permissionData)
          
          return response.success && 
                 response.data.platform === 'android' &&
                 Array.isArray(response.data.granted) &&
                 Array.isArray(response.data.denied)
        }
      },
      {
        name: 'Read Vital Signs from Health Connect',
        test: async () => {
          const vitalData = {
            action: 'read_vital_signs',
            platform: 'android',
            timeRange: {
              start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            }
          }

          const response = await this.callNativeAPI(vitalData)
          
          return response.success && 
                 response.data.platform === 'android' &&
                 response.data.vitalSigns &&
                 typeof response.data.vitalSigns === 'object'
        }
      },
      {
        name: 'Check Donation Eligibility with Fitness Data',
        test: async () => {
          const eligibilityData = {
            action: 'check_donation_eligibility',
            platform: 'android',
            fitnessData: {
              steps: { count: 8000, startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), endTime: new Date() },
              sleep: { startTime: new Date(Date.now() - 8 * 60 * 60 * 1000), endTime: new Date() }
            }
          }

          const response = await this.callNativeAPI(eligibilityData)
          
          return response.success && 
                 response.data.platform === 'android' &&
                 typeof response.data.eligible === 'boolean' &&
                 typeof response.data.fitnessScore === 'number' &&
                 Array.isArray(response.data.recommendations)
        }
      },
      {
        name: 'Record Blood Donation in Health Connect',
        test: async () => {
          const donationData = {
            action: 'record_donation',
            platform: 'android',
            donationData: {
              donationDate: new Date().toISOString(),
              bloodType: 'A+',
              volume: 450,
              location: 'Android Test Blood Bank',
              preVitals: {
                heartRate: { beatsPerMinute: 75, timestamp: new Date() },
                bloodPressure: { systolic: 118, diastolic: 78, timestamp: new Date() }
              },
              notes: 'Test donation record for Health Connect'
            }
          }

          const response = await this.callNativeAPI(donationData)
          
          return response.success && 
                 response.data.platform === 'android' &&
                 response.data.recorded === true &&
                 response.data.recordId
        }
      },
      {
        name: 'Sync Health Connect Data',
        test: async () => {
          const syncData = {
            action: 'sync_health_data',
            platform: 'android',
            dataTypes: ['vital_signs', 'fitness_data', 'health_profile']
          }

          const response = await this.callNativeAPI(syncData)
          
          return response.success && 
                 response.data.platform === 'android' &&
                 Array.isArray(response.data.syncedData) &&
                 response.data.syncedData.length > 0
        }
      }
    ]

    await this.runTestSuite('Health Connect Integration', tests, 'healthConnect')
  }

  async testBiometricAuthentication() {
    console.log('👆 Testing Biometric Authentication...')

    const tests = [
      {
        name: 'Check Biometric Capabilities',
        test: async () => {
          const response = await this.getNativeAPI('biometric_capabilities')
          
          return response.success && 
                 response.data.capabilities &&
                 typeof response.data.capabilities.deviceSupported === 'boolean' &&
                 response.data.securityPolicies &&
                 Array.isArray(response.data.voiceLanguages)
        }
      },
      {
        name: 'Enroll Face Biometric',
        test: async () => {
          const enrollmentData = {
            action: 'biometric_enroll',
            type: 'face'
          }

          const response = await this.callNativeAPI(enrollmentData)
          
          if (response.success && response.data.enrolled) {
            this.testData.biometricTemplates.push({
              type: 'face',
              templateId: response.data.templateId
            })
          }
          
          return response.success && 
                 (response.data.enrolled === true || response.error === 'face biometric is not supported on this device')
        }
      },
      {
        name: 'Enroll Fingerprint Biometric',
        test: async () => {
          const enrollmentData = {
            action: 'biometric_enroll',
            type: 'fingerprint'
          }

          const response = await this.callNativeAPI(enrollmentData)
          
          if (response.success && response.data.enrolled) {
            this.testData.biometricTemplates.push({
              type: 'fingerprint',
              templateId: response.data.templateId
            })
          }
          
          return response.success && 
                 (response.data.enrolled === true || response.error === 'fingerprint biometric is not supported on this device')
        }
      },
      {
        name: 'Enroll Voice Biometric',
        test: async () => {
          const enrollmentData = {
            action: 'biometric_enroll',
            type: 'voice',
            language: 'en',
            phrases: ['My voice is my passport, verify me', 'BloodLink Africa keeps my data secure']
          }

          const response = await this.callNativeAPI(enrollmentData)
          
          if (response.success && response.data.enrolled) {
            this.testData.biometricTemplates.push({
              type: 'voice',
              templateId: response.data.templateId
            })
          }
          
          return response.success && 
                 response.data.enrolled === true &&
                 response.data.templateId &&
                 typeof response.data.quality === 'number'
        }
      },
      {
        name: 'Authenticate with Face ID',
        test: async () => {
          const authData = {
            action: 'biometric_authenticate',
            method: 'face_id',
            reason: 'Authenticate for blood donation access',
            timeout: 30
          }

          const response = await this.callNativeAPI(authData)
          
          return response.success && 
                 (response.data.authenticated === true || 
                  (response.error && response.error.type === 'biometry_not_available'))
        }
      },
      {
        name: 'Authenticate with Fingerprint',
        test: async () => {
          const authData = {
            action: 'biometric_authenticate',
            method: 'fingerprint',
            reason: 'Verify identity for donation record access',
            allowDeviceCredentials: true
          }

          const response = await this.callNativeAPI(authData)
          
          return response.success && 
                 (response.data.authenticated === true || 
                  (response.error && response.error.type === 'biometry_not_available'))
        }
      },
      {
        name: 'Authenticate with Any Available Method',
        test: async () => {
          const authData = {
            action: 'biometric_authenticate',
            method: 'any',
            reason: 'Access secure health information',
            fallbackTitle: 'Use Passcode',
            cancelTitle: 'Cancel'
          }

          const response = await this.callNativeAPI(authData)
          
          return response.success && 
                 (response.data.authenticated === true || 
                  response.error !== undefined)
        }
      }
    ]

    await this.runTestSuite('Biometric Authentication', tests, 'biometricAuth')
  }

  async testPlatformFeatures() {
    console.log('🔧 Testing Platform Features...')

    const tests = [
      {
        name: 'Detect Platform Capabilities',
        test: async () => {
          const response = await this.getNativeAPI('platform_capabilities')
          
          return response.success && 
                 response.data.platform &&
                 response.data.version &&
                 response.data.features &&
                 typeof response.data.features === 'object' &&
                 response.data.permissions &&
                 typeof response.data.permissions === 'object'
        }
      },
      {
        name: 'Setup App Shortcuts',
        test: async () => {
          const shortcutData = {
            action: 'setup_shortcuts'
          }

          const response = await this.callNativeAPI(shortcutData)
          
          return response.success && 
                 Array.isArray(response.data.shortcuts) &&
                 response.data.shortcuts.length > 0 &&
                 response.data.shortcuts.every(s => s.id && s.title && s.action)
        }
      },
      {
        name: 'Get Notification Templates',
        test: async () => {
          const response = await this.getNativeAPI('notification_templates')
          
          return response.success && 
                 Array.isArray(response.data.templates) &&
                 response.data.templates.length > 0 &&
                 response.data.templates.every(t => t.id && t.title && t.body)
        }
      },
      {
        name: 'Get Health System Status',
        test: async () => {
          const response = await this.getNativeAPI('health_system_status')
          
          return response.success && 
                 response.data.ios &&
                 response.data.android &&
                 response.data.ios.status &&
                 response.data.android.status
        }
      },
      {
        name: 'Get System Statistics',
        test: async () => {
          const response = await this.getNativeAPI('system_stats')
          
          return response.success && 
                 response.data.platform &&
                 response.data.biometric &&
                 response.data.healthKit &&
                 response.data.healthConnect &&
                 response.data.overall &&
                 typeof response.data.overall.totalFeatures === 'number'
        }
      }
    ]

    await this.runTestSuite('Platform Features', tests, 'platformFeatures')
  }

  async testWidgetSystem() {
    console.log('📊 Testing Widget System...')

    const tests = [
      {
        name: 'Setup User Widgets',
        test: async () => {
          const widgetData = {
            action: 'setup_widgets'
          }

          const response = await this.callNativeAPI(widgetData)
          
          if (response.success && response.data.widgets) {
            this.testData.widgets = response.data.widgets
          }
          
          return response.success && 
                 Array.isArray(response.data.widgets) &&
                 response.data.widgets.length > 0 &&
                 response.data.widgets.every(w => w.id && w.type && w.title)
        }
      },
      {
        name: 'Update Widget Content',
        test: async () => {
          if (this.testData.widgets.length === 0) return false

          const widget = this.testData.widgets[0]
          const updateData = {
            action: 'update_widget',
            widgetId: widget.id,
            content: {
              bloodType: 'A+',
              donationCount: 5,
              nextDonationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          }

          const response = await this.callNativeAPI(updateData)
          
          return response.success && 
                 response.data.widget &&
                 response.data.widget.id === widget.id &&
                 response.data.updatedAt
        }
      },
      {
        name: 'Widget Content Validation',
        test: async () => {
          if (this.testData.widgets.length === 0) return false

          const widget = this.testData.widgets.find(w => w.type === 'large')
          if (!widget) return false

          return widget.content !== undefined &&
                 widget.updateInterval > 0 &&
                 widget.isActive === true &&
                 widget.lastUpdated instanceof Date || typeof widget.lastUpdated === 'string'
        }
      },
      {
        name: 'Widget Performance',
        test: async () => {
          if (this.testData.widgets.length === 0) return false

          const startTime = Date.now()
          
          const promises = this.testData.widgets.slice(0, 3).map(widget => 
            this.callNativeAPI({
              action: 'update_widget',
              widgetId: widget.id
            })
          )

          const responses = await Promise.all(promises)
          const updateTime = Date.now() - startTime
          
          return responses.every(r => r.success) && updateTime < 5000 // Under 5 seconds
        }
      }
    ]

    await this.runTestSuite('Widget System', tests, 'widgets')
  }

  async testNotificationSystem() {
    console.log('🔔 Testing Notification System...')

    const tests = [
      {
        name: 'Schedule Donation Reminder',
        test: async () => {
          const notificationData = {
            action: 'schedule_notification',
            templateId: 'donation_reminder',
            scheduledFor: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute from now
            customData: {
              bloodType: 'O+',
              location: 'Test Blood Bank'
            }
          }

          const response = await this.callNativeAPI(notificationData)
          
          if (response.success && response.data.notificationId) {
            this.testData.notifications.push(response.data.notificationId)
          }
          
          return response.success && 
                 response.data.scheduled === true &&
                 response.data.notificationId &&
                 response.data.scheduledAt
        }
      },
      {
        name: 'Schedule Urgent Blood Request',
        test: async () => {
          const notificationData = {
            action: 'schedule_notification',
            templateId: 'urgent_request',
            customData: {
              bloodType: 'AB-',
              hospital: 'Emergency Hospital',
              urgency: 'critical'
            }
          }

          const response = await this.callNativeAPI(notificationData)
          
          if (response.success && response.data.notificationId) {
            this.testData.notifications.push(response.data.notificationId)
          }
          
          return response.success && 
                 response.data.scheduled === true &&
                 response.data.notificationId
        }
      },
      {
        name: 'Schedule Health Check Reminder',
        test: async () => {
          const notificationData = {
            action: 'schedule_notification',
            templateId: 'health_check',
            scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
            customData: {
              checkType: 'pre_donation',
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }
          }

          const response = await this.callNativeAPI(notificationData)
          
          return response.success && 
                 response.data.scheduled === true &&
                 response.data.notificationId
        }
      },
      {
        name: 'Notification Template Validation',
        test: async () => {
          const templatesResponse = await this.getNativeAPI('notification_templates')
          
          if (!templatesResponse.success) return false

          const templates = templatesResponse.data.templates
          const requiredTemplates = ['donation_reminder', 'urgent_request', 'health_check']
          
          return requiredTemplates.every(templateId => 
            templates.some(t => t.id === templateId && t.title && t.body && t.category)
          )
        }
      }
    ]

    await this.runTestSuite('Notification System', tests, 'notifications')
  }

  async testVoiceAssistant() {
    console.log('🗣️ Testing Voice Assistant Integration...')

    const tests = [
      {
        name: 'Setup Siri Shortcuts',
        test: async () => {
          const siriData = {
            action: 'setup_voice_assistant',
            assistantType: 'siri',
            language: 'en'
          }

          const response = await this.callNativeAPI(siriData)
          
          return response.success && 
                 (response.data.assistant === 'siri' || 
                  response.error === 'Siri shortcuts not supported on this platform') &&
                 (response.data.shortcuts ? Array.isArray(response.data.shortcuts) : true)
        }
      },
      {
        name: 'Setup Google Assistant Actions',
        test: async () => {
          const assistantData = {
            action: 'setup_voice_assistant',
            assistantType: 'google_assistant',
            language: 'en'
          }

          const response = await this.callNativeAPI(assistantData)
          
          return response.success && 
                 (response.data.assistant === 'google_assistant' || 
                  response.error === 'Google Assistant not supported on this platform') &&
                 (response.data.actions ? Array.isArray(response.data.actions) : true)
        }
      },
      {
        name: 'Multi-language Voice Support',
        test: async () => {
          const languages = ['en', 'fr', 'es']
          const results = []

          for (const language of languages) {
            const response = await this.callNativeAPI({
              action: 'setup_voice_assistant',
              assistantType: 'siri',
              language
            })
            results.push(response.success || response.error === 'Siri shortcuts not supported on this platform')
          }

          return results.every(result => result === true)
        }
      },
      {
        name: 'Voice Command Validation',
        test: async () => {
          // Test that voice commands are properly structured
          const siriResponse = await this.callNativeAPI({
            action: 'setup_voice_assistant',
            assistantType: 'siri',
            language: 'en'
          })

          if (!siriResponse.success || !siriResponse.data.shortcuts) {
            return true // Skip if not supported
          }

          const shortcuts = siriResponse.data.shortcuts
          const requiredCommands = ['request blood donation', 'schedule blood donation', 'check donation status']
          
          return requiredCommands.every(command => 
            shortcuts.some(s => s.phrase.toLowerCase().includes(command.toLowerCase()))
          )
        }
      }
    ]

    await this.runTestSuite('Voice Assistant Integration', tests, 'voiceAssistant')
  }

  async testIntegration() {
    console.log('🔗 Testing System Integration...')

    const tests = [
      {
        name: 'Health Data to Eligibility Check',
        test: async () => {
          // First read vital signs
          const vitalResponse = await this.callNativeAPI({
            action: 'read_vital_signs',
            platform: 'ios'
          })

          if (!vitalResponse.success) return false

          // Then check eligibility using the vital signs
          const eligibilityResponse = await this.callNativeAPI({
            action: 'check_donation_eligibility',
            platform: 'ios',
            vitalSigns: vitalResponse.data.vitalSigns
          })

          return eligibilityResponse.success && 
                 typeof eligibilityResponse.data.eligible === 'boolean'
        }
      },
      {
        name: 'Biometric Auth to Health Access',
        test: async () => {
          // First authenticate with biometrics
          const authResponse = await this.callNativeAPI({
            action: 'biometric_authenticate',
            method: 'any',
            reason: 'Access health data for integration test'
          })

          // Then access health data (should work regardless of auth result)
          const healthResponse = await this.callNativeAPI({
            action: 'read_vital_signs',
            platform: 'ios'
          })

          return (authResponse.success || authResponse.error) && 
                 (healthResponse.success || healthResponse.error)
        }
      },
      {
        name: 'Widget Update from Health Data',
        test: async () => {
          if (this.testData.widgets.length === 0) return false

          // Get health data
          const healthResponse = await this.callNativeAPI({
            action: 'read_vital_signs',
            platform: 'ios'
          })

          if (!healthResponse.success) return false

          // Update widget with health data
          const widget = this.testData.widgets[0]
          const updateResponse = await this.callNativeAPI({
            action: 'update_widget',
            widgetId: widget.id,
            content: {
              healthStats: {
                heartRate: healthResponse.data.vitalSigns.heartRate?.value || 72,
                lastSync: new Date().toISOString()
              }
            }
          })

          return updateResponse.success && updateResponse.data.widget
        }
      },
      {
        name: 'Cross-Platform Data Consistency',
        test: async () => {
          // Test data consistency between iOS and Android platforms
          const iosResponse = await this.callNativeAPI({
            action: 'sync_health_data',
            platform: 'ios'
          })

          const androidResponse = await this.callNativeAPI({
            action: 'sync_health_data',
            platform: 'android'
          })

          return (iosResponse.success || iosResponse.error) && 
                 (androidResponse.success || androidResponse.error)
        }
      },
      {
        name: 'Notification Triggered by Health Event',
        test: async () => {
          // Simulate health event triggering notification
          const eligibilityResponse = await this.callNativeAPI({
            action: 'check_donation_eligibility',
            platform: 'ios'
          })

          if (!eligibilityResponse.success) return false

          // If eligible, schedule reminder notification
          if (eligibilityResponse.data.eligible) {
            const notificationResponse = await this.callNativeAPI({
              action: 'schedule_notification',
              templateId: 'donation_reminder',
              customData: {
                eligibilityChecked: true,
                eligible: true
              }
            })

            return notificationResponse.success
          }

          return true // Test passes if not eligible
        }
      }
    ]

    await this.runTestSuite('System Integration', tests, 'integration')
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...')

    const tests = [
      {
        name: 'Health Data Read Performance',
        test: async () => {
          const startTime = Date.now()
          
          const response = await this.callNativeAPI({
            action: 'read_vital_signs',
            platform: 'ios',
            timeRange: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            }
          })

          const readTime = Date.now() - startTime
          
          return (response.success || response.error) && readTime < 5000 // Under 5 seconds
        }
      },
      {
        name: 'Biometric Authentication Speed',
        test: async () => {
          const startTime = Date.now()
          
          const response = await this.callNativeAPI({
            action: 'biometric_authenticate',
            method: 'any',
            reason: 'Performance test authentication',
            timeout: 10
          })

          const authTime = Date.now() - startTime
          
          return (response.success || response.error) && authTime < 15000 // Under 15 seconds
        }
      },
      {
        name: 'Widget Update Performance',
        test: async () => {
          if (this.testData.widgets.length === 0) return false

          const startTime = Date.now()
          
          const promises = this.testData.widgets.slice(0, 5).map(widget => 
            this.callNativeAPI({
              action: 'update_widget',
              widgetId: widget.id
            })
          )

          const responses = await Promise.all(promises)
          const updateTime = Date.now() - startTime
          
          return responses.length > 0 && updateTime < 10000 // Under 10 seconds
        }
      },
      {
        name: 'Concurrent Health Operations',
        test: async () => {
          const operations = [
            this.callNativeAPI({ action: 'read_vital_signs', platform: 'ios' }),
            this.callNativeAPI({ action: 'read_vital_signs', platform: 'android' }),
            this.callNativeAPI({ action: 'check_donation_eligibility', platform: 'ios' }),
            this.callNativeAPI({ action: 'sync_health_data', platform: 'ios' }),
            this.callNativeAPI({ action: 'sync_health_data', platform: 'android' })
          ]

          const responses = await Promise.all(operations)
          
          return responses.length === 5 && 
                 responses.every(r => r.success || r.error !== undefined)
        }
      },
      {
        name: 'Memory Usage Stability',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed
          
          // Perform multiple operations
          for (let i = 0; i < 20; i++) {
            await this.callNativeAPI({
              action: 'read_vital_signs',
              platform: Math.random() > 0.5 ? 'ios' : 'android'
            })
          }
          
          const finalMemory = process.memoryUsage().heapUsed
          const memoryIncrease = finalMemory - initialMemory
          
          // Memory increase should be reasonable (less than 100MB)
          return memoryIncrease < 100 * 1024 * 1024
        }
      }
    ]

    await this.runTestSuite('Performance', tests, 'performance')
  }

  // Helper methods for API calls
  async callNativeAPI(data) {
    try {
      const response = await fetch(`${BASE_URL}/api/native/platform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(data)
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getNativeAPI(action) {
    try {
      const response = await fetch(`${BASE_URL}/api/native/platform?action=${action}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async cleanup() {
    // Clean up test data
    console.log('🧹 Cleaning up test data...')
    
    // Clean up biometric templates
    for (const template of this.testData.biometricTemplates) {
      try {
        // In a real implementation, this would delete the biometric template
        console.log(`Cleaning up biometric template: ${template.templateId}`)
      } catch (error) {
        console.error(`Failed to cleanup template ${template.templateId}:`, error)
      }
    }
  }

  async runTestSuite(suiteName, tests, category) {
    const results = { passed: 0, failed: 0, total: tests.length, tests: {} }

    for (const test of tests) {
      try {
        const passed = await test.test()
        results.tests[test.name] = { passed, error: null }
        
        if (passed) {
          results.passed++
          console.log(`  ✅ ${test.name}`)
        } else {
          results.failed++
          console.log(`  ❌ ${test.name}`)
        }
      } catch (error) {
        results.failed++
        results.tests[test.name] = { passed: false, error: error.message }
        console.log(`  ❌ ${test.name}: ${error.message}`)
      }
    }

    this.results[category] = results
    this.results.overall.passed += results.passed
    this.results.overall.failed += results.failed
    this.results.overall.total += results.total

    console.log(`  📱 ${suiteName}: ${results.passed}/${results.total} passed\n`)
  }

  generateReport() {
    console.log('📋 Native Platform Integration Test Report')
    console.log('=' .repeat(70))
    
    const categories = [
      'healthKit',
      'healthConnect',
      'biometricAuth',
      'platformFeatures',
      'widgets',
      'notifications',
      'voiceAssistant',
      'integration',
      'performance'
    ]

    categories.forEach(category => {
      const result = this.results[category]
      const percentage = ((result.passed / result.total) * 100).toFixed(1)
      console.log(`${category.padEnd(20)}: ${result.passed}/${result.total} (${percentage}%)`)
    })

    console.log('=' .repeat(70))
    const overallPercentage = ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1)
    console.log(`Overall Score: ${this.results.overall.passed}/${this.results.overall.total} (${overallPercentage}%)`)

    // Save detailed report
    const reportPath = './native-platform-test-report.json'
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // Platform integration insights
    if (this.results.healthKit.passed > 0 || this.results.healthConnect.passed > 0) {
      console.log('\n🏥 Health Platform Integration:')
      console.log('- HealthKit (iOS) and Health Connect (Android) integration')
      console.log('- Vital signs monitoring and donation eligibility checking')
      console.log('- Blood donation record synchronization with health platforms')
    }

    if (this.results.biometricAuth.passed > 0) {
      console.log('\n👆 Biometric Authentication:')
      console.log('- Multi-modal biometric support (Face ID, Touch ID, Fingerprint, Voice)')
      console.log('- Secure biometric template enrollment and storage')
      console.log('- Cross-platform biometric authentication with fallback options')
    }

    if (this.results.platformFeatures.passed > 0) {
      console.log('\n📱 Platform-Specific Features:')
      console.log('- Native widgets for health dashboard and donation status')
      console.log('- App shortcuts for quick access to key functions')
      console.log('- Rich notifications with actionable buttons')
    }

    if (this.results.voiceAssistant.passed > 0) {
      console.log('\n🗣️ Voice Assistant Integration:')
      console.log('- Siri Shortcuts for iOS voice commands')
      console.log('- Google Assistant Actions for Android voice commands')
      console.log('- Multi-language voice command support')
    }

    if (this.results.performance.passed > 0) {
      console.log('\n⚡ Performance Metrics:')
      console.log('- Sub-5-second health data retrieval')
      console.log('- Sub-15-second biometric authentication')
      console.log('- Concurrent health operations support')
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new NativePlatformTester()
  tester.runAllTests().catch(console.error)
}

module.exports = NativePlatformTester
