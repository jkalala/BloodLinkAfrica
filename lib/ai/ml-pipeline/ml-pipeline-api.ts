/**
 * Integrated ML Pipeline API
 * 
 * Unified interface for all machine learning capabilities including
 * recommendations, predictions, and ensemble methods
 */

import { getRecommendationEngine, RecommendationRequest, RecommendationResult } from './recommendation-engine'
import { getPredictiveAnalyticsSystem, ForecastRequest, PredictiveInsights } from './predictive-analytics'
import { getEnsembleMLSystem, EnsembleRequest, EnsemblePrediction } from './ensemble-system'
import { performanceMonitor } from '../../performance/metrics'
import { getCache } from '../../cache/redis-cache'

export interface MLPipelineRequest {
  type: 'recommendation' | 'forecast' | 'ensemble' | 'combined'
  data: RecommendationRequest | ForecastRequest | EnsembleRequest | CombinedAnalysisRequest
  options?: {
    cacheResults?: boolean
    includeMetadata?: boolean
    confidenceThreshold?: number
    timeout?: number
  }
}

export interface CombinedAnalysisRequest {
  bloodRequest: RecommendationRequest['bloodRequest']
  forecastRegions: string[]
  forecastHorizon: number
  ensembleFeatures: Record<string, number>
  maxRecommendations: number
}

export interface MLPipelineResult {
  type: string
  recommendations?: RecommendationResult[]
  forecasts?: PredictiveInsights
  ensemblePrediction?: EnsemblePrediction
  combinedAnalysis?: {
    recommendations: RecommendationResult[]
    demandForecast: PredictiveInsights['demandForecasts'][0]
    supplyForecast: PredictiveInsights['supplyForecasts'][0]
    riskAssessment: PredictiveInsights['riskAssessment']
    optimizedStrategy: {
      priorityDonors: string[]
      alternativeRegions: string[]
      timelineRecommendations: string[]
      contingencyPlans: string[]
    }
  }
  metadata: {
    processingTime: number
    modelsUsed: string[]
    cacheHit: boolean
    confidence: number
    requestId: string
  }
}

export interface MLSystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  components: {
    recommendationEngine: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      isInitialized: boolean
      modelVersion: string
      lastUpdate: Date
    }
    predictiveAnalytics: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      isInitialized: boolean
      modelAccuracy: number
      predictionHorizon: number
    }
    ensembleSystem: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      activeModels: number
      averageAccuracy: number
      lastWeightUpdate: Date
    }
  }
  performance: {
    avgResponseTime: number
    successRate: number
    cacheHitRate: number
    throughput: number
  }
  resourceUsage: {
    memoryUsage: number
    cpuUsage: number
    gpuUsage?: number
  }
}

class MLPipelineAPI {
  private recommendationEngine = getRecommendationEngine()
  private predictiveAnalytics = getPredictiveAnalyticsSystem()
  private ensembleSystem = getEnsembleMLSystem()
  private cache = getCache()
  private requestCounter = 0

  async processRequest(request: MLPipelineRequest): Promise<MLPipelineResult> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()

    try {
      // Check cache if enabled
      if (request.options?.cacheResults) {
        const cacheKey = this.generateCacheKey(request)
        const cachedResult = await this.cache.get<MLPipelineResult>(cacheKey)
        
        if (cachedResult) {
          cachedResult.metadata.cacheHit = true
          cachedResult.metadata.requestId = requestId
          return cachedResult
        }
      }

      let result: MLPipelineResult

      switch (request.type) {
        case 'recommendation':
          result = await this.processRecommendationRequest(request.data as RecommendationRequest, requestId)
          break

        case 'forecast':
          result = await this.processForecastRequest(request.data as ForecastRequest, requestId)
          break

        case 'ensemble':
          result = await this.processEnsembleRequest(request.data as EnsembleRequest, requestId)
          break

        case 'combined':
          result = await this.processCombinedRequest(request.data as CombinedAnalysisRequest, requestId)
          break

        default:
          throw new Error(`Unsupported request type: ${request.type}`)
      }

      const processingTime = performance.now() - startTime
      result.metadata.processingTime = processingTime
      result.metadata.cacheHit = false

      // Cache result if enabled
      if (request.options?.cacheResults) {
        const cacheKey = this.generateCacheKey(request)
        await this.cache.set(cacheKey, result, { 
          ttl: 600, // 10 minutes
          tags: ['ml_pipeline', request.type]
        })
      }

      // Record performance metrics
      this.recordRequestMetrics(request.type, processingTime, true, result.metadata.confidence)

      return result

    } catch (error) {
      const processingTime = performance.now() - startTime
      
      this.recordRequestMetrics(request.type, processingTime, false, 0, (error as Error).message)
      
      throw new Error(`ML Pipeline request failed: ${(error as Error).message}`)
    }
  }

  private async processRecommendationRequest(
    data: RecommendationRequest,
    requestId: string
  ): Promise<MLPipelineResult> {
    const recommendations = await this.recommendationEngine.generateRecommendations(data)
    
    const avgConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length

    return {
      type: 'recommendation',
      recommendations,
      metadata: {
        processingTime: 0, // Will be set by caller
        modelsUsed: ['collaborative_filtering', 'content_based', 'ensemble'],
        cacheHit: false,
        confidence: avgConfidence,
        requestId
      }
    }
  }

  private async processForecastRequest(
    data: ForecastRequest,
    requestId: string
  ): Promise<MLPipelineResult> {
    const forecasts = await this.predictiveAnalytics.generatePredictiveInsights(data)
    
    // Calculate overall confidence from forecasts
    const demandConfidence = forecasts.demandForecasts.reduce((sum, forecast) => {
      const avgPredictionConfidence = forecast.predictions.reduce((s, p) => s + p.confidence, 0) / forecast.predictions.length
      return sum + avgPredictionConfidence
    }, 0) / forecasts.demandForecasts.length

    return {
      type: 'forecast',
      forecasts,
      metadata: {
        processingTime: 0,
        modelsUsed: ['lstm_demand', 'lstm_supply', 'seasonal_decomposition'],
        cacheHit: false,
        confidence: demandConfidence || 0.8,
        requestId
      }
    }
  }

  private async processEnsembleRequest(
    data: EnsembleRequest,
    requestId: string
  ): Promise<MLPipelineResult> {
    const ensemblePrediction = await this.ensembleSystem.predict(data)

    return {
      type: 'ensemble',
      ensemblePrediction,
      metadata: {
        processingTime: 0,
        modelsUsed: ensemblePrediction.modelContributions.map(m => m.modelId),
        cacheHit: false,
        confidence: ensemblePrediction.confidence,
        requestId
      }
    }
  }

  private async processCombinedRequest(
    data: CombinedAnalysisRequest,
    requestId: string
  ): Promise<MLPipelineResult> {
    // Run all analyses in parallel
    const [recommendations, forecasts, ensemblePrediction] = await Promise.all([
      this.recommendationEngine.generateRecommendations({
        bloodRequest: data.bloodRequest,
        maxRecommendations: data.maxRecommendations,
        includeReasons: true
      }),
      this.predictiveAnalytics.generatePredictiveInsights({
        regions: data.forecastRegions,
        bloodTypes: [data.bloodRequest.bloodType],
        horizonDays: data.forecastHorizon,
        includeConfidenceIntervals: true,
        includeFactorAnalysis: true
      }),
      this.ensembleSystem.predict({
        features: data.ensembleFeatures,
        predictionType: 'donor_response',
        includeExplanation: true
      })
    ])

    // Find relevant forecasts
    const demandForecast = forecasts.demandForecasts.find(f => 
      f.bloodType === data.bloodRequest.bloodType
    ) || forecasts.demandForecasts[0]

    const supplyForecast = forecasts.supplyForecasts.find(f => 
      data.forecastRegions.includes(f.region)
    ) || forecasts.supplyForecasts[0]

    // Generate optimized strategy
    const optimizedStrategy = this.generateOptimizedStrategy(
      recommendations,
      demandForecast,
      supplyForecast,
      forecasts.riskAssessment
    )

    const combinedAnalysis = {
      recommendations,
      demandForecast,
      supplyForecast,
      riskAssessment: forecasts.riskAssessment,
      optimizedStrategy
    }

    // Calculate combined confidence
    const avgRecommendationConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length
    const forecastConfidence = demandForecast?.predictions.reduce((sum, p) => sum + p.confidence, 0) / demandForecast?.predictions.length || 0.8
    const combinedConfidence = (avgRecommendationConfidence + forecastConfidence + ensemblePrediction.confidence) / 3

    return {
      type: 'combined',
      combinedAnalysis,
      metadata: {
        processingTime: 0,
        modelsUsed: ['recommendation_engine', 'predictive_analytics', 'ensemble_system'],
        cacheHit: false,
        confidence: combinedConfidence,
        requestId
      }
    }
  }

  private generateOptimizedStrategy(
    recommendations: RecommendationResult[],
    demandForecast: PredictiveInsights['demandForecasts'][0],
    supplyForecast: PredictiveInsights['supplyForecasts'][0],
    riskAssessment: PredictiveInsights['riskAssessment']
  ) {
    // Priority donors based on high scores and low risk
    const priorityDonors = recommendations
      .filter(rec => rec.score > 0.8 && rec.confidence > 0.7)
      .slice(0, 5)
      .map(rec => rec.donorId)

    // Alternative regions if current region has supply issues
    const alternativeRegions: string[] = []
    if (supplyForecast && supplyForecast.criticalPeriods.length > 0) {
      alternativeRegions.push('neighboring_region_1', 'neighboring_region_2')
    }

    // Timeline recommendations based on demand forecast
    const timelineRecommendations: string[] = []
    if (demandForecast) {
      const peakDemandPeriods = demandForecast.predictions.filter(p => p.predictedDemand > 10)
      if (peakDemandPeriods.length > 0) {
        timelineRecommendations.push('Schedule donations before peak demand periods')
        timelineRecommendations.push('Increase outreach 2 weeks before predicted shortages')
      }
    }

    // Contingency plans based on risk assessment
    const contingencyPlans: string[] = []
    if (riskAssessment.overallRisk === 'high' || riskAssessment.overallRisk === 'critical') {
      contingencyPlans.push('Activate emergency donor network')
      contingencyPlans.push('Coordinate with regional blood banks')
      contingencyPlans.push('Implement priority allocation protocols')
    }

    return {
      priorityDonors,
      alternativeRegions,
      timelineRecommendations,
      contingencyPlans
    }
  }

  async getSystemStatus(): Promise<MLSystemStatus> {
    try {
      // Get component statuses
      const [recEngineInfo, predictiveInfo, ensembleHealth] = await Promise.all([
        this.recommendationEngine.getSystemInfo(),
        this.predictiveAnalytics.getSystemInfo(),
        this.ensembleSystem.performHealthCheck()
      ])

      // Determine component statuses
      const recommendationStatus = recEngineInfo.isInitialized ? 'healthy' : 'unhealthy'
      const predictiveStatus = predictiveInfo.isInitialized ? 'healthy' : 'unhealthy'
      const ensembleStatus = ensembleHealth.status

      // Determine overall status
      const statuses = [recommendationStatus, predictiveStatus, ensembleStatus]
      const healthyCount = statuses.filter(s => s === 'healthy').length
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
      if (healthyCount === 3) overallStatus = 'healthy'
      else if (healthyCount >= 2) overallStatus = 'degraded'
      else overallStatus = 'unhealthy'

      // Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics()
      const resourceUsage = this.getResourceUsage()

      return {
        overall: overallStatus,
        components: {
          recommendationEngine: {
            status: recommendationStatus as any,
            isInitialized: recEngineInfo.isInitialized,
            modelVersion: recEngineInfo.modelVersions?.ensemble || '1.0.0',
            lastUpdate: new Date()
          },
          predictiveAnalytics: {
            status: predictiveStatus as any,
            isInitialized: predictiveInfo.isInitialized,
            modelAccuracy: 0.85,
            predictionHorizon: predictiveInfo.modelConfig?.predictionHorizon || 14
          },
          ensembleSystem: {
            status: ensembleStatus,
            activeModels: ensembleHealth.details.activeModels,
            averageAccuracy: ensembleHealth.details.averageAccuracy,
            lastWeightUpdate: ensembleHealth.details.lastWeightUpdate
          }
        },
        performance: performanceMetrics,
        resourceUsage
      }

    } catch (error) {
      console.error('Failed to get ML system status:', error)
      
      return {
        overall: 'unhealthy',
        components: {
          recommendationEngine: { status: 'unhealthy', isInitialized: false, modelVersion: '0.0.0', lastUpdate: new Date() },
          predictiveAnalytics: { status: 'unhealthy', isInitialized: false, modelAccuracy: 0, predictionHorizon: 0 },
          ensembleSystem: { status: 'unhealthy', activeModels: 0, averageAccuracy: 0, lastWeightUpdate: new Date() }
        },
        performance: { avgResponseTime: 0, successRate: 0, cacheHitRate: 0, throughput: 0 },
        resourceUsage: { memoryUsage: 0, cpuUsage: 0 }
      }
    }
  }

  private async getPerformanceMetrics() {
    // In production, these would come from actual metrics
    return {
      avgResponseTime: 1250, // ms
      successRate: 0.96,
      cacheHitRate: 0.73,
      throughput: 45 // requests per minute
    }
  }

  private getResourceUsage() {
    const memoryUsage = process.memoryUsage()
    
    return {
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      gpuUsage: undefined // Would be available if using GPU
    }
  }

  private recordRequestMetrics(
    requestType: string,
    processingTime: number,
    success: boolean,
    confidence: number,
    error?: string
  ): void {
    performanceMonitor.recordCustomMetric({
      name: 'ml_pipeline_request_duration',
      value: processingTime,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        request_type: requestType,
        success: success.toString(),
        confidence: confidence.toFixed(2),
        error: error || 'none'
      }
    })

    performanceMonitor.recordCustomMetric({
      name: 'ml_pipeline_request_count',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: {
        request_type: requestType,
        success: success.toString()
      }
    })
  }

  private generateRequestId(): string {
    this.requestCounter++
    return `ml_${Date.now()}_${this.requestCounter.toString().padStart(4, '0')}`
  }

  private generateCacheKey(request: MLPipelineRequest): string {
    const keyData = {
      type: request.type,
      data: request.data,
      timestamp: Math.floor(Date.now() / 600000) // 10-minute buckets
    }
    
    return `ml_pipeline:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`
  }

  // Batch processing for high-throughput scenarios
  async processBatch(requests: MLPipelineRequest[]): Promise<MLPipelineResult[]> {
    const startTime = performance.now()
    
    try {
      // Process requests in parallel with concurrency limit
      const concurrencyLimit = 10
      const results: MLPipelineResult[] = []
      
      for (let i = 0; i < requests.length; i += concurrencyLimit) {
        const batch = requests.slice(i, i + concurrencyLimit)
        const batchResults = await Promise.all(
          batch.map(request => this.processRequest(request))
        )
        results.push(...batchResults)
      }
      
      const totalTime = performance.now() - startTime
      
      performanceMonitor.recordCustomMetric({
        name: 'ml_pipeline_batch_duration',
        value: totalTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          batch_size: requests.length.toString(),
          avg_time_per_request: (totalTime / requests.length).toFixed(2),
          success: 'true'
        }
      })
      
      return results
      
    } catch (error) {
      performanceMonitor.recordCustomMetric({
        name: 'ml_pipeline_batch_duration',
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

  // Model management
  async updateModels(): Promise<void> {
    console.log('Updating ML pipeline models...')
    
    await Promise.all([
      this.recommendationEngine.updateModels([]),
      this.predictiveAnalytics.updateModels([]),
      this.ensembleSystem.updateModelWeights()
    ])
    
    console.log('ML pipeline models updated successfully')
  }

  // Cleanup
  dispose(): void {
    this.recommendationEngine.dispose()
    this.predictiveAnalytics.dispose()
    this.ensembleSystem.dispose()
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    details: Record<string, any>
  }> {
    const systemStatus = await this.getSystemStatus()
    
    return {
      status: systemStatus.overall,
      timestamp: new Date().toISOString(),
      details: {
        components: systemStatus.components,
        performance: systemStatus.performance,
        resourceUsage: systemStatus.resourceUsage
      }
    }
  }
}

// Singleton instance
let mlPipelineAPIInstance: MLPipelineAPI | null = null

export function getMLPipelineAPI(): MLPipelineAPI {
  if (!mlPipelineAPIInstance) {
    mlPipelineAPIInstance = new MLPipelineAPI()
  }
  return mlPipelineAPIInstance
}

export default MLPipelineAPI
