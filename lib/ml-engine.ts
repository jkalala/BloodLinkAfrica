/**
 * Machine Learning Engine for BloodConnect
 * Provides advanced ML algorithms for donor matching, predictions, and optimization
 */

import { createServerSupabaseClient } from './supabase'
import { performanceMonitor } from './performance-monitoring'

export interface MLTrainingData {
  features: number[][]
  labels: number[]
  metadata: {
    featureNames: string[]
    sampleCount: number
    lastTraining: string
  }
}

export interface MLPrediction {
  prediction: number
  confidence: number
  importance: { feature: string; weight: number }[]
  explanation: string
}

export interface DonorFeatures {
  bloodTypeCompatibility: number
  locationDistance: number
  responseRate: number
  successRate: number
  avgResponseTime: number
  timeOfDay: number
  dayOfWeek: number
  recentActivity: number
  donationFrequency: number
  urgencyMatch: number
  seasonality: number
  weatherCondition: number
}

export interface MatchingModel {
  id: string
  type: 'donor_matching' | 'response_prediction' | 'success_prediction'
  weights: number[]
  bias: number
  accuracy: number
  lastTrained: string
  trainingDataCount: number
}

export interface Donor {
  id: string;
  blood_type: string;
  location: string;
  response_rate: number;
  success_rate: number;
  avg_response_time: number;
  last_donation: string;
  total_donations: number;
}

export interface BloodRequest {
  id: string;
  blood_type: string;
  urgency: string;
  location: string;
  created_at: string;
  status: string;
  donor_responses?: {
    response_type: string;
    created_at: string;
    updated_at: string;
  }[];
}

export class MLEngine {
  private supabase = createServerSupabaseClient()
  private models: Map<string, MatchingModel> = new Map()
  private featureNames: string[] = [
    'bloodTypeCompatibility',
    'locationDistance', 
    'responseRate',
    'successRate',
    'avgResponseTime',
    'timeOfDay',
    'dayOfWeek',
    'recentActivity',
    'donationFrequency',
    'urgencyMatch',
    'seasonality',
    'weatherCondition'
  ]

  constructor() {
    this.loadModels()
  }

  /**
   * Train machine learning models with historical data
   */
  async trainModels(): Promise<{ success: boolean; models: string[]; accuracy: Record<string, number> }> {
    const tracker = performanceMonitor.startTracking('ml-training', 'TRAIN')
    
    try {
      console.log('🤖 Starting ML model training...')
      
      // Get training data
      const trainingData = await this.prepareTrainingData()
      
      if (trainingData.features.length < 100) {
        console.warn('Insufficient training data. Need at least 100 samples.')
        return { success: false, models: [], accuracy: {} }
      }

      // Train donor matching model
      const donorMatchingModel = await this.trainDonorMatchingModel(trainingData)
      
      // Train response prediction model  
      const responsePredictionModel = await this.trainResponsePredictionModel(trainingData)
      
      // Train success prediction model
      const successPredictionModel = await this.trainSuccessPredictionModel(trainingData)

      // Store models
      this.models.set('donor_matching', donorMatchingModel)
      this.models.set('response_prediction', responsePredictionModel)
      this.models.set('success_prediction', successPredictionModel)

      // Save to database
      await this.saveModels()

      const accuracy = {
        donor_matching: donorMatchingModel.accuracy,
        response_prediction: responsePredictionModel.accuracy,
        success_prediction: successPredictionModel.accuracy
      }

      console.log('✅ ML model training completed:', accuracy)
      tracker.end(200)
      
      return {
        success: true,
        models: ['donor_matching', 'response_prediction', 'success_prediction'],
        accuracy
      }

    } catch (error) {
      console.error('❌ ML training failed:', error)
      tracker.end(500)
      return { success: false, models: [], accuracy: {} }
    }
  }

  /**
   * Predict donor matching score using trained ML model
   */
  async predictDonorMatch(donorId: string, requestId: string): Promise<MLPrediction | null> {
    try {
      const model = this.models.get('donor_matching')
      if (!model) {
        console.warn('Donor matching model not available')
        return null
      }

      // Extract features
      const features = await this.extractDonorFeatures(donorId, requestId)
      if (!features) return null

      // Make prediction
      const prediction = this.predict(model, Object.values(features))
      
      // Calculate feature importance
      const importance = this.calculateFeatureImportance(model, features)
      
      // Generate explanation
      const explanation = this.generateExplanation(features, importance)

      return {
        prediction,
        confidence: this.calculateConfidence(prediction, model.accuracy),
        importance,
        explanation
      }

    } catch (error) {
      console.error('Prediction error:', error)
      return null
    }
  }

  /**
   * Predict response time for a donor
   */
  async predictResponseTime(donorId: string, urgency: string): Promise<number> {
    try {
      const model = this.models.get('response_prediction')
      if (!model) return 30 // Default 30 minutes

      const features = await this.extractResponseFeatures(donorId, urgency)
      if (!features) return 30

      const prediction = this.predict(model, Object.values(features))
      return Math.max(5, Math.round(prediction)) // Minimum 5 minutes

    } catch (error) {
      console.error('Response time prediction error:', error)
      return 30
    }
  }

  /**
   * Predict success probability for a match
   */
  async predictSuccessProbability(donorId: string, requestId: string): Promise<number> {
    try {
      const model = this.models.get('success_prediction')
      if (!model) return 0.5 // Default 50%

      const features = await this.extractDonorFeatures(donorId, requestId)
      if (!features) return 0.5

      const prediction = this.predict(model, Object.values(features))
      return Math.max(0.1, Math.min(0.95, prediction)) // Clamp between 10% and 95%

    } catch (error) {
      console.error('Success probability prediction error:', error)
      return 0.5
    }
  }

  /**
   * Prepare training data from historical donations
   */
  private async prepareTrainingData(): Promise<MLTrainingData> {
    const { data: historicalData } = await this.supabase
      .from('blood_requests')
      .select(`
        *,
        donor_responses (
          *,
          users (
            id,
            blood_type,
            location,
            response_rate,
            success_rate,
            avg_response_time,
            total_donations
          )
        )
      `)
      .not('status', 'eq', 'pending')
      .order('created_at', { ascending: false })
      .limit(2000)

    const features: number[][] = []
    const labels: number[] = []

    for (const request of historicalData || []) {
      for (const response of request.donor_responses || []) {
        if (!response.users) continue

        const donorFeatures = await this.calculateHistoricalFeatures(
          response.users,
          request,
          response
        )

        if (donorFeatures) {
          features.push(Object.values(donorFeatures))
          
          // Label: 1 for successful match, 0 for unsuccessful
          const label = response.response_type === 'accept' && 
                       request.status === 'completed' ? 1 : 0
          labels.push(label)
        }
      }
    }

    return {
      features,
      labels,
      metadata: {
        featureNames: this.featureNames,
        sampleCount: features.length,
        lastTraining: new Date().toISOString()
      }
    }
  }

  /**
   * Train donor matching model using logistic regression
   */
  private async trainDonorMatchingModel(trainingData: MLTrainingData): Promise<MatchingModel> {
    const { weights, bias } = this.trainLogisticRegression(
      trainingData.features,
      trainingData.labels
    )

    const accuracy = this.evaluateModel(
      trainingData.features,
      trainingData.labels,
      weights,
      bias
    )

    return {
      id: 'donor_matching',
      type: 'donor_matching',
      weights,
      bias,
      accuracy,
      lastTrained: new Date().toISOString(),
      trainingDataCount: trainingData.features.length
    }
  }

  /**
   * Train response prediction model
   */
  private async trainResponsePredictionModel(trainingData: MLTrainingData): Promise<MatchingModel> {
    // For response time prediction, we need different labels
    const { data: responseData } = await this.supabase
      .from('donor_responses')
      .select(`
        *,
        users (*),
        blood_requests (*)
      `)
      .not('response_time', 'is', null)
      .limit(1000)

    const features: number[][] = []
    const responseTimes: number[] = []

    for (const response of responseData || []) {
      if (!response.users || !response.blood_requests) continue

      const donorFeatures = await this.calculateHistoricalFeatures(
        response.users,
        response.blood_requests,
        response
      )

      if (donorFeatures && response.response_time) {
        features.push(Object.values(donorFeatures))
        responseTimes.push(response.response_time)
      }
    }

    const { weights, bias } = this.trainLinearRegression(features, responseTimes)
    const accuracy = this.evaluateRegressionModel(features, responseTimes, weights, bias)

    return {
      id: 'response_prediction',
      type: 'response_prediction',
      weights,
      bias,
      accuracy,
      lastTrained: new Date().toISOString(),
      trainingDataCount: features.length
    }
  }

  /**
   * Train success prediction model
   */
  private async trainSuccessPredictionModel(trainingData: MLTrainingData): Promise<MatchingModel> {
    // Use same data as donor matching but with different focus
    const { weights, bias } = this.trainLogisticRegression(
      trainingData.features,
      trainingData.labels
    )

    const accuracy = this.evaluateModel(
      trainingData.features,
      trainingData.labels,
      weights,
      bias
    )

    return {
      id: 'success_prediction',
      type: 'success_prediction', 
      weights,
      bias,
      accuracy,
      lastTrained: new Date().toISOString(),
      trainingDataCount: trainingData.features.length
    }
  }

  /**
   * Simple logistic regression implementation
   */
  private trainLogisticRegression(features: number[][], labels: number[], learningRate = 0.01, epochs = 1000): { weights: number[]; bias: number } {
    const numFeatures = features[0]?.length || 0
    let weights = new Array(numFeatures).fill(0)
    let bias = 0

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < features.length; i++) {
        const x = features[i]
        const y = labels[i]
        
        // Forward pass
        const z = x.reduce((sum, xi, j) => sum + xi * weights[j], 0) + bias
        const prediction = 1 / (1 + Math.exp(-z)) // Sigmoid
        
        // Backward pass
        const error = prediction - y
        
        // Update weights
        for (let j = 0; j < weights.length; j++) {
          weights[j] -= learningRate * error * x[j]
        }
        bias -= learningRate * error
      }
    }

    return { weights, bias }
  }

  /**
   * Simple linear regression implementation
   */
  private trainLinearRegression(features: number[][], labels: number[], learningRate = 0.001, epochs = 1000): { weights: number[]; bias: number } {
    const numFeatures = features[0]?.length || 0
    let weights = new Array(numFeatures).fill(0)
    let bias = 0

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < features.length; i++) {
        const x = features[i]
        const y = labels[i]
        
        // Forward pass
        const prediction = x.reduce((sum, xi, j) => sum + xi * weights[j], 0) + bias
        
        // Backward pass
        const error = prediction - y
        
        // Update weights
        for (let j = 0; j < weights.length; j++) {
          weights[j] -= learningRate * error * x[j]
        }
        bias -= learningRate * error
      }
    }

    return { weights, bias }
  }

  /**
   * Make prediction using trained model
   */
  private predict(model: MatchingModel, features: number[]): number {
    const z = features.reduce((sum, feature, i) => sum + feature * model.weights[i], 0) + model.bias
    
    if (model.type === 'donor_matching' || model.type === 'success_prediction') {
      return 1 / (1 + Math.exp(-z)) // Sigmoid for classification
    } else {
      return z // Linear for regression
    }
  }

  /**
   * Extract features for a donor-request pair
   */
  private async extractDonorFeatures(donorId: string, requestId: string): Promise<DonorFeatures | null> {
    try {
      const { data: donor } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', donorId)
        .single()

      const { data: request } = await this.supabase
        .from('blood_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (!donor || !request) return null

      return this.calculateFeatures(donor, request)

    } catch (error) {
      console.error('Feature extraction error:', error)
      return null
    }
  }

  /**
   * Extract features for response time prediction
   */
  private async extractResponseFeatures(donorId: string, urgency: string): Promise<DonorFeatures | null> {
    try {
      const { data: donor } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', donorId)
        .single()

      if (!donor) return null

      // Create a mock request for feature calculation
      const mockRequest = {
        urgency,
        created_at: new Date().toISOString(),
        blood_type: donor.blood_type,
        location: donor.location
      }

      return this.calculateFeatures(donor, mockRequest)

    } catch (error) {
      console.error('Response feature extraction error:', error)
      return null
    }
  }

  /**
   * Calculate features for ML model
   */
  private calculateFeatures(donor: Donor, request: BloodRequest): DonorFeatures {
    const now = new Date()
    
    return {
      bloodTypeCompatibility: this.calculateBloodTypeCompatibility(donor.blood_type, request.blood_type),
      locationDistance: this.calculateLocationDistance(donor.location, request.location),
      responseRate: donor.response_rate || 0.5,
      successRate: donor.success_rate || 0.5,
      avgResponseTime: this.normalizeResponseTime(donor.avg_response_time || 30),
      timeOfDay: now.getHours() / 24, // Normalize to 0-1
      dayOfWeek: now.getDay() / 7, // Normalize to 0-1
      recentActivity: this.calculateRecentActivity(donor),
      donationFrequency: this.normalizeDonationFrequency(donor.total_donations || 0),
      urgencyMatch: this.calculateUrgencyMatch(request.urgency, donor.avg_response_time),
      seasonality: this.calculateSeasonality(),
      weatherCondition: 0.5 // Placeholder - would integrate with weather API
    }
  }

  /**
   * Calculate historical features (for training data)
   */
  private async calculateHistoricalFeatures(donor: Donor, request: BloodRequest, response: BloodRequest['donor_responses'][number]): Promise<DonorFeatures | null> {
    const responseTime = new Date(response.created_at)
    
    return {
      bloodTypeCompatibility: this.calculateBloodTypeCompatibility(donor.blood_type, request.blood_type),
      locationDistance: this.calculateLocationDistance(donor.location, request.location),
      responseRate: donor.response_rate || 0.5,
      successRate: donor.success_rate || 0.5,
      avgResponseTime: this.normalizeResponseTime(donor.avg_response_time || 30),
      timeOfDay: responseTime.getHours() / 24,
      dayOfWeek: responseTime.getDay() / 7,
      recentActivity: this.calculateRecentActivity(donor),
      donationFrequency: this.normalizeDonationFrequency(donor.total_donations || 0),
      urgencyMatch: this.calculateUrgencyMatch(request.urgency, donor.avg_response_time),
      seasonality: this.calculateSeasonality(responseTime),
      weatherCondition: 0.5 // Placeholder
    }
  }

  /**
   * Helper methods for feature calculation
   */
  private calculateBloodTypeCompatibility(donorType: string, requestType: string): number {
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      'O-': { 'O-': 1, 'O+': 1, 'A-': 1, 'A+': 1, 'B-': 1, 'B+': 1, 'AB-': 1, 'AB+': 1 },
      'O+': { 'O+': 1, 'A+': 1, 'B+': 1, 'AB+': 1 },
      'A-': { 'A-': 1, 'A+': 1, 'AB-': 1, 'AB+': 1 },
      'A+': { 'A+': 1, 'AB+': 1 },
      'B-': { 'B-': 1, 'B+': 1, 'AB-': 1, 'AB+': 1 },
      'B+': { 'B+': 1, 'AB+': 1 },
      'AB-': { 'AB-': 1, 'AB+': 1 },
      'AB+': { 'AB+': 1 }
    }

    return compatibilityMatrix[donorType]?.[requestType] || 0
  }

  private calculateLocationDistance(donorLocation: string, requestLocation: string): number {
    // Simplified distance calculation - in production would use real geolocation
    return donorLocation === requestLocation ? 0 : 0.5
  }

  private normalizeResponseTime(responseTime: number): number {
    // Normalize response time to 0-1 scale (0 = immediate, 1 = very slow)
    return Math.min(responseTime / 120, 1) // 120 minutes max
  }

  private calculateRecentActivity(donor: Donor): number {
    // Calculate based on last donation - placeholder implementation
    if (!donor.last_donation) return 0
    
    const lastDonation = new Date(donor.last_donation)
    const daysSince = (Date.now() - lastDonation.getTime()) / (1000 * 60 * 60 * 24)
    
    return Math.max(0, 1 - daysSince / 90) // Active if donated within 90 days
  }

  private normalizeDonationFrequency(totalDonations: number): number {
    // Normalize total donations to 0-1 scale
    return Math.min(totalDonations / 50, 1) // 50+ donations = 1
  }

  private calculateUrgencyMatch(urgency: string, avgResponseTime: number): number {
    if (urgency === 'critical' && avgResponseTime < 15) return 1
    if (urgency === 'urgent' && avgResponseTime < 30) return 0.8
    if (urgency === 'normal') return 0.6
    return 0.3
  }

  private calculateSeasonality(date?: Date): number {
    const now = date || new Date()
    const month = now.getMonth()
    
    // Higher donation rates in certain months
    const seasonalFactors = [0.8, 0.7, 0.9, 0.9, 1.0, 0.8, 0.7, 0.7, 0.9, 1.0, 0.9, 0.8]
    return seasonalFactors[month]
  }

  /**
   * Calculate feature importance
   */
  private calculateFeatureImportance(model: MatchingModel, features: DonorFeatures): { feature: string; weight: number }[] {
    return this.featureNames.map((name, index) => ({
      feature: name,
      weight: Math.abs(model.weights[index] || 0)
    })).sort((a, b) => b.weight - a.weight)
  }

  /**
   * Generate explanation for prediction
   */
  private generateExplanation(features: DonorFeatures, importance: { feature: string; weight: number }[]): string {
    const topFactors = importance.slice(0, 3)
    const explanations: string[] = []

    for (const factor of topFactors) {
      const featureValue = features[factor.feature as keyof DonorFeatures]
      
      switch (factor.feature) {
        case 'bloodTypeCompatibility':
          if (featureValue > 0.5) explanations.push('Compatible blood type')
          break
        case 'responseRate':
          if (featureValue > 0.8) explanations.push('High response rate')
          break
        case 'successRate':
          if (featureValue > 0.8) explanations.push('High success rate')
          break
        case 'urgencyMatch':
          if (featureValue > 0.7) explanations.push('Good urgency match')
          break
      }
    }

    return explanations.join(', ') || 'Based on historical patterns'
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(prediction: number, modelAccuracy: number): number {
    // Confidence based on model accuracy and prediction strength
    const predictionStrength = Math.abs(prediction - 0.5) * 2 // 0-1 scale
    return modelAccuracy * predictionStrength
  }

  /**
   * Evaluate model accuracy
   */
  private evaluateModel(features: number[][], labels: number[], weights: number[], bias: number): number {
    let correct = 0
    
    for (let i = 0; i < features.length; i++) {
      const prediction = this.predict({ weights, bias } as MatchingModel, features[i])
      const predicted = prediction > 0.5 ? 1 : 0
      if (predicted === labels[i]) correct++
    }
    
    return correct / features.length
  }

  /**
   * Evaluate regression model accuracy
   */
  private evaluateRegressionModel(features: number[][], labels: number[], weights: number[], bias: number): number {
    let totalError = 0
    
    for (let i = 0; i < features.length; i++) {
      const prediction = this.predict({ weights, bias } as MatchingModel, features[i])
      const error = Math.abs(prediction - labels[i])
      totalError += error
    }
    
    const meanError = totalError / features.length
    const meanLabel = labels.reduce((sum, label) => sum + label, 0) / labels.length
    
    return 1 - (meanError / meanLabel) // Accuracy as 1 - normalized error
  }

  /**
   * Load models from database
   */
  private async loadModels(): Promise<void> {
    try {
      const { data: models } = await this.supabase
        .from('ml_models')
        .select('*')
        .order('created_at', { ascending: false })

      for (const model of models || []) {
        this.models.set(model.type, {
          id: model.id,
          type: model.type,
          weights: model.weights,
          bias: model.bias,
          accuracy: model.accuracy,
          lastTrained: model.last_trained,
          trainingDataCount: model.training_data_count
        })
      }

      console.log(`Loaded ${this.models.size} ML models`)

    } catch (error) {
      console.error('Error loading ML models:', error)
    }
  }

  /**
   * Save models to database
   */
  private async saveModels(): Promise<void> {
    try {
      for (const [type, model] of this.models.entries()) {
        await this.supabase
          .from('ml_models')
          .upsert({
            id: model.id,
            type: model.type,
            weights: model.weights,
            bias: model.bias,
            accuracy: model.accuracy,
            last_trained: model.lastTrained,
            training_data_count: model.trainingDataCount,
            updated_at: new Date().toISOString()
          })
      }

      console.log('ML models saved to database')

    } catch (error) {
      console.error('Error saving ML models:', error)
    }
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(): Record<string, unknown> {
    const metrics: Record<string, any> = {}
    
    for (const [type, model] of this.models.entries()) {
      metrics[type] = {
        accuracy: model.accuracy,
        lastTrained: model.lastTrained,
        trainingDataCount: model.trainingDataCount
      }
    }
    
    return metrics
  }
}

// Export singleton instance
export const mlEngine = new MLEngine()