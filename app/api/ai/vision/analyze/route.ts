/**
 * Computer Vision Analysis API Endpoint
 * 
 * Unified endpoint for blood type recognition and document OCR
 */

import { NextRequest, NextResponse } from 'next/server'
import { getComputerVisionAPI, VisionAnalysisRequest } from '@/lib/ai/computer-vision/vision-api'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schema
const AnalysisRequestSchema = z.object({
  analysisType: z.enum(['blood_type', 'document_ocr', 'combined', 'auto']).default('auto'),
  options: z.object({
    enhanceImage: z.boolean().default(true),
    extractFields: z.boolean().default(true),
    validateDocument: z.boolean().default(true),
    documentType: z.string().optional(),
    cacheResults: z.boolean().default(true),
    returnMetadata: z.boolean().default(true)
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

    // Parse form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const optionsJson = formData.get('options') as string

    if (!imageFile) {
      return createApiResponse(null, 'Image file is required', 400)
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(imageFile.type)) {
      return createApiResponse(null, 'Invalid file type. Only JPEG, PNG, and WebP are supported', 400)
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (imageFile.size > maxSize) {
      return createApiResponse(null, 'File size too large. Maximum size is 10MB', 400)
    }

    // Parse and validate options
    let parsedOptions = {}
    if (optionsJson) {
      try {
        parsedOptions = JSON.parse(optionsJson)
      } catch (error) {
        return createApiResponse(null, 'Invalid options JSON', 400)
      }
    }

    const validationResult = AnalysisRequestSchema.safeParse(parsedOptions)
    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid request parameters', 400, {
        errors: validationResult.error.errors
      })
    }

    // Convert file to buffer
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer())

    // Create analysis request
    const analysisRequest: VisionAnalysisRequest = {
      imageBuffer,
      analysisType: validationResult.data.analysisType,
      options: validationResult.data.options
    }

    // Perform analysis
    const visionAPI = getComputerVisionAPI()
    const result = await visionAPI.analyzeImage(analysisRequest)

    // Log the analysis for audit purposes
    console.log(`Vision analysis completed for user ${user.id}:`, {
      analysisId: result.metadata.analysisId,
      analysisType: result.analysisType,
      processingTime: result.metadata.totalProcessingTime,
      cacheHit: result.metadata.cacheHit
    })

    return createApiResponse({
      success: true,
      data: result,
      metadata: {
        userId: user.id,
        timestamp: new Date().toISOString(),
        analysisId: result.metadata.analysisId
      }
    })

  } catch (error) {
    console.error('Vision analysis API error:', error)
    
    return createApiResponse(null, 'Vision analysis failed', 500, {
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

    // Get system status
    const visionAPI = getComputerVisionAPI()
    const status = await visionAPI.getSystemStatus()

    return createApiResponse({
      success: true,
      data: status,
      metadata: {
        timestamp: new Date().toISOString(),
        requestedBy: user.id
      }
    })

  } catch (error) {
    console.error('Vision status API error:', error)
    
    return createApiResponse(null, 'Failed to get system status', 500)
  }
}
