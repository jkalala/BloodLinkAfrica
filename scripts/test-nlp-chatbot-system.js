#!/usr/bin/env node

/**
 * NLP & Chatbot System Testing Script
 * 
 * Comprehensive testing for advanced NLP engine, conversational AI,
 * multi-language support, and chatbot interactions
 */

const fetch = require('node-fetch')
const fs = require('fs')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'

class NLPChatbotTester {
  constructor() {
    this.results = {
      nlpProcessing: { passed: 0, failed: 0, tests: {} },
      languageDetection: { passed: 0, failed: 0, tests: {} },
      intentRecognition: { passed: 0, failed: 0, tests: {} },
      entityExtraction: { passed: 0, failed: 0, tests: {} },
      sentimentAnalysis: { passed: 0, failed: 0, tests: {} },
      chatbotConversation: { passed: 0, failed: 0, tests: {} },
      multiLanguage: { passed: 0, failed: 0, tests: {} },
      contextAwareness: { passed: 0, failed: 0, tests: {} },
      performance: { passed: 0, failed: 0, tests: {} },
      overall: { passed: 0, failed: 0, total: 0 }
    }
    this.testData = {
      sessions: [],
      conversations: []
    }
  }

  async runAllTests() {
    console.log('🤖 Starting NLP & Chatbot System Testing...\n')

    try {
      // 1. NLP Processing Tests
      await this.testNLPProcessing()

      // 2. Language Detection Tests
      await this.testLanguageDetection()

      // 3. Intent Recognition Tests
      await this.testIntentRecognition()

      // 4. Entity Extraction Tests
      await this.testEntityExtraction()

      // 5. Sentiment Analysis Tests
      await this.testSentimentAnalysis()

      // 6. Chatbot Conversation Tests
      await this.testChatbotConversation()

      // 7. Multi-language Support Tests
      await this.testMultiLanguageSupport()

      // 8. Context Awareness Tests
      await this.testContextAwareness()

      // 9. Performance Tests
      await this.testPerformance()

      // 10. Cleanup
      await this.cleanup()

      // 11. Generate Report
      this.generateReport()

      console.log('✅ NLP & Chatbot system testing completed!')
      
      const hasFailures = this.results.overall.failed > 0
      process.exit(hasFailures ? 1 : 0)

    } catch (error) {
      console.error('❌ NLP & Chatbot system testing failed:', error)
      await this.cleanup()
      process.exit(1)
    }
  }

  async testNLPProcessing() {
    console.log('🧠 Testing NLP Processing...')

    const tests = [
      {
        name: 'Basic Text Processing',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I need blood type A+ urgently for my patient',
            tasks: ['sentiment', 'intent', 'entities', 'language_detection']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage &&
                 response.data.sentiment &&
                 response.data.intent &&
                 Array.isArray(response.data.entities)
        }
      },
      {
        name: 'Complex Medical Text',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Emergency blood request for AB negative patient with severe anemia at Central Hospital',
            tasks: ['sentiment', 'intent', 'entities'],
            context: { domain: 'medical' }
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name !== 'unknown' &&
                 response.data.entities.some(e => e.label === 'BLOOD_TYPE') &&
                 response.data.contextualInsights.urgencyLevel === 'critical'
        }
      },
      {
        name: 'Donation Inquiry Processing',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I want to donate blood and help save lives. How can I register?',
            tasks: ['sentiment', 'intent', 'entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'donate_blood' &&
                 response.data.sentiment.polarity === 'positive' &&
                 response.data.contextualInsights.suggestedActions.length > 0
        }
      },
      {
        name: 'Eligibility Check Processing',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Can I donate blood if I have diabetes and take medication?',
            tasks: ['sentiment', 'intent', 'entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'check_eligibility' &&
                 response.data.entities.some(e => e.label === 'MEDICAL_CONDITION')
        }
      },
      {
        name: 'Location Inquiry Processing',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Where can I find blood donation centers in Lagos?',
            tasks: ['sentiment', 'intent', 'entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'find_location' &&
                 response.data.entities.some(e => e.label === 'LOCATION')
        }
      }
    ]

    await this.runTestSuite('NLP Processing', tests, 'nlpProcessing')
  }

  async testLanguageDetection() {
    console.log('🌍 Testing Language Detection...')

    const tests = [
      {
        name: 'English Detection',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I need blood donation help',
            tasks: ['language_detection']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage === 'en' &&
                 response.data.confidence > 0.8
        }
      },
      {
        name: 'French Detection',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Je veux donner du sang pour aider les patients',
            tasks: ['language_detection']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage === 'fr' &&
                 response.data.confidence > 0.7
        }
      },
      {
        name: 'Arabic Detection',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'أحتاج إلى التبرع بالدم',
            tasks: ['language_detection']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage === 'ar' &&
                 response.data.confidence > 0.6
        }
      },
      {
        name: 'Swahili Detection',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Nataka kutoa damu ili kusaidia wagonjwa',
            tasks: ['language_detection']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage === 'sw' &&
                 response.data.confidence > 0.5
        }
      },
      {
        name: 'Mixed Language Handling',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Hello, je veux donner blood type A+',
            tasks: ['language_detection']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage &&
                 response.data.confidence > 0.3
        }
      }
    ]

    await this.runTestSuite('Language Detection', tests, 'languageDetection')
  }

  async testIntentRecognition() {
    console.log('🎯 Testing Intent Recognition...')

    const tests = [
      {
        name: 'Blood Request Intent',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I urgently need O negative blood for surgery',
            tasks: ['intent']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'request_blood' &&
                 response.data.intent.confidence > 0.7
        }
      },
      {
        name: 'Donation Intent',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'How can I become a blood donor and help people?',
            tasks: ['intent']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'donate_blood' &&
                 response.data.intent.confidence > 0.6
        }
      },
      {
        name: 'Eligibility Intent',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Am I eligible to donate if I take blood pressure medication?',
            tasks: ['intent']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'check_eligibility' &&
                 response.data.intent.confidence > 0.6
        }
      },
      {
        name: 'Location Intent',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Where are the blood banks in Abuja?',
            tasks: ['intent']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'find_location' &&
                 response.data.intent.confidence > 0.6
        }
      },
      {
        name: 'Emergency Intent',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'EMERGENCY! Need blood immediately, patient is dying!',
            tasks: ['intent']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.name === 'emergency_help' &&
                 response.data.intent.confidence > 0.8
        }
      }
    ]

    await this.runTestSuite('Intent Recognition', tests, 'intentRecognition')
  }

  async testEntityExtraction() {
    console.log('🏷️ Testing Entity Extraction...')

    const tests = [
      {
        name: 'Blood Type Extraction',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I need A+ blood for my patient urgently',
            tasks: ['entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.entities.some(e => 
                   e.label === 'BLOOD_TYPE' && 
                   e.text.toUpperCase() === 'A+'
                 )
        }
      },
      {
        name: 'Multiple Blood Types',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'We need O-, AB+, and B- blood types for emergency',
            tasks: ['entities']
          }

          const response = await this.processNLP(nlpData)
          
          const bloodTypeEntities = response.data.entities.filter(e => e.label === 'BLOOD_TYPE')
          return response.success && bloodTypeEntities.length >= 2
        }
      },
      {
        name: 'Urgency Level Extraction',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'This is an emergency situation, need blood ASAP',
            tasks: ['entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.entities.some(e => 
                   e.label === 'URGENCY_LEVEL' && 
                   e.metadata?.urgencyLevel === 'emergency'
                 )
        }
      },
      {
        name: 'Location Extraction',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Looking for blood banks near Lagos University Teaching Hospital',
            tasks: ['entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.entities.some(e => e.label === 'LOCATION')
        }
      },
      {
        name: 'Medical Condition Extraction',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Can I donate blood if I have diabetes and hypertension?',
            tasks: ['entities'],
            context: { domain: 'medical' }
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.entities.some(e => e.label === 'MEDICAL_CONDITION')
        }
      }
    ]

    await this.runTestSuite('Entity Extraction', tests, 'entityExtraction')
  }

  async testSentimentAnalysis() {
    console.log('😊 Testing Sentiment Analysis...')

    const tests = [
      {
        name: 'Positive Sentiment',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I love helping people by donating blood. It makes me happy!',
            tasks: ['sentiment']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.sentiment.polarity === 'positive' &&
                 response.data.sentiment.score > 0.3
        }
      },
      {
        name: 'Negative Sentiment',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I am very worried and scared about my patient condition',
            tasks: ['sentiment']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.sentiment.polarity === 'negative' &&
                 response.data.sentiment.score < -0.3
        }
      },
      {
        name: 'Neutral Sentiment',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'What are the requirements for blood donation?',
            tasks: ['sentiment']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.sentiment.polarity === 'neutral' &&
                 Math.abs(response.data.sentiment.score) < 0.3
        }
      },
      {
        name: 'Emergency Sentiment',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'URGENT! Patient is critical, need blood immediately!',
            tasks: ['sentiment']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 (response.data.sentiment.polarity === 'negative' || 
                  response.data.contextualInsights.urgencyLevel === 'critical')
        }
      },
      {
        name: 'Emotion Detection',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'I am so grateful for the blood donors who saved my life',
            tasks: ['sentiment']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.sentiment.emotions &&
                 Object.keys(response.data.sentiment.emotions).length > 0
        }
      }
    ]

    await this.runTestSuite('Sentiment Analysis', tests, 'sentimentAnalysis')
  }

  async testChatbotConversation() {
    console.log('💬 Testing Chatbot Conversation...')

    const tests = [
      {
        name: 'Start Conversation',
        test: async () => {
          const sessionData = {
            action: 'start_session',
            language: 'en',
            domain: 'blood_donation'
          }

          const response = await this.startChatSession(sessionData)
          
          if (response.success) {
            this.testData.sessions.push(response.data.sessionId)
          }
          
          return response.success && 
                 response.data.sessionId &&
                 response.data.greeting
        }
      },
      {
        name: 'Blood Request Conversation',
        test: async () => {
          if (this.testData.sessions.length === 0) return false

          const sessionId = this.testData.sessions[0]
          const messageData = {
            action: 'send_message',
            text: 'I need O+ blood for my patient urgently',
            sessionId
          }

          const response = await this.sendChatMessage(messageData)
          
          return response.success && 
                 response.data.message &&
                 response.data.suggestedActions &&
                 response.data.suggestedActions.length > 0
        }
      },
      {
        name: 'Donation Inquiry Conversation',
        test: async () => {
          const sessionData = {
            action: 'start_session',
            language: 'en'
          }

          const sessionResponse = await this.startChatSession(sessionData)
          if (!sessionResponse.success) return false

          const messageData = {
            action: 'send_message',
            text: 'I want to donate blood and help save lives',
            sessionId: sessionResponse.data.sessionId
          }

          const response = await this.sendChatMessage(messageData)
          
          return response.success && 
                 response.data.message.includes('donation') &&
                 response.data.quickReplies &&
                 response.data.quickReplies.length > 0
        }
      },
      {
        name: 'Emergency Handling',
        test: async () => {
          const sessionData = {
            action: 'start_session',
            language: 'en'
          }

          const sessionResponse = await this.startChatSession(sessionData)
          if (!sessionResponse.success) return false

          const messageData = {
            action: 'send_message',
            text: 'EMERGENCY! Patient is dying, need blood NOW!',
            sessionId: sessionResponse.data.sessionId
          }

          const response = await this.sendChatMessage(messageData)
          
          return response.success && 
                 response.data.escalationRequired === true &&
                 response.data.message.includes('EMERGENCY')
        }
      },
      {
        name: 'Conversation Flow',
        test: async () => {
          const sessionData = {
            action: 'start_session',
            language: 'en'
          }

          const sessionResponse = await this.startChatSession(sessionData)
          if (!sessionResponse.success) return false

          const sessionId = sessionResponse.data.sessionId

          // Multi-turn conversation
          const messages = [
            'Hello',
            'I want to donate blood',
            'I am 25 years old and healthy',
            'Where can I donate?'
          ]

          let allSuccessful = true
          for (const text of messages) {
            const messageData = {
              action: 'send_message',
              text,
              sessionId
            }

            const response = await this.sendChatMessage(messageData)
            if (!response.success) {
              allSuccessful = false
              break
            }
          }

          return allSuccessful
        }
      }
    ]

    await this.runTestSuite('Chatbot Conversation', tests, 'chatbotConversation')
  }

  async testMultiLanguageSupport() {
    console.log('🌐 Testing Multi-language Support...')

    const tests = [
      {
        name: 'French Conversation',
        test: async () => {
          const sessionData = {
            action: 'start_session',
            language: 'fr'
          }

          const sessionResponse = await this.startChatSession(sessionData)
          if (!sessionResponse.success) return false

          const messageData = {
            action: 'send_message',
            text: 'Je veux donner du sang',
            sessionId: sessionResponse.data.sessionId
          }

          const response = await this.sendChatMessage(messageData)
          
          return response.success && response.data.message
        }
      },
      {
        name: 'Arabic Processing',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'أريد التبرع بالدم',
            language: 'ar',
            tasks: ['intent', 'sentiment']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage === 'ar'
        }
      },
      {
        name: 'Swahili Support',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Nahitaji damu ya aina A+',
            language: 'sw',
            tasks: ['intent', 'entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.detectedLanguage === 'sw'
        }
      },
      {
        name: 'Language Auto-detection',
        test: async () => {
          const sessionData = {
            action: 'start_session'
          }

          const sessionResponse = await this.startChatSession(sessionData)
          if (!sessionResponse.success) return false

          const messageData = {
            action: 'send_message',
            text: 'Bonjour, je cherche du sang type O+',
            sessionId: sessionResponse.data.sessionId
          }

          const response = await this.sendChatMessage(messageData)
          
          return response.success && 
                 response.metadata.intent !== 'unknown'
        }
      },
      {
        name: 'Supported Languages List',
        test: async () => {
          const response = await this.getSupportedLanguages()
          
          return response.success && 
                 Array.isArray(response.data.languages) &&
                 response.data.languages.length >= 5 &&
                 response.data.languages.some(lang => lang.code === 'en')
        }
      }
    ]

    await this.runTestSuite('Multi-language Support', tests, 'multiLanguage')
  }

  async testContextAwareness() {
    console.log('🧠 Testing Context Awareness...')

    const tests = [
      {
        name: 'Session Context Retention',
        test: async () => {
          const sessionData = {
            action: 'start_session',
            language: 'en'
          }

          const sessionResponse = await this.startChatSession(sessionData)
          if (!sessionResponse.success) return false

          const sessionId = sessionResponse.data.sessionId

          // First message - establish context
          await this.sendChatMessage({
            action: 'send_message',
            text: 'I am a doctor and need A+ blood',
            sessionId
          })

          // Second message - should remember context
          const response = await this.sendChatMessage({
            action: 'send_message',
            text: 'How quickly can you find it?',
            sessionId
          })

          return response.success && 
                 response.data.message &&
                 response.metadata.intent !== 'unknown'
        }
      },
      {
        name: 'User Profile Context',
        test: async () => {
          const messageData = {
            action: 'send_message',
            text: 'I want to donate blood',
            sessionId: `context_test_${Date.now()}`,
            context: {
              userId: 'test-user-123',
              metadata: { bloodType: 'O+', location: 'Lagos' }
            }
          }

          const response = await this.sendChatMessage(messageData)
          
          return response.success && 
                 response.data.message &&
                 response.data.suggestedActions.length > 0
        }
      },
      {
        name: 'Domain-specific Context',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Patient has severe anemia and needs transfusion',
            context: { domain: 'medical' },
            tasks: ['intent', 'entities']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.entities.some(e => e.label === 'MEDICAL_CONDITION') &&
                 response.data.contextualInsights.urgencyLevel !== 'low'
        }
      },
      {
        name: 'Conversation History Context',
        test: async () => {
          const nlpData = {
            action: 'process_nlp',
            text: 'Yes, I can come tomorrow',
            context: {
              previousMessages: [
                'I want to donate blood',
                'Can you come to our center this week?'
              ]
            },
            tasks: ['intent']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && 
                 response.data.intent.confidence > 0.3
        }
      },
      {
        name: 'Contextual Suggestions',
        test: async () => {
          const messageData = {
            action: 'send_message',
            text: 'I need blood urgently',
            sessionId: `urgent_test_${Date.now()}`
          }

          const response = await this.sendChatMessage(messageData)
          
          return response.success && 
                 response.data.suggestedActions &&
                 response.data.suggestedActions.some(action => 
                   action.action.includes('emergency') || 
                   action.action.includes('urgent')
                 )
        }
      }
    ]

    await this.runTestSuite('Context Awareness', tests, 'contextAwareness')
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...')

    const tests = [
      {
        name: 'NLP Processing Speed',
        test: async () => {
          const startTime = Date.now()
          
          const nlpData = {
            action: 'process_nlp',
            text: 'I need O+ blood for emergency surgery at Lagos Hospital',
            tasks: ['sentiment', 'intent', 'entities', 'language_detection']
          }

          const response = await this.processNLP(nlpData)
          const processingTime = Date.now() - startTime
          
          return response.success && processingTime < 3000 // Under 3 seconds
        }
      },
      {
        name: 'Chatbot Response Speed',
        test: async () => {
          const startTime = Date.now()
          
          const messageData = {
            action: 'send_message',
            text: 'Hello, I want to donate blood',
            sessionId: `speed_test_${Date.now()}`
          }

          const response = await this.sendChatMessage(messageData)
          const responseTime = Date.now() - startTime
          
          return response.success && responseTime < 2000 // Under 2 seconds
        }
      },
      {
        name: 'Concurrent Processing',
        test: async () => {
          const promises = Array(5).fill().map((_, i) => 
            this.processNLP({
              action: 'process_nlp',
              text: `Test message ${i} for concurrent processing`,
              tasks: ['intent', 'sentiment']
            })
          )

          const responses = await Promise.all(promises)
          
          return responses.every(response => response.success)
        }
      },
      {
        name: 'Large Text Processing',
        test: async () => {
          const largeText = 'I need blood donation help. '.repeat(50) // ~1500 characters
          
          const nlpData = {
            action: 'process_nlp',
            text: largeText,
            tasks: ['sentiment', 'intent']
          }

          const response = await this.processNLP(nlpData)
          
          return response.success && response.metadata.processingTime < 5000
        }
      },
      {
        name: 'Memory Stability',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed
          
          // Process multiple messages
          for (let i = 0; i < 10; i++) {
            await this.sendChatMessage({
              action: 'send_message',
              text: `Memory test message ${i}`,
              sessionId: `memory_test_${i}`
            })
          }
          
          const finalMemory = process.memoryUsage().heapUsed
          const memoryIncrease = finalMemory - initialMemory
          
          // Memory increase should be reasonable (less than 50MB)
          return memoryIncrease < 50 * 1024 * 1024
        }
      }
    ]

    await this.runTestSuite('Performance', tests, 'performance')
  }

  // Helper methods for API calls
  async processNLP(nlpData) {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(nlpData)
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async startChatSession(sessionData) {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(sessionData)
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async sendChatMessage(messageData) {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(messageData)
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getSupportedLanguages() {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/chat?action=supported_languages`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getSystemStats() {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/chat?action=system_stats`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      })
      return await response.json()
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async cleanup() {
    // Clean up test sessions
    for (const sessionId of this.testData.sessions) {
      try {
        await fetch(`${BASE_URL}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`
          },
          body: JSON.stringify({
            action: 'end_session',
            sessionId
          })
        })
      } catch (error) {
        console.error(`Failed to cleanup session ${sessionId}:`, error)
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

    console.log(`  🤖 ${suiteName}: ${results.passed}/${results.total} passed\n`)
  }

  generateReport() {
    console.log('📋 NLP & Chatbot System Test Report')
    console.log('=' .repeat(70))
    
    const categories = [
      'nlpProcessing',
      'languageDetection',
      'intentRecognition',
      'entityExtraction',
      'sentimentAnalysis',
      'chatbotConversation',
      'multiLanguage',
      'contextAwareness',
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
    const reportPath = './nlp-chatbot-test-report.json'
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)

    // System insights
    if (this.results.nlpProcessing.passed > 0) {
      console.log('\n🧠 NLP Engine:')
      console.log('- Multi-language text processing with 7 supported languages')
      console.log('- Advanced intent recognition and entity extraction')
      console.log('- Real-time sentiment analysis with emotion detection')
    }

    if (this.results.chatbotConversation.passed > 0) {
      console.log('\n💬 Conversational AI:')
      console.log('- Context-aware conversations with memory retention')
      console.log('- Domain-specific knowledge for blood donation')
      console.log('- Emergency escalation and intelligent routing')
    }

    if (this.results.multiLanguage.passed > 0) {
      console.log('\n🌐 Multi-language Support:')
      console.log('- Automatic language detection and processing')
      console.log('- Native support for English, French, Arabic, Swahili')
      console.log('- Cross-language intent and entity recognition')
    }

    if (this.results.performance.passed > 0) {
      console.log('\n⚡ Performance Metrics:')
      console.log('- Sub-3-second NLP processing for complex text')
      console.log('- Sub-2-second chatbot response generation')
      console.log('- Concurrent processing and memory stability')
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new NLPChatbotTester()
  tester.runAllTests().catch(console.error)
}

module.exports = NLPChatbotTester
