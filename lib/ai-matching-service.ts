import { getSupabase } from "./supabase"
import { mlEngine } from "./ml-engine"
import { performanceMonitor, PerformanceTracker } from "./performance-monitoring"

export interface AIMatchPrediction {
  donor_id: string
  recipient_id: string
  compatibility_score: number
  success_probability: number
  response_time_prediction: number
  factors: string[]
}

export interface Donor {
  id: string;
  name: string | null;
  blood_type: string | null;
  location: string | null;
  available: boolean | null;
  last_donation: string | null;
  total_donations: number | null;
  response_rate: number | null;
  avg_response_time: number | null;
  success_rate: number | null;
}

export interface HistoricalData {
  id: string;
  blood_type: string;
  urgency: string;
  status: string;
  created_at: string;
  donor_responses: {
    response_type: string;
    response_time: number;
    donor_id: string;
    created_at: string;
  }[];
}

export interface DonorProfile {
  id: string
  blood_type: string
  location: string
  response_rate: number
  avg_response_time: number
  success_rate: number
  availability_pattern: string
  last_donation: string
  total_donations: number
}

export class AIMatchingService {
  private supabase = getSupabase()
  private activeRequests = new Map<string, Promise<any>>()
  private maxConcurrentRequests = 3 // Reduced from 5 to 3
  private cacheTimeout = 3 * 60 * 1000 // Reduced from 5 to 3 minutes
  private cache = new Map<string, { data: any; timestamp: number }>()
  private maxCacheSize = 50 // Maximum cache entries

  /**
   * AI-powered donor matching with machine learning
   */
  async findOptimalDonors(
    requestId: string,
    bloodType: string,
    urgency: string,
    location: string
  ): Promise<AIMatchPrediction[]> {
    // Check for concurrent request limit
    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      console.warn(`⚠️ Request throttled: ${this.activeRequests.size} active requests`)
      throw new Error('Too many concurrent requests. Please try again later.')
    }

    // Check cache first
    const cacheKey = `${requestId}-${bloodType}-${urgency}-${location}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('✅ Returning cached results')
      return cached.data
    }

    const tracker = performanceMonitor.startTracking('ai-matching', 'FIND_DONORS')
    const requestPromise = this._findOptimalDonorsInternal(requestId, bloodType, urgency, location, tracker, cacheKey)
    
    // Track active request
    this.activeRequests.set(requestId, requestPromise)
    
    try {
      const result = await requestPromise
      return result
    } finally {
      // Cleanup
      this.activeRequests.delete(requestId)
      // Force garbage collection hint
      if (global.gc) {
        global.gc()
      }
    }
  }

  private async _findOptimalDonorsInternal(
    requestId: string,
    bloodType: string,
    urgency: string,
    location: string,
    tracker: PerformanceTracker,
    cacheKey: string
  ): Promise<AIMatchPrediction[]> {
    try {
      console.log(`🤖 Finding optimal donors for request ${requestId}`)
      
      // Get compatible donors with stricter limit to prevent memory overflow
      const compatibleDonors = await this.getCompatibleDonors(bloodType, location, 25) // Reduced from 50 to 25 donors
      
      if (compatibleDonors.length === 0) {
        console.log('No compatible donors found')
        tracker.end(200)
        return []
      }

      // Process donors in smaller batches to manage memory
      const batchSize = 5 // Reduced from 10 to 5
      const predictions: AIMatchPrediction[] = []
      
      for (let i = 0; i < compatibleDonors.length; i += batchSize) {
        const batch = compatibleDonors.slice(i, i + batchSize)
        const batchPredictions = await this.processDonorBatch(batch, requestId, urgency)
        predictions.push(...batchPredictions)
        
        // Force garbage collection after each batch for better memory management
        if (global.gc) {
          global.gc()
        }
        
        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Sort by combined ML score and success probability
      predictions.sort((a, b) => {
        const scoreA = (a.compatibility_score * 0.4) + (a.success_probability * 100 * 0.6)
        const scoreB = (b.compatibility_score * 0.4) + (b.success_probability * 100 * 0.6)
        return scoreB - scoreA
      })
      
      const topResults = predictions.slice(0, 10) // Return top 10 matches
      
      // Cache results
      this.cache.set(cacheKey, { data: topResults, timestamp: Date.now() })
      this.cleanupCache()
      
      console.log(`✅ Found ${predictions.length} donor matches, returning top 10`)
      tracker.end(200)
      
      return topResults
    } catch (error: any) {
      console.error('❌ Error in AI matching:', error)
      tracker.end(500)
      return []
    }
  }

  private async processDonorBatch(donors: Donor[], requestId: string, urgency: string): Promise<AIMatchPrediction[]> {
    const batchPredictions: AIMatchPrediction[] = []
    
    // Process donors in parallel but with controlled concurrency
    const concurrentPromises = donors.map(async (donor) => {
      try {
        // Get ML prediction with timeout
        const mlPrediction = await Promise.race([
          mlEngine.predictDonorMatch(donor.id, requestId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]).catch(() => null)
        
        const successProbability = await Promise.race([
          mlEngine.predictSuccessProbability(donor.id, requestId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]).catch(() => 0.5)
        
        const responseTimePrediction = await Promise.race([
          mlEngine.predictResponseTime(donor.id, urgency),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]).catch(() => 30)
        
        // Combine ML prediction with traditional factors
        const compatibilityScore = mlPrediction ? 
          Math.round(mlPrediction.prediction * 100) : 
          this.calculateBaseCompatibility(donor, urgency)
          
        const factors = mlPrediction ? 
          mlPrediction.importance.slice(0, 5).map(imp => imp.feature) :
          this.identifyFactors(donor, { factors: {} }, urgency)

        return {
          donor_id: donor.id,
          recipient_id: requestId,
          compatibility_score: compatibilityScore,
          success_probability: successProbability,
          response_time_prediction: responseTimePrediction,
          factors
        }
      } catch (error) {
        console.error(`Error processing donor ${donor.id}:`, error)
        return null
      }
    })

    const results = await Promise.allSettled(concurrentPromises)
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        batchPredictions.push(result.value)
      }
    })

    return batchPredictions
  }

  private cleanupCache(): void {
    const now = Date.now()
    const entriesToDelete: string[] = []
    
    // Collect expired entries
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        entriesToDelete.push(key)
      }
    }
    
    // Delete expired entries
    entriesToDelete.forEach(key => this.cache.delete(key))
    
    // If cache is still too large, remove oldest entries
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * Get historical donation data for ML training (memory optimized)
   */
  private async getHistoricalData(limit: number = 500) {
    // Use cache for historical data
    const cacheKey = `historical-data-${limit}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout * 2) { // Cache for 10 minutes
      return cached.data
    }

    const { data: requests } = await this.supabase
      .from('blood_requests')
      .select(`
        id,
        blood_type,
        urgency,
        status,
        created_at,
        donor_responses!inner (
          response_type,
          response_time,
          donor_id,
          created_at
        )
      `)
      .not('status', 'eq', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit)

    const result = requests || []
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
    return result
  }

  /**
   * Get compatible donors with enhanced filtering
   */
  private async getCompatibleDonors(bloodType: string, location: string, limit: number = 100) {
    // Blood type compatibility: who can donate TO whom
    const donorCompatibilityMatrix: Record<string, string[]> = {
      'O-': ['O-'],  // O- can donate to O-
      'O+': ['O-', 'O+'],  // O+ can donate to O- and O+
      'A-': ['O-', 'A-'],  // A- can donate to O- and A-
      'A+': ['O-', 'O+', 'A-', 'A+'],  // A+ can donate to O-, O+, A-, A+
      'B-': ['O-', 'B-'],  // B- can donate to O- and B-
      'B+': ['O-', 'O+', 'B-', 'B+'],  // B+ can donate to O-, O+, B-, B+
      'AB-': ['O-', 'A-', 'B-', 'AB-'],  // AB- can donate to O-, A-, B-, AB-
      'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']  // AB+ can donate to anyone
    }

    // Find who can donate to the requested blood type
    const compatibleDonorTypes: string[] = []
    for (const [donorType, canDonateTo] of Object.entries(donorCompatibilityMatrix)) {
      if (canDonateTo.includes(bloodType)) {
        compatibleDonorTypes.push(donorType)
      }
    }

    console.log(`🩸 Looking for donors with types: ${compatibleDonorTypes.join(', ')} who can donate to ${bloodType}`)

    const { data: donors, error } = await this.supabase
      .from('users')
      .select(`
        id,
        name,
        blood_type,
        location,
        available,
        last_donation,
        total_donations,
        response_rate,
        avg_response_time,
        success_rate
      `)
      .in('blood_type', compatibleDonorTypes)
      .eq('available', true)
      .order('response_rate', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Error fetching compatible donors:', error)
      return []
    }

    console.log(`✅ Found ${donors?.length || 0} compatible donors`)
    return donors || []
  }

  /**
   * Apply machine learning scoring algorithm
   */
  private async applyMLScoring(
    donors: Donor[],
    requestId: string,
    urgency: string,
    historicalData: HistoricalData[]
  ): Promise<AIMatchPrediction[]> {
    const predictions: AIMatchPrediction[] = []

    for (const donor of donors) {
      // Calculate base compatibility score
      let compatibilityScore = this.calculateBaseCompatibility(donor, urgency)
      
      // Apply ML factors
      const mlFactors = this.applyMLFactors(donor, historicalData, urgency)
      compatibilityScore *= mlFactors.scoreMultiplier
      
      // Predict success probability
      const successProbability = this.predictSuccessProbability(donor, historicalData)
      
      // Predict response time
      const responseTimePrediction = this.predictResponseTime(donor, urgency)
      
      // Identify contributing factors
      const factors = this.identifyFactors(donor, mlFactors, urgency)

      predictions.push({
        donor_id: donor.id,
        recipient_id: requestId,
        compatibility_score: Math.round(compatibilityScore),
        success_probability: successProbability,
        response_time_prediction: responseTimePrediction,
        factors
      })
    }

    return predictions
  }

  /**
   * Calculate base compatibility score
   */
  private calculateBaseCompatibility(donor: Donor, urgency: string): number {
    let score = 100

    // Blood type compatibility (already filtered)
    if (donor.blood_type) score += 50

    // Availability score
    if (donor.available) score += 30

    // Response rate bonus
    if (donor.response_rate > 0.8) score += 20
    else if (donor.response_rate > 0.6) score += 10

    // Success rate bonus
    if (donor.success_rate > 0.9) score += 25
    else if (donor.success_rate > 0.7) score += 15

    // Urgency adjustment
    if (urgency === 'critical') score *= 1.3
    else if (urgency === 'urgent') score *= 1.1

    return score
  }

  /**
   * Apply machine learning factors
   */
  private async applyMLFactors(
    donor: Donor,
    historicalData: HistoricalData[],
    urgency: string
  ): Promise<{ scoreMultiplier: number; factors: Record<string, string> }> {
    let scoreMultiplier = 1.0;
    const factors: any = {};

    // Time-based patterns
    const timePattern = this.analyzeTimePattern(donor, historicalData);
    if (timePattern.isActiveNow) {
      scoreMultiplier *= 1.2;
      factors.timePattern = 'Active now';
    }

    // Location-based patterns
    const locationPattern = this.analyzeLocationPattern(donor, historicalData);
    if (locationPattern.isNearby) {
      scoreMultiplier *= 1.15;
      factors.locationPattern = 'Nearby donor';
    }

    // Historical success patterns
    const successPattern = this.analyzeSuccessPattern(donor, historicalData);
    if (successPattern.highSuccessRate) {
      scoreMultiplier *= 1.25;
      factors.successPattern = 'High success rate';
    }

    // Urgency matching
    if (urgency === 'critical' && donor.avg_response_time < 10) {
      scoreMultiplier *= 1.3;
      factors.urgencyMatch = 'Fast responder';
    }

    // Trust score
    const trustScore = await this.calculateTrustScore(donor.id);
    scoreMultiplier *= 1 + (trustScore / 100) * 0.5; // Add up to 50% bonus for trust score
    factors.trustScore = `Trust score: ${trustScore.toFixed(2)}`;

    return { scoreMultiplier, factors };
  }

  /**
   * Analyze time-based response patterns
   */
  private analyzeTimePattern(donor: Donor, historicalData: HistoricalData[]) {
    const donorResponses = historicalData
      .flatMap(req => req.donor_responses)
      .filter(resp => resp.donor_id === donor.id)

    const now = new Date()
    const hour = now.getHours()
    
    // Check if donor is typically active at this time
    const activeHours = donorResponses
      .map(resp => new Date(resp.created_at).getHours())
      .filter(h => h >= 6 && h <= 22) // Active during day

    const isActiveNow = activeHours.length > donorResponses.length * 0.6

    return { isActiveNow }
  }

  /**
   * Analyze location-based patterns
   */
  private analyzeLocationPattern(donor: Donor, historicalData: HistoricalData[]) {
    // Simplified location analysis
    // In a real implementation, this would use geospatial analysis
    return { isNearby: true } // Assume nearby for now
  }

  /**
   * Analyze historical success patterns
   */
  private analyzeSuccessPattern(donor: Donor, historicalData: HistoricalData[]) {
    const donorResponses = historicalData
      .flatMap(req => req.donor_responses)
      .filter(resp => resp.donor_id === donor.id)

    const successfulResponses = donorResponses
      .filter(resp => resp.response_type === 'accept')

    const highSuccessRate = successfulResponses.length / donorResponses.length > 0.7

    return { highSuccessRate }
  }

  /**
   * Predict success probability using ML
   */
  private predictSuccessProbability(donor: Donor, historicalData: HistoricalData[]): number {
    let probability = 0.5 // Base probability

    // Factor in response rate
    if (donor.response_rate) {
      probability *= donor.response_rate
    }

    // Factor in success rate
    if (donor.success_rate) {
      probability *= donor.success_rate
    }

    // Factor in recent activity
    const recentActivity = this.getRecentActivity(donor, historicalData)
    if (recentActivity > 0.8) {
      probability *= 1.2
    }

    return Math.min(probability, 0.95) // Cap at 95%
  }

  /**
   * Predict response time
   */
  private predictResponseTime(donor: Donor, urgency: string): number {
    let baseTime = donor.avg_response_time || 30 // Default 30 minutes

    // Adjust for urgency
    if (urgency === 'critical') {
      baseTime *= 0.7 // 30% faster for critical
    } else if (urgency === 'urgent') {
      baseTime *= 0.85 // 15% faster for urgent
    }

    return Math.round(baseTime)
  }

  /**
   * Get recent activity level
   */
  private getRecentActivity(donor: Donor, historicalData: HistoricalData[]): number {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentResponses = historicalData
      .flatMap(req => req.donor_responses)
      .filter(resp => 
        resp.donor_id === donor.id && 
        new Date(resp.created_at) > thirtyDaysAgo
      )

    return recentResponses.length / 30 // Normalize to daily average
  }

  /**
   * Identify contributing factors for the match
   */
  private identifyFactors(donor: Donor, mlFactors: { factors: Record<string, string> }, urgency: string): string[] {
    const factors: string[] = []

    if (donor.response_rate > 0.8) factors.push('High response rate')
    if (donor.success_rate > 0.9) factors.push('High success rate')
    if (donor.avg_response_time < 15) factors.push('Fast responder')
    if (urgency === 'critical') factors.push('Critical urgency')
    if (mlFactors.factors.timePattern) factors.push(mlFactors.factors.timePattern)
    if (mlFactors.factors.locationPattern) factors.push(mlFactors.factors.locationPattern)
    if (mlFactors.factors.successPattern) factors.push(mlFactors.factors.successPattern)
    if (mlFactors.factors.urgencyMatch) factors.push(mlFactors.factors.urgencyMatch)
    if (mlFactors.factors.trustScore) factors.push(mlFactors.factors.trustScore)

    return factors
  }

  private async calculateTrustScore(donorId: string): Promise<number> {
    const { data: user } = await this.supabase
      .from('users')
      .select('created_at, verification_level, total_donations')
      .eq('id', donorId)
      .single();

    if (!user) {
      return 0;
    }

    let score = 0;

    // Account age
    const accountAgeDays = (new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 3600 * 24);
    score += Math.min(20, accountAgeDays / 30); // Max 20 points for account age

    // Verification level
    const verificationScores = {
      unverified: 0,
      basic: 10,
      enhanced: 20,
      premium: 30,
    };
    score += verificationScores[user.verification_level] || 0;

    // Total donations
    score += Math.min(50, user.total_donations * 2); // Max 50 points for donations

    return Math.min(100, score);
  }

  /**
   * Update donor profile with ML insights
   */
  async updateDonorProfile(donorId: string): Promise<void> {
    try {
      const historicalData = await this.getHistoricalData()
      const donorResponses = historicalData
        .flatMap(req => req.donor_responses)
        .filter(resp => resp.donor_id === donorId)

      if (donorResponses.length === 0) return

      // Calculate metrics
      const responseRate = donorResponses.length / historicalData.length
      const avgResponseTime = this.calculateAverageResponseTime(donorResponses)
      const successRate = this.calculateSuccessRate(donorResponses)

      // Update donor profile
      await this.supabase
        .from('users')
        .update({
          response_rate: responseRate,
          avg_response_time: avgResponseTime,
          success_rate: successRate
        })
        .eq('id', donorId)

    } catch (error: any) {
      console.error('Error updating donor profile:', error)
    }
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(responses: HistoricalData['donor_responses']): number {
    const responseTimes = responses
      .map(resp => {
        const requestTime = new Date(resp.created_at).getTime()
        const responseTime = new Date(resp.updated_at || resp.created_at).getTime()
        return (responseTime - requestTime) / (1000 * 60) // Convert to minutes
      })
      .filter(time => time > 0)

    if (responseTimes.length === 0) return 30

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(responses: HistoricalData['donor_responses']): number {
    const successful = responses.filter(resp => resp.response_type === 'accept').length
    return successful / responses.length
  }

  /**
   * Store ML prediction for evaluation
   */
  private async storePrediction(mlPrediction: any, donorId: string, requestId: string): Promise<void> {
    if (!mlPrediction) return

    try {
      await this.supabase
        .from('ml_predictions')
        .insert([{
          model_type: 'donor_matching',
          model_version: 1,
          donor_id: donorId,
          request_id: requestId,
          prediction_value: mlPrediction.prediction,
          confidence: mlPrediction.confidence,
          features: mlPrediction.importance,
          explanation: mlPrediction.explanation
        }])
    } catch (error) {
      console.error('Error storing ML prediction:', error)
    }
  }

  /**
   * Train ML models with latest data
   */
  async trainModels(): Promise<{ success: boolean; accuracy: Record<string, number> }> {
    try {
      console.log('🎓 Training ML models...')
      const result = await mlEngine.trainModels()
      console.log('✅ ML model training completed:', result.accuracy)
      return result
    } catch (error) {
      console.error('❌ ML model training failed:', error)
      return { success: false, accuracy: {} }
    }
  }

  /**
   * Get ML model performance metrics
   */
  getModelMetrics(): Record<string, any> {
    return mlEngine.getModelMetrics()
  }

  /**
   * Update all donor profiles with latest ML insights (memory optimized)
   */
  async updateAllDonorProfiles(): Promise<void> {
    try {
      const { data: donors } = await this.supabase
        .from('users')
        .select('id')
        .not('blood_type', 'is', null)
        .limit(1000) // Limit to prevent memory overflow

      console.log(`🔄 Updating ${donors?.length || 0} donor profiles...`)

      // Process in smaller batches to manage memory
      const batchSize = 20
      for (let i = 0; i < (donors?.length || 0); i += batchSize) {
        const batch = donors?.slice(i, i + batchSize) || []
        
        // Process batch in parallel with controlled concurrency
        await Promise.allSettled(
          batch.map(donor => this.updateDonorProfile(donor.id))
        )
        
        console.log(`✅ Updated ${Math.min(i + batchSize, donors?.length || 0)} / ${donors?.length || 0} profiles`)
        
        // Allow garbage collection between batches
        if (i % 100 === 0 && global.gc) {
          global.gc()
        }
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log('✅ All donor profiles updated')
    } catch (error) {
      console.error('❌ Error updating donor profiles:', error)
    }
  }

  /**
   * Analyze matching performance and suggest improvements
   */
  async analyzeMatchingPerformance(): Promise<{
    totalPredictions: number
    averageAccuracy: number
    modelPerformance: Record<string, number>
    recommendations: string[]
  }> {
    try {
      const { data: predictions } = await this.supabase
        .from('ml_predictions')
        .select('*')
        .not('actual_outcome', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000)

      const totalPredictions = predictions?.length || 0
      const correctPredictions = predictions?.filter(p => p.prediction_accuracy === 1.0).length || 0
      const averageAccuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0

      const modelPerformance = mlEngine.getModelMetrics()
      
      const recommendations: string[] = []
      
      if (averageAccuracy < 0.7) {
        recommendations.push('Model accuracy is below 70%. Consider retraining with more data.')
      }
      
      if (totalPredictions < 100) {
        recommendations.push('Limited prediction history. Collect more data for better insights.')
      }

      return {
        totalPredictions,
        averageAccuracy,
        modelPerformance,
        recommendations
      }

    } catch (error) {
      console.error('Error analyzing matching performance:', error)
      return {
        totalPredictions: 0,
        averageAccuracy: 0,
        modelPerformance: {},
        recommendations: ['Error analyzing performance. Check system logs.']
      }
    }
  }

  /**
   * Memory management and cleanup
   */
  cleanup(): void {
    console.log('🧹 Cleaning up AI matching service...')
    
    // Clear caches
    this.cache.clear()
    
    // Cancel active requests (if possible)
    this.activeRequests.clear()
    
    // Force garbage collection
    if (global.gc) {
      global.gc()
    }
    
    console.log('✅ AI matching service cleanup completed')
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    cacheSize: number
    activeRequests: number
    memoryUsage: NodeJS.MemoryUsage
  } {
    return {
      cacheSize: this.cache.size,
      activeRequests: this.activeRequests.size,
      memoryUsage: process.memoryUsage()
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    issues: string[]
    metrics: any
  }> {
    const issues: string[] = []
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    const memoryStats = this.getMemoryStats()
    const memoryUsageMB = memoryStats.memoryUsage.heapUsed / 1024 / 1024
    
    // Check memory usage - lowered thresholds for better performance
    if (memoryUsageMB > 150) {
      issues.push(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`)
      status = 'unhealthy'
      // Auto-cleanup when memory is high
      this.cleanup()
    } else if (memoryUsageMB > 75) {
      issues.push(`Elevated memory usage: ${memoryUsageMB.toFixed(2)}MB`)
      status = 'degraded'
      // Cleanup cache when memory is elevated
      this.cleanupCache()
    }
    
    // Check active requests
    if (memoryStats.activeRequests >= this.maxConcurrentRequests) {
      issues.push(`Maximum concurrent requests reached: ${memoryStats.activeRequests}`)
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded'
    }
    
    // Check cache size
    if (memoryStats.cacheSize > 100) {
      issues.push(`Large cache size: ${memoryStats.cacheSize} items`)
      if (status === 'healthy') status = 'degraded'
    }
    
    return {
      status,
      issues,
      metrics: memoryStats
    }
  }
}

// Export singleton instance
export const aiMatchingService = new AIMatchingService()

// Auto-cleanup every 5 minutes for better memory management
setInterval(() => {
  aiMatchingService.cleanupCache()
}, 5 * 60 * 1000)

// Additional memory monitoring every minute
setInterval(() => {
  const memoryUsage = process.memoryUsage()
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024
  
  if (memoryUsageMB > 100) {
    console.warn(`⚠️ High memory usage detected: ${memoryUsageMB.toFixed(2)}MB`)
    aiMatchingService.cleanup()
  }
}, 60 * 1000)

// Cleanup on process exit
process.on('beforeExit', () => {
  aiMatchingService.cleanup()
}) 