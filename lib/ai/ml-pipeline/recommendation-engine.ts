/**
 * Advanced Recommendation Engine
 * 
 * Sophisticated donor-recipient matching system using ensemble methods,
 * collaborative filtering, and content-based recommendations
 */

import * as tf from '@tensorflow/tfjs-node'
import { performanceMonitor } from '../../performance/metrics'
import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'

export interface DonorProfile {
  id: string
  bloodType: string
  location: {
    latitude: number
    longitude: number
    city: string
    region: string
  }
  availability: {
    lastDonation: Date
    nextEligibleDate: Date
    preferredTimes: string[]
    maxDistance: number
  }
  demographics: {
    age: number
    gender: string
    weight: number
    height: number
  }
  medicalHistory: {
    eligibilityScore: number
    riskFactors: string[]
    donationHistory: number
    averageInterval: number
  }
  preferences: {
    urgencyTypes: string[]
    recipientTypes: string[]
    communicationMethods: string[]
  }
}

export interface BloodRequest {
  id: string
  bloodType: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  location: {
    latitude: number
    longitude: number
    hospital: string
    city: string
  }
  requirements: {
    units: number
    deadline: Date
    specialRequirements: string[]
    patientAge?: number
    patientCondition?: string
  }
  requestedBy: {
    hospitalId: string
    doctorId: string
    contactInfo: string
  }
}

export interface RecommendationResult {
  donorId: string
  score: number
  confidence: number
  factors: {
    compatibility: number
    proximity: number
    availability: number
    reliability: number
    urgencyMatch: number
  }
  estimatedResponse: {
    probability: number
    timeToResponse: number
    timeToArrival: number
  }
  reasoning: string[]
}

export interface RecommendationRequest {
  bloodRequest: BloodRequest
  maxRecommendations: number
  includeReasons: boolean
  filterCriteria?: {
    maxDistance?: number
    minEligibilityScore?: number
    excludeDonorIds?: string[]
  }
}

class RecommendationEngine {
  private collaborativeModel: tf.LayersModel | null = null
  private contentModel: tf.LayersModel | null = null
  private ensembleModel: tf.LayersModel | null = null
  private isInitialized = false
  private cache = getCache()
  private db = getOptimizedDB()

  // Feature weights for ensemble scoring
  private readonly FEATURE_WEIGHTS = {
    bloodCompatibility: 0.30,
    proximity: 0.25,
    availability: 0.20,
    reliability: 0.15,
    urgencyMatch: 0.10
  }

  // Blood type compatibility matrix
  private readonly COMPATIBILITY_MATRIX = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  }

  constructor() {
    this.initializeModels()
  }

  private async initializeModels(): Promise<void> {
    try {
      console.log('Initializing ML recommendation models...')

      // Initialize collaborative filtering model
      this.collaborativeModel = await this.createCollaborativeModel()
      
      // Initialize content-based model
      this.contentModel = await this.createContentBasedModel()
      
      // Initialize ensemble model
      this.ensembleModel = await this.createEnsembleModel()

      this.isInitialized = true
      console.log('ML recommendation models initialized successfully')

    } catch (error) {
      console.error('Failed to initialize ML models:', error)
      this.isInitialized = false
    }
  }

  private async createCollaborativeModel(): Promise<tf.LayersModel> {
    // Collaborative filtering model for donor-request interactions
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [20], // Donor-request interaction features
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Response probability
      ]
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    })

    return model
  }

  private async createContentBasedModel(): Promise<tf.LayersModel> {
    // Content-based model for donor profile matching
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [15], // Donor profile features
          units: 48,
          activation: 'relu'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.25 }),
        tf.layers.dense({ units: 24, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.15 }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Suitability score
      ]
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    })

    return model
  }

  private async createEnsembleModel(): Promise<tf.LayersModel> {
    // Ensemble model combining collaborative and content-based predictions
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [7], // Combined features from both models + additional factors
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Final recommendation score
      ]
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    })

    return model
  }

  async generateRecommendations(request: RecommendationRequest): Promise<RecommendationResult[]> {
    const startTime = performance.now()

    if (!this.isInitialized) {
      throw new Error('Recommendation engine not initialized')
    }

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request)
      const cachedResults = await this.cache.get<RecommendationResult[]>(cacheKey)
      
      if (cachedResults) {
        performanceMonitor.recordCustomMetric({
          name: 'recommendation_cache_hit',
          value: 1,
          unit: 'count',
          timestamp: Date.now(),
          tags: { cache_hit: 'true' }
        })
        return cachedResults
      }

      // Get eligible donors
      const eligibleDonors = await this.getEligibleDonors(request.bloodRequest, request.filterCriteria)
      
      if (eligibleDonors.length === 0) {
        return []
      }

      // Generate recommendations for each donor
      const recommendations: RecommendationResult[] = []
      
      for (const donor of eligibleDonors) {
        const recommendation = await this.scoreDonor(donor, request.bloodRequest, request.includeReasons)
        recommendations.push(recommendation)
      }

      // Sort by score and limit results
      const sortedRecommendations = recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, request.maxRecommendations)

      // Cache results
      await this.cache.set(cacheKey, sortedRecommendations, { 
        ttl: 300, // 5 minutes
        tags: ['recommendations', 'ml']
      })

      const processingTime = performance.now() - startTime

      performanceMonitor.recordCustomMetric({
        name: 'recommendation_generation_duration',
        value: processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          donor_count: eligibleDonors.length.toString(),
          recommendation_count: sortedRecommendations.length.toString(),
          urgency: request.bloodRequest.urgency,
          cache_hit: 'false'
        }
      })

      return sortedRecommendations

    } catch (error) {
      performanceMonitor.recordCustomMetric({
        name: 'recommendation_generation_duration',
        value: performance.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          success: 'false',
          error: (error as Error).message
        }
      })

      throw new Error(`Recommendation generation failed: ${(error as Error).message}`)
    }
  }

  private async getEligibleDonors(
    bloodRequest: BloodRequest,
    filterCriteria?: RecommendationRequest['filterCriteria']
  ): Promise<DonorProfile[]> {
    // Get compatible blood types
    const compatibleTypes = this.getCompatibleBloodTypes(bloodRequest.bloodType)
    
    // Build query filters
    const filters: any = {
      blood_type: { in: compatibleTypes },
      verified: true,
      active: true
    }

    // Add filter criteria
    if (filterCriteria?.minEligibilityScore) {
      filters.eligibility_score = { gte: filterCriteria.minEligibilityScore }
    }

    if (filterCriteria?.excludeDonorIds?.length) {
      filters.id = { notIn: filterCriteria.excludeDonorIds }
    }

    // Get donors from database
    const donorsResult = await this.db.findMany('donors', filters, {
      select: `
        id, blood_type, latitude, longitude, city, region,
        last_donation, next_eligible_date, preferred_times, max_distance,
        age, gender, weight, height, eligibility_score, risk_factors,
        donation_history, average_interval, urgency_types, recipient_types
      `,
      limit: 500 // Reasonable limit for processing
    })

    // Transform to DonorProfile objects
    const donors: DonorProfile[] = donorsResult.data?.map(donor => ({
      id: donor.id,
      bloodType: donor.blood_type,
      location: {
        latitude: donor.latitude,
        longitude: donor.longitude,
        city: donor.city,
        region: donor.region
      },
      availability: {
        lastDonation: new Date(donor.last_donation),
        nextEligibleDate: new Date(donor.next_eligible_date),
        preferredTimes: donor.preferred_times || [],
        maxDistance: donor.max_distance || 50
      },
      demographics: {
        age: donor.age,
        gender: donor.gender,
        weight: donor.weight,
        height: donor.height
      },
      medicalHistory: {
        eligibilityScore: donor.eligibility_score,
        riskFactors: donor.risk_factors || [],
        donationHistory: donor.donation_history || 0,
        averageInterval: donor.average_interval || 90
      },
      preferences: {
        urgencyTypes: donor.urgency_types || [],
        recipientTypes: donor.recipient_types || [],
        communicationMethods: ['email', 'sms'] // Default
      }
    })) || []

    // Apply distance filter
    if (filterCriteria?.maxDistance) {
      return donors.filter(donor => {
        const distance = this.calculateDistance(
          bloodRequest.location.latitude,
          bloodRequest.location.longitude,
          donor.location.latitude,
          donor.location.longitude
        )
        return distance <= filterCriteria.maxDistance!
      })
    }

    return donors
  }

  private async scoreDonor(
    donor: DonorProfile,
    bloodRequest: BloodRequest,
    includeReasons: boolean
  ): Promise<RecommendationResult> {
    // Calculate individual factor scores
    const compatibility = this.calculateCompatibilityScore(donor.bloodType, bloodRequest.bloodType)
    const proximity = this.calculateProximityScore(donor, bloodRequest)
    const availability = this.calculateAvailabilityScore(donor, bloodRequest)
    const reliability = this.calculateReliabilityScore(donor)
    const urgencyMatch = this.calculateUrgencyMatchScore(donor, bloodRequest)

    // Use ML models for enhanced scoring
    const collaborativeScore = await this.getCollaborativeScore(donor, bloodRequest)
    const contentScore = await this.getContentScore(donor, bloodRequest)
    
    // Ensemble scoring
    const ensembleFeatures = tf.tensor2d([[
      compatibility,
      proximity,
      availability,
      reliability,
      urgencyMatch,
      collaborativeScore,
      contentScore
    ]])

    const ensemblePrediction = this.ensembleModel!.predict(ensembleFeatures) as tf.Tensor
    const ensembleScore = (await ensemblePrediction.data())[0]

    // Calculate final weighted score
    const finalScore = (
      compatibility * this.FEATURE_WEIGHTS.bloodCompatibility +
      proximity * this.FEATURE_WEIGHTS.proximity +
      availability * this.FEATURE_WEIGHTS.availability +
      reliability * this.FEATURE_WEIGHTS.reliability +
      urgencyMatch * this.FEATURE_WEIGHTS.urgencyMatch
    ) * 0.7 + ensembleScore * 0.3 // 70% traditional, 30% ML

    // Calculate confidence based on data quality and model certainty
    const confidence = this.calculateConfidence(donor, bloodRequest, ensembleScore)

    // Estimate response probability and timing
    const estimatedResponse = this.estimateResponse(donor, bloodRequest, finalScore)

    // Generate reasoning if requested
    const reasoning = includeReasons ? this.generateReasoning(donor, bloodRequest, {
      compatibility, proximity, availability, reliability, urgencyMatch
    }) : []

    // Cleanup tensors
    ensembleFeatures.dispose()
    ensemblePrediction.dispose()

    return {
      donorId: donor.id,
      score: Math.round(finalScore * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      factors: {
        compatibility: Math.round(compatibility * 100) / 100,
        proximity: Math.round(proximity * 100) / 100,
        availability: Math.round(availability * 100) / 100,
        reliability: Math.round(reliability * 100) / 100,
        urgencyMatch: Math.round(urgencyMatch * 100) / 100
      },
      estimatedResponse,
      reasoning
    }
  }

  private calculateCompatibilityScore(donorType: string, requestedType: string): number {
    const compatibleTypes = this.COMPATIBILITY_MATRIX[donorType as keyof typeof this.COMPATIBILITY_MATRIX] || []
    
    if (!compatibleTypes.includes(requestedType)) {
      return 0
    }

    // Perfect match gets highest score
    if (donorType === requestedType) {
      return 1.0
    }

    // Universal donors get high scores
    if (donorType === 'O-') {
      return 0.95
    }

    // Other compatible types
    return 0.8
  }

  private calculateProximityScore(donor: DonorProfile, bloodRequest: BloodRequest): number {
    const distance = this.calculateDistance(
      donor.location.latitude,
      donor.location.longitude,
      bloodRequest.location.latitude,
      bloodRequest.location.longitude
    )

    // Score decreases with distance
    const maxDistance = donor.availability.maxDistance
    if (distance > maxDistance) {
      return 0
    }

    // Exponential decay for distance scoring
    return Math.exp(-distance / (maxDistance * 0.3))
  }

  private calculateAvailabilityScore(donor: DonorProfile, bloodRequest: BloodRequest): number {
    const now = new Date()
    const nextEligible = donor.availability.nextEligibleDate
    
    // Not eligible yet
    if (nextEligible > now) {
      const daysUntilEligible = (nextEligible.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return Math.max(0, 1 - daysUntilEligible / 30) // Decrease score over 30 days
    }

    // Check preferred times if deadline allows
    const hoursUntilDeadline = (bloodRequest.requirements.deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilDeadline > 24 && donor.availability.preferredTimes.length > 0) {
      const currentHour = now.getHours()
      const preferredHours = donor.availability.preferredTimes.map(time => parseInt(time.split(':')[0]))
      const isPreferredTime = preferredHours.some(hour => Math.abs(hour - currentHour) <= 2)
      
      return isPreferredTime ? 1.0 : 0.7
    }

    return 1.0 // Fully available
  }

  private calculateReliabilityScore(donor: DonorProfile): number {
    const history = donor.medicalHistory
    
    // Base score from eligibility
    let score = history.eligibilityScore / 100
    
    // Bonus for donation history
    const historyBonus = Math.min(history.donationHistory * 0.05, 0.3)
    score += historyBonus
    
    // Penalty for risk factors
    const riskPenalty = history.riskFactors.length * 0.1
    score -= riskPenalty
    
    // Consistency bonus (regular donors)
    if (history.averageInterval > 0 && history.averageInterval <= 120) {
      score += 0.1
    }

    return Math.max(0, Math.min(1, score))
  }

  private calculateUrgencyMatchScore(donor: DonorProfile, bloodRequest: BloodRequest): number {
    const donorUrgencyTypes = donor.preferences.urgencyTypes
    
    if (donorUrgencyTypes.length === 0) {
      return 0.5 // Neutral if no preference
    }

    if (donorUrgencyTypes.includes(bloodRequest.urgency)) {
      return 1.0
    }

    // Partial matches
    if (bloodRequest.urgency === 'critical' && donorUrgencyTypes.includes('high')) {
      return 0.8
    }

    if (bloodRequest.urgency === 'high' && donorUrgencyTypes.includes('medium')) {
      return 0.6
    }

    return 0.2
  }

  private async getCollaborativeScore(donor: DonorProfile, bloodRequest: BloodRequest): Promise<number> {
    try {
      // Create feature vector for collaborative filtering
      const features = tf.tensor2d([[
        donor.medicalHistory.donationHistory,
        donor.demographics.age / 100,
        donor.medicalHistory.eligibilityScore / 100,
        bloodRequest.urgency === 'critical' ? 1 : 0,
        bloodRequest.urgency === 'high' ? 1 : 0,
        bloodRequest.requirements.units / 10,
        this.calculateDistance(
          donor.location.latitude,
          donor.location.longitude,
          bloodRequest.location.latitude,
          bloodRequest.location.longitude
        ) / 100,
        // Additional interaction features...
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 // Placeholder for historical interactions
      ]])

      const prediction = this.collaborativeModel!.predict(features) as tf.Tensor
      const score = (await prediction.data())[0]

      features.dispose()
      prediction.dispose()

      return score
    } catch (error) {
      console.error('Collaborative scoring error:', error)
      return 0.5 // Fallback score
    }
  }

  private async getContentScore(donor: DonorProfile, bloodRequest: BloodRequest): Promise<number> {
    try {
      // Create feature vector for content-based filtering
      const features = tf.tensor2d([[
        donor.demographics.age / 100,
        donor.demographics.weight / 200,
        donor.medicalHistory.eligibilityScore / 100,
        donor.medicalHistory.donationHistory / 50,
        donor.medicalHistory.averageInterval / 365,
        this.calculateDistance(
          donor.location.latitude,
          donor.location.longitude,
          bloodRequest.location.latitude,
          bloodRequest.location.longitude
        ) / 100,
        bloodRequest.urgency === 'critical' ? 1 : 0,
        bloodRequest.urgency === 'high' ? 1 : 0,
        bloodRequest.requirements.units / 10,
        // Additional content features...
        0, 0, 0, 0, 0, 0
      ]])

      const prediction = this.contentModel!.predict(features) as tf.Tensor
      const score = (await prediction.data())[0]

      features.dispose()
      prediction.dispose()

      return score
    } catch (error) {
      console.error('Content scoring error:', error)
      return 0.5 // Fallback score
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private getCompatibleBloodTypes(requestedType: string): string[] {
    // Return donor types that can donate to the requested type
    const compatibilityMap: Record<string, string[]> = {
      'O-': ['O-'],
      'O+': ['O-', 'O+'],
      'A-': ['O-', 'A-'],
      'A+': ['O-', 'O+', 'A-', 'A+'],
      'B-': ['O-', 'B-'],
      'B+': ['O-', 'O+', 'B-', 'B+'],
      'AB-': ['O-', 'A-', 'B-', 'AB-'],
      'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
    }

    return compatibilityMap[requestedType] || []
  }

  private calculateConfidence(donor: DonorProfile, bloodRequest: BloodRequest, mlScore: number): number {
    let confidence = 0.5

    // Data quality factors
    if (donor.medicalHistory.donationHistory > 0) confidence += 0.2
    if (donor.location.latitude && donor.location.longitude) confidence += 0.1
    if (donor.availability.preferredTimes.length > 0) confidence += 0.1

    // ML model confidence
    const mlConfidence = Math.abs(mlScore - 0.5) * 2 // Distance from neutral
    confidence += mlConfidence * 0.1

    return Math.min(1, confidence)
  }

  private estimateResponse(donor: DonorProfile, bloodRequest: BloodRequest, score: number) {
    const baseProbability = score * 0.8 + 0.1 // 10-90% range
    
    // Adjust based on urgency
    let urgencyMultiplier = 1
    switch (bloodRequest.urgency) {
      case 'critical': urgencyMultiplier = 1.3; break
      case 'high': urgencyMultiplier = 1.2; break
      case 'medium': urgencyMultiplier = 1.1; break
    }

    const probability = Math.min(0.95, baseProbability * urgencyMultiplier)
    
    // Estimate response time based on donor history and urgency
    const baseResponseTime = donor.medicalHistory.averageInterval > 0 ? 
      Math.min(120, donor.medicalHistory.averageInterval / 10) : 60
    
    const timeToResponse = baseResponseTime / urgencyMultiplier
    
    // Estimate arrival time based on distance
    const distance = this.calculateDistance(
      donor.location.latitude,
      donor.location.longitude,
      bloodRequest.location.latitude,
      bloodRequest.location.longitude
    )
    
    const timeToArrival = timeToResponse + (distance * 2) // 2 minutes per km

    return {
      probability: Math.round(probability * 100) / 100,
      timeToResponse: Math.round(timeToResponse),
      timeToArrival: Math.round(timeToArrival)
    }
  }

  private generateReasoning(
    donor: DonorProfile,
    bloodRequest: BloodRequest,
    factors: { compatibility: number; proximity: number; availability: number; reliability: number; urgencyMatch: number }
  ): string[] {
    const reasons: string[] = []

    // Blood compatibility
    if (factors.compatibility === 1.0) {
      reasons.push(`Perfect blood type match (${donor.bloodType})`)
    } else if (factors.compatibility > 0.9) {
      reasons.push(`Universal donor (${donor.bloodType}) compatible with ${bloodRequest.bloodType}`)
    } else if (factors.compatibility > 0.7) {
      reasons.push(`Compatible blood type (${donor.bloodType} → ${bloodRequest.bloodType})`)
    }

    // Proximity
    const distance = this.calculateDistance(
      donor.location.latitude,
      donor.location.longitude,
      bloodRequest.location.latitude,
      bloodRequest.location.longitude
    )
    
    if (distance < 5) {
      reasons.push(`Very close location (${distance.toFixed(1)}km away)`)
    } else if (distance < 15) {
      reasons.push(`Nearby location (${distance.toFixed(1)}km away)`)
    }

    // Availability
    if (factors.availability === 1.0) {
      reasons.push('Immediately available for donation')
    } else if (factors.availability > 0.7) {
      reasons.push('Available during preferred time slots')
    }

    // Reliability
    if (donor.medicalHistory.donationHistory > 10) {
      reasons.push(`Experienced donor (${donor.medicalHistory.donationHistory} previous donations)`)
    } else if (donor.medicalHistory.donationHistory > 5) {
      reasons.push(`Regular donor (${donor.medicalHistory.donationHistory} previous donations)`)
    }

    if (donor.medicalHistory.eligibilityScore > 90) {
      reasons.push('High medical eligibility score')
    }

    // Urgency match
    if (factors.urgencyMatch === 1.0) {
      reasons.push(`Prefers ${bloodRequest.urgency} urgency requests`)
    }

    return reasons
  }

  private generateCacheKey(request: RecommendationRequest): string {
    const keyData = {
      bloodType: request.bloodRequest.bloodType,
      urgency: request.bloodRequest.urgency,
      location: `${request.bloodRequest.location.latitude},${request.bloodRequest.location.longitude}`,
      units: request.bloodRequest.requirements.units,
      maxRecs: request.maxRecommendations,
      filters: request.filterCriteria
    }
    
    return `recommendations:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`
  }

  // Model training and updates
  async updateModels(trainingData: any[]): Promise<void> {
    // Implementation for model retraining would go here
    console.log('Model update functionality - to be implemented with production data')
  }

  // Cleanup
  dispose(): void {
    this.collaborativeModel?.dispose()
    this.contentModel?.dispose()
    this.ensembleModel?.dispose()
  }

  getSystemInfo() {
    return {
      isInitialized: this.isInitialized,
      modelVersions: {
        collaborative: '1.0.0',
        content: '1.0.0',
        ensemble: '1.0.0'
      },
      featureWeights: this.FEATURE_WEIGHTS,
      compatibilityMatrix: Object.keys(this.COMPATIBILITY_MATRIX)
    }
  }
}

// Singleton instance
let recommendationEngineInstance: RecommendationEngine | null = null

export function getRecommendationEngine(): RecommendationEngine {
  if (!recommendationEngineInstance) {
    recommendationEngineInstance = new RecommendationEngine()
  }
  return recommendationEngineInstance
}

export default RecommendationEngine
