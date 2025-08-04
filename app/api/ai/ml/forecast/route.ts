/**
 * ML Forecasting API Endpoint
 * 
 * Provides predictive analytics for blood demand and supply forecasting
 */

import { NextRequest, NextResponse } from 'next/server'
import { getMLPipelineAPI, MLPipelineRequest } from '@/lib/ai/ml-pipeline/ml-pipeline-api'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schema
const ForecastRequestSchema = z.object({
  regions: z.array(z.string()).min(1).max(10),
  bloodTypes: z.array(z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])).min(1),
  horizonDays: z.number().min(1).max(90).default(14),
  includeConfidenceIntervals: z.boolean().default(true),
  includeFactorAnalysis: z.boolean().default(true),
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

    // Check permissions - forecasting requires higher permissions
    if (!authManager.hasPermission(user, 'read:analytics') || 
        !['hospital', 'admin', 'super_admin'].includes(user.role)) {
      return createApiResponse(null, 'Insufficient permissions for forecasting', 403)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = ForecastRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid request parameters', 400, {
        errors: validationResult.error.errors
      })
    }

    const requestData = validationResult.data

    // Create ML pipeline request
    const mlRequest: MLPipelineRequest = {
      type: 'forecast',
      data: requestData,
      options: requestData.options
    }

    // Process request through ML pipeline
    const mlPipeline = getMLPipelineAPI()
    const result = await mlPipeline.processRequest(mlRequest)

    // Log the forecast request for audit purposes
    console.log(`ML forecast request processed for user ${user.id}:`, {
      requestId: result.metadata.requestId,
      regions: requestData.regions,
      bloodTypes: requestData.bloodTypes,
      horizonDays: requestData.horizonDays,
      processingTime: result.metadata.processingTime,
      confidence: result.metadata.confidence
    })

    // Prepare response data
    const responseData = {
      forecasts: result.forecasts,
      summary: {
        totalRegions: requestData.regions.length,
        totalBloodTypes: requestData.bloodTypes.length,
        forecastHorizon: requestData.horizonDays,
        overallRisk: result.forecasts?.riskAssessment.overallRisk,
        criticalActionItems: result.forecasts?.riskAssessment.actionItems
          .filter(item => item.priority === 'critical')
          .length || 0
      },
      metadata: {
        requestId: result.metadata.requestId,
        processingTime: result.metadata.processingTime,
        modelsUsed: result.metadata.modelsUsed,
        confidence: result.metadata.confidence,
        cacheHit: result.metadata.cacheHit,
        generatedAt: new Date().toISOString()
      }
    }

    return createApiResponse({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('ML forecast API error:', error)
    
    return createApiResponse(null, 'Forecast generation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

// Get forecast templates and configuration
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

    // Check permissions
    if (!authManager.hasPermission(user, 'read:analytics')) {
      return createApiResponse(null, 'Insufficient permissions', 403)
    }

    // Get available regions and blood types
    const availableRegions = [
      'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt',
      'Benin City', 'Maiduguri', 'Zaria', 'Aba', 'Jos'
    ]

    const availableBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

    // Get ML system status
    const mlPipeline = getMLPipelineAPI()
    const systemStatus = await mlPipeline.getSystemStatus()

    // Forecast configuration based on user role
    const forecastConfig = {
      maxRegions: user.role === 'admin' ? 10 : user.role === 'hospital' ? 3 : 1,
      maxHorizonDays: user.role === 'admin' ? 90 : user.role === 'hospital' ? 30 : 14,
      availableFeatures: {
        confidenceIntervals: true,
        factorAnalysis: user.role !== 'donor',
        riskAssessment: ['hospital', 'admin', 'super_admin'].includes(user.role),
        actionItems: ['admin', 'super_admin'].includes(user.role)
      }
    }

    // Forecast templates
    const templates = [
      {
        id: 'weekly_demand',
        name: 'Weekly Demand Forecast',
        description: 'Predict blood demand for the next 7 days',
        defaultConfig: {
          horizonDays: 7,
          includeConfidenceIntervals: true,
          includeFactorAnalysis: true
        }
      },
      {
        id: 'monthly_supply',
        name: 'Monthly Supply Forecast',
        description: 'Predict donor availability for the next 30 days',
        defaultConfig: {
          horizonDays: 30,
          includeConfidenceIntervals: true,
          includeFactorAnalysis: true
        }
      },
      {
        id: 'emergency_planning',
        name: 'Emergency Planning Forecast',
        description: 'Critical shortage risk assessment',
        defaultConfig: {
          horizonDays: 14,
          includeConfidenceIntervals: true,
          includeFactorAnalysis: true
        },
        requiredRole: ['hospital', 'admin', 'super_admin']
      }
    ]

    // Filter templates based on user role
    const filteredTemplates = templates.filter(template => 
      !template.requiredRole || template.requiredRole.includes(user.role)
    )

    return createApiResponse({
      success: true,
      data: {
        availableRegions,
        availableBloodTypes,
        forecastConfig,
        templates: filteredTemplates,
        systemStatus: {
          predictiveAnalytics: systemStatus.components.predictiveAnalytics,
          performance: {
            avgResponseTime: systemStatus.performance.avgResponseTime,
            successRate: systemStatus.performance.successRate
          }
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestedBy: user.id,
        userRole: user.role
      }
    })

  } catch (error) {
    console.error('ML forecast config API error:', error)
    
    return createApiResponse(null, 'Failed to get forecast configuration', 500)
  }
}
