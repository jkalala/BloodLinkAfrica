/**
 * Ensemble ML System
 * 
 * Advanced ensemble learning system combining multiple ML models
 * for improved accuracy and robustness in blood donation predictions
 */

import * as tf from '@tensorflow/tfjs-node'
import { getRecommendationEngine, RecommendationResult } from './recommendation-engine'
import { getPredictiveAnalyticsSystem, PredictiveInsights } from './predictive-analytics'
import { performanceMonitor } from '../../performance/metrics'
import { getCache } from '../../cache/redis-cache'

export interface EnsembleModel {
  id: string
  name: string
  type: 'neural_network' | 'random_forest' | 'gradient_boosting' | 'svm' | 'linear_regression'
  weight: number
  accuracy: number
  lastTrained: Date
  isActive: boolean
}

export interface EnsemblePrediction {
  prediction: number
  confidence: number
  modelContributions: Array<{
    modelId: string
    prediction: number
    weight: number
    confidence: number
  }>
  uncertainty: {
    variance: number
    standardDeviation: number
    confidenceInterval: [number, number]
  }
  explanation: {
    topFeatures: Array<{
      feature: string
      importance: number
      impact: 'positive' | 'negative'
    }>
    reasoning: string[]
  }
}

export interface EnsembleRequest {
  features: Record<string, number>
  predictionType: 'donor_response' | 'demand_forecast' | 'supply_risk' | 'compatibility_score'
  includeExplanation: boolean
  confidenceThreshold?: number
}

export interface ModelPerformanceMetrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  auc: number
  calibrationError: number
  predictionLatency: number
}

class EnsembleMLSystem {
  private models: Map<string, tf.LayersModel> = new Map()
  private modelMetadata: Map<string, EnsembleModel> = new Map()
  private metaLearner: tf.LayersModel | null = null
  private isInitialized = false
  private cache = getCache()

  // Ensemble configuration
  private readonly ENSEMBLE_CONFIG = {
    minModels: 3,
    maxModels: 7,
    weightUpdateFrequency: 24 * 60 * 60 * 1000, // 24 hours
    performanceWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
    confidenceThreshold: 0.7,
    diversityThreshold: 0.3
  }

  // Model architectures for different prediction types
  private readonly MODEL_ARCHITECTURES = {
    donor_response: {
      layers: [64, 32, 16, 1],
      activation: 'sigmoid',
      loss: 'binaryCrossentropy'
    },
    demand_forecast: {
      layers: [48, 24, 12, 1],
      activation: 'linear',
      loss: 'meanSquaredError'
    },
    supply_risk: {
      layers: [32, 16, 8, 3],
      activation: 'softmax',
      loss: 'categoricalCrossentropy'
    },
    compatibility_score: {
      layers: [40, 20, 10, 1],
      activation: 'sigmoid',
      loss: 'meanSquaredError'
    }
  }

  constructor() {
    this.initializeEnsemble()
  }

  private async initializeEnsemble(): Promise<void> {
    try {
      console.log('Initializing ensemble ML system...')

      // Initialize base models
      await this.initializeBaseModels()
      
      // Initialize meta-learner
      await this.initializeMetaLearner()
      
      // Load model weights and metadata
      await this.loadModelMetadata()

      this.isInitialized = true
      console.log('Ensemble ML system initialized successfully')

    } catch (error) {
      console.error('Failed to initialize ensemble system:', error)
      this.isInitialized = false
    }
  }

  private async initializeBaseModels(): Promise<void> {
    const modelTypes = ['neural_network', 'gradient_boosting', 'random_forest']
    
    for (const modelType of modelTypes) {
      for (const predictionType of Object.keys(this.MODEL_ARCHITECTURES)) {
        const modelId = `${modelType}_${predictionType}`
        const model = await this.createBaseModel(predictionType as keyof typeof this.MODEL_ARCHITECTURES)
        
        this.models.set(modelId, model)
        this.modelMetadata.set(modelId, {
          id: modelId,
          name: `${modelType.replace('_', ' ')} - ${predictionType.replace('_', ' ')}`,
          type: modelType as EnsembleModel['type'],
          weight: 1.0 / modelTypes.length,
          accuracy: 0.8, // Initial estimate
          lastTrained: new Date(),
          isActive: true
        })
      }
    }
  }

  private async createBaseModel(predictionType: keyof typeof this.MODEL_ARCHITECTURES): Promise<tf.LayersModel> {
    const config = this.MODEL_ARCHITECTURES[predictionType]
    
    const layers: tf.layers.Layer[] = []
    
    // Input layer
    layers.push(tf.layers.dense({
      inputShape: [20], // Feature vector size
      units: config.layers[0],
      activation: 'relu'
    }))
    
    // Hidden layers
    for (let i = 1; i < config.layers.length - 1; i++) {
      layers.push(tf.layers.dropout({ rate: 0.2 }))
      layers.push(tf.layers.dense({
        units: config.layers[i],
        activation: 'relu'
      }))
    }
    
    // Output layer
    layers.push(tf.layers.dense({
      units: config.layers[config.layers.length - 1],
      activation: config.activation
    }))

    const model = tf.sequential({ layers })
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: config.loss,
      metrics: ['accuracy']
    })

    return model
  }

  private async initializeMetaLearner(): Promise<void> {
    // Meta-learner that combines predictions from base models
    this.metaLearner = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.ENSEMBLE_CONFIG.maxModels], // Predictions from base models
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    })

    this.metaLearner.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    })
  }

  private async loadModelMetadata(): Promise<void> {
    // In production, this would load from database
    // For now, we'll use default values set in initializeBaseModels
    console.log('Model metadata loaded')
  }

  async predict(request: EnsembleRequest): Promise<EnsemblePrediction> {
    const startTime = performance.now()

    if (!this.isInitialized) {
      throw new Error('Ensemble system not initialized')
    }

    try {
      // Check cache
      const cacheKey = this.generateCacheKey(request)
      const cachedPrediction = await this.cache.get<EnsemblePrediction>(cacheKey)
      
      if (cachedPrediction) {
        return cachedPrediction
      }

      // Prepare feature vector
      const featureVector = this.prepareFeatures(request.features)
      
      // Get predictions from active models
      const modelPredictions = await this.getModelPredictions(featureVector, request.predictionType)
      
      // Apply ensemble method
      const ensemblePrediction = await this.combineModelPredictions(modelPredictions)
      
      // Calculate uncertainty
      const uncertainty = this.calculateUncertainty(modelPredictions)
      
      // Generate explanation if requested
      const explanation = request.includeExplanation 
        ? await this.generateExplanation(request.features, modelPredictions)
        : { topFeatures: [], reasoning: [] }

      const result: EnsemblePrediction = {
        prediction: ensemblePrediction.value,
        confidence: ensemblePrediction.confidence,
        modelContributions: modelPredictions,
        uncertainty,
        explanation
      }

      // Cache result
      await this.cache.set(cacheKey, result, { 
        ttl: 300, // 5 minutes
        tags: ['ensemble_ml', request.predictionType]
      })

      const processingTime = performance.now() - startTime

      performanceMonitor.recordCustomMetric({
        name: 'ensemble_prediction_duration',
        value: processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          prediction_type: request.predictionType,
          model_count: modelPredictions.length.toString(),
          confidence: result.confidence.toFixed(2)
        }
      })

      return result

    } catch (error) {
      performanceMonitor.recordCustomMetric({
        name: 'ensemble_prediction_duration',
        value: performance.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          success: 'false',
          error: (error as Error).message
        }
      })

      throw new Error(`Ensemble prediction failed: ${(error as Error).message}`)
    }
  }

  private prepareFeatures(features: Record<string, number>): tf.Tensor2D {
    // Convert feature object to tensor
    const featureKeys = [
      'age', 'weight', 'height', 'donation_history', 'eligibility_score',
      'distance', 'urgency_score', 'compatibility_score', 'availability_score',
      'reliability_score', 'seasonal_factor', 'weather_factor', 'event_factor',
      'time_of_day', 'day_of_week', 'month', 'blood_type_rarity',
      'hospital_capacity', 'regional_demand', 'supply_level'
    ]

    const featureVector = featureKeys.map(key => features[key] || 0)
    return tf.tensor2d([featureVector])
  }

  private async getModelPredictions(
    featureVector: tf.Tensor2D,
    predictionType: string
  ): Promise<EnsemblePrediction['modelContributions']> {
    const predictions: EnsemblePrediction['modelContributions'] = []

    for (const [modelId, model] of this.models.entries()) {
      if (!modelId.includes(predictionType)) continue

      const metadata = this.modelMetadata.get(modelId)
      if (!metadata || !metadata.isActive) continue

      try {
        const prediction = model.predict(featureVector) as tf.Tensor
        const predictionValue = (await prediction.data())[0]
        
        predictions.push({
          modelId,
          prediction: predictionValue,
          weight: metadata.weight,
          confidence: this.calculateModelConfidence(predictionValue, metadata)
        })

        prediction.dispose()
      } catch (error) {
        console.error(`Model ${modelId} prediction failed:`, error)
      }
    }

    featureVector.dispose()
    return predictions
  }

  private async combineModelPredictions(
    modelPredictions: EnsemblePrediction['modelContributions']
  ): Promise<{ value: number; confidence: number }> {
    if (modelPredictions.length === 0) {
      throw new Error('No model predictions available')
    }

    // Weighted average ensemble
    const totalWeight = modelPredictions.reduce((sum, pred) => sum + pred.weight, 0)
    const weightedSum = modelPredictions.reduce((sum, pred) => sum + pred.prediction * pred.weight, 0)
    const weightedPrediction = weightedSum / totalWeight

    // Use meta-learner for final prediction if available
    let finalPrediction = weightedPrediction
    if (this.metaLearner && modelPredictions.length >= this.ENSEMBLE_CONFIG.minModels) {
      try {
        const metaFeatures = tf.tensor2d([modelPredictions.map(p => p.prediction)])
        const metaPrediction = this.metaLearner.predict(metaFeatures) as tf.Tensor
        const metaValue = (await metaPrediction.data())[0]
        
        // Blend weighted average with meta-learner prediction
        finalPrediction = weightedPrediction * 0.7 + metaValue * 0.3

        metaFeatures.dispose()
        metaPrediction.dispose()
      } catch (error) {
        console.error('Meta-learner prediction failed:', error)
      }
    }

    // Calculate ensemble confidence
    const confidenceWeightedSum = modelPredictions.reduce((sum, pred) => sum + pred.confidence * pred.weight, 0)
    const ensembleConfidence = confidenceWeightedSum / totalWeight

    return {
      value: finalPrediction,
      confidence: ensembleConfidence
    }
  }

  private calculateUncertainty(
    modelPredictions: EnsemblePrediction['modelContributions']
  ): EnsemblePrediction['uncertainty'] {
    const predictions = modelPredictions.map(p => p.prediction)
    const mean = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length
    
    const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - mean, 2), 0) / predictions.length
    const standardDeviation = Math.sqrt(variance)
    
    // 95% confidence interval
    const confidenceInterval: [number, number] = [
      mean - 1.96 * standardDeviation,
      mean + 1.96 * standardDeviation
    ]

    return {
      variance,
      standardDeviation,
      confidenceInterval
    }
  }

  private async generateExplanation(
    features: Record<string, number>,
    modelPredictions: EnsemblePrediction['modelContributions']
  ): Promise<EnsemblePrediction['explanation']> {
    // Feature importance analysis (simplified SHAP-like approach)
    const featureImportances = await this.calculateFeatureImportances(features)
    
    const topFeatures = Object.entries(featureImportances)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 5)
      .map(([feature, importance]) => ({
        feature,
        importance: Math.abs(importance),
        impact: importance > 0 ? 'positive' as const : 'negative' as const
      }))

    const reasoning = this.generateReasoning(topFeatures, modelPredictions)

    return { topFeatures, reasoning }
  }

  private async calculateFeatureImportances(features: Record<string, number>): Promise<Record<string, number>> {
    // Simplified feature importance calculation
    // In production, this would use more sophisticated methods like SHAP or LIME
    const importances: Record<string, number> = {}

    // Mock feature importances based on domain knowledge
    importances.compatibility_score = features.compatibility_score * 0.3
    importances.distance = -features.distance * 0.25
    importances.availability_score = features.availability_score * 0.2
    importances.reliability_score = features.reliability_score * 0.15
    importances.urgency_score = features.urgency_score * 0.1

    return importances
  }

  private generateReasoning(
    topFeatures: EnsemblePrediction['explanation']['topFeatures'],
    modelPredictions: EnsemblePrediction['modelContributions']
  ): string[] {
    const reasoning: string[] = []

    // Model agreement analysis
    const predictions = modelPredictions.map(p => p.prediction)
    const variance = predictions.reduce((sum, pred, _, arr) => {
      const mean = arr.reduce((s, p) => s + p, 0) / arr.length
      return sum + Math.pow(pred - mean, 2)
    }, 0) / predictions.length

    if (variance < 0.01) {
      reasoning.push('High model agreement increases prediction confidence')
    } else if (variance > 0.05) {
      reasoning.push('Models show disagreement, indicating higher uncertainty')
    }

    // Feature-based reasoning
    topFeatures.forEach(feature => {
      if (feature.importance > 0.2) {
        const impact = feature.impact === 'positive' ? 'increases' : 'decreases'
        reasoning.push(`${feature.feature.replace('_', ' ')} strongly ${impact} the prediction`)
      }
    })

    return reasoning
  }

  private calculateModelConfidence(prediction: number, metadata: EnsembleModel): number {
    // Base confidence on model accuracy and prediction certainty
    let confidence = metadata.accuracy

    // Adjust based on prediction certainty (distance from 0.5 for binary predictions)
    if (metadata.type === 'neural_network') {
      const certainty = Math.abs(prediction - 0.5) * 2
      confidence *= (0.5 + certainty * 0.5)
    }

    return Math.min(0.95, confidence)
  }

  // Model management methods
  async updateModelWeights(): Promise<void> {
    console.log('Updating model weights based on recent performance...')
    
    // Get recent performance metrics for each model
    for (const [modelId, metadata] of this.modelMetadata.entries()) {
      const performance = await this.getModelPerformance(modelId)
      
      // Update weight based on performance
      const newWeight = this.calculateOptimalWeight(performance, metadata)
      metadata.weight = newWeight
      
      // Deactivate poorly performing models
      if (performance.accuracy < 0.6) {
        metadata.isActive = false
        console.log(`Deactivated model ${modelId} due to poor performance`)
      }
    }
    
    // Normalize weights
    this.normalizeModelWeights()
  }

  private async getModelPerformance(modelId: string): Promise<ModelPerformanceMetrics> {
    // In production, this would query actual performance metrics
    return {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.88,
      f1Score: 0.85,
      auc: 0.91,
      calibrationError: 0.05,
      predictionLatency: 15
    }
  }

  private calculateOptimalWeight(performance: ModelPerformanceMetrics, metadata: EnsembleModel): number {
    // Weight based on multiple performance metrics
    const accuracyWeight = performance.accuracy * 0.4
    const f1Weight = performance.f1Score * 0.3
    const aucWeight = performance.auc * 0.2
    const latencyPenalty = Math.max(0, 1 - performance.predictionLatency / 100) * 0.1
    
    return Math.max(0.1, accuracyWeight + f1Weight + aucWeight + latencyPenalty)
  }

  private normalizeModelWeights(): void {
    const activeModels = Array.from(this.modelMetadata.values()).filter(m => m.isActive)
    const totalWeight = activeModels.reduce((sum, model) => sum + model.weight, 0)
    
    if (totalWeight > 0) {
      activeModels.forEach(model => {
        model.weight = model.weight / totalWeight
      })
    }
  }

  async addModel(modelConfig: Partial<EnsembleModel>, modelData: tf.LayersModel): Promise<void> {
    const modelId = modelConfig.id || `custom_${Date.now()}`
    
    this.models.set(modelId, modelData)
    this.modelMetadata.set(modelId, {
      id: modelId,
      name: modelConfig.name || 'Custom Model',
      type: modelConfig.type || 'neural_network',
      weight: 0.1, // Start with low weight
      accuracy: modelConfig.accuracy || 0.7,
      lastTrained: new Date(),
      isActive: true
    })
    
    this.normalizeModelWeights()
    console.log(`Added new model: ${modelId}`)
  }

  async removeModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId)
    if (model) {
      model.dispose()
      this.models.delete(modelId)
      this.modelMetadata.delete(modelId)
      this.normalizeModelWeights()
      console.log(`Removed model: ${modelId}`)
    }
  }

  private generateCacheKey(request: EnsembleRequest): string {
    const keyData = {
      features: request.features,
      predictionType: request.predictionType,
      timestamp: Math.floor(Date.now() / 300000) // 5-minute buckets
    }
    
    return `ensemble_prediction:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`
  }

  // System information and diagnostics
  getSystemInfo() {
    const activeModels = Array.from(this.modelMetadata.values()).filter(m => m.isActive)
    
    return {
      isInitialized: this.isInitialized,
      totalModels: this.models.size,
      activeModels: activeModels.length,
      modelTypes: [...new Set(activeModels.map(m => m.type))],
      ensembleConfig: this.ENSEMBLE_CONFIG,
      modelMetadata: Object.fromEntries(this.modelMetadata.entries())
    }
  }

  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const activeModels = Array.from(this.modelMetadata.values()).filter(m => m.isActive)
    const healthyModels = activeModels.filter(m => m.accuracy > 0.7)
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (healthyModels.length < this.ENSEMBLE_CONFIG.minModels) {
      status = 'unhealthy'
    } else if (healthyModels.length < activeModels.length * 0.8) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        totalModels: this.models.size,
        activeModels: activeModels.length,
        healthyModels: healthyModels.length,
        averageAccuracy: activeModels.reduce((sum, m) => sum + m.accuracy, 0) / activeModels.length,
        lastWeightUpdate: new Date() // Would track actual last update
      }
    }
  }

  dispose(): void {
    for (const model of this.models.values()) {
      model.dispose()
    }
    this.models.clear()
    this.modelMetadata.clear()
    this.metaLearner?.dispose()
  }
}

// Singleton instance
let ensembleSystemInstance: EnsembleMLSystem | null = null

export function getEnsembleMLSystem(): EnsembleMLSystem {
  if (!ensembleSystemInstance) {
    ensembleSystemInstance = new EnsembleMLSystem()
  }
  return ensembleSystemInstance
}

export default EnsembleMLSystem
