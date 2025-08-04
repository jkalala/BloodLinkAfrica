/**
 * Computer Vision Health Check API Endpoint
 * 
 * Provides health status and diagnostics for the computer vision system
 */

import { NextRequest, NextResponse } from 'next/server'
import { getComputerVisionAPI } from '@/lib/ai/computer-vision/vision-api'
import { createApiResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const visionAPI = getComputerVisionAPI()
    
    // Perform comprehensive health check
    const healthCheck = await visionAPI.healthCheck()
    const systemStatus = await visionAPI.getSystemStatus()
    
    // Additional diagnostic information
    const diagnostics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV
    }

    // Determine overall health status
    const isHealthy = healthCheck.status === 'healthy'
    const httpStatus = isHealthy ? 200 : healthCheck.status === 'degraded' ? 200 : 503

    return NextResponse.json({
      success: true,
      data: {
        status: healthCheck.status,
        services: healthCheck.services,
        systemStatus,
        diagnostics,
        checks: {
          bloodTypeRecognition: {
            status: healthCheck.services.bloodTypeRecognition ? 'healthy' : 'unhealthy',
            details: systemStatus.bloodTypeRecognition
          },
          documentOCR: {
            status: healthCheck.services.documentOCR ? 'healthy' : 'unhealthy',
            details: systemStatus.documentOCR
          },
          cache: {
            status: healthCheck.services.cache ? 'healthy' : 'unhealthy',
            details: 'Redis cache connectivity'
          }
        },
        performance: systemStatus.performance,
        recommendations: generateHealthRecommendations(healthCheck, systemStatus)
      },
      metadata: {
        timestamp: diagnostics.timestamp,
        version: '2.0.0'
      }
    }, { status: httpStatus })

  } catch (error) {
    console.error('Vision health check error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    }, { status: 503 })
  }
}

// Detailed health check with performance test
export async function POST(request: NextRequest) {
  try {
    const visionAPI = getComputerVisionAPI()
    
    // Basic health check
    const basicHealth = await visionAPI.healthCheck()
    
    // Performance test with a small test image
    const performanceTest = await performPerformanceTest(visionAPI)
    
    // System resource check
    const resourceCheck = checkSystemResources()
    
    // Dependency check
    const dependencyCheck = await checkDependencies()
    
    const detailedHealth = {
      basic: basicHealth,
      performance: performanceTest,
      resources: resourceCheck,
      dependencies: dependencyCheck,
      timestamp: new Date().toISOString()
    }

    // Calculate overall health score
    const healthScore = calculateHealthScore(detailedHealth)
    
    return createApiResponse({
      success: true,
      data: {
        ...detailedHealth,
        healthScore,
        status: healthScore >= 0.8 ? 'healthy' : healthScore >= 0.5 ? 'degraded' : 'unhealthy'
      }
    })

  } catch (error) {
    console.error('Detailed health check error:', error)
    
    return createApiResponse(null, 'Detailed health check failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

async function performPerformanceTest(visionAPI: any) {
  try {
    // Create a small test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8A, 0x8E, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])

    const startTime = Date.now()
    
    // Test blood type recognition
    const bloodTypeTest = await visionAPI.analyzeImage({
      imageBuffer: testImageBuffer,
      analysisType: 'blood_type',
      options: { enhanceImage: false, cacheResults: false }
    }).catch((error: Error) => ({ error: error.message }))
    
    const bloodTypeTime = Date.now() - startTime

    // Test OCR
    const ocrStartTime = Date.now()
    const ocrTest = await visionAPI.analyzeImage({
      imageBuffer: testImageBuffer,
      analysisType: 'document_ocr',
      options: { enhanceImage: false, cacheResults: false }
    }).catch((error: Error) => ({ error: error.message }))
    
    const ocrTime = Date.now() - ocrStartTime

    return {
      bloodTypeRecognition: {
        responseTime: bloodTypeTime,
        success: !('error' in bloodTypeTest),
        error: 'error' in bloodTypeTest ? bloodTypeTest.error : null
      },
      documentOCR: {
        responseTime: ocrTime,
        success: !('error' in ocrTest),
        error: 'error' in ocrTest ? ocrTest.error : null
      },
      totalTestTime: Date.now() - startTime
    }

  } catch (error) {
    return {
      error: (error as Error).message,
      success: false
    }
  }
}

function checkSystemResources() {
  const memoryUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()
  
  // Convert to MB
  const memoryMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  }

  // Memory health assessment
  const memoryHealth = {
    status: memoryMB.heapUsed < 512 ? 'healthy' : memoryMB.heapUsed < 1024 ? 'warning' : 'critical',
    usage: memoryMB,
    heapUtilization: Math.round((memoryMB.heapUsed / memoryMB.heapTotal) * 100)
  }

  return {
    memory: memoryHealth,
    uptime: process.uptime(),
    platform: process.platform,
    nodeVersion: process.version,
    pid: process.pid
  }
}

async function checkDependencies() {
  const dependencies = {
    tensorflow: false,
    tesseract: false,
    sharp: false,
    canvas: false
  }

  try {
    // Check TensorFlow
    const tf = await import('@tensorflow/tfjs-node')
    dependencies.tensorflow = !!tf
  } catch (error) {
    // TensorFlow not available
  }

  try {
    // Check Tesseract
    const tesseract = await import('tesseract.js')
    dependencies.tesseract = !!tesseract
  } catch (error) {
    // Tesseract not available
  }

  try {
    // Check Sharp
    const sharp = await import('sharp')
    dependencies.sharp = !!sharp
  } catch (error) {
    // Sharp not available
  }

  try {
    // Check Canvas
    const canvas = await import('canvas')
    dependencies.canvas = !!canvas
  } catch (error) {
    // Canvas not available
  }

  return {
    dependencies,
    allAvailable: Object.values(dependencies).every(Boolean),
    availableCount: Object.values(dependencies).filter(Boolean).length,
    totalCount: Object.keys(dependencies).length
  }
}

function calculateHealthScore(healthData: any): number {
  let score = 0
  let maxScore = 0

  // Basic health (40% weight)
  maxScore += 40
  if (healthData.basic.status === 'healthy') score += 40
  else if (healthData.basic.status === 'degraded') score += 20

  // Performance (30% weight)
  maxScore += 30
  if (healthData.performance && !healthData.performance.error) {
    if (healthData.performance.bloodTypeRecognition?.success) score += 15
    if (healthData.performance.documentOCR?.success) score += 15
  }

  // Resources (20% weight)
  maxScore += 20
  if (healthData.resources.memory.status === 'healthy') score += 20
  else if (healthData.resources.memory.status === 'warning') score += 10

  // Dependencies (10% weight)
  maxScore += 10
  if (healthData.dependencies.allAvailable) score += 10
  else score += (healthData.dependencies.availableCount / healthData.dependencies.totalCount) * 10

  return score / maxScore
}

function generateHealthRecommendations(healthCheck: any, systemStatus: any): string[] {
  const recommendations: string[] = []

  if (!healthCheck.services.bloodTypeRecognition) {
    recommendations.push('Blood type recognition model is not loaded. Check model files and configuration.')
  }

  if (!healthCheck.services.documentOCR) {
    recommendations.push('Document OCR workers are not initialized. Check Tesseract.js configuration.')
  }

  if (systemStatus.performance.avgProcessingTime > 2000) {
    recommendations.push('Average processing time is high. Consider optimizing image preprocessing or upgrading hardware.')
  }

  if (systemStatus.performance.successRate < 0.9) {
    recommendations.push('Success rate is below 90%. Review error logs and consider model retraining.')
  }

  if (systemStatus.performance.cacheHitRate < 0.5) {
    recommendations.push('Cache hit rate is low. Consider increasing cache TTL or improving cache key generation.')
  }

  if (recommendations.length === 0) {
    recommendations.push('System is operating optimally. No immediate actions required.')
  }

  return recommendations
}
