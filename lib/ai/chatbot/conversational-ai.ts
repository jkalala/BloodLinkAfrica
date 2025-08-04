/**
 * Conversational AI Chatbot System
 * 
 * Advanced chatbot with context awareness, multi-language support,
 * and domain-specific knowledge for blood donation assistance
 */

import { getAdvancedNLPEngine, NLPRequest, NLPResponse } from '../nlp/advanced-nlp-engine'
import { getMLPipelineAPI } from '../ml-pipeline/ml-pipeline-api'
import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'
import { performanceMonitor } from '../../performance/metrics'
import { getRealTimeEventSystem } from '../../realtime/event-system'

export interface ChatMessage {
  id: string
  sessionId: string
  userId?: string
  type: 'user' | 'bot' | 'system'
  content: string
  language: string
  timestamp: Date
  metadata: {
    intent?: string
    entities?: Record<string, any>
    sentiment?: string
    confidence?: number
    responseTime?: number
  }
}

export interface ChatSession {
  id: string
  userId?: string
  language: string
  domain: string
  status: 'active' | 'paused' | 'ended'
  startTime: Date
  lastActivity: Date
  messages: ChatMessage[]
  context: {
    userProfile?: {
      name?: string
      bloodType?: string
      location?: string
      preferences: Record<string, any>
    }
    currentTopic?: string
    conversationFlow?: string[]
    variables: Record<string, any>
  }
  analytics: {
    messageCount: number
    averageResponseTime: number
    satisfactionScore?: number
    resolvedIssues: string[]
    escalations: number
  }
}

export interface ChatbotResponse {
  success: boolean
  data: {
    message: string
    messageId: string
    language: string
    suggestedActions?: Array<{
      text: string
      action: string
      parameters?: Record<string, any>
    }>
    quickReplies?: string[]
    attachments?: Array<{
      type: 'image' | 'document' | 'link' | 'location'
      url: string
      title?: string
      description?: string
    }>
    escalationRequired?: boolean
    conversationEnded?: boolean
  }
  metadata: {
    responseTime: number
    confidence: number
    intent: string
    nlpProcessingTime: number
    cacheHit: boolean
  }
}

export interface ResponseTemplate {
  id: string
  intent: string
  language: string
  domain: string
  templates: Array<{
    text: string
    conditions?: Record<string, any>
    priority: number
    personalization?: {
      useUserName: boolean
      includeContext: boolean
      adaptToSentiment: boolean
    }
  }>
  followUpQuestions?: string[]
  suggestedActions?: Array<{
    text: string
    action: string
  }>
  isActive: boolean
}

export interface ConversationFlow {
  id: string
  name: string
  domain: string
  startIntent: string
  steps: Array<{
    id: string
    type: 'question' | 'information' | 'action' | 'decision'
    content: string
    conditions?: Record<string, any>
    nextSteps: Array<{
      condition: string
      nextStepId: string
    }>
    requiredEntities?: string[]
    validationRules?: Array<{
      field: string
      rule: string
      errorMessage: string
    }>
  }>
  isActive: boolean
}

class ConversationalAI {
  private nlpEngine = getAdvancedNLPEngine()
  private mlPipeline = getMLPipelineAPI()
  private db = getOptimizedDB()
  private cache = getCache()
  private eventSystem = getRealTimeEventSystem()

  private activeSessions: Map<string, ChatSession> = new Map()
  private responseTemplates: Map<string, ResponseTemplate> = new Map()
  private conversationFlows: Map<string, ConversationFlow> = new Map()

  // Configuration
  private readonly CONFIG = {
    maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
    maxMessagesPerSession: 1000,
    responseTimeout: 30000, // 30 seconds
    defaultLanguage: 'en',
    enablePersonalization: true,
    enableContextAwareness: true,
    escalationThreshold: 3, // Number of unresolved queries before escalation
    confidenceThreshold: 0.7
  }

  // Blood donation knowledge base
  private readonly KNOWLEDGE_BASE = {
    bloodTypes: {
      'A+': { canDonateTo: ['A+', 'AB+'], canReceiveFrom: ['A+', 'A-', 'O+', 'O-'] },
      'A-': { canDonateTo: ['A+', 'A-', 'AB+', 'AB-'], canReceiveFrom: ['A-', 'O-'] },
      'B+': { canDonateTo: ['B+', 'AB+'], canReceiveFrom: ['B+', 'B-', 'O+', 'O-'] },
      'B-': { canDonateTo: ['B+', 'B-', 'AB+', 'AB-'], canReceiveFrom: ['B-', 'O-'] },
      'AB+': { canDonateTo: ['AB+'], canReceiveFrom: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
      'AB-': { canDonateTo: ['AB+', 'AB-'], canReceiveFrom: ['A-', 'B-', 'AB-', 'O-'] },
      'O+': { canDonateTo: ['A+', 'B+', 'AB+', 'O+'], canReceiveFrom: ['O+', 'O-'] },
      'O-': { canDonateTo: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], canReceiveFrom: ['O-'] }
    },
    eligibilityRequirements: {
      age: { min: 17, max: 65 },
      weight: { min: 50 }, // kg
      healthConditions: {
        allowed: ['healthy', 'controlled_hypertension', 'controlled_diabetes'],
        restricted: ['anemia', 'heart_disease', 'recent_surgery', 'pregnancy']
      },
      medications: {
        allowed: ['vitamins', 'birth_control', 'blood_pressure_medication'],
        restricted: ['antibiotics', 'blood_thinners', 'immunosuppressants']
      }
    },
    donationProcess: {
      steps: [
        'Registration and health screening',
        'Medical examination',
        'Blood collection (8-10 minutes)',
        'Rest and refreshments',
        'Post-donation care instructions'
      ],
      duration: '45-60 minutes',
      recovery: '24-48 hours'
    }
  }

  constructor() {
    this.initializeResponseTemplates()
    this.initializeConversationFlows()
    this.startSessionCleanup()
  }

  async processMessage(message: {
    text: string
    sessionId: string
    userId?: string
    language?: string
  }): Promise<ChatbotResponse> {
    const startTime = performance.now()

    try {
      // Get or create session
      let session = await this.getOrCreateSession(message.sessionId, message.userId, message.language)

      // Process message with NLP
      const nlpRequest: NLPRequest = {
        text: message.text,
        language: session.language,
        context: {
          userId: session.userId,
          sessionId: session.id,
          previousMessages: session.messages.slice(-5).map(m => m.content),
          userProfile: session.context.userProfile,
          domain: session.domain
        },
        tasks: ['sentiment', 'intent', 'entities', 'language_detection']
      }

      const nlpResponse = await this.nlpEngine.processText(nlpRequest)

      // Create user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: session.id,
        userId: session.userId,
        type: 'user',
        content: message.text,
        language: nlpResponse.data.detectedLanguage,
        timestamp: new Date(),
        metadata: {
          intent: nlpResponse.data.intent.name,
          entities: nlpResponse.data.entities.reduce((acc, entity) => {
            acc[entity.label] = entity.text
            return acc
          }, {} as Record<string, any>),
          sentiment: nlpResponse.data.sentiment.polarity,
          confidence: nlpResponse.data.intent.confidence
        }
      }

      // Add user message to session
      session.messages.push(userMessage)
      session.lastActivity = new Date()

      // Generate bot response
      const botResponse = await this.generateResponse(session, nlpResponse)

      // Create bot message
      const botMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: session.id,
        type: 'bot',
        content: botResponse.data.message,
        language: session.language,
        timestamp: new Date(),
        metadata: {
          intent: nlpResponse.data.intent.name,
          confidence: botResponse.metadata.confidence,
          responseTime: botResponse.metadata.responseTime
        }
      }

      // Add bot message to session
      session.messages.push(botMessage)

      // Update session analytics
      session.analytics.messageCount += 2 // User + bot message
      session.analytics.averageResponseTime = 
        (session.analytics.averageResponseTime + botResponse.metadata.responseTime) / 2

      // Check for escalation
      if (this.shouldEscalate(session, nlpResponse)) {
        botResponse.data.escalationRequired = true
        session.analytics.escalations++
      }

      // Update session context
      await this.updateSessionContext(session, nlpResponse)

      // Save session
      await this.saveSession(session)

      // Record metrics
      performanceMonitor.recordCustomMetric({
        name: 'chatbot_response_time',
        value: performance.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          intent: nlpResponse.data.intent.name,
          language: session.language,
          domain: session.domain,
          confidence: Math.floor(botResponse.metadata.confidence * 10) / 10
        }
      })

      return {
        ...botResponse,
        data: {
          ...botResponse.data,
          messageId: botMessage.id
        },
        metadata: {
          ...botResponse.metadata,
          responseTime: performance.now() - startTime,
          nlpProcessingTime: nlpResponse.processingTime
        }
      }

    } catch (error) {
      const processingTime = performance.now() - startTime
      
      performanceMonitor.recordCustomMetric({
        name: 'chatbot_response_time',
        value: processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          success: 'false',
          error: (error as Error).message
        }
      })

      // Return error response
      return {
        success: false,
        data: {
          message: 'I apologize, but I encountered an error processing your message. Please try again.',
          messageId: `error_${Date.now()}`,
          language: message.language || this.CONFIG.defaultLanguage
        },
        metadata: {
          responseTime: processingTime,
          confidence: 0,
          intent: 'error',
          nlpProcessingTime: 0,
          cacheHit: false
        }
      }
    }
  }

  private async getOrCreateSession(sessionId: string, userId?: string, language?: string): Promise<ChatSession> {
    // Check active sessions first
    let session = this.activeSessions.get(sessionId)
    
    if (session) {
      return session
    }

    // Check cache
    session = await this.cache.get<ChatSession>(`chat_session:${sessionId}`)
    
    if (session) {
      this.activeSessions.set(sessionId, session)
      return session
    }

    // Create new session
    session = {
      id: sessionId,
      userId,
      language: language || this.CONFIG.defaultLanguage,
      domain: 'blood_donation',
      status: 'active',
      startTime: new Date(),
      lastActivity: new Date(),
      messages: [],
      context: {
        variables: {},
        conversationFlow: []
      },
      analytics: {
        messageCount: 0,
        averageResponseTime: 0,
        resolvedIssues: [],
        escalations: 0
      }
    }

    // Load user profile if available
    if (userId) {
      session.context.userProfile = await this.loadUserProfile(userId)
    }

    this.activeSessions.set(sessionId, session)
    return session
  }

  private async generateResponse(session: ChatSession, nlpResponse: NLPResponse): Promise<ChatbotResponse> {
    const intent = nlpResponse.data.intent.name
    const entities = nlpResponse.data.entities
    const sentiment = nlpResponse.data.sentiment.polarity

    // Check for conversation flow
    if (session.context.currentTopic) {
      const flowResponse = await this.handleConversationFlow(session, nlpResponse)
      if (flowResponse) {
        return flowResponse
      }
    }

    // Generate response based on intent
    switch (intent) {
      case 'request_blood':
        return await this.handleBloodRequest(session, entities)
      
      case 'donate_blood':
        return await this.handleDonationInquiry(session, entities)
      
      case 'check_eligibility':
        return await this.handleEligibilityCheck(session, entities)
      
      case 'find_location':
        return await this.handleLocationInquiry(session, entities)
      
      case 'emergency_help':
        return await this.handleEmergencyRequest(session, entities)
      
      case 'greeting':
        return await this.handleGreeting(session)
      
      case 'goodbye':
        return await this.handleGoodbye(session)
      
      default:
        return await this.handleUnknownIntent(session, nlpResponse)
    }
  }

  private async handleBloodRequest(session: ChatSession, entities: any[]): Promise<ChatbotResponse> {
    const bloodTypeEntity = entities.find(e => e.label === 'BLOOD_TYPE')
    const urgencyEntity = entities.find(e => e.label === 'URGENCY_LEVEL')
    const locationEntity = entities.find(e => e.label === 'LOCATION')

    let message = "I understand you need blood. Let me help you find available donors."
    const suggestedActions: any[] = []
    const quickReplies: string[] = []

    if (bloodTypeEntity) {
      const bloodType = bloodTypeEntity.text.toUpperCase()
      message = `I understand you need ${bloodType} blood. `
      
      // Get compatible blood types
      const compatibility = this.KNOWLEDGE_BASE.bloodTypes[bloodType as keyof typeof this.KNOWLEDGE_BASE.bloodTypes]
      if (compatibility) {
        message += `Compatible donors include: ${compatibility.canReceiveFrom.join(', ')}. `
      }

      suggestedActions.push({
        text: `Search for ${bloodType} donors`,
        action: 'search_donors',
        parameters: { bloodType }
      })
    } else {
      message += " What blood type do you need?"
      quickReplies.push('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    }

    if (urgencyEntity && urgencyEntity.metadata?.urgencyLevel === 'emergency') {
      message = "🚨 EMERGENCY BLOOD REQUEST 🚨\n" + message
      suggestedActions.unshift({
        text: 'Activate Emergency Protocol',
        action: 'emergency_protocol',
        parameters: { urgency: 'critical' }
      })
    }

    if (!locationEntity) {
      message += " Where do you need the blood delivered?"
      quickReplies.push('Current location', 'Specify hospital', 'Enter address')
    }

    suggestedActions.push(
      { text: 'Find nearby blood banks', action: 'find_blood_banks' },
      { text: 'Contact emergency services', action: 'emergency_contact' }
    )

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        suggestedActions,
        quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
        escalationRequired: urgencyEntity?.metadata?.urgencyLevel === 'emergency'
      },
      metadata: {
        responseTime: 0,
        confidence: 0.9,
        intent: 'request_blood',
        nlpProcessingTime: 0,
        cacheHit: false
      }
    }
  }

  private async handleDonationInquiry(session: ChatSession, entities: any[]): Promise<ChatbotResponse> {
    const bloodTypeEntity = entities.find(e => e.label === 'BLOOD_TYPE')
    const locationEntity = entities.find(e => e.label === 'LOCATION')

    let message = "Thank you for your interest in donating blood! You're helping save lives. "
    const suggestedActions: any[] = []

    // Check if user has blood type in profile
    const userBloodType = session.context.userProfile?.bloodType || bloodTypeEntity?.text

    if (userBloodType) {
      const bloodType = userBloodType.toUpperCase()
      const compatibility = this.KNOWLEDGE_BASE.bloodTypes[bloodType as keyof typeof this.KNOWLEDGE_BASE.bloodTypes]
      
      if (compatibility) {
        message += `As a ${bloodType} donor, you can help patients with blood types: ${compatibility.canDonateTo.join(', ')}. `
      }
    } else {
      message += "First, I'll need to know your blood type. "
      suggestedActions.push({
        text: 'I don\'t know my blood type',
        action: 'blood_type_test',
        parameters: {}
      })
    }

    message += "Let me guide you through the donation process."

    suggestedActions.push(
      { text: 'Check eligibility', action: 'check_eligibility' },
      { text: 'Find donation centers', action: 'find_locations' },
      { text: 'Schedule appointment', action: 'schedule_donation' },
      { text: 'Learn about donation process', action: 'donation_info' }
    )

    // Set conversation flow
    session.context.currentTopic = 'donation_process'
    session.context.conversationFlow = ['eligibility_check', 'location_selection', 'appointment_scheduling']

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        suggestedActions,
        quickReplies: ['Check eligibility', 'Find locations', 'Learn more']
      },
      metadata: {
        responseTime: 0,
        confidence: 0.9,
        intent: 'donate_blood',
        nlpProcessingTime: 0,
        cacheHit: false
      }
    }
  }

  private async handleEligibilityCheck(session: ChatSession, entities: any[]): Promise<ChatbotResponse> {
    const medicalConditionEntity = entities.find(e => e.label === 'MEDICAL_CONDITION')
    
    let message = "Let me help you check your eligibility to donate blood.\n\n"
    message += "**Basic Requirements:**\n"
    message += `• Age: ${this.KNOWLEDGE_BASE.eligibilityRequirements.age.min}-${this.KNOWLEDGE_BASE.eligibilityRequirements.age.max} years\n`
    message += `• Weight: At least ${this.KNOWLEDGE_BASE.eligibilityRequirements.weight.min} kg\n`
    message += "• Good general health\n\n"

    if (medicalConditionEntity) {
      const condition = medicalConditionEntity.text.toLowerCase()
      const { allowed, restricted } = this.KNOWLEDGE_BASE.eligibilityRequirements.healthConditions
      
      if (restricted.includes(condition)) {
        message += `⚠️ Having ${condition} may affect your eligibility. Please consult with our medical staff for a proper assessment.`
      } else if (allowed.includes(condition)) {
        message += `✅ Having ${condition} should not prevent you from donating, but we'll need to verify during screening.`
      } else {
        message += `I'd recommend speaking with our medical team about ${condition} to determine your eligibility.`
      }
    } else {
      message += "Do you have any medical conditions or take any medications I should know about?"
    }

    const suggestedActions = [
      { text: 'I have a medical condition', action: 'medical_condition_check' },
      { text: 'I take medications', action: 'medication_check' },
      { text: 'I\'m healthy', action: 'proceed_to_donation' },
      { text: 'Schedule health screening', action: 'schedule_screening' }
    ]

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        suggestedActions,
        quickReplies: ['I\'m healthy', 'I have conditions', 'Schedule screening']
      },
      metadata: {
        responseTime: 0,
        confidence: 0.9,
        intent: 'check_eligibility',
        nlpProcessingTime: 0,
        cacheHit: false
      }
    }
  }

  private async handleLocationInquiry(session: ChatSession, entities: any[]): Promise<ChatbotResponse> {
    let message = "I'll help you find blood donation locations near you.\n\n"
    
    const suggestedActions = [
      { text: 'Use my current location', action: 'use_current_location' },
      { text: 'Enter specific address', action: 'enter_address' },
      { text: 'Search by city', action: 'search_by_city' },
      { text: 'Show all locations', action: 'show_all_locations' }
    ]

    // If user location is available
    if (session.context.userProfile?.location) {
      message += `Based on your location (${session.context.userProfile.location}), here are nearby options:\n\n`
      message += "🏥 **Central Hospital Blood Bank**\n"
      message += "📍 123 Main Street\n"
      message += "⏰ Mon-Fri: 8AM-6PM, Sat: 9AM-3PM\n"
      message += "📞 +234-xxx-xxxx\n\n"
      
      suggestedActions.unshift({
        text: 'Get directions to Central Hospital',
        action: 'get_directions',
        parameters: { locationId: 'central_hospital' }
      })
    } else {
      message += "To show you the most relevant locations, I'll need to know where you are or where you'd like to donate."
    }

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        suggestedActions,
        attachments: [{
          type: 'link',
          url: '/locations',
          title: 'View All Donation Centers',
          description: 'Interactive map of all blood donation locations'
        }]
      },
      metadata: {
        responseTime: 0,
        confidence: 0.9,
        intent: 'find_location',
        nlpProcessingTime: 0,
        cacheHit: false
      }
    }
  }

  private async handleEmergencyRequest(session: ChatSession, entities: any[]): Promise<ChatbotResponse> {
    const message = "🚨 **EMERGENCY BLOOD REQUEST ACTIVATED** 🚨\n\n" +
                   "I'm immediately escalating your request to our emergency response team. " +
                   "You should receive a call within 5 minutes.\n\n" +
                   "**Immediate Actions:**\n" +
                   "• Emergency team has been notified\n" +
                   "• Nearby hospitals are being contacted\n" +
                   "• Available donors are being alerted\n\n" +
                   "**Emergency Hotline:** +234-911-BLOOD\n\n" +
                   "Please stay on the line if possible."

    // Trigger emergency protocol
    await this.eventSystem.publishEvent({
      id: `emergency_${Date.now()}`,
      type: 'emergency_alert',
      priority: 'critical',
      source: 'chatbot',
      timestamp: new Date(),
      data: {
        type: 'blood_emergency',
        sessionId: session.id,
        userId: session.userId,
        entities: entities.reduce((acc, entity) => {
          acc[entity.label] = entity.text
          return acc
        }, {} as Record<string, any>)
      }
    })

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        escalationRequired: true,
        suggestedActions: [
          { text: 'Call Emergency Hotline', action: 'call_emergency', parameters: { number: '+234-911-BLOOD' } },
          { text: 'Provide additional details', action: 'emergency_details' },
          { text: 'Track emergency status', action: 'track_emergency' }
        ]
      },
      metadata: {
        responseTime: 0,
        confidence: 1.0,
        intent: 'emergency_help',
        nlpProcessingTime: 0,
        cacheHit: false
      }
    }
  }

  private async handleGreeting(session: ChatSession): Promise<ChatbotResponse> {
    const userName = session.context.userProfile?.name
    const greeting = userName ? `Hello ${userName}!` : "Hello!"
    
    const message = `${greeting} Welcome to BloodLink Africa. I'm here to help you with blood donation and requests.\n\n` +
                   "**How can I assist you today?**\n" +
                   "• Request blood for a patient\n" +
                   "• Donate blood and save lives\n" +
                   "• Check donation eligibility\n" +
                   "• Find donation locations\n" +
                   "• Get emergency assistance"

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        quickReplies: ['Request blood', 'Donate blood', 'Find locations', 'Emergency help'],
        suggestedActions: [
          { text: 'I need blood urgently', action: 'request_blood' },
          { text: 'I want to donate', action: 'donate_blood' },
          { text: 'Find donation centers', action: 'find_locations' },
          { text: 'Emergency assistance', action: 'emergency_help' }
        ]
      },
      metadata: {
        responseTime: 0,
        confidence: 0.95,
        intent: 'greeting',
        nlpProcessingTime: 0,
        cacheHit: false
      }
    }
  }

  private async handleGoodbye(session: ChatSession): Promise<ChatbotResponse> {
    const message = "Thank you for using BloodLink Africa! Remember, every donation saves up to 3 lives. " +
                   "Feel free to return anytime you need assistance with blood donation or requests.\n\n" +
                   "Stay healthy and keep saving lives! 🩸❤️"

    // Mark session as ended
    session.status = 'ended'

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        conversationEnded: true,
        suggestedActions: [
          { text: 'Schedule donation', action: 'schedule_donation' },
          { text: 'Share with friends', action: 'share_app' },
          { text: 'Rate this conversation', action: 'rate_conversation' }
        ]
      },
      metadata: {
        responseTime: 0,
        confidence: 0.95,
        intent: 'goodbye',
        nlpProcessingTime: 0,
        cacheHit: false
      }
    }
  }

  private async handleUnknownIntent(session: ChatSession, nlpResponse: NLPResponse): Promise<ChatbotResponse> {
    const confidence = nlpResponse.data.intent.confidence
    
    let message: string
    
    if (confidence < 0.3) {
      message = "I'm not sure I understand what you're looking for. Could you please rephrase your question?\n\n" +
               "I can help you with:\n" +
               "• Blood donation requests\n" +
               "• Becoming a blood donor\n" +
               "• Finding donation locations\n" +
               "• Checking eligibility\n" +
               "• Emergency blood assistance"
    } else {
      message = "I think I understand what you're asking, but I'd like to make sure I can help you properly. " +
               "Could you provide a bit more detail about what you need?"
    }

    // Increment unknown intent counter for potential escalation
    session.context.variables.unknownIntentCount = (session.context.variables.unknownIntentCount || 0) + 1

    return {
      success: true,
      data: {
        message,
        messageId: '',
        language: session.language,
        quickReplies: ['Request blood', 'Donate blood', 'Find locations', 'Speak to human'],
        suggestedActions: [
          { text: 'Request blood', action: 'request_blood' },
          { text: 'Donate blood', action: 'donate_blood' },
          { text: 'Find locations', action: 'find_locations' },
          { text: 'Speak to a human', action: 'escalate_to_human' }
        ]
      },
      metadata: {
        responseTime: 0,
        confidence: confidence,
        intent: 'unknown',
        nlpProcessingTime: nlpResponse.processingTime,
        cacheHit: false
      }
    }
  }

  private async handleConversationFlow(session: ChatSession, nlpResponse: NLPResponse): Promise<ChatbotResponse | null> {
    // Implementation for conversation flow handling
    // This would manage multi-step conversations like donation scheduling
    return null
  }

  private shouldEscalate(session: ChatSession, nlpResponse: NLPResponse): boolean {
    // Check for emergency intent
    if (nlpResponse.data.intent.name === 'emergency_help') {
      return true
    }

    // Check for repeated unknown intents
    const unknownIntentCount = session.context.variables.unknownIntentCount || 0
    if (unknownIntentCount >= this.CONFIG.escalationThreshold) {
      return true
    }

    // Check for negative sentiment with low confidence
    if (nlpResponse.data.sentiment.polarity === 'negative' && 
        nlpResponse.data.sentiment.score < -0.7 &&
        nlpResponse.data.intent.confidence < 0.5) {
      return true
    }

    return false
  }

  private async updateSessionContext(session: ChatSession, nlpResponse: NLPResponse): Promise<void> {
    // Update context variables based on entities
    for (const entity of nlpResponse.data.entities) {
      if (entity.label === 'BLOOD_TYPE') {
        session.context.variables.bloodType = entity.text.toUpperCase()
      } else if (entity.label === 'LOCATION') {
        session.context.variables.location = entity.text
      } else if (entity.label === 'URGENCY_LEVEL') {
        session.context.variables.urgencyLevel = entity.metadata?.urgencyLevel
      }
    }

    // Update user profile if new information is available
    if (session.context.userProfile && session.context.variables.bloodType) {
      session.context.userProfile.bloodType = session.context.variables.bloodType
    }
  }

  private async loadUserProfile(userId: string): Promise<any> {
    try {
      const userResult = await this.db.findOne('users', { id: userId })
      if (userResult.success && userResult.data) {
        return {
          name: userResult.data.name,
          bloodType: userResult.data.blood_type,
          location: userResult.data.location,
          preferences: userResult.data.preferences || {}
        }
      }
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
    return { preferences: {} }
  }

  private async saveSession(session: ChatSession): Promise<void> {
    try {
      // Update active sessions
      this.activeSessions.set(session.id, session)

      // Cache session
      await this.cache.set(`chat_session:${session.id}`, session, {
        ttl: this.CONFIG.maxSessionDuration / 1000,
        tags: ['chat_session', session.id]
      })

      // Save to database for persistence
      await this.db.upsert('chat_sessions', { id: session.id }, session)

    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  private initializeResponseTemplates(): void {
    // Initialize response templates for different intents and languages
    console.log('Response templates initialized')
  }

  private initializeConversationFlows(): void {
    // Initialize conversation flows for complex interactions
    console.log('Conversation flows initialized')
  }

  private startSessionCleanup(): void {
    // Clean up inactive sessions every hour
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - this.CONFIG.maxSessionDuration)
      
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.lastActivity < cutoffTime || session.status === 'ended') {
          this.activeSessions.delete(sessionId)
        }
      }
    }, 60 * 60 * 1000) // 1 hour
  }

  // Public API methods
  public async getSession(sessionId: string): Promise<ChatSession | undefined> {
    return this.activeSessions.get(sessionId) || 
           await this.cache.get<ChatSession>(`chat_session:${sessionId}`)
  }

  public async endSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId)
    if (session) {
      session.status = 'ended'
      await this.saveSession(session)
      this.activeSessions.delete(sessionId)
    }
  }

  public getSystemStats() {
    return {
      activeSessions: this.activeSessions.size,
      responseTemplates: this.responseTemplates.size,
      conversationFlows: this.conversationFlows.size,
      supportedLanguages: this.nlpEngine.getSupportedLanguages()
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = this.getSystemStats()
    const nlpHealth = await this.nlpEngine.healthCheck()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (nlpHealth.status === 'unhealthy') {
      status = 'unhealthy'
    } else if (nlpHealth.status === 'degraded') {
      status = 'degraded'
    }

    return {
      status,
      details: {
        ...stats,
        nlpEngineStatus: nlpHealth.status,
        knowledgeBaseLoaded: Object.keys(this.KNOWLEDGE_BASE).length > 0
      }
    }
  }
}

// Singleton instance
let conversationalAIInstance: ConversationalAI | null = null

export function getConversationalAI(): ConversationalAI {
  if (!conversationalAIInstance) {
    conversationalAIInstance = new ConversationalAI()
  }
  return conversationalAIInstance
}

export default ConversationalAI
