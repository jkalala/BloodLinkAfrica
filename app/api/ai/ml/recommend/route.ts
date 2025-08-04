/**
 * ML Recommendation API Endpoint
 * 
 * Provides intelligent donor recommendations using advanced ML algorithms
 */

import { NextRequest, NextResponse } from 'next/server'
import { getMLPipelineAPI, MLPipelineRequest } from '@/lib/ai/ml-pipeline/ml-pipeline-api'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schema
const RecommendationRequestSchema = z.object({
  bloodRequest: z.object({
    id: z.string(),
    bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
      hospital: z.string(),
      city: z.string()
    }),
    requirements: z.object({
      units: z.number().min(1).max(20),
      deadline: z.string().datetime(),
      specialRequirements: z.array(z.string()).optional(),
      patientAge: z.number().optional(),
      patientCondition: z.string().optional()
    }),
    requestedBy: z.object({
      hospitalId: z.string(),
      doctorId: z.string(),
      contactInfo: z.string()
    })
  }),
  maxRecommendations: z.number().min(1).max(50).default(10),
  includeReasons: z.boolean().default(true),
  filterCriteria: z.object({
    maxDistance: z.number().optional(),
    minEligibilityScore: z.number().min(0).max(100).optional(),
    excludeDonorIds: z.array(z.string()).optional()
  }).optional(),
  options: z.object({
    cacheResults: z.boolean().default(true),
    includeMetadata: z.boolean().default(true),
    confidenceThreshold: z.number().min(0).max(1).default(0.7)
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user) {
      return createApiResponse(null, 'Invalid token', 401)
    }

    // Check permissions
    if (!authManager.hasPermission(user, 'read:blood_requests')) {
      return createApiResponse(null, 'Insufficient permissions', 403)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = RecommendationRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid request parameters', 400, {
        errors: validationResult.error.errors
      })
    }

    const requestData = validationResult.data

    // Convert deadline string to Date
    requestData.bloodRequest.requirements.deadline = new Date(requestData.bloodRequest.requirements.deadline)

    // Create ML pipeline request
    const mlRequest: MLPipelineRequest = {
      type: 'recommendation',
      data: requestData,
      options: requestData.options
    }

    // Process request through ML pipeline
    const mlPipeline = getMLPipelineAPI()
    const result = await mlPipeline.processRequest(mlRequest)

    // Log the recommendation request for audit purposes
    console.log(`ML recommendation request processed for user ${user.id}:`, {
      requestId: result.metadata.requestId,
      bloodType: requestData.bloodRequest.bloodType,
      urgency: requestData.bloodRequest.urgency,
      recommendationCount: result.recommendations?.length || 0,
      processingTime: result.metadata.processingTime,
      confidence: result.metadata.confidence
    })

    return createApiResponse({
      success: true,
      data: {
        recommendations: result.recommendations,
        metadata: {
          requestId: result.metadata.requestId,
          processingTime: result.metadata.processingTime,
          modelsUsed: result.metadata.modelsUsed,
          confidence: result.metadata.confidence,
          cacheHit: result.metadata.cacheHit
        }
      },
      pagination: {
        total: result.recommendations?.length || 0,
        limit: requestData.maxRecommendations,
        offset: 0
      }
    })

  } catch (error) {
    console.error('ML recommendation API error:', error)
    
    return createApiResponse(null, 'Recommendation generation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user) {
      return createApiResponse(null, 'Invalid token', 401)
    }

    // Get ML system status
    const mlPipeline = getMLPipelineAPI()
    const systemStatus = await mlPipeline.getSystemStatus()

    // Filter status based on user role
    const filteredStatus = {
      overall: systemStatus.overall,
      recommendationEngine: {
        status: systemStatus.components.recommendationEngine.status,
        isInitialized: systemStatus.components.recommendationEngine.isInitialized,
        modelVersion: systemStatus.components.recommendationEngine.modelVersion
      },
      performance: {
        avgResponseTime: systemStatus.performance.avgResponseTime,
        successRate: systemStatus.performance.successRate,
        cacheHitRate: systemStatus.performance.cacheHitRate
      }
    }

    // Include detailed information for admin users
    if (['admin', 'super_admin'].includes(user.role)) {
      return createApiResponse({
        success: true,
        data: systemStatus,
        metadata: {
          timestamp: new Date().toISOString(),
          requestedBy: user.id,
          userRole: user.role
        }
      })
    }

    return createApiResponse({
      success: true,
      data: filteredStatus,
      metadata: {
        timestamp: new Date().toISOString(),
        requestedBy: user.id
      }
    })

  } catch (error) {
    console.error('ML recommendation status API error:', error)
    
    return createApiResponse(null, 'Failed to get recommendation system status', 500)
  }
}
