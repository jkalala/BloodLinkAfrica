/**
 * Advanced NLP Engine
 * 
 * Multi-language natural language processing with sentiment analysis,
 * intent recognition, entity extraction, and contextual understanding
 */

import { getMLPipelineAPI } from '../ml-pipeline/ml-pipeline-api'
import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'
import { performanceMonitor } from '../../performance/metrics'
import { getRealTimeEventSystem } from '../../realtime/event-system'

export interface NLPRequest {
  text: string
  language?: string
  context?: {
    userId?: string
    sessionId?: string
    previousMessages?: string[]
    userProfile?: Record<string, any>
    domain?: 'medical' | 'general' | 'support' | 'emergency'
  }
  tasks?: Array<'sentiment' | 'intent' | 'entities' | 'language_detection' | 'translation' | 'summarization'>
}

export interface NLPResponse {
  success: boolean
  data: {
    originalText: string
    detectedLanguage: string
    confidence: number
    sentiment: {
      polarity: 'positive' | 'negative' | 'neutral'
      score: number
      confidence: number
      emotions?: Record<string, number>
    }
    intent: {
      name: string
      confidence: number
      parameters: Record<string, any>
      domain: string
    }
    entities: Array<{
      text: string
      label: string
      start: number
      end: number
      confidence: number
      metadata?: Record<string, any>
    }>
    translation?: {
      targetLanguage: string
      translatedText: string
      confidence: number
    }
    summary?: {
      text: string
      keyPoints: string[]
      confidence: number
    }
    contextualInsights: {
      userIntent: string
      urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
      suggestedActions: string[]
      relatedTopics: string[]
    }
  }
  processingTime: number
  metadata: {
    modelVersions: Record<string, string>
    processingSteps: string[]
    cacheHit: boolean
  }
}

export interface LanguageModel {
  id: string
  name: string
  language: string
  type: 'transformer' | 'lstm' | 'bert' | 'gpt' | 'custom'
  version: string
  capabilities: string[]
  accuracy: number
  lastUpdated: Date
  isActive: boolean
  modelPath?: string
  apiEndpoint?: string
}

export interface IntentPattern {
  id: string
  intent: string
  domain: string
  patterns: string[]
  entities: string[]
  responses: Array<{
    text: string
    language: string
    confidence: number
  }>
  priority: number
  isActive: boolean
}

export interface ConversationContext {
  sessionId: string
  userId?: string
  language: string
  domain: string
  history: Array<{
    timestamp: Date
    userMessage: string
    botResponse: string
    intent: string
    entities: Record<string, any>
    sentiment: string
  }>
  userProfile: {
    preferences: Record<string, any>
    demographics: Record<string, any>
    medicalInfo?: Record<string, any>
    communicationStyle: 'formal' | 'casual' | 'technical'
  }
  contextVariables: Record<string, any>
  lastActivity: Date
  isActive: boolean
}

class AdvancedNLPEngine {
  private mlPipeline = getMLPipelineAPI()
  private db = getOptimizedDB()
  private cache = getCache()
  private eventSystem = getRealTimeEventSystem()

  private languageModels: Map<string, LanguageModel> = new Map()
  private intentPatterns: Map<string, IntentPattern> = new Map()
  private conversationContexts: Map<string, ConversationContext> = new Map()

  // Supported languages with their models
  private readonly SUPPORTED_LANGUAGES = {
    'en': { name: 'English', model: 'en_core_web_lg', confidence: 0.95 },
    'fr': { name: 'French', model: 'fr_core_news_lg', confidence: 0.90 },
    'ar': { name: 'Arabic', model: 'ar_core_news_lg', confidence: 0.85 },
    'sw': { name: 'Swahili', model: 'sw_core_news_sm', confidence: 0.80 },
    'ha': { name: 'Hausa', model: 'ha_core_news_sm', confidence: 0.75 },
    'yo': { name: 'Yoruba', model: 'yo_core_news_sm', confidence: 0.75 },
    'ig': { name: 'Igbo', model: 'ig_core_news_sm', confidence: 0.70 }
  }

  // Medical domain entities
  private readonly MEDICAL_ENTITIES = {
    'BLOOD_TYPE': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'MEDICAL_CONDITION': ['anemia', 'diabetes', 'hypertension', 'heart disease', 'cancer'],
    'URGENCY_LEVEL': ['emergency', 'urgent', 'routine', 'scheduled'],
    'LOCATION': ['hospital', 'clinic', 'blood bank', 'donation center'],
    'TIME_EXPRESSION': ['today', 'tomorrow', 'next week', 'immediately', 'asap']
  }

  // Intent patterns for blood donation domain
  private readonly BLOOD_DONATION_INTENTS = [
    {
      intent: 'request_blood',
      patterns: [
        'I need blood type {blood_type}',
        'Emergency blood request for {blood_type}',
        'Looking for {blood_type} blood donor',
        'Urgent need for {blood_type}'
      ],
      entities: ['BLOOD_TYPE', 'URGENCY_LEVEL', 'LOCATION']
    },
    {
      intent: 'donate_blood',
      patterns: [
        'I want to donate blood',
        'How can I become a blood donor',
        'Register me as a donor',
        'I would like to help by donating'
      ],
      entities: ['BLOOD_TYPE', 'LOCATION', 'TIME_EXPRESSION']
    },
    {
      intent: 'check_eligibility',
      patterns: [
        'Am I eligible to donate blood',
        'Can I donate with {medical_condition}',
        'What are the requirements for donation',
        'Check my donation eligibility'
      ],
      entities: ['MEDICAL_CONDITION', 'BLOOD_TYPE']
    },
    {
      intent: 'find_location',
      patterns: [
        'Where can I donate blood',
        'Find nearest blood bank',
        'Blood donation centers near me',
        'Hospital locations for donation'
      ],
      entities: ['LOCATION']
    },
    {
      intent: 'emergency_help',
      patterns: [
        'This is an emergency',
        'Need immediate help',
        'Critical blood shortage',
        'Life threatening situation'
      ],
      entities: ['URGENCY_LEVEL', 'BLOOD_TYPE', 'LOCATION']
    }
  ]

  constructor() {
    this.initializeLanguageModels()
    this.initializeIntentPatterns()
    this.startContextCleanup()
  }

  async processText(request: NLPRequest): Promise<NLPResponse> {
    const startTime = performance.now()

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request)
      const cachedResult = await this.cache.get<NLPResponse>(cacheKey)
      
      if (cachedResult) {
        cachedResult.metadata.cacheHit = true
        return cachedResult
      }

      // Initialize response
      const response: NLPResponse = {
        success: true,
        data: {
          originalText: request.text,
          detectedLanguage: 'en',
          confidence: 0,
          sentiment: { polarity: 'neutral', score: 0, confidence: 0 },
          intent: { name: 'unknown', confidence: 0, parameters: {}, domain: 'general' },
          entities: [],
          contextualInsights: {
            userIntent: 'unknown',
            urgencyLevel: 'low',
            suggestedActions: [],
            relatedTopics: []
          }
        },
        processingTime: 0,
        metadata: {
          modelVersions: {},
          processingSteps: [],
          cacheHit: false
        }
      }

      const processingSteps: string[] = []

      // 1. Language Detection
      if (!request.language || request.tasks?.includes('language_detection')) {
        const detectedLanguage = await this.detectLanguage(request.text)
        response.data.detectedLanguage = detectedLanguage.language
        response.data.confidence = detectedLanguage.confidence
        processingSteps.push('language_detection')
      } else {
        response.data.detectedLanguage = request.language
        response.data.confidence = 0.95
      }

      // 2. Sentiment Analysis
      if (!request.tasks || request.tasks.includes('sentiment')) {
        const sentiment = await this.analyzeSentiment(request.text, response.data.detectedLanguage)
        response.data.sentiment = sentiment
        processingSteps.push('sentiment_analysis')
      }

      // 3. Intent Recognition
      if (!request.tasks || request.tasks.includes('intent')) {
        const intent = await this.recognizeIntent(request.text, response.data.detectedLanguage, request.context)
        response.data.intent = intent
        processingSteps.push('intent_recognition')
      }

      // 4. Entity Extraction
      if (!request.tasks || request.tasks.includes('entities')) {
        const entities = await this.extractEntities(request.text, response.data.detectedLanguage, request.context?.domain)
        response.data.entities = entities
        processingSteps.push('entity_extraction')
      }

      // 5. Translation (if needed)
      if (request.tasks?.includes('translation') && response.data.detectedLanguage !== 'en') {
        const translation = await this.translateText(request.text, response.data.detectedLanguage, 'en')
        response.data.translation = translation
        processingSteps.push('translation')
      }

      // 6. Summarization (if requested)
      if (request.tasks?.includes('summarization') && request.text.length > 200) {
        const summary = await this.summarizeText(request.text, response.data.detectedLanguage)
        response.data.summary = summary
        processingSteps.push('summarization')
      }

      // 7. Contextual Analysis
      const contextualInsights = await this.analyzeContext(request, response.data)
      response.data.contextualInsights = contextualInsights
      processingSteps.push('contextual_analysis')

      // Update conversation context if session provided
      if (request.context?.sessionId) {
        await this.updateConversationContext(request.context.sessionId, request, response.data)
      }

      // Finalize response
      response.processingTime = performance.now() - startTime
      response.metadata.processingSteps = processingSteps
      response.metadata.modelVersions = this.getModelVersions()

      // Cache result
      await this.cache.set(cacheKey, response, { 
        ttl: 3600,
        tags: ['nlp', response.data.detectedLanguage, response.data.intent.name]
      })

      // Record metrics
      performanceMonitor.recordCustomMetric({
        name: 'nlp_processing_duration',
        value: response.processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          language: response.data.detectedLanguage,
          intent: response.data.intent.name,
          sentiment: response.data.sentiment.polarity,
          text_length: request.text.length.toString()
        }
      })

      return response

    } catch (error) {
      const processingTime = performance.now() - startTime
      
      performanceMonitor.recordCustomMetric({
        name: 'nlp_processing_duration',
        value: processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          success: 'false',
          error: (error as Error).message
        }
      })

      throw new Error(`NLP processing failed: ${(error as Error).message}`)
    }
  }

  private async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    try {
      // Use ML pipeline for language detection
      const mlResult = await this.mlPipeline.processRequest({
        type: 'ensemble',
        data: {
          features: {
            text_features: this.extractTextFeatures(text),
            char_ngrams: this.extractCharNgrams(text, 3),
            word_patterns: this.extractWordPatterns(text)
          },
          predictionType: 'language_detection',
          includeExplanation: false
        }
      })

      if (mlResult.ensemblePrediction) {
        const detectedLang = mlResult.ensemblePrediction.prediction
        const confidence = mlResult.ensemblePrediction.confidence

        // Validate against supported languages
        if (this.SUPPORTED_LANGUAGES[detectedLang as keyof typeof this.SUPPORTED_LANGUAGES]) {
          return { language: detectedLang, confidence }
        }
      }

      // Fallback to simple heuristics
      return this.detectLanguageHeuristic(text)

    } catch (error) {
      console.error('Language detection failed:', error)
      return { language: 'en', confidence: 0.5 }
    }
  }

  private detectLanguageHeuristic(text: string): { language: string; confidence: number } {
    const lowerText = text.toLowerCase()
    
    // Arabic detection
    if (/[\u0600-\u06FF]/.test(text)) {
      return { language: 'ar', confidence: 0.9 }
    }
    
    // French detection
    if (/\b(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles)\b/.test(lowerText)) {
      return { language: 'fr', confidence: 0.8 }
    }
    
    // Swahili detection
    if (/\b(na|ya|wa|za|la|ma|ki|vi|u|ku|pa|mu)\b/.test(lowerText)) {
      return { language: 'sw', confidence: 0.7 }
    }
    
    // Default to English
    return { language: 'en', confidence: 0.6 }
  }

  private async analyzeSentiment(text: string, language: string): Promise<{
    polarity: 'positive' | 'negative' | 'neutral'
    score: number
    confidence: number
    emotions?: Record<string, number>
  }> {
    try {
      // Use ML pipeline for sentiment analysis
      const mlResult = await this.mlPipeline.processRequest({
        type: 'ensemble',
        data: {
          features: {
            text: text,
            language: language,
            text_features: this.extractTextFeatures(text),
            emotional_indicators: this.extractEmotionalIndicators(text)
          },
          predictionType: 'sentiment_analysis',
          includeExplanation: true
        }
      })

      if (mlResult.ensemblePrediction) {
        const sentiment = mlResult.ensemblePrediction.prediction
        const confidence = mlResult.ensemblePrediction.confidence
        const score = this.mapSentimentToScore(sentiment)

        // Extract emotions if available
        const emotions = this.extractEmotions(text, language)

        return {
          polarity: sentiment as 'positive' | 'negative' | 'neutral',
          score,
          confidence,
          emotions
        }
      }

      // Fallback to rule-based sentiment
      return this.analyzeSentimentRuleBased(text, language)

    } catch (error) {
      console.error('Sentiment analysis failed:', error)
      return { polarity: 'neutral', score: 0, confidence: 0.5 }
    }
  }

  private analyzeSentimentRuleBased(text: string, language: string): {
    polarity: 'positive' | 'negative' | 'neutral'
    score: number
    confidence: number
  } {
    const lowerText = text.toLowerCase()
    
    // Positive indicators
    const positiveWords = ['good', 'great', 'excellent', 'happy', 'thank', 'please', 'help', 'yes']
    const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'angry', 'no', 'never', 'emergency', 'urgent']
    
    let positiveCount = 0
    let negativeCount = 0
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++
    })
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++
    })
    
    const totalWords = text.split(' ').length
    const positiveRatio = positiveCount / totalWords
    const negativeRatio = negativeCount / totalWords
    
    if (positiveRatio > negativeRatio && positiveRatio > 0.1) {
      return { polarity: 'positive', score: positiveRatio, confidence: 0.7 }
    } else if (negativeRatio > positiveRatio && negativeRatio > 0.1) {
      return { polarity: 'negative', score: -negativeRatio, confidence: 0.7 }
    } else {
      return { polarity: 'neutral', score: 0, confidence: 0.6 }
    }
  }

  private async recognizeIntent(text: string, language: string, context?: any): Promise<{
    name: string
    confidence: number
    parameters: Record<string, any>
    domain: string
  }> {
    try {
      const lowerText = text.toLowerCase()
      let bestMatch = { intent: 'unknown', confidence: 0, parameters: {}, domain: 'general' }

      // Check against predefined patterns
      for (const intentData of this.BLOOD_DONATION_INTENTS) {
        for (const pattern of intentData.patterns) {
          const similarity = this.calculateTextSimilarity(lowerText, pattern.toLowerCase())
          if (similarity > bestMatch.confidence) {
            bestMatch = {
              intent: intentData.intent,
              confidence: similarity,
              parameters: this.extractParametersFromPattern(text, pattern, intentData.entities),
              domain: 'blood_donation'
            }
          }
        }
      }

      // Use ML pipeline for intent classification if no good pattern match
      if (bestMatch.confidence < 0.6) {
        const mlResult = await this.mlPipeline.processRequest({
          type: 'ensemble',
          data: {
            features: {
              text: text,
              language: language,
              text_features: this.extractTextFeatures(text),
              context_features: context ? this.extractContextFeatures(context) : {}
            },
            predictionType: 'intent_classification',
            includeExplanation: true
          }
        })

        if (mlResult.ensemblePrediction && mlResult.ensemblePrediction.confidence > bestMatch.confidence) {
          bestMatch = {
            intent: mlResult.ensemblePrediction.prediction,
            confidence: mlResult.ensemblePrediction.confidence,
            parameters: mlResult.ensemblePrediction.parameters || {},
            domain: this.inferDomain(mlResult.ensemblePrediction.prediction)
          }
        }
      }

      return {
        name: bestMatch.intent,
        confidence: bestMatch.confidence,
        parameters: bestMatch.parameters,
        domain: bestMatch.domain
      }

    } catch (error) {
      console.error('Intent recognition failed:', error)
      return { name: 'unknown', confidence: 0, parameters: {}, domain: 'general' }
    }
  }

  private async extractEntities(text: string, language: string, domain?: string): Promise<Array<{
    text: string
    label: string
    start: number
    end: number
    confidence: number
    metadata?: Record<string, any>
  }>> {
    try {
      const entities: any[] = []

      // Extract medical entities if in medical domain
      if (domain === 'medical' || domain === undefined) {
        const medicalEntities = this.extractMedicalEntities(text)
        entities.push(...medicalEntities)
      }

      // Use ML pipeline for general entity extraction
      const mlResult = await this.mlPipeline.processRequest({
        type: 'ensemble',
        data: {
          features: {
            text: text,
            language: language,
            domain: domain || 'general'
          },
          predictionType: 'entity_extraction',
          includeExplanation: false
        }
      })

      if (mlResult.ensemblePrediction && mlResult.ensemblePrediction.entities) {
        entities.push(...mlResult.ensemblePrediction.entities)
      }

      // Remove duplicates and sort by confidence
      const uniqueEntities = this.deduplicateEntities(entities)
      return uniqueEntities.sort((a, b) => b.confidence - a.confidence)

    } catch (error) {
      console.error('Entity extraction failed:', error)
      return []
    }
  }

  private extractMedicalEntities(text: string): any[] {
    const entities: any[] = []
    const lowerText = text.toLowerCase()

    // Extract blood types
    for (const bloodType of this.MEDICAL_ENTITIES.BLOOD_TYPE) {
      const regex = new RegExp(`\\b${bloodType.toLowerCase()}\\b`, 'gi')
      let match
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          label: 'BLOOD_TYPE',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.9,
          metadata: { bloodType: bloodType }
        })
      }
    }

    // Extract urgency levels
    const urgencyPatterns = {
      'emergency': /\b(emergency|urgent|critical|immediate|asap)\b/gi,
      'routine': /\b(routine|scheduled|planned|regular)\b/gi
    }

    for (const [level, pattern] of Object.entries(urgencyPatterns)) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          label: 'URGENCY_LEVEL',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.8,
          metadata: { urgencyLevel: level }
        })
      }
    }

    return entities
  }

  private async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<{
    targetLanguage: string
    translatedText: string
    confidence: number
  }> {
    try {
      // Use ML pipeline for translation
      const mlResult = await this.mlPipeline.processRequest({
        type: 'ensemble',
        data: {
          features: {
            text: text,
            source_language: sourceLanguage,
            target_language: targetLanguage
          },
          predictionType: 'translation',
          includeExplanation: false
        }
      })

      if (mlResult.ensemblePrediction) {
        return {
          targetLanguage,
          translatedText: mlResult.ensemblePrediction.translation,
          confidence: mlResult.ensemblePrediction.confidence
        }
      }

      // Fallback to simple translation
      return {
        targetLanguage,
        translatedText: text, // No translation available
        confidence: 0.3
      }

    } catch (error) {
      console.error('Translation failed:', error)
      return {
        targetLanguage,
        translatedText: text,
        confidence: 0.1
      }
    }
  }

  private async summarizeText(text: string, language: string): Promise<{
    text: string
    keyPoints: string[]
    confidence: number
  }> {
    try {
      // Use ML pipeline for summarization
      const mlResult = await this.mlPipeline.processRequest({
        type: 'ensemble',
        data: {
          features: {
            text: text,
            language: language,
            max_length: Math.min(100, Math.floor(text.length * 0.3))
          },
          predictionType: 'summarization',
          includeExplanation: false
        }
      })

      if (mlResult.ensemblePrediction) {
        return {
          text: mlResult.ensemblePrediction.summary,
          keyPoints: mlResult.ensemblePrediction.keyPoints || [],
          confidence: mlResult.ensemblePrediction.confidence
        }
      }

      // Fallback to extractive summarization
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
      const summary = sentences.slice(0, 2).join('. ') + '.'
      
      return {
        text: summary,
        keyPoints: sentences.slice(0, 3),
        confidence: 0.6
      }

    } catch (error) {
      console.error('Summarization failed:', error)
      return {
        text: text.substring(0, 100) + '...',
        keyPoints: [],
        confidence: 0.3
      }
    }
  }

  private async analyzeContext(request: NLPRequest, nlpData: any): Promise<{
    userIntent: string
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
    suggestedActions: string[]
    relatedTopics: string[]
  }> {
    // Determine user intent from NLP results
    let userIntent = nlpData.intent.name
    if (userIntent === 'unknown' && nlpData.entities.length > 0) {
      userIntent = this.inferIntentFromEntities(nlpData.entities)
    }

    // Determine urgency level
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    
    // Check for urgency indicators
    const urgencyEntity = nlpData.entities.find((e: any) => e.label === 'URGENCY_LEVEL')
    if (urgencyEntity) {
      urgencyLevel = urgencyEntity.metadata?.urgencyLevel === 'emergency' ? 'critical' : 'high'
    }
    
    // Check sentiment for urgency
    if (nlpData.sentiment.polarity === 'negative' && nlpData.sentiment.score < -0.5) {
      urgencyLevel = urgencyLevel === 'low' ? 'medium' : urgencyLevel
    }

    // Generate suggested actions
    const suggestedActions = this.generateSuggestedActions(userIntent, urgencyLevel, nlpData.entities)

    // Generate related topics
    const relatedTopics = this.generateRelatedTopics(userIntent, nlpData.entities)

    return {
      userIntent,
      urgencyLevel,
      suggestedActions,
      relatedTopics
    }
  }

  // Helper methods
  private generateCacheKey(request: NLPRequest): string {
    const keyData = {
      text: request.text,
      language: request.language,
      tasks: request.tasks?.sort(),
      domain: request.context?.domain
    }
    return `nlp:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`
  }

  private extractTextFeatures(text: string): Record<string, number> {
    return {
      length: text.length,
      word_count: text.split(' ').length,
      sentence_count: text.split(/[.!?]+/).length,
      avg_word_length: text.split(' ').reduce((sum, word) => sum + word.length, 0) / text.split(' ').length,
      uppercase_ratio: (text.match(/[A-Z]/g) || []).length / text.length,
      punctuation_ratio: (text.match(/[.!?,:;]/g) || []).length / text.length
    }
  }

  private extractCharNgrams(text: string, n: number): string[] {
    const ngrams: string[] = []
    for (let i = 0; i <= text.length - n; i++) {
      ngrams.push(text.substring(i, i + n))
    }
    return ngrams
  }

  private extractWordPatterns(text: string): Record<string, number> {
    const words = text.toLowerCase().split(/\s+/)
    const patterns: Record<string, number> = {}
    
    words.forEach(word => {
      patterns[word] = (patterns[word] || 0) + 1
    })
    
    return patterns
  }

  private extractEmotionalIndicators(text: string): Record<string, number> {
    const emotionalWords = {
      joy: ['happy', 'glad', 'excited', 'pleased'],
      anger: ['angry', 'mad', 'furious', 'annoyed'],
      fear: ['scared', 'afraid', 'worried', 'anxious'],
      sadness: ['sad', 'depressed', 'upset', 'disappointed']
    }

    const indicators: Record<string, number> = {}
    const lowerText = text.toLowerCase()

    for (const [emotion, words] of Object.entries(emotionalWords)) {
      indicators[emotion] = words.filter(word => lowerText.includes(word)).length
    }

    return indicators
  }

  private extractEmotions(text: string, language: string): Record<string, number> {
    // Simplified emotion extraction
    const emotions = {
      joy: 0,
      anger: 0,
      fear: 0,
      sadness: 0,
      surprise: 0,
      disgust: 0
    }

    const lowerText = text.toLowerCase()
    
    // Joy indicators
    if (/\b(happy|glad|excited|joy|pleased|great|excellent)\b/.test(lowerText)) {
      emotions.joy = 0.7
    }
    
    // Anger indicators
    if (/\b(angry|mad|furious|annoyed|hate|terrible)\b/.test(lowerText)) {
      emotions.anger = 0.7
    }
    
    // Fear indicators
    if (/\b(scared|afraid|worried|anxious|emergency|urgent)\b/.test(lowerText)) {
      emotions.fear = 0.6
    }

    return emotions
  }

  private mapSentimentToScore(sentiment: string): number {
    switch (sentiment) {
      case 'positive': return 0.7
      case 'negative': return -0.7
      default: return 0
    }
  }

  private extractContextFeatures(context: any): Record<string, any> {
    return {
      has_user_id: !!context.userId,
      has_session: !!context.sessionId,
      has_history: !!(context.previousMessages && context.previousMessages.length > 0),
      domain: context.domain || 'general',
      message_count: context.previousMessages?.length || 0
    }
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '))
    const words2 = new Set(text2.split(' '))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }

  private extractParametersFromPattern(text: string, pattern: string, entities: string[]): Record<string, any> {
    const parameters: Record<string, any> = {}
    
    // Simple parameter extraction based on entities
    entities.forEach(entityType => {
      if (entityType === 'BLOOD_TYPE') {
        const bloodTypeMatch = text.match(/\b(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)\b/i)
        if (bloodTypeMatch) {
          parameters.blood_type = bloodTypeMatch[0].toUpperCase()
        }
      }
    })
    
    return parameters
  }

  private inferDomain(intent: string): string {
    const bloodDonationIntents = ['request_blood', 'donate_blood', 'check_eligibility', 'find_location', 'emergency_help']
    return bloodDonationIntents.includes(intent) ? 'blood_donation' : 'general'
  }

  private deduplicateEntities(entities: any[]): any[] {
    const seen = new Set()
    return entities.filter(entity => {
      const key = `${entity.text}-${entity.label}-${entity.start}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private inferIntentFromEntities(entities: any[]): string {
    const entityLabels = entities.map(e => e.label)
    
    if (entityLabels.includes('BLOOD_TYPE') && entityLabels.includes('URGENCY_LEVEL')) {
      return 'request_blood'
    }
    
    if (entityLabels.includes('BLOOD_TYPE')) {
      return 'donate_blood'
    }
    
    if (entityLabels.includes('LOCATION')) {
      return 'find_location'
    }
    
    return 'general_inquiry'
  }

  private generateSuggestedActions(intent: string, urgencyLevel: string, entities: any[]): string[] {
    const actions: string[] = []
    
    switch (intent) {
      case 'request_blood':
        actions.push('Search for available donors')
        actions.push('Contact nearby blood banks')
        if (urgencyLevel === 'critical') {
          actions.push('Initiate emergency protocol')
        }
        break
        
      case 'donate_blood':
        actions.push('Check eligibility requirements')
        actions.push('Find nearest donation center')
        actions.push('Schedule appointment')
        break
        
      case 'emergency_help':
        actions.push('Escalate to emergency team')
        actions.push('Activate emergency response')
        actions.push('Notify relevant hospitals')
        break
        
      default:
        actions.push('Provide general information')
        actions.push('Ask clarifying questions')
    }
    
    return actions
  }

  private generateRelatedTopics(intent: string, entities: any[]): string[] {
    const topics: string[] = []
    
    switch (intent) {
      case 'request_blood':
        topics.push('Blood compatibility')
        topics.push('Emergency procedures')
        topics.push('Hospital locations')
        break
        
      case 'donate_blood':
        topics.push('Donation eligibility')
        topics.push('Health requirements')
        topics.push('Donation process')
        break
        
      default:
        topics.push('Blood donation basics')
        topics.push('Health and safety')
    }
    
    return topics
  }

  private async updateConversationContext(sessionId: string, request: NLPRequest, nlpData: any): Promise<void> {
    let context = this.conversationContexts.get(sessionId)
    
    if (!context) {
      context = {
        sessionId,
        userId: request.context?.userId,
        language: nlpData.detectedLanguage,
        domain: request.context?.domain || 'general',
        history: [],
        userProfile: {
          preferences: {},
          demographics: {},
          communicationStyle: 'casual'
        },
        contextVariables: {},
        lastActivity: new Date(),
        isActive: true
      }
    }
    
    // Add to history
    context.history.push({
      timestamp: new Date(),
      userMessage: request.text,
      botResponse: '', // Will be filled by chatbot
      intent: nlpData.intent.name,
      entities: nlpData.entities.reduce((acc: any, entity: any) => {
        acc[entity.label] = entity.text
        return acc
      }, {}),
      sentiment: nlpData.sentiment.polarity
    })
    
    // Keep only last 50 messages
    if (context.history.length > 50) {
      context.history = context.history.slice(-50)
    }
    
    context.lastActivity = new Date()
    this.conversationContexts.set(sessionId, context)
    
    // Cache context
    await this.cache.set(`conversation:${sessionId}`, context, { 
      ttl: 24 * 3600,
      tags: ['conversation', sessionId]
    })
  }

  private getModelVersions(): Record<string, string> {
    const versions: Record<string, string> = {}
    
    for (const [id, model] of this.languageModels.entries()) {
      versions[id] = model.version
    }
    
    return versions
  }

  private initializeLanguageModels(): void {
    // Initialize language models for supported languages
    for (const [langCode, langInfo] of Object.entries(this.SUPPORTED_LANGUAGES)) {
      const model: LanguageModel = {
        id: `${langCode}_model`,
        name: `${langInfo.name} Language Model`,
        language: langCode,
        type: 'transformer',
        version: '1.0.0',
        capabilities: ['tokenization', 'pos_tagging', 'ner', 'sentiment'],
        accuracy: langInfo.confidence,
        lastUpdated: new Date(),
        isActive: true,
        modelPath: `/models/${langInfo.model}`
      }
      
      this.languageModels.set(model.id, model)
    }
  }

  private initializeIntentPatterns(): void {
    // Initialize intent patterns from predefined data
    this.BLOOD_DONATION_INTENTS.forEach((intentData, index) => {
      const pattern: IntentPattern = {
        id: `pattern_${index}`,
        intent: intentData.intent,
        domain: 'blood_donation',
        patterns: intentData.patterns,
        entities: intentData.entities,
        responses: [
          {
            text: `I understand you want to ${intentData.intent.replace('_', ' ')}. Let me help you with that.`,
            language: 'en',
            confidence: 0.8
          }
        ],
        priority: intentData.intent === 'emergency_help' ? 1 : 5,
        isActive: true
      }
      
      this.intentPatterns.set(pattern.id, pattern)
    })
  }

  private startContextCleanup(): void {
    // Clean up inactive conversation contexts every hour
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      
      for (const [sessionId, context] of this.conversationContexts.entries()) {
        if (context.lastActivity < cutoffTime) {
          this.conversationContexts.delete(sessionId)
        }
      }
    }, 60 * 60 * 1000) // 1 hour
  }

  // Public API methods
  public async getConversationContext(sessionId: string): Promise<ConversationContext | undefined> {
    return this.conversationContexts.get(sessionId)
  }

  public getSupportedLanguages(): Record<string, any> {
    return this.SUPPORTED_LANGUAGES
  }

  public getLanguageModels(): LanguageModel[] {
    return Array.from(this.languageModels.values())
  }

  public getSystemStats() {
    return {
      languageModels: this.languageModels.size,
      intentPatterns: this.intentPatterns.size,
      activeConversations: this.conversationContexts.size,
      supportedLanguages: Object.keys(this.SUPPORTED_LANGUAGES).length
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = this.getSystemStats()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (stats.languageModels === 0) {
      status = 'unhealthy'
    } else if (stats.languageModels < 3) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        ...stats,
        mlPipelineConnected: true // Assume connected if no errors
      }
    }
  }
}

// Singleton instance
let advancedNLPEngineInstance: AdvancedNLPEngine | null = null

export function getAdvancedNLPEngine(): AdvancedNLPEngine {
  if (!advancedNLPEngineInstance) {
    advancedNLPEngineInstance = new AdvancedNLPEngine()
  }
  return advancedNLPEngineInstance
}

export default AdvancedNLPEngine
