/**
 * Conversational AI Chat API Endpoint
 * 
 * Provides REST API for chatbot interactions, NLP processing,
 * and conversation management
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConversationalAI } from '@/lib/ai/chatbot/conversational-ai'
import { getAdvancedNLPEngine } from '@/lib/ai/nlp/advanced-nlp-engine'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const ChatMessageSchema = z.object({
  text: z.string().min(1).max(2000),
  sessionId: z.string().min(1).max(100),
  language: z.string().optional(),
  context: z.object({
    userId: z.string().optional(),
    domain: z.enum(['medical', 'general', 'support', 'emergency']).optional(),
    metadata: z.record(z.any()).optional()
  }).optional()
})

const NLPProcessSchema = z.object({
  text: z.string().min(1).max(5000),
  language: z.string().optional(),
  tasks: z.array(z.enum(['sentiment', 'intent', 'entities', 'language_detection', 'translation', 'summarization'])).optional(),
  context: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    domain: z.enum(['medical', 'general', 'support', 'emergency']).optional(),
    previousMessages: z.array(z.string()).optional()
  }).optional()
})

const SessionQuerySchema = z.object({
  sessionId: z.string().min(1).max(100),
  includeMessages: z.boolean().default(true),
  messageLimit: z.number().min(1).max(100).default(50)
})

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const action = body.action

    // Optional authentication for some actions
    let user = null
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const authManager = getAuthManager()
      user = await authManager.verifyToken(token)
    }

    switch (action) {
      case 'send_message':
        return await handleSendMessage(body, user)
      
      case 'process_nlp':
        return await handleNLPProcessing(body, user)
      
      case 'start_session':
        return await handleStartSession(body, user)
      
      case 'end_session':
        return await handleEndSession(body, user)
      
      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Chat API error:', error)
    
    return createApiResponse(null, 'Chat operation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

async function handleSendMessage(body: any, user: any) {
  // Validate chat message request
  const validationResult = ChatMessageSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid chat message data', 400, {
      errors: validationResult.error.errors
    })
  }

  const messageData = validationResult.data

  // Add user ID to context if authenticated
  if (user && messageData.context) {
    messageData.context.userId = user.id
  } else if (user) {
    messageData.context = { userId: user.id }
  }

  // Process message with conversational AI
  const conversationalAI = getConversationalAI()
  const response = await conversationalAI.processMessage({
    text: messageData.text,
    sessionId: messageData.sessionId,
    userId: messageData.context?.userId,
    language: messageData.language
  })

  return createApiResponse({
    success: response.success,
    data: {
      message: response.data.message,
      messageId: response.data.messageId,
      language: response.data.language,
      suggestedActions: response.data.suggestedActions,
      quickReplies: response.data.quickReplies,
      attachments: response.data.attachments,
      escalationRequired: response.data.escalationRequired,
      conversationEnded: response.data.conversationEnded
    },
    metadata: {
      responseTime: response.metadata.responseTime,
      confidence: response.metadata.confidence,
      intent: response.metadata.intent,
      nlpProcessingTime: response.metadata.nlpProcessingTime,
      sessionId: messageData.sessionId
    }
  })
}

async function handleNLPProcessing(body: any, user: any) {
  // Validate NLP processing request
  const validationResult = NLPProcessSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid NLP processing data', 400, {
      errors: validationResult.error.errors
    })
  }

  const nlpData = validationResult.data

  // Add user ID to context if authenticated
  if (user && nlpData.context) {
    nlpData.context.userId = user.id
  } else if (user) {
    nlpData.context = { userId: user.id }
  }

  // Process text with NLP engine
  const nlpEngine = getAdvancedNLPEngine()
  const response = await nlpEngine.processText({
    text: nlpData.text,
    language: nlpData.language,
    context: nlpData.context,
    tasks: nlpData.tasks
  })

  return createApiResponse({
    success: response.success,
    data: {
      originalText: response.data.originalText,
      detectedLanguage: response.data.detectedLanguage,
      confidence: response.data.confidence,
      sentiment: response.data.sentiment,
      intent: response.data.intent,
      entities: response.data.entities,
      translation: response.data.translation,
      summary: response.data.summary,
      contextualInsights: response.data.contextualInsights
    },
    metadata: {
      processingTime: response.processingTime,
      modelVersions: response.metadata.modelVersions,
      processingSteps: response.metadata.processingSteps,
      cacheHit: response.metadata.cacheHit
    }
  })
}

async function handleStartSession(body: any, user: any) {
  const sessionId = body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const language = body.language || 'en'
  const domain = body.domain || 'blood_donation'

  const conversationalAI = getConversationalAI()
  
  // Create initial greeting message
  const response = await conversationalAI.processMessage({
    text: 'Hello',
    sessionId,
    userId: user?.id,
    language
  })

  return createApiResponse({
    success: true,
    data: {
      sessionId,
      language,
      domain,
      greeting: response.data.message,
      suggestedActions: response.data.suggestedActions,
      quickReplies: response.data.quickReplies
    },
    metadata: {
      createdAt: new Date().toISOString(),
      userId: user?.id
    }
  })
}

async function handleEndSession(body: any, user: any) {
  const sessionId = body.sessionId

  if (!sessionId) {
    return createApiResponse(null, 'Session ID is required', 400)
  }

  const conversationalAI = getConversationalAI()
  await conversationalAI.endSession(sessionId)

  return createApiResponse({
    success: true,
    data: {
      sessionId,
      ended: true,
      endedAt: new Date().toISOString()
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    // Optional authentication
    let user = null
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const authManager = getAuthManager()
      user = await authManager.verifyToken(token)
    }

    // Parse query parameters
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'get_session':
        return await handleGetSession(url.searchParams, user)
      
      case 'list_sessions':
        return await handleListSessions(url.searchParams, user)
      
      case 'system_stats':
        return await handleSystemStats(user)
      
      case 'supported_languages':
        return await handleSupportedLanguages()
      
      default:
        return await handleSystemStats(user)
    }

  } catch (error) {
    console.error('Chat query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve chat data', 500)
  }
}

async function handleGetSession(searchParams: URLSearchParams, user: any) {
  const sessionId = searchParams.get('sessionId')
  const includeMessages = searchParams.get('includeMessages') !== 'false'
  const messageLimit = parseInt(searchParams.get('messageLimit') || '50')

  if (!sessionId) {
    return createApiResponse(null, 'Session ID is required', 400)
  }

  const conversationalAI = getConversationalAI()
  const session = await conversationalAI.getSession(sessionId)

  if (!session) {
    return createApiResponse(null, 'Session not found', 404)
  }

  // Check if user has access to this session
  if (user && session.userId && session.userId !== user.id) {
    return createApiResponse(null, 'Access denied to this session', 403)
  }

  const responseData: any = {
    sessionId: session.id,
    userId: session.userId,
    language: session.language,
    domain: session.domain,
    status: session.status,
    startTime: session.startTime,
    lastActivity: session.lastActivity,
    analytics: session.analytics
  }

  if (includeMessages) {
    responseData.messages = session.messages
      .slice(-messageLimit)
      .map(msg => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        language: msg.language,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      }))
  }

  return createApiResponse({
    success: true,
    data: responseData,
    metadata: {
      messageCount: session.messages.length,
      requestedAt: new Date().toISOString()
    }
  })
}

async function handleListSessions(searchParams: URLSearchParams, user: any) {
  // This would require authentication
  if (!user) {
    return createApiResponse(null, 'Authentication required', 401)
  }

  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')
  const status = searchParams.get('status')

  // In a real implementation, this would query the database for user's sessions
  const sessions = [] // Placeholder

  return createApiResponse({
    success: true,
    data: {
      sessions,
      count: sessions.length
    },
    pagination: {
      limit,
      offset,
      total: sessions.length
    },
    metadata: {
      userId: user.id,
      requestedAt: new Date().toISOString()
    }
  })
}

async function handleSystemStats(user: any) {
  const conversationalAI = getConversationalAI()
  const nlpEngine = getAdvancedNLPEngine()

  const [chatStats, nlpStats, chatHealth, nlpHealth] = await Promise.all([
    conversationalAI.getSystemStats(),
    nlpEngine.getSystemStats(),
    conversationalAI.healthCheck(),
    nlpEngine.healthCheck()
  ])

  return createApiResponse({
    success: true,
    data: {
      chatbot: {
        stats: chatStats,
        health: chatHealth.status,
        details: chatHealth.details
      },
      nlp: {
        stats: nlpStats,
        health: nlpHealth.status,
        details: nlpHealth.details
      },
      overall: {
        status: chatHealth.status === 'healthy' && nlpHealth.status === 'healthy' ? 'healthy' : 
                chatHealth.status === 'unhealthy' || nlpHealth.status === 'unhealthy' ? 'unhealthy' : 'degraded',
        capabilities: [
          'Multi-language support',
          'Intent recognition',
          'Entity extraction',
          'Sentiment analysis',
          'Context awareness',
          'Blood donation expertise'
        ]
      }
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user?.id
    }
  })
}

async function handleSupportedLanguages() {
  const nlpEngine = getAdvancedNLPEngine()
  const supportedLanguages = nlpEngine.getSupportedLanguages()

  return createApiResponse({
    success: true,
    data: {
      languages: Object.entries(supportedLanguages).map(([code, info]) => ({
        code,
        name: (info as any).name,
        confidence: (info as any).confidence,
        model: (info as any).model
      })),
      defaultLanguage: 'en',
      totalSupported: Object.keys(supportedLanguages).length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    const conversationalAI = getConversationalAI()
    const nlpEngine = getAdvancedNLPEngine()

    const [chatHealth, nlpHealth] = await Promise.all([
      conversationalAI.healthCheck(),
      nlpEngine.healthCheck()
    ])

    const overallStatus = chatHealth.status === 'healthy' && nlpHealth.status === 'healthy' ? 'healthy' :
                         chatHealth.status === 'unhealthy' || nlpHealth.status === 'unhealthy' ? 'unhealthy' : 'degraded'

    return new NextResponse(null, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 206 : 503,
      headers: {
        'X-Chat-Status': chatHealth.status,
        'X-NLP-Status': nlpHealth.status,
        'X-System-Health': overallStatus,
        'X-Active-Sessions': chatHealth.details.activeSessions?.toString() || '0',
        'X-Supported-Languages': nlpHealth.details.supportedLanguages?.toString() || '0'
      }
    })

  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-System-Health': 'unhealthy',
        'X-Error': 'Health check failed'
      }
    })
  }
}
