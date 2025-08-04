/**
 * Computer Vision Batch Processing API Endpoint
 * 
 * Handles multiple image analysis requests in batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { getComputerVisionAPI, VisionAnalysisRequest } from '@/lib/ai/computer-vision/vision-api'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Batch request validation schema
const BatchAnalysisRequestSchema = z.object({
  analysisType: z.enum(['blood_type', 'document_ocr', 'combined', 'auto']).default('auto'),
  options: z.object({
    enhanceImage: z.boolean().default(true),
    extractFields: z.boolean().default(true),
    validateDocument: z.boolean().default(true),
    documentType: z.string().optional(),
    cacheResults: z.boolean().default(true),
    returnMetadata: z.boolean().default(false) // Reduce payload size for batch
  }).optional(),
  maxConcurrency: z.number().min(1).max(10).default(5)
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

    // Check permissions - batch processing requires higher permissions
    if (!authManager.hasPermission(user, 'write:blood_requests') || 
        !['admin', 'hospital'].includes(user.role)) {
      return createApiResponse(null, 'Insufficient permissions for batch processing', 403)
    }

    // Parse form data
    const formData = await request.formData()
    const optionsJson = formData.get('options') as string

    // Get all image files
    const imageFiles: File[] = []
    let fileIndex = 0
    
    while (true) {
      const imageFile = formData.get(`image_${fileIndex}`) as File
      if (!imageFile) break
      imageFiles.push(imageFile)
      fileIndex++
    }

    // Also check for images array (alternative format)
    if (imageFiles.length === 0) {
      const imagesArray = formData.getAll('images') as File[]
      imageFiles.push(...imagesArray)
    }

    if (imageFiles.length === 0) {
      return createApiResponse(null, 'At least one image file is required', 400)
    }

    // Validate batch size limits
    const maxBatchSize = user.role === 'admin' ? 50 : 20
    if (imageFiles.length > maxBatchSize) {
      return createApiResponse(null, `Batch size exceeds limit. Maximum ${maxBatchSize} images allowed`, 400)
    }

    // Validate file types and sizes
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxSize = 10 * 1024 * 1024 // 10MB per file
    
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      
      if (!allowedTypes.includes(file.type)) {
        return createApiResponse(null, `Invalid file type for image ${i + 1}. Only JPEG, PNG, and WebP are supported`, 400)
      }
      
      if (file.size > maxSize) {
        return createApiResponse(null, `File size too large for image ${i + 1}. Maximum size is 10MB`, 400)
      }
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

    const validationResult = BatchAnalysisRequestSchema.safeParse(parsedOptions)
    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid request parameters', 400, {
        errors: validationResult.error.errors
      })
    }

    // Convert files to buffers
    const imageBuffers = await Promise.all(
      imageFiles.map(async (file) => Buffer.from(await file.arrayBuffer()))
    )

    // Create analysis requests
    const analysisRequests: VisionAnalysisRequest[] = imageBuffers.map(buffer => ({
      imageBuffer: buffer,
      analysisType: validationResult.data.analysisType,
      options: validationResult.data.options
    }))

    // Perform batch analysis
    const visionAPI = getComputerVisionAPI()
    const startTime = Date.now()
    
    const results = await visionAPI.analyzeImageBatch(analysisRequests)
    
    const totalProcessingTime = Date.now() - startTime

    // Calculate batch statistics
    const batchStats = {
      totalImages: results.length,
      successfulAnalyses: results.filter(r => !r.metadata.totalProcessingTime || r.metadata.totalProcessingTime > 0).length,
      averageProcessingTime: results.reduce((sum, r) => sum + (r.metadata.totalProcessingTime || 0), 0) / results.length,
      cacheHitRate: results.filter(r => r.metadata.cacheHit).length / results.length,
      totalProcessingTime
    }

    // Analyze results by type
    const resultsByType = results.reduce((acc, result) => {
      const type = result.analysisType
      if (!acc[type]) acc[type] = 0
      acc[type]++
      return acc
    }, {} as Record<string, number>)

    // Log batch analysis for audit purposes
    console.log(`Batch vision analysis completed for user ${user.id}:`, {
      batchSize: results.length,
      processingTime: totalProcessingTime,
      stats: batchStats
    })

    return createApiResponse({
      success: true,
      data: {
        results,
        statistics: batchStats,
        resultsByType
      },
      metadata: {
        userId: user.id,
        timestamp: new Date().toISOString(),
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    })

  } catch (error) {
    console.error('Vision batch analysis API error:', error)
    
    return createApiResponse(null, 'Batch vision analysis failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

// Get batch processing status and limits
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

    // Get user-specific batch limits
    const batchLimits = {
      maxBatchSize: user.role === 'admin' ? 50 : user.role === 'hospital' ? 20 : 5,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      maxConcurrency: user.role === 'admin' ? 10 : 5,
      rateLimits: {
        requestsPerHour: user.role === 'admin' ? 100 : user.role === 'hospital' ? 50 : 20,
        imagesPerHour: user.role === 'admin' ? 1000 : user.role === 'hospital' ? 500 : 100
      }
    }

    // Get system status
    const visionAPI = getComputerVisionAPI()
    const systemStatus = await visionAPI.getSystemStatus()

    return createApiResponse({
      success: true,
      data: {
        batchLimits,
        systemStatus,
        userRole: user.role
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestedBy: user.id
      }
    })

  } catch (error) {
    console.error('Vision batch status API error:', error)
    
    return createApiResponse(null, 'Failed to get batch processing status', 500)
  }
}
