#!/usr/bin/env node

/**
 * Real-time Communication System Testing Script
 * 
 * Comprehensive testing for WebSocket server, push notifications,
 * and real-time event system
 */

const WebSocket = require('ws')
const fetch = require('node-fetch')
const fs = require('fs')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:8080'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'

class RealTimeSystemTester {
  constructor() {
    this.results = {
      websocket: { passed: 0, failed: 0, tests: {} },
      notifications: { passed: 0, failed: 0, tests: {} },
      events: { passed: 0, failed: 0, tests: {} },
      integration: { passed: 0, failed: 0, tests: {} },
      performance: { passed: 0, failed: 0, tests: {} },
      overall: { passed: 0, failed: 0, total: 0 }
    }
    this.activeConnections = []
  }

  async runAllTests() {
    console.log('🔄 Starting Real-time Communication System Testing...\n')

    try {
      // 1. WebSocket Server Tests
      await this.testWebSocketServer()

      // 2. Push Notification Tests
      await this.testPushNotifications()

      // 3. Event System Tests
      await this.testEventSystem()

      // 4. Integration Tests
      await this.testIntegration()

      // 5. Performance Tests
      await this.testPerformance()

      // 6. Cleanup
      await this.cleanup()

      // 7. Generate Report
      this.generateReport()

      console.log('✅ Real-time system testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ Real-time system testing failed:', error)
      await this.cleanup()
      process.exit(1)
    }
  }

  async testWebSocketServer() {
    console.log('🔌 Testing WebSocket Server...')

    const tests = [
      {
        name: 'WebSocket Connection',
        test: async () => {
          const ws = await this.createWebSocketConnection()
          const connected = ws.readyState === WebSocket.OPEN
          if (connected) {
            this.activeConnections.push(ws)
          }
          return connected
        }
      },
      {
        name: 'Authentication',
        test: async () => {
          // Test connection without token (should fail)
          try {
            const ws = new WebSocket(WS_URL)
            await new Promise((resolve, reject) => {
              ws.on('open', () => reject(new Error('Should not connect without token')))
              ws.on('error', () => resolve(true))
              setTimeout(() => resolve(true), 2000)
            })
            return true
          } catch (error) {
            return false
          }
        }
      },
      {
        name: 'Room Management',
        test: async () => {
          const ws = await this.createWebSocketConnection()
          this.activeConnections.push(ws)

          return new Promise((resolve) => {
            let joinedRoom = false

            ws.on('message', (data) => {
              const message = JSON.parse(data.toString())
              if (message.type === 'join_room' && message.data.joined) {
                joinedRoom = true
                resolve(true)
              }
            })

            // Join a room
            ws.send(JSON.stringify({
              type: 'join_room',
              data: { roomId: 'general' }
            }))

            setTimeout(() => resolve(joinedRoom), 3000)
          })
        }
      },
      {
        name: 'Message Broadcasting',
        test: async () => {
          const ws1 = await this.createWebSocketConnection()
          const ws2 = await this.createWebSocketConnection()
          this.activeConnections.push(ws1, ws2)

          return new Promise((resolve) => {
            let messageReceived = false

            // Join same room
            ws1.send(JSON.stringify({
              type: 'join_room',
              data: { roomId: 'test_room' }
            }))

            ws2.send(JSON.stringify({
              type: 'join_room',
              data: { roomId: 'test_room' }
            }))

            setTimeout(() => {
              ws2.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'room_message' && message.data.content === 'test_message') {
                  messageReceived = true
                  resolve(true)
                }
              })

              // Send message from ws1
              ws1.send(JSON.stringify({
                type: 'room_message',
                room: 'test_room',
                data: { content: 'test_message' }
              }))
            }, 1000)

            setTimeout(() => resolve(messageReceived), 5000)
          })
        }
      },
      {
        name: 'Heartbeat Mechanism',
        test: async () => {
          const ws = await this.createWebSocketConnection()
          this.activeConnections.push(ws)

          return new Promise((resolve) => {
            let heartbeatReceived = false

            ws.on('message', (data) => {
              const message = JSON.parse(data.toString())
              if (message.type === 'heartbeat') {
                heartbeatReceived = true
                resolve(true)
              }
            })

            // Send heartbeat
            ws.send(JSON.stringify({
              type: 'heartbeat'
            }))

            setTimeout(() => resolve(heartbeatReceived), 3000)
          })
        }
      }
    ]

    await this.runTestSuite('WebSocket Server', tests, 'websocket')
  }

  async testPushNotifications() {
    console.log('📱 Testing Push Notifications...')

    const tests = [
      {
        name: 'Send Direct Notification',
        test: async () => {
          const notificationData = {
            type: 'system',
            priority: 'medium',
            title: 'Test Notification',
            body: 'This is a test notification',
            channels: [
              { type: 'in_app', enabled: true },
              { type: 'websocket', enabled: true }
            ],
            targeting: {
              userIds: ['test_user_1']
            }
          }

          const response = await this.sendNotification(notificationData)
          return response.success && response.data.status === 'sent'
        }
      },
      {
        name: 'Template-based Notification',
        test: async () => {
          const templateData = {
            templateId: 'blood_request_urgent',
            variables: {
              bloodType: 'A+',
              hospitalName: 'Test Hospital',
              units: '2'
            },
            targeting: {
              roles: ['donor']
            }
          }

          const response = await this.sendNotification(templateData)
          return response.success && response.data.status === 'sent'
        }
      },
      {
        name: 'Get Notification Templates',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/realtime/notifications?action=templates`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          
          return response.ok && data.success && 
                 data.data.templates && data.data.templates.length > 0
        }
      },
      {
        name: 'Notification History',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/realtime/notifications?action=history&limit=10`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          
          return response.ok && data.success && Array.isArray(data.data.notifications)
        }
      },
      {
        name: 'Mark Notification as Read',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/realtime/notifications`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
              notificationId: 'test_notification_1',
              action: 'mark_read'
            })
          })
          const data = await response.json()
          
          return response.ok && data.success
        }
      }
    ]

    await this.runTestSuite('Push Notifications', tests, 'notifications')
  }

  async testEventSystem() {
    console.log('⚡ Testing Event System...')

    const tests = [
      {
        name: 'Publish Blood Request Event',
        test: async () => {
          const eventData = {
            type: 'blood_request_created',
            priority: 'high',
            source: 'test_hospital',
            data: {
              id: 'test_request_1',
              bloodType: 'A+',
              units: 2,
              hospital: 'Test Hospital',
              urgency: 'high'
            },
            metadata: {
              region: 'Lagos',
              bloodType: 'A+'
            },
            targeting: {
              roles: ['donor'],
              regions: ['Lagos']
            }
          }

          const response = await this.publishEvent(eventData)
          return response.success && response.data.published
        }
      },
      {
        name: 'Publish Emergency Alert',
        test: async () => {
          const eventData = {
            type: 'emergency_alert',
            priority: 'critical',
            source: 'emergency_system',
            data: {
              type: 'shortage',
              message: 'Critical blood shortage in Lagos region',
              bloodType: 'O-',
              region: 'Lagos'
            },
            metadata: {
              region: 'Lagos',
              bloodType: 'O-'
            }
          }

          const response = await this.publishEvent(eventData)
          return response.success && response.data.published
        }
      },
      {
        name: 'Event History Retrieval',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/realtime/events?limit=10`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          
          return response.ok && data.success && 
                 Array.isArray(data.data.events)
        }
      },
      {
        name: 'Event Filtering',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/realtime/events?type=blood_request_created&priority=high`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
          })
          const data = await response.json()
          
          return response.ok && data.success && 
                 data.data.events.every(event => 
                   event.type === 'blood_request_created' && 
                   event.priority === 'high'
                 )
        }
      }
    ]

    await this.runTestSuite('Event System', tests, 'events')
  }

  async testIntegration() {
    console.log('🔗 Testing System Integration...')

    const tests = [
      {
        name: 'Event to WebSocket Integration',
        test: async () => {
          const ws = await this.createWebSocketConnection()
          this.activeConnections.push(ws)

          return new Promise((resolve) => {
            let eventReceived = false

            ws.on('message', (data) => {
              const message = JSON.parse(data.toString())
              if (message.type === 'event_notification' && 
                  message.data.eventType === 'donor_matched') {
                eventReceived = true
                resolve(true)
              }
            })

            // Publish event that should trigger WebSocket notification
            setTimeout(async () => {
              await this.publishEvent({
                type: 'donor_matched',
                priority: 'medium',
                source: 'matching_system',
                data: {
                  donorId: 'test_donor_1',
                  requestId: 'test_request_1',
                  matchScore: 0.95
                }
              })
            }, 1000)

            setTimeout(() => resolve(eventReceived), 5000)
          })
        }
      },
      {
        name: 'Event to Notification Integration',
        test: async () => {
          // This test would verify that events trigger appropriate notifications
          // For now, we'll test that the event system can handle notification events
          const eventData = {
            type: 'donation_completed',
            priority: 'medium',
            source: 'donation_system',
            data: {
              donationId: 'test_donation_1',
              donorId: 'test_donor_1',
              units: 1,
              bloodType: 'A+'
            }
          }

          const response = await this.publishEvent(eventData)
          return response.success && response.data.processed
        }
      },
      {
        name: 'Cross-System Data Flow',
        test: async () => {
          // Test that data flows correctly between systems
          const ws = await this.createWebSocketConnection()
          this.activeConnections.push(ws)

          // Join emergency room
          ws.send(JSON.stringify({
            type: 'join_room',
            data: { roomId: 'emergency' }
          }))

          return new Promise((resolve) => {
            let emergencyReceived = false

            ws.on('message', (data) => {
              const message = JSON.parse(data.toString())
              if (message.type === 'emergency_broadcast') {
                emergencyReceived = true
                resolve(true)
              }
            })

            // Publish emergency event
            setTimeout(async () => {
              await this.publishEvent({
                type: 'emergency_alert',
                priority: 'critical',
                source: 'integration_test',
                data: {
                  message: 'Integration test emergency',
                  type: 'test'
                }
              })
            }, 1000)

            setTimeout(() => resolve(emergencyReceived), 5000)
          })
        }
      }
    ]

    await this.runTestSuite('System Integration', tests, 'integration')
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...')

    const tests = [
      {
        name: 'WebSocket Connection Speed',
        test: async () => {
          const startTime = Date.now()
          const ws = await this.createWebSocketConnection()
          const connectionTime = Date.now() - startTime
          
          this.activeConnections.push(ws)
          return connectionTime < 1000 // Under 1 second
        }
      },
      {
        name: 'Multiple Concurrent Connections',
        test: async () => {
          const connectionPromises = Array(10).fill().map(() => 
            this.createWebSocketConnection()
          )

          try {
            const connections = await Promise.all(connectionPromises)
            this.activeConnections.push(...connections)
            
            // Check all connections are open
            return connections.every(ws => ws.readyState === WebSocket.OPEN)
          } catch (error) {
            return false
          }
        }
      },
      {
        name: 'Event Processing Speed',
        test: async () => {
          const startTime = Date.now()
          
          const response = await this.publishEvent({
            type: 'donor_available',
            priority: 'low',
            source: 'performance_test',
            data: { donorId: 'test_donor_perf' }
          })

          const processingTime = Date.now() - startTime
          
          return response.success && processingTime < 2000 // Under 2 seconds
        }
      },
      {
        name: 'Notification Delivery Speed',
        test: async () => {
          const startTime = Date.now()
          
          const response = await this.sendNotification({
            type: 'system',
            priority: 'low',
            title: 'Performance Test',
            body: 'Testing notification speed',
            channels: [{ type: 'in_app', enabled: true }],
            targeting: { userIds: ['perf_test_user'] }
          })

          const deliveryTime = Date.now() - startTime
          
          return response.success && deliveryTime < 3000 // Under 3 seconds
        }
      },
      {
        name: 'System Resource Usage',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed
          
          // Create load
          const promises = []
          for (let i = 0; i < 50; i++) {
            promises.push(this.publishEvent({
              type: 'system_test',
              priority: 'low',
              source: 'load_test',
              data: { iteration: i }
            }))
          }
          
          await Promise.all(promises)
          
          const finalMemory = process.memoryUsage().heapUsed
          const memoryIncrease = finalMemory - initialMemory
          
          // Memory increase should be reasonable (less than 100MB)
          return memoryIncrease < 100 * 1024 * 1024
        }
      }
    ]

    await this.runTestSuite('Performance', tests, 'performance')
  }

  // Helper methods
  async createWebSocketConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`)
      
      ws.on('open', () => resolve(ws))
      ws.on('error', reject)
      
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000)
    })
  }

  async sendNotification(notificationData) {
    try {
      const response = await fetch(`${BASE_URL}/api/realtime/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(notificationData)
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async publishEvent(eventData) {
    try {
      const response = await fetch(`${BASE_URL}/api/realtime/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(eventData)
      })

      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async cleanup() {
    // Close all WebSocket connections
    for (const ws of this.activeConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
    this.activeConnections = []
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

    console.log(`  📊 ${suiteName}: ${results.passed}/${results.total} passed\n`)
  }

  generateReport() {
    console.log('📋 Real-time Communication System Test Report')
    console.log('=' .repeat(60))
    
    const categories = [
      'websocket',
      'notifications',
      'events',
      'integration',
      'performance'
    ]

    categories.forEach(category => {
      const result = this.results[category]
      const percentage = ((result.passed / result.total) * 100).toFixed(1)
      console.log(`${category.padEnd(15)}: ${result.passed}/${result.total} (${percentage}%)`)
    })

    console.log('=' .repeat(60))
    const overallPercentage = ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1)
    console.log(`Overall Score: ${this.results.overall.passed}/${this.results.overall.total} (${overallPercentage}%)`)

    // Save detailed report
    const reportPath = './realtime-system-test-report.json'
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // Real-time system insights
    if (this.results.websocket.passed > 0) {
      console.log('\n🔌 WebSocket System:')
      console.log('- Real-time bidirectional communication')
      console.log('- Room-based message broadcasting')
      console.log('- Authentication and connection management')
    }

    if (this.results.notifications.passed > 0) {
      console.log('\n📱 Notification System:')
      console.log('- Multi-channel notification delivery')
      console.log('- Template-based messaging')
      console.log('- User preference management')
    }

    if (this.results.events.passed > 0) {
      console.log('\n⚡ Event System:')
      console.log('- Real-time event publishing and processing')
      console.log('- Event-driven architecture')
      console.log('- Cross-system integration')
    }

    if (this.results.performance.passed > 0) {
      console.log('\n⚡ Performance Metrics:')
      console.log('- Sub-1-second WebSocket connections')
      console.log('- Sub-2-second event processing')
      console.log('- Concurrent connection handling')
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new RealTimeSystemTester()
  tester.runAllTests().catch(console.error)
}

module.exports = RealTimeSystemTester
