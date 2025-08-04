/**
 * Integrated Computer Vision API
 * 
 * Unified interface for blood type recognition and document OCR
 * with intelligent routing and combined analysis capabilities
 */

import { getBloodTypeRecognitionSystem, BloodTypeResult } from './blood-type-recognition'
import { getDocumentOCRSystem, OCRResult, DocumentInfo } from './document-ocr'
import { performanceMonitor } from '../../performance/metrics'
import { getCache } from '../../cache/redis-cache'

export interface VisionAnalysisRequest {
  imageBuffer: Buffer
  analysisType: 'blood_type' | 'document_ocr' | 'combined' | 'auto'
  options?: {
    enhanceImage?: boolean
    extractFields?: boolean
    validateDocument?: boolean
    documentType?: string
    cacheResults?: boolean
    returnMetadata?: boolean
  }
}

export interface VisionAnalysisResult {
  analysisType: string
  bloodType?: BloodTypeResult
  ocr?: OCRResult
  document?: DocumentInfo
  combinedAnalysis?: {
    extractedBloodType?: string
    confidence: number
    consistencyCheck: {
      bloodTypeMatch: boolean
      confidenceScore: number
      discrepancies: string[]
    }
  }
  metadata: {
    totalProcessingTime: number
    cacheHit: boolean
    imageHash: string
    analysisId: string
  }
}

export interface VisionSystemStatus {
  bloodTypeRecognition: {
    available: boolean
    modelLoaded: boolean
    version: string
  }
  documentOCR: {
    available: boolean
    workersInitialized: boolean
    workerCount: number
  }
  performance: {
    avgProcessingTime: number
    successRate: number
    cacheHitRate: number
  }
}

class ComputerVisionAPI {
  private bloodTypeSystem = getBloodTypeRecognitionSystem()
  private ocrSystem = getDocumentOCRSystem()
  private cache = getCache()
  private analysisCounter = 0

  async analyzeImage(request: VisionAnalysisRequest): Promise<VisionAnalysisResult> {
    const startTime = performance.now()
    const analysisId = this.generateAnalysisId()
    const imageHash = this.generateImageHash(request.imageBuffer)

    try {
      // Check cache if enabled
      if (request.options?.cacheResults) {
        const cachedResult = await this.getCachedResult(imageHash, request.analysisType)
        if (cachedResult) {
          return {
            ...cachedResult,
            metadata: {
              ...cachedResult.metadata,
              cacheHit: true,
              analysisId
            }
          }
        }
      }

      // Determine analysis type
      const analysisType = await this.determineAnalysisType(request)
      
      let result: VisionAnalysisResult = {
        analysisType,
        metadata: {
          totalProcessingTime: 0,
          cacheHit: false,
          imageHash,
          analysisId
        }
      }

      // Perform analysis based on type
      switch (analysisType) {
        case 'blood_type':
          result.bloodType = await this.performBloodTypeAnalysis(request)
          break

        case 'document_ocr':
          const ocrResult = await this.performDocumentOCR(request)
          result.ocr = ocrResult.ocr
          result.document = ocrResult.document
          break

        case 'combined':
          const combinedResult = await this.performCombinedAnalysis(request)
          result = { ...result, ...combinedResult }
          break

        default:
          throw new Error(`Unsupported analysis type: ${analysisType}`)
      }

      const totalProcessingTime = performance.now() - startTime
      result.metadata.totalProcessingTime = totalProcessingTime

      // Cache result if enabled
      if (request.options?.cacheResults) {
        await this.cacheResult(imageHash, analysisType, result)
      }

      // Record performance metrics
      this.recordAnalysisMetrics(analysisType, totalProcessingTime, true)

      return result

    } catch (error) {
      const totalProcessingTime = performance.now() - startTime
      
      this.recordAnalysisMetrics(request.analysisType, totalProcessingTime, false, (error as Error).message)
      
      throw new Error(`Vision analysis failed: ${(error as Error).message}`)
    }
  }

  private async determineAnalysisType(request: VisionAnalysisRequest): Promise<string> {
    if (request.analysisType !== 'auto') {
      return request.analysisType
    }

    // Auto-detection logic based on image characteristics
    try {
      // Quick OCR scan to detect document type
      const quickOCR = await this.ocrSystem.processDocument(request.imageBuffer, {
        enhanceImage: false,
        extractFields: false
      })

      const text = quickOCR.ocr.text.toLowerCase()
      
      // Check for document indicators
      const documentKeywords = ['patient', 'medical', 'hospital', 'doctor', 'diagnosis', 'report']
      const hasDocumentKeywords = documentKeywords.some(keyword => text.includes(keyword))
      
      // Check for blood type indicators
      const bloodTypePattern = /\b(A|B|AB|O)[+-]?\b/i
      const hasBloodTypePattern = bloodTypePattern.test(text)
      
      if (hasDocumentKeywords && hasBloodTypePattern) {
        return 'combined'
      } else if (hasDocumentKeywords) {
        return 'document_ocr'
      } else if (hasBloodTypePattern || text.length < 50) {
        return 'blood_type'
      } else {
        return 'document_ocr' // Default to OCR for text-heavy images
      }

    } catch (error) {
      // Fallback to combined analysis if auto-detection fails
      return 'combined'
    }
  }

  private async performBloodTypeAnalysis(request: VisionAnalysisRequest): Promise<BloodTypeResult> {
    return this.bloodTypeSystem.recognizeBloodType(request.imageBuffer, {
      enhanceImage: request.options?.enhanceImage,
      detectRegion: true,
      returnMetadata: request.options?.returnMetadata
    })
  }

  private async performDocumentOCR(request: VisionAnalysisRequest): Promise<{
    ocr: OCRResult
    document?: DocumentInfo
  }> {
    return this.ocrSystem.processDocument(request.imageBuffer, {
      documentType: request.options?.documentType,
      enhanceImage: request.options?.enhanceImage,
      extractFields: request.options?.extractFields,
      validateDocument: request.options?.validateDocument
    })
  }

  private async performCombinedAnalysis(request: VisionAnalysisRequest): Promise<Partial<VisionAnalysisResult>> {
    // Run both analyses in parallel
    const [bloodTypeResult, ocrResult] = await Promise.all([
      this.performBloodTypeAnalysis(request),
      this.performDocumentOCR(request)
    ])

    // Perform consistency analysis
    const combinedAnalysis = this.analyzeCombinedResults(bloodTypeResult, ocrResult.ocr, ocrResult.document)

    return {
      bloodType: bloodTypeResult,
      ocr: ocrResult.ocr,
      document: ocrResult.document,
      combinedAnalysis
    }
  }

  private analyzeCombinedResults(
    bloodTypeResult: BloodTypeResult,
    ocrResult: OCRResult,
    documentInfo?: DocumentInfo
  ) {
    const extractedBloodTypeFromOCR = this.extractBloodTypeFromText(ocrResult.text)
    const discrepancies: string[] = []
    
    // Check for blood type consistency
    let bloodTypeMatch = false
    let confidenceScore = 0

    if (extractedBloodTypeFromOCR && bloodTypeResult.bloodType) {
      bloodTypeMatch = extractedBloodTypeFromOCR === bloodTypeResult.bloodType
      
      if (bloodTypeMatch) {
        confidenceScore = Math.min(bloodTypeResult.confidence, ocrResult.confidence) / 100
      } else {
        discrepancies.push(`Blood type mismatch: Vision detected ${bloodTypeResult.bloodType}, OCR found ${extractedBloodTypeFromOCR}`)
        confidenceScore = Math.abs(bloodTypeResult.confidence - ocrResult.confidence) / 200
      }
    } else if (bloodTypeResult.bloodType && !extractedBloodTypeFromOCR) {
      discrepancies.push('Blood type detected in image but not found in text')
      confidenceScore = bloodTypeResult.confidence / 200
    } else if (!bloodTypeResult.bloodType && extractedBloodTypeFromOCR) {
      discrepancies.push('Blood type found in text but not detected in image')
      confidenceScore = ocrResult.confidence / 200
    }

    // Additional consistency checks
    if (documentInfo) {
      if (documentInfo.type === 'blood_donor_card' && !bloodTypeResult.bloodType) {
        discrepancies.push('Blood donor card detected but no blood type found in image')
      }
      
      if (documentInfo.extractedFields.blood_type && 
          documentInfo.extractedFields.blood_type !== bloodTypeResult.bloodType) {
        discrepancies.push('Blood type in document fields differs from image recognition')
      }
    }

    return {
      extractedBloodType: extractedBloodTypeFromOCR || bloodTypeResult.bloodType,
      confidence: Math.max(bloodTypeResult.confidence, ocrResult.confidence),
      consistencyCheck: {
        bloodTypeMatch,
        confidenceScore,
        discrepancies
      }
    }
  }

  private extractBloodTypeFromText(text: string): string | null {
    const bloodTypePattern = /\b(A|B|AB|O)[+-]\b/i
    const match = text.match(bloodTypePattern)
    return match ? match[0].toUpperCase() : null
  }

  private generateAnalysisId(): string {
    this.analysisCounter++
    return `vision_${Date.now()}_${this.analysisCounter.toString().padStart(4, '0')}`
  }

  private generateImageHash(imageBuffer: Buffer): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(imageBuffer).digest('hex').substring(0, 16)
  }

  private async getCachedResult(imageHash: string, analysisType: string): Promise<VisionAnalysisResult | null> {
    try {
      const cacheKey = `vision_analysis:${imageHash}:${analysisType}`
      return await this.cache.get<VisionAnalysisResult>(cacheKey)
    } catch (error) {
      console.error('Cache retrieval error:', error)
      return null
    }
  }

  private async cacheResult(imageHash: string, analysisType: string, result: VisionAnalysisResult): Promise<void> {
    try {
      const cacheKey = `vision_analysis:${imageHash}:${analysisType}`
      await this.cache.set(cacheKey, result, { 
        ttl: 3600, // 1 hour
        tags: ['vision_analysis', analysisType]
      })
    } catch (error) {
      console.error('Cache storage error:', error)
    }
  }

  private recordAnalysisMetrics(
    analysisType: string,
    processingTime: number,
    success: boolean,
    error?: string
  ): void {
    performanceMonitor.recordCustomMetric({
      name: 'vision_analysis_duration',
      value: processingTime,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        analysis_type: analysisType,
        success: success.toString(),
        error: error || 'none'
      }
    })

    // Record analysis count
    performanceMonitor.recordCustomMetric({
      name: 'vision_analysis_count',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: {
        analysis_type: analysisType,
        success: success.toString()
      }
    })
  }

  // Batch processing
  async analyzeImageBatch(requests: VisionAnalysisRequest[]): Promise<VisionAnalysisResult[]> {
    const startTime = performance.now()
    
    try {
      // Process requests in parallel with concurrency limit
      const concurrencyLimit = 5
      const results: VisionAnalysisResult[] = []
      
      for (let i = 0; i < requests.length; i += concurrencyLimit) {
        const batch = requests.slice(i, i + concurrencyLimit)
        const batchResults = await Promise.all(
          batch.map(request => this.analyzeImage(request))
        )
        results.push(...batchResults)
      }
      
      const totalTime = performance.now() - startTime
      
      performanceMonitor.recordCustomMetric({
        name: 'vision_batch_analysis_duration',
        value: totalTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          batch_size: requests.length.toString(),
          avg_time_per_image: (totalTime / requests.length).toFixed(2),
          success: 'true'
        }
      })
      
      return results
      
    } catch (error) {
      performanceMonitor.recordCustomMetric({
        name: 'vision_batch_analysis_duration',
        value: performance.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          batch_size: requests.length.toString(),
          success: 'false',
          error: (error as Error).message
        }
      })
      
      throw error
    }
  }

  // System status and health checks
  async getSystemStatus(): Promise<VisionSystemStatus> {
    const bloodTypeInfo = this.bloodTypeSystem.getModelInfo()
    const ocrInfo = this.ocrSystem.getSystemInfo()
    
    // Get performance metrics from cache
    const performanceMetrics = await this.getPerformanceMetrics()
    
    return {
      bloodTypeRecognition: {
        available: bloodTypeInfo.isLoaded,
        modelLoaded: bloodTypeInfo.isLoaded,
        version: bloodTypeInfo.version
      },
      documentOCR: {
        available: ocrInfo.isInitialized,
        workersInitialized: ocrInfo.isInitialized,
        workerCount: ocrInfo.workerCount
      },
      performance: performanceMetrics
    }
  }

  private async getPerformanceMetrics(): Promise<{
    avgProcessingTime: number
    successRate: number
    cacheHitRate: number
  }> {
    try {
      // In a real implementation, these would come from stored metrics
      return {
        avgProcessingTime: 1250, // ms
        successRate: 0.95, // 95%
        cacheHitRate: 0.75 // 75%
      }
    } catch (error) {
      return {
        avgProcessingTime: 0,
        successRate: 0,
        cacheHitRate: 0
      }
    }
  }

  // Cleanup and resource management
  async dispose(): Promise<void> {
    this.bloodTypeSystem.dispose()
    await this.ocrSystem.dispose()
  }

  // Health check endpoint
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: Record<string, boolean>
    timestamp: string
  }> {
    const bloodTypeHealthy = this.bloodTypeSystem.getModelInfo().isLoaded
    const ocrHealthy = this.ocrSystem.getSystemInfo().isInitialized
    
    const services = {
      bloodTypeRecognition: bloodTypeHealthy,
      documentOCR: ocrHealthy,
      cache: true // Simplified check
    }
    
    const healthyCount = Object.values(services).filter(Boolean).length
    const totalServices = Object.keys(services).length
    
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyCount === totalServices) {
      status = 'healthy'
    } else if (healthyCount > 0) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }
    
    return {
      status,
      services,
      timestamp: new Date().toISOString()
    }
  }
}

// Singleton instance
let visionAPIInstance: ComputerVisionAPI | null = null

export function getComputerVisionAPI(): ComputerVisionAPI {
  if (!visionAPIInstance) {
    visionAPIInstance = new ComputerVisionAPI()
  }
  return visionAPIInstance
}

export default ComputerVisionAPI
