/**
 * Chatbot Service for BloodConnect
 * Provides 24/7 AI-powered support for users
 */

import { getSupabase } from './supabase'
import { performanceMonitor } from './performance-monitoring'

export interface ChatMessage {
  id: string
  sessionId: string
  userId?: string
  message: string
  response: string
  intent: string
  confidence: number
  timestamp: string
  isResolved: boolean
  transferredToHuman?: boolean
}

export interface ChatIntent {
  intent: string
  confidence: number
  entities: { [key: string]: string }
  context: UserContext
}

export interface ChatbotResponse {
  message: string
  intent: string
  confidence: number
  quickReplies?: string[]
  needsEscalation: boolean
  followUpActions?: string[]
}

export interface UserContext {
  userId?: string
  bloodType?: string
  location?: string
  userType: 'donor' | 'recipient' | 'hospital' | 'guest'
  language: 'en' | 'fr' | 'pt' | 'sw'
  previousMessages: string[]
  sessionData: Record<string, unknown>
}

export class ChatbotService {
  private supabase = getSupabase()
  private intents: Map<string, any> = new Map()
  private responses: Map<string, string[]> = new Map()
  private knowledgeBase: Map<string, any> = new Map()

  constructor() {
    this.initializeChatbot()
  }

  /**
   * Initialize chatbot with intents and responses
   */
  private async initializeChatbot(): Promise<void> {
    try {
      console.log('🤖 Initializing chatbot service...')
      
      // Load intents and responses from database or config
      await this.loadIntents()
      await this.loadResponses()
      await this.loadKnowledgeBase()
      
      console.log('✅ Chatbot service initialized successfully')
      
    } catch (error) {
      console.error('❌ Failed to initialize chatbot:', error)
    }
  }

  /**
   * Process user message and generate response
   */
  async processMessage(
    message: string,
    context: UserContext,
    sessionId: string
  ): Promise<ChatbotResponse> {
    const tracker = performanceMonitor.startTracking('chatbot', 'PROCESS_MESSAGE');

    try {
      console.log(`💬 Processing message: "${message}"`);

      // Detect intent using a simulated NLP model
      const intent = await this.detectIntentWithNLP(message, context);

      // Generate response based on intent
      const response = await this.generateResponse(intent, context, message);

      // Store conversation in database
      await this.storeConversation(sessionId, context.userId, message, response, intent);

      console.log(`✅ Generated response for intent: ${intent.intent}`);
      tracker.end(200);

      return response;
    } catch (error: any) {
      console.error('❌ Message processing failed:', error);
      tracker.end(500);

      return {
        message: this.getErrorResponse(context.language),
        intent: 'error',
        confidence: 1.0,
        needsEscalation: false,
      };
    }
  }

  private async detectIntentWithNLP(message: string, context: UserContext): Promise<ChatIntent> {
    // In a real implementation, this would call an NLP service like Dialogflow, Rasa, or a custom model.
    // For now, we'll simulate the NLP response.
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network latency

    const normalizedMessage = message.toLowerCase().trim();
    const intent = await this.detectIntent(message, context);

    // Enhance with simulated NLP capabilities
    intent.confidence = Math.min(0.95, intent.confidence + 0.1);
    intent.entities = {
      ...intent.entities,
      ...this.extractAdvancedEntities(normalizedMessage),
    };

    return intent;
  }

  private extractAdvancedEntities(message: string): { [key: string]: string } {
    const entities: { [key: string]: string } = {};
    // Location entities (simple version)
    const locationMatch = message.match(/in (\w+)/);
    if (locationMatch) {
      entities.location = locationMatch[1];
    }

    // Date/time entities
    const timeMatch = message.match(/tomorrow|today|next week/);
    if (timeMatch) {
      entities.time = timeMatch[0];
    }

    return entities;
  }

  /**
   * Detect intent from user message
   */
  private async detectIntent(message: string, context: UserContext): Promise<ChatIntent> {
    const normalizedMessage = message.toLowerCase().trim()
    let bestMatch = { intent: 'unknown', confidence: 0, entities: {}, context: {} }
    
    // Check for common intents
    const intentPatterns = {
      'greeting': ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'habari', 'salut', 'olá'],
      'blood_donation_info': ['donate blood', 'how to donate', 'donation process', 'donate', 'giving blood'],
      'find_donors': ['find donors', 'need blood', 'blood request', 'emergency blood', 'urgent blood'],
      'eligibility': ['can i donate', 'eligible', 'requirements', 'qualify'],
      'location_help': ['where to donate', 'blood banks near me', 'locations', 'nearby'],
      'appointment': ['book appointment', 'schedule', 'appointment', 'slot'],
      'blood_types': ['blood type', 'compatibility', 'which blood type', 'blood group'],
      'emergency': ['emergency', 'urgent', 'critical', 'help immediately'],
      'complaint': ['problem', 'issue', 'complaint', 'not working', 'error'],
      'praise': ['thank you', 'thanks', 'great', 'excellent', 'good job'],
      'goodbye': ['bye', 'goodbye', 'see you', 'thanks bye', 'kwaheri']
    }

    // Find best matching intent
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (normalizedMessage.includes(pattern)) {
          const confidence = this.calculateConfidence(normalizedMessage, pattern)
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              intent,
              confidence,
              entities: this.extractEntities(normalizedMessage, intent),
              context: { userType: context.userType, language: context.language }
            }
          }
        }
      }
    }

    return bestMatch
  }

  /**
   * Generate response based on detected intent
   */
  private async generateResponse(
    intent: ChatIntent,
    context: UserContext,
    originalMessage: string
  ): Promise<ChatbotResponse> {
    const responses = this.getResponsesForIntent(intent.intent, context.language)
    
    let response: ChatbotResponse = {
      message: this.selectRandomResponse(responses),
      intent: intent.intent,
      confidence: intent.confidence,
      needsEscalation: false
    }

    // Customize response based on intent
    switch (intent.intent) {
      case 'greeting':
        response = await this.handleGreeting(context)
        break
        
      case 'blood_donation_info':
        response = await this.handleDonationInfo(context)
        break
        
      case 'find_donors':
        response = await this.handleFindDonors(context, intent.entities)
        break
        
      case 'eligibility':
        response = await this.handleEligibility(context)
        break
        
      case 'location_help':
        response = await this.handleLocationHelp(context)
        break
        
      case 'blood_types':
        response = await this.handleBloodTypes(context)
        break
        
      case 'emergency':
        response = await this.handleEmergency(context)
        break
        
      case 'complaint':
        response = await this.handleComplaint(context, originalMessage)
        break
        
      case 'appointment':
        response = await this.handleAppointment(context)
        break
        
      default:
        response = await this.handleUnknown(context, originalMessage)
    }

    return response
  }

  /**
   * Handle greeting intent
   */
  private async handleGreeting(context: UserContext): Promise<ChatbotResponse> {
    const greetings = {
      en: [
        "Hello! Welcome to BloodConnect. How can I help you today?",
        "Hi there! I'm here to assist you with blood donation. What would you like to know?",
        "Welcome! I can help you with donations, finding donors, or answer any questions."
      ],
      fr: [
        "Bonjour ! Bienvenue sur BloodConnect. Comment puis-je vous aider aujourd'hui ?",
        "Salut ! Je suis là pour vous aider avec le don de sang. Que voulez-vous savoir ?"
      ],
      pt: [
        "Olá! Bem-vindo ao BloodConnect. Como posso ajudá-lo hoje?",
        "Oi! Estou aqui para ajudar com doação de sangue. O que gostaria de saber?"
      ],
      sw: [
        "Habari! Karibu BloodConnect. Naweza kukusaidia vipi leo?",
        "Hujambo! Nipo hapa kukusaidia na maswala ya kutoa damu."
      ]
    }

    return {
      message: this.selectRandomResponse(greetings[context.language] || greetings.en),
      intent: 'greeting',
      confidence: 1.0,
      quickReplies: [
        'Donate Blood',
        'Find Donors',
        'Blood Types',
        'Locations'
      ],
      needsEscalation: false
    }
  }

  /**
   * Handle blood donation information
   */
  private async handleDonationInfo(context: UserContext): Promise<ChatbotResponse> {
    const info = {
      en: `To donate blood:
1. You must be 18-65 years old
2. Weigh at least 50kg
3. Be in good health
4. Not have donated in the last 8 weeks

Would you like me to help you find nearby donation centers or check your eligibility?`,
      
      fr: `Pour donner du sang :
1. Vous devez avoir entre 18 et 65 ans
2. Peser au moins 50 kg
3. Être en bonne santé
4. Ne pas avoir donné dans les 8 dernières semaines

Voulez-vous que je vous aide à trouver des centres de don à proximité ?`,
      
      sw: `Kutoa damu:
1. Uwe na umri wa miaka 18-65
2. Uzito usiopungua kilo 50
3. Uwe na afya nzuri
4. Usijatoa damu wiki 8 zilizopita

Je, ungependa nikusaidie kupata vituo vya kutoa damu?`
    }

    return {
      message: info[context.language] || info.en,
      intent: 'blood_donation_info',
      confidence: 1.0,
      quickReplies: [
        'Check Eligibility',
        'Find Centers',
        'Book Appointment',
        'Blood Types Info'
      ],
      needsEscalation: false
    }
  }

  /**
   * Handle emergency requests
   */
  private async handleEmergency(context: UserContext): Promise<ChatbotResponse> {
    const emergencyResponse = {
      en: `🚨 EMERGENCY BLOOD REQUEST 🚨

I understand this is urgent! Here's what I can do immediately:

1. 🩸 Create an emergency blood request
2. 📱 Alert nearby donors instantly  
3. 🏥 Contact blood banks in your area
4. 🚑 Provide emergency contact numbers

Please provide:
- Blood type needed
- Number of units
- Hospital/Location
- Contact number

This request will be processed with highest priority!`,
      
      fr: `🚨 DEMANDE DE SANG D'URGENCE 🚨

Je comprends que c'est urgent ! Voici ce que je peux faire immédiatement :

1. 🩸 Créer une demande de sang d'urgence
2. 📱 Alerter les donneurs à proximité
3. 🏥 Contacter les banques de sang
4. 🚑 Fournir les numéros d'urgence`,
      
      sw: `🚨 OMBI LA HARAKA LA DAMU 🚨

Naelewa hili ni la haraka! Hivi ndivyo ninaweza kusaidia:

1. 🩸 Kuunda ombi la haraka la damu
2. 📱 Kutaarifu watoaji damu wa karibu
3. 🏥 Kuwasiliana na mabenki ya damu
4. 🚑 Kutoa nambari za dharura`
    }

    return {
      message: emergencyResponse[context.language] || emergencyResponse.en,
      intent: 'emergency',
      confidence: 1.0,
      quickReplies: [
        'Create Emergency Request',
        'Call Emergency Hotline',
        'Find Blood Banks',
        'Contact Admin'
      ],
      needsEscalation: true,
      followUpActions: ['escalate_to_emergency_team', 'create_priority_alert']
    }
  }

  /**
   * Handle complaints
   */
  private async handleComplaint(context: UserContext, message: string): Promise<ChatbotResponse> {
    // Store complaint for human review
    await this.storeComplaint(context.userId, message)

    const response = {
      en: `I'm sorry to hear you're having an issue. I've recorded your concern and our support team will look into it.

In the meantime, I can try to help with:
- Technical issues
- Account problems  
- General questions

Would you like me to connect you with a human support agent?`,
      
      fr: `Je suis désolé d'apprendre que vous avez un problème. J'ai enregistré votre préoccupation et notre équipe de support l'examinera.

En attendant, je peux essayer d'aider avec :
- Problèmes techniques
- Problèmes de compte
- Questions générales`,
      
      sw: `Pole kwa shida unayopata. Nimerekodi malalamiko yako na timu yetu ya msaada itaangalia.

Wakati huu, ninaweza kusaidia na:
- Matatizo ya kiufundi
- Matatizo ya akaunti
- Maswali ya kawaida`
    }

    return {
      message: response[context.language] || response.en,
      intent: 'complaint',
      confidence: 1.0,
      quickReplies: [
        'Connect to Human',
        'Technical Help',
        'Account Issues',
        'General Support'
      ],
      needsEscalation: true
    }
  }

  /**
   * Handle unknown intents
   */
  private async handleUnknown(context: UserContext, message: string): Promise<ChatbotResponse> {
    const unknownResponses = {
      en: [
        "I'm not sure I understand. Could you please rephrase that?",
        "I didn't quite get that. Can you try asking in a different way?",
        "I'm still learning! Could you be more specific about what you need help with?"
      ],
      fr: [
        "Je ne suis pas sûr de comprendre. Pourriez-vous reformuler ?",
        "Je n'ai pas bien compris. Pouvez-vous essayer autrement ?"
      ],
      sw: [
        "Sijaelewa vizuri. Je, unaweza kuuliza kwa njia nyingine?",
        "Sijapata vizuri. Unaweza kuwa maalum zaidi?"
      ]
    }

    // If confidence is very low, escalate to human
    const needsEscalation = message.length > 100 || message.includes('speak to human')

    return {
      message: this.selectRandomResponse(unknownResponses[context.language] || unknownResponses.en),
      intent: 'unknown',
      confidence: 0.3,
      quickReplies: [
        'Donate Blood',
        'Find Donors', 
        'Blood Types',
        'Speak to Human'
      ],
      needsEscalation
    }
  }

  /**
   * Additional handler methods for other intents
   */
  private async handleFindDonors(context: UserContext, entities: Record<string, string>): Promise<ChatbotResponse> {
    return {
      message: "I can help you find blood donors! Please let me know the blood type needed and your location.",
      intent: 'find_donors',
      confidence: 1.0,
      quickReplies: ['A+', 'B+', 'O+', 'AB+', 'Emergency Request'],
      needsEscalation: false
    }
  }

  private async handleEligibility(context: UserContext): Promise<ChatbotResponse> {
    return {
      message: "Let me help you check if you're eligible to donate blood. I'll ask you a few quick questions.",
      intent: 'eligibility',
      confidence: 1.0,
      quickReplies: ['Start Eligibility Check', 'Age Requirements', 'Health Requirements'],
      needsEscalation: false
    }
  }

  private async handleLocationHelp(context: UserContext): Promise<ChatbotResponse> {
    return {
      message: "I can help you find nearby blood donation centers and blood banks. What's your current location?",
      intent: 'location_help',
      confidence: 1.0,
      quickReplies: ['Use My Location', 'Enter City', 'View All Centers'],
      needsEscalation: false
    }
  }

  private async handleBloodTypes(context: UserContext): Promise<ChatbotResponse> {
    return {
      message: "Blood types determine compatibility for donations. Would you like to learn about compatibility, find your blood type, or understand the donation process?",
      intent: 'blood_types',
      confidence: 1.0,
      quickReplies: ['Compatibility Chart', 'Find My Type', 'Universal Donors'],
      needsEscalation: false
    }
  }

  private async handleAppointment(context: UserContext): Promise<ChatbotResponse> {
    return {
      message: "I can help you book a donation appointment. Would you like to see available slots at nearby centers?",
      intent: 'appointment',
      confidence: 1.0,
      quickReplies: ['Book Now', 'View Centers', 'Reschedule', 'Cancel'],
      needsEscalation: false
    }
  }

  /**
   * Utility methods
   */
  private calculateConfidence(message: string, pattern: string): number {
    const exactMatch = message.includes(pattern) ? 0.9 : 0
    const wordMatch = pattern.split(' ').some(word => message.includes(word)) ? 0.6 : 0
    return Math.max(exactMatch, wordMatch)
  }

  private extractEntities(message: string, intent: string): { [key: string]: string } {
    const entities: { [key: string]: string } = {}
    
    // Extract blood types
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    for (const type of bloodTypes) {
      if (message.toUpperCase().includes(type)) {
        entities.bloodType = type
        break
      }
    }
    
    // Extract numbers (units needed)
    const numberMatch = message.match(/\d+/)
    if (numberMatch) {
      entities.quantity = numberMatch[0]
    }
    
    return entities
  }

  private selectRandomResponse(responses: string[]): string {
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private getResponsesForIntent(intent: string, language: string): string[] {
    const key = `${intent}_${language}`
    return this.responses.get(key) || this.responses.get(`${intent}_en`) || ['I can help with that.']
  }

  private getErrorResponse(language: string): string {
    const errors = {
      en: "I'm sorry, I'm having trouble processing your request right now. Please try again or contact support.",
      fr: "Désolé, j'ai des difficultés à traiter votre demande. Veuillez réessayer ou contacter le support.",
      sw: "Pole, nina matatizo ya kuchakata ombi lako. Tafadhali jaribu tena au wasiliana na msaada."
    }
    return errors[language] || errors.en
  }

  /**
   * Data persistence methods
   */
  private async storeConversation(
    sessionId: string,
    userId: string | undefined,
    message: string,
    response: ChatbotResponse,
    intent: ChatIntent
  ): Promise<void> {
    try {
      await this.supabase
        .from('chatbot_conversations')
        .insert({
          session_id: sessionId,
          user_id: userId,
          user_message: message,
          bot_response: response.message,
          intent: intent.intent,
          confidence: intent.confidence,
          needs_escalation: response.needsEscalation,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to store conversation:', error)
    }
  }

  private async storeComplaint(userId: string | undefined, message: string): Promise<void> {
    try {
      await this.supabase
        .from('user_complaints')
        .insert({
          user_id: userId,
          complaint_text: message,
          status: 'new',
          priority: 'medium',
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to store complaint:', error)
    }
  }

  /**
   * Load configuration data
   */
  private async loadIntents(): Promise<void> {
    // In production, load from database or configuration files
    console.log('📚 Loading chatbot intents...')
  }

  private async loadResponses(): Promise<void> {
    // In production, load multilingual responses
    console.log('💬 Loading chatbot responses...')
  }

  private async loadKnowledgeBase(): Promise<void> {
    // Load FAQ and knowledge base content
    console.log('🧠 Loading knowledge base...')
  }

  /**
   * Get chatbot analytics
   */
  async getAnalytics(): Promise<{
    totalConversations: number
    topIntents: { intent: string; count: number }[]
    escalationRate: number
    userSatisfaction: number
    averageResponseTime: number
  }> {
    try {
      const { data: conversations } = await this.supabase
        .from('chatbot_conversations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      const totalConversations = conversations?.length || 0
      const escalations = conversations?.filter(c => c.needs_escalation).length || 0
      const escalationRate = totalConversations > 0 ? escalations / totalConversations : 0

      const intentCounts: Record<string, number> = {}
      conversations?.forEach(c => {
        intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1
      })

      const topIntents = Object.entries(intentCounts)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        totalConversations,
        topIntents,
        escalationRate,
        userSatisfaction: 0.85, // Would calculate from feedback
        averageResponseTime: 0.5 // Would track actual response times
      }

    } catch (error) {
      console.error('Error getting analytics:', error)
      return {
        totalConversations: 0,
        topIntents: [],
        escalationRate: 0,
        userSatisfaction: 0,
        averageResponseTime: 0
      }
    }
  }
}

// Export singleton instance
export const chatbotService = new ChatbotService()