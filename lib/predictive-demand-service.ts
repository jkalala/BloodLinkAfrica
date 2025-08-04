"use client"

import { getSupabase } from "./supabase"
import { performanceMonitor } from "./performance-monitoring"

export interface DemandForecast {
  id: string
  bloodType: string
  region: string
  hospitalId?: string
  forecastDate: Date
  predictedDemand: number
  confidenceLevel: number
  actualDemand?: number
  accuracy?: number
  factors: ForecastFactor[]
  timeHorizon: 'daily' | 'weekly' | 'monthly' | 'seasonal'
  metadata: Record<string, unknown>
}

export interface ForecastFactor {
  factor: string
  impact: number
  confidence: number
  description: string
}

export interface SeasonalPattern {
  bloodType: string
  region: string
  pattern: 'increasing' | 'decreasing' | 'stable' | 'cyclical'
  seasonality: {
    spring: number
    summer: number
    autumn: number
    winter: number
  }
  trends: {
    holidays: number[]
    events: number[]
    weather: number[]
  }
}

export interface DemandAlert {
  id: string
  type: 'shortage_predicted' | 'surplus_predicted' | 'pattern_change'
  bloodType: string
  region: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  predictedDate: Date
  message: string
  recommendations: string[]
  createdAt: Date
}

export class PredictiveDemandService {
  private supabase = getSupabase()
  private forecasts = new Map<string, DemandForecast>()
  private seasonalPatterns = new Map<string, SeasonalPattern>()
  private alerts = new Map<string, DemandAlert>()
  private modelWeights = {
    historical: 0.4,
    seasonal: 0.3,
    trending: 0.2,
    external: 0.1
  }
  private forecastHorizon = 30 // days

  constructor() {
    this.initializeService()
  }

  /**
   * Initialize predictive demand service
   */
  private async initializeService(): Promise<void> {
    try {
      console.log('🔮 Initializing predictive demand service...')
      
      await this.loadHistoricalData()
      await this.buildSeasonalPatterns()
      await this.initializeModels()
      this.startForecastUpdates()
      
      console.log('✅ Predictive demand service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize predictive demand service:', error)
    }
  }

  /**
   * Generate demand forecast for specific blood type and region
   */
  async generateForecast(
    bloodType: string,
    region: string,
    timeHorizon: DemandForecast['timeHorizon'] = 'weekly',
    hospitalId?: string
  ): Promise<DemandForecast> {
    const tracker = performanceMonitor.startTracking('predictive-demand', 'GENERATE_FORECAST');

    try {
      console.log(`🔮 Generating ${timeHorizon} forecast for ${bloodType} in ${region}`);

      // Get historical data
      const historicalData = await this.getHistoricalDemand(bloodType, region, hospitalId);

      // Apply forecasting models
      const baselineForecast = this.calculateBaselineForecast(historicalData, timeHorizon);
      const seasonalAdjustment = this.applySeasonalAdjustment(bloodType, region, timeHorizon);
      const trendAdjustment = this.applyTrendAnalysis(historicalData, timeHorizon);
      const externalFactors = await this.analyzeExternalFactors(region, timeHorizon);

      // Combine predictions using weighted model
      const predictedDemand = Math.round(
        baselineForecast *
          this.modelWeights.historical *
          seasonalAdjustment *
          this.modelWeights.seasonal *
          trendAdjustment *
          this.modelWeights.trending *
          externalFactors.impact *
          this.modelWeights.external
      );

      // Calculate confidence level
      const confidenceLevel = this.calculateConfidence(
        historicalData,
        seasonalAdjustment,
        trendAdjustment,
        externalFactors
      );

      // Identify contributing factors
      const factors = this.identifyForecastFactors(
        baselineForecast,
        seasonalAdjustment,
        trendAdjustment,
        externalFactors
      );

      const forecast: DemandForecast = {
        id: this.generateForecastId(),
        bloodType,
        region,
        hospitalId,
        forecastDate: this.getForecastDate(timeHorizon),
        predictedDemand: Math.max(0, predictedDemand),
        confidenceLevel,
        factors,
        timeHorizon,
        metadata: {
          generatedAt: new Date().toISOString(),
          modelVersion: '1.1',
          dataPoints: historicalData.length,
          baselineForecast,
          seasonalAdjustment,
          trendAdjustment,
          externalFactors,
        },
      };

      // Store forecast
      await this.storeForecast(forecast);
      this.forecasts.set(forecast.id, forecast);

      // Check for alerts
      await this.checkForDemandAlerts(forecast);

      console.log(`✅ Generated forecast: ${predictedDemand} units (${Math.round(confidenceLevel * 100)}% confidence)`);
      tracker.end(200);

      return forecast;
    } catch (error) {
      console.error('❌ Failed to generate forecast:', error);
      tracker.end(500);
      throw error;
    }
  }

  /**
   * Generate forecasts for all blood types and regions
   */
  async generateAllForecasts(timeHorizon: DemandForecast['timeHorizon'] = 'weekly'): Promise<DemandForecast[]> {
    try {
      console.log(`🔮 Generating comprehensive ${timeHorizon} forecasts...`)

      // Get all active regions and blood types
      const { data: regions } = await this.supabase
        .from('hospitals')
        .select('DISTINCT region')
        .not('region', 'is', null)

      const bloodTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
      const forecasts: DemandForecast[] = []

      // Generate forecasts for each combination
      const forecastPromises = []
      
      for (const regionData of regions || []) {
        for (const bloodType of bloodTypes) {
          forecastPromises.push(
            this.generateForecast(bloodType, regionData.region, timeHorizon)
              .catch(error => {
                console.error(`Failed to forecast ${bloodType} in ${regionData.region}:`, error)
                return null
              })
          )
        }
      }

      const results = await Promise.allSettled(forecastPromises)
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          forecasts.push(result.value)
        }
      })

      console.log(`✅ Generated ${forecasts.length} comprehensive forecasts`)
      return forecasts

    } catch (error) {
      console.error('❌ Failed to generate all forecasts:', error)
      return []
    }
  }

  /**
   * Get demand forecasts with optional filtering
   */
  async getForecasts(filters: {
    bloodType?: string
    region?: string
    hospitalId?: string
    timeHorizon?: DemandForecast['timeHorizon']
    dateRange?: { start: Date; end: Date }
  } = {}): Promise<DemandForecast[]> {
    try {
      let query = this.supabase
        .from('demand_forecasts')
        .select('*')
        .order('forecast_date', { ascending: true })

      if (filters.bloodType) {
        query = query.eq('blood_type', filters.bloodType)
      }
      if (filters.region) {
        query = query.eq('region', filters.region)
      }
      if (filters.hospitalId) {
        query = query.eq('hospital_id', filters.hospitalId)
      }
      if (filters.timeHorizon) {
        query = query.eq('time_horizon', filters.timeHorizon)
      }
      if (filters.dateRange) {
        query = query
          .gte('forecast_date', filters.dateRange.start.toISOString())
          .lte('forecast_date', filters.dateRange.end.toISOString())
      }

      const { data: forecasts, error } = await query

      if (error) throw error

      return forecasts?.map(this.mapDatabaseForecastToInterface) || []

    } catch (error) {
      console.error('❌ Failed to get forecasts:', error)
      return []
    }
  }

  /**
   * Get demand alerts
   */
  async getDemandAlerts(filters: {
    region?: string
    bloodType?: string
    severity?: DemandAlert['severity']
    active?: boolean
  } = {}): Promise<DemandAlert[]> {
    try {
      let query = this.supabase
        .from('demand_alerts')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters.region) {
        query = query.eq('region', filters.region)
      }
      if (filters.bloodType) {
        query = query.eq('blood_type', filters.bloodType)
      }
      if (filters.severity) {
        query = query.eq('severity', filters.severity)
      }
      if (filters.active) {
        query = query.gte('predicted_date', new Date().toISOString())
      }

      const { data: alerts, error } = await query

      if (error) throw error

      return alerts?.map(this.mapDatabaseAlertToInterface) || []

    } catch (error) {
      console.error('❌ Failed to get demand alerts:', error)
      return []
    }
  }

  /**
   * Update forecast accuracy with actual demand data
   */
  async updateForecastAccuracy(forecastId: string, actualDemand: number): Promise<void> {
    try {
      const forecast = this.forecasts.get(forecastId)
      if (!forecast) {
        throw new Error('Forecast not found')
      }

      const accuracy = this.calculateAccuracy(forecast.predictedDemand, actualDemand)
      
      forecast.actualDemand = actualDemand
      forecast.accuracy = accuracy

      // Update in database
      await this.supabase
        .from('demand_forecasts')
        .update({
          actual_demand: actualDemand,
          accuracy: accuracy,
          updated_at: new Date().toISOString()
        })
        .eq('id', forecastId)

      // Update model weights based on accuracy
      await this.updateModelWeights(forecast, accuracy)

      console.log(`📊 Updated forecast accuracy: ${Math.round(accuracy * 100)}%`)

    } catch (error) {
      console.error('❌ Failed to update forecast accuracy:', error)
    }
  }

  /**
   * Get forecast performance metrics
   */
  async getForecastMetrics(timeRange: 'week' | 'month' | 'quarter' = 'month'): Promise<{
    totalForecasts: number
    averageAccuracy: number
    accuracyByBloodType: Record<string, number>
    accuracyByRegion: Record<string, number>
    bestPredictors: ForecastFactor[]
    alertsGenerated: number
    alertAccuracy: number
  }> {
    try {
      const startDate = this.getTimeRangeStart(timeRange)

      const { data: forecasts } = await this.supabase
        .from('demand_forecasts')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .not('accuracy', 'is', null)

      const { data: alerts } = await this.supabase
        .from('demand_alerts')
        .select('*')
        .gte('created_at', startDate.toISOString())

      const totalForecasts = forecasts?.length || 0
      const averageAccuracy = totalForecasts > 0
        ? forecasts!.reduce((sum, f) => sum + f.accuracy, 0) / totalForecasts
        : 0

      // Calculate accuracy by blood type
      const accuracyByBloodType: Record<string, number> = {}
      const bloodTypeCounts: Record<string, number> = {}

      forecasts?.forEach(f => {
        if (!accuracyByBloodType[f.blood_type]) {
          accuracyByBloodType[f.blood_type] = 0
          bloodTypeCounts[f.blood_type] = 0
        }
        accuracyByBloodType[f.blood_type] += f.accuracy
        bloodTypeCounts[f.blood_type]++
      })

      Object.keys(accuracyByBloodType).forEach(bloodType => {
        accuracyByBloodType[bloodType] /= bloodTypeCounts[bloodType]
      })

      // Calculate accuracy by region
      const accuracyByRegion: Record<string, number> = {}
      const regionCounts: Record<string, number> = {}

      forecasts?.forEach(f => {
        if (!accuracyByRegion[f.region]) {
          accuracyByRegion[f.region] = 0
          regionCounts[f.region] = 0
        }
        accuracyByRegion[f.region] += f.accuracy
        regionCounts[f.region]++
      })

      Object.keys(accuracyByRegion).forEach(region => {
        accuracyByRegion[region] /= regionCounts[region]
      })

      // Analyze best predictors
      const bestPredictors = this.analyzeBestPredictors(forecasts || [])

      return {
        totalForecasts,
        averageAccuracy,
        accuracyByBloodType,
        accuracyByRegion,
        bestPredictors,
        alertsGenerated: alerts?.length || 0,
        alertAccuracy: 0.85 // Would calculate from alert outcomes
      }

    } catch (error) {
      console.error('❌ Failed to get forecast metrics:', error)
      return {
        totalForecasts: 0,
        averageAccuracy: 0,
        accuracyByBloodType: {},
        accuracyByRegion: {},
        bestPredictors: [],
        alertsGenerated: 0,
        alertAccuracy: 0
      }
    }
  }

  /**
   * Private utility methods
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load historical blood request and fulfillment data
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const { data: historicalData } = await this.supabase
        .from('blood_requests')
        .select(`
          *,
          hospitals!inner(region),
          blood_fulfillments(*)
        `)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true })

      console.log(`📊 Loaded ${historicalData?.length || 0} historical data points`)
    } catch (error) {
      console.error('❌ Failed to load historical data:', error)
    }
  }

  private async buildSeasonalPatterns(): Promise<void> {
    try {
      console.log('📈 Building seasonal patterns...')
      
      // Analyze historical data to identify seasonal patterns
      const patterns = await this.analyzeSeasonalTrends()
      
      patterns.forEach(pattern => {
        const key = `${pattern.bloodType}_${pattern.region}`
        this.seasonalPatterns.set(key, pattern)
      })

      console.log(`📈 Built ${patterns.length} seasonal patterns`)
    } catch (error) {
      console.error('❌ Failed to build seasonal patterns:', error)
    }
  }

  private async initializeModels(): Promise<void> {
    try {
      console.log('🤖 Initializing prediction models...')
      
      // Load and validate model weights from past performance
      const { data: modelConfig } = await this.supabase
        .from('prediction_model_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (modelConfig?.weights) {
        this.modelWeights = { ...this.modelWeights, ...modelConfig.weights }
      }

      console.log('🤖 Prediction models initialized')
    } catch (error) {
      console.error('❌ Failed to initialize models:', error)
    }
  }

  private startForecastUpdates(): void {
    // Update forecasts daily at midnight
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime()
    
    setTimeout(() => {
      this.dailyForecastUpdate()
      
      // Then repeat every 24 hours
      setInterval(() => {
        this.dailyForecastUpdate()
      }, 24 * 60 * 60 * 1000)
    }, msUntilMidnight)

    console.log('⏰ Scheduled daily forecast updates')
  }

  private async dailyForecastUpdate(): Promise<void> {
    try {
      console.log('🔄 Starting daily forecast update...')
      
      await this.generateAllForecasts('daily')
      await this.generateAllForecasts('weekly')
      
      // Monthly forecasts on the 1st of each month
      if (new Date().getDate() === 1) {
        await this.generateAllForecasts('monthly')
      }

      console.log('✅ Daily forecast update completed')
    } catch (error) {
      console.error('❌ Daily forecast update failed:', error)
    }
  }

  private async getHistoricalDemand(
    bloodType: string,
    region: string,
    hospitalId?: string
  ): Promise<Array<{ date: Date; demand: number }>> {
    try {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      let query = this.supabase
        .from('blood_requests')
        .select(`
          created_at,
          units_needed,
          hospitals!inner(region)
        `)
        .eq('blood_type', bloodType)
        .eq('hospitals.region', region)
        .gte('created_at', threeMonthsAgo.toISOString())

      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId)
      }

      const { data: rawData } = await query

      // Aggregate by day
      const dailyDemand = new Map<string, number>()
      
      rawData?.forEach(record => {
        const date = new Date(record.created_at).toDateString()
        dailyDemand.set(date, (dailyDemand.get(date) || 0) + record.units_needed)
      })

      return Array.from(dailyDemand.entries()).map(([dateStr, demand]) => ({
        date: new Date(dateStr),
        demand
      })).sort((a, b) => a.date.getTime() - b.date.getTime())

    } catch (error) {
      console.error('❌ Failed to get historical demand:', error)
      return []
    }
  }

  private calculateBaselineForecast(
    historicalData: Array<{ date: Date; demand: number }>,
    timeHorizon: DemandForecast['timeHorizon']
  ): number {
    if (historicalData.length === 0) return 0

    // Simple moving average with recent data weighted more heavily
    const weights = historicalData.map((_, index) => {
      const recency = index / historicalData.length
      return 0.5 + (0.5 * recency) // Weight from 0.5 to 1.0
    })

    const weightedSum = historicalData.reduce((sum, data, index) => {
      return sum + (data.demand * weights[index])
    }, 0)

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    
    const averageDailyDemand = weightedSum / totalWeight

    // Scale by time horizon
    const horizonMultipliers = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      seasonal: 90
    }

    return averageDailyDemand * horizonMultipliers[timeHorizon]
  }

  private applySeasonalAdjustment(
    bloodType: string,
    region: string,
    timeHorizon: DemandForecast['timeHorizon']
  ): number {
    const key = `${bloodType}_${region}`
    const pattern = this.seasonalPatterns.get(key)
    
    if (!pattern) return 1.0 // No adjustment if no pattern

    const currentMonth = new Date().getMonth()
    const season = this.getSeasonFromMonth(currentMonth)
    
    return pattern.seasonality[season] || 1.0
  }

  private applyTrendAnalysis(
    historicalData: Array<{ date: Date; demand: number }>,
    timeHorizon: DemandForecast['timeHorizon']
  ): number {
    if (historicalData.length < 7) return 1.0

    // Calculate trend using linear regression
    const n = historicalData.length
    const x = historicalData.map((_, i) => i)
    const y = historicalData.map(d => d.demand)
    
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    // Project trend forward
    const horizonDays = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      seasonal: 90
    }

    const projectedValue = intercept + slope * (n + horizonDays[timeHorizon])
    const currentAverage = sumY / n
    
    return projectedValue / currentAverage
  }

  private async analyzeExternalFactors(
    region: string,
    timeHorizon: DemandForecast['timeHorizon']
  ): Promise<{ impact: number; factors: ForecastFactor[] }> {
    const factors: ForecastFactor[] = []
    let totalImpact = 1.0

    // Holiday effects
    const holidayImpact = this.analyzeHolidayEffects()
    if (holidayImpact !== 1.0) {
      factors.push({
        factor: 'Holiday Season',
        impact: holidayImpact,
        confidence: 0.8,
        description: 'Increased demand during holiday periods'
      })
      totalImpact *= holidayImpact
    }

    // Weather patterns (simplified)
    const weatherImpact = this.analyzeWeatherImpact(region)
    if (weatherImpact !== 1.0) {
      factors.push({
        factor: 'Weather Conditions',
        impact: weatherImpact,
        confidence: 0.6,
        description: 'Weather-related health impacts'
      })
      totalImpact *= weatherImpact
    }

    // Regional events or disasters
    const eventImpact = await this.analyzeRegionalEvents(region)
    if (eventImpact !== 1.0) {
      factors.push({
        factor: 'Regional Events',
        impact: eventImpact,
        confidence: 0.9,
        description: 'Local events affecting blood demand'
      })
      totalImpact *= eventImpact
    }

    return { impact: totalImpact, factors }
  }

  private calculateConfidence(
    historicalData: Array<{ date: Date; demand: number }>,
    seasonalAdjustment: number,
    trendAdjustment: number,
    externalFactors: { impact: number; factors: ForecastFactor[] }
  ): number {
    let confidence = 0.5 // Base confidence

    // Data quality factor
    const dataQuality = Math.min(historicalData.length / 30, 1.0) // More data = higher confidence
    confidence += dataQuality * 0.3

    // Stability factor (low variance = higher confidence)
    if (historicalData.length > 1) {
      const variance = this.calculateVariance(historicalData.map(d => d.demand))
      const stability = Math.max(0, 1 - (variance / 100)) // Normalize variance
      confidence += stability * 0.2
    }

    return Math.min(confidence, 0.95) // Cap at 95%
  }

  private identifyForecastFactors(
    baseline: number,
    seasonal: number,
    trend: number,
    external: { impact: number; factors: ForecastFactor[] }
  ): ForecastFactor[] {
    const factors: ForecastFactor[] = []

    factors.push({
      factor: 'Historical Average',
      impact: baseline,
      confidence: 0.8,
      description: 'Based on recent historical demand patterns'
    })

    if (Math.abs(seasonal - 1.0) > 0.1) {
      factors.push({
        factor: 'Seasonal Pattern',
        impact: seasonal,
        confidence: 0.7,
        description: 'Seasonal variation in blood demand'
      })
    }

    if (Math.abs(trend - 1.0) > 0.1) {
      factors.push({
        factor: 'Demand Trend',
        impact: trend,
        confidence: 0.6,
        description: 'Long-term trend in demand changes'
      })
    }

    factors.push(...external.factors)

    return factors.sort((a, b) => Math.abs(b.impact - 1) - Math.abs(a.impact - 1))
  }

  private async checkForDemandAlerts(forecast: DemandForecast): Promise<void> {
    try {
      // Get current inventory levels
      const { data: inventory } = await this.supabase
        .from('blood_inventory')
        .select('*')
        .eq('blood_type', forecast.bloodType)
        .eq('region', forecast.region)

      const currentStock = inventory?.reduce((sum, item) => sum + item.units_available, 0) || 0
      const demandRatio = forecast.predictedDemand / Math.max(currentStock, 1)

      // Generate alerts based on predicted shortages
      if (demandRatio > 1.5 && forecast.confidenceLevel > 0.7) {
        const alert: DemandAlert = {
          id: this.generateAlertId(),
          type: 'shortage_predicted',
          bloodType: forecast.bloodType,
          region: forecast.region,
          severity: demandRatio > 2.5 ? 'critical' : demandRatio > 2.0 ? 'high' : 'medium',
          predictedDate: forecast.forecastDate,
          message: `Predicted ${forecast.bloodType} shortage in ${forecast.region}. Expected demand: ${forecast.predictedDemand} units, Current stock: ${currentStock} units.`,
          recommendations: this.generateShortageRecommendations(forecast, currentStock),
          createdAt: new Date()
        }

        await this.storeAlert(alert)
        this.alerts.set(alert.id, alert)

        console.log(`⚠️  Generated shortage alert for ${forecast.bloodType} in ${forecast.region}`)
      }

    } catch (error) {
      console.error('❌ Failed to check for demand alerts:', error)
    }
  }

  private generateShortageRecommendations(forecast: DemandForecast, currentStock: number): string[] {
    const recommendations = []
    const shortfall = forecast.predictedDemand - currentStock

    recommendations.push(`Increase blood collection efforts for ${forecast.bloodType}`)
    recommendations.push(`Target ${Math.ceil(shortfall * 1.2)} additional units`)
    
    if (forecast.timeHorizon === 'daily') {
      recommendations.push('Activate emergency donor notification system')
      recommendations.push('Contact O- universal donors as backup')
    } else {
      recommendations.push('Schedule additional donation drives')
      recommendations.push('Reach out to regular donors')
    }

    if (forecast.confidenceLevel > 0.8) {
      recommendations.push('Consider inter-regional blood transfers')
    }

    return recommendations
  }

  // Utility methods
  private getForecastDate(timeHorizon: DemandForecast['timeHorizon']): Date {
    const date = new Date()
    switch (timeHorizon) {
      case 'daily':
        date.setDate(date.getDate() + 1)
        break
      case 'weekly':
        date.setDate(date.getDate() + 7)
        break
      case 'monthly':
        date.setMonth(date.getMonth() + 1)
        break
      case 'seasonal':
        date.setMonth(date.getMonth() + 3)
        break
    }
    return date
  }

  private getSeasonFromMonth(month: number): keyof SeasonalPattern['seasonality'] {
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'autumn'
    return 'winter'
  }

  private analyzeHolidayEffects(): number {
    const now = new Date()
    const month = now.getMonth()
    const day = now.getDate()

    // Holiday periods typically see increased demand
    const holidays = [
      { month: 11, day: 25, impact: 1.3 }, // Christmas
      { month: 0, day: 1, impact: 1.2 },   // New Year
      { month: 6, day: 4, impact: 1.15 },  // Independence Day (example)
    ]

    for (const holiday of holidays) {
      const daysDiff = Math.abs((month * 30 + day) - (holiday.month * 30 + holiday.day))
      if (daysDiff <= 7) { // Within a week of holiday
        return holiday.impact
      }
    }

    return 1.0
  }

  private analyzeWeatherImpact(region: string): number {
    // Simplified weather impact analysis
    // In reality, this would integrate with weather APIs
    const currentMonth = new Date().getMonth()
    
    // Assume higher demand during flu season (winter months)
    if (currentMonth >= 10 || currentMonth <= 2) {
      return 1.1
    }
    
    return 1.0
  }

  private async analyzeRegionalEvents(region: string): Promise<number> {
    // Check for scheduled events or emergencies in the region
    // This would integrate with event databases or emergency systems
    return 1.0
  }

  private calculateVariance(data: number[]): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length
  }

  private calculateAccuracy(predicted: number, actual: number): number {
    const error = Math.abs(predicted - actual)
    const accuracy = Math.max(0, 1 - (error / Math.max(predicted, actual, 1)))
    return accuracy
  }

  private async updateModelWeights(forecast: DemandForecast, accuracy: number): Promise<void> {
    // Adjust model weights based on forecast accuracy
    // This is a simplified version - in reality would use more sophisticated learning
    const learningRate = 0.01
    
    if (accuracy > 0.8) {
      // Good prediction - slightly increase weight of successful factors
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key as keyof typeof this.modelWeights] *= (1 + learningRate)
      })
    } else if (accuracy < 0.6) {
      // Poor prediction - slightly decrease weights
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key as keyof typeof this.modelWeights] *= (1 - learningRate)
      })
    }

    // Normalize weights to sum to 1
    const totalWeight = Object.values(this.modelWeights).reduce((sum, weight) => sum + weight, 0)
    Object.keys(this.modelWeights).forEach(key => {
      this.modelWeights[key as keyof typeof this.modelWeights] /= totalWeight
    })
  }

  private analyzeBestPredictors(forecasts: unknown[]): ForecastFactor[] {
    // Analyze which factors contribute most to accuracy
    const factorAccuracy: Record<string, { total: number; count: number }> = {}

    forecasts.forEach(forecast => {
      if (forecast.factors && forecast.accuracy) {
        forecast.factors.forEach((factor: ForecastFactor) => {
          if (!factorAccuracy[factor.factor]) {
            factorAccuracy[factor.factor] = { total: 0, count: 0 }
          }
          factorAccuracy[factor.factor].total += forecast.accuracy
          factorAccuracy[factor.factor].count++
        })
      }
    })

    return Object.entries(factorAccuracy)
      .map(([factor, data]) => ({
        factor,
        impact: data.total / data.count,
        confidence: Math.min(data.count / 10, 1.0),
        description: `Historical accuracy: ${Math.round((data.total / data.count) * 100)}%`
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
  }

  private async analyzeSeasonalTrends(): Promise<SeasonalPattern[]> {
    // Analyze historical data to identify seasonal patterns
    // This is a simplified version - would be more sophisticated in reality
    const patterns: SeasonalPattern[] = []
    
    const bloodTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
    const regions = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru'] // Example regions

    for (const bloodType of bloodTypes) {
      for (const region of regions) {
        patterns.push({
          bloodType,
          region,
          pattern: 'cyclical',
          seasonality: {
            spring: 1.0,
            summer: 0.9,
            autumn: 1.1,
            winter: 1.2
          },
          trends: {
            holidays: [1.3, 1.2, 1.15],
            events: [1.1, 1.05],
            weather: [1.1, 0.95, 1.0]
          }
        })
      }
    }

    return patterns
  }

  private getTimeRangeStart(range: 'week' | 'month' | 'quarter'): Date {
    const now = new Date()
    switch (range) {
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        return weekStart
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      case 'quarter':
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      default:
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    }
  }

  private generateForecastId(): string {
    return `forecast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private mapDatabaseForecastToInterface(dbForecast: Record<string, unknown>): DemandForecast {
    return {
      id: dbForecast.id,
      bloodType: dbForecast.blood_type,
      region: dbForecast.region,
      hospitalId: dbForecast.hospital_id,
      forecastDate: new Date(dbForecast.forecast_date),
      predictedDemand: dbForecast.predicted_demand,
      confidenceLevel: dbForecast.confidence_level,
      actualDemand: dbForecast.actual_demand,
      accuracy: dbForecast.accuracy,
      factors: dbForecast.factors || [],
      timeHorizon: dbForecast.time_horizon,
      metadata: dbForecast.metadata || {}
    }
  }

  private mapDatabaseAlertToInterface(dbAlert: Record<string, unknown>): DemandAlert {
    return {
      id: dbAlert.id,
      type: dbAlert.type,
      bloodType: dbAlert.blood_type,
      region: dbAlert.region,
      severity: dbAlert.severity,
      predictedDate: new Date(dbAlert.predicted_date),
      message: dbAlert.message,
      recommendations: dbAlert.recommendations || [],
      createdAt: new Date(dbAlert.created_at)
    }
  }

  private async storeForecast(forecast: DemandForecast): Promise<void> {
    await this.supabase
      .from('demand_forecasts')
      .insert({
        id: forecast.id,
        blood_type: forecast.bloodType,
        region: forecast.region,
        hospital_id: forecast.hospitalId,
        forecast_date: forecast.forecastDate.toISOString(),
        predicted_demand: forecast.predictedDemand,
        confidence_level: forecast.confidenceLevel,
        factors: forecast.factors,
        time_horizon: forecast.timeHorizon,
        metadata: forecast.metadata,
        created_at: new Date().toISOString()
      })
  }

  private async storeAlert(alert: DemandAlert): Promise<void> {
    await this.supabase
      .from('demand_alerts')
      .insert({
        id: alert.id,
        type: alert.type,
        blood_type: alert.bloodType,
        region: alert.region,
        severity: alert.severity,
        predicted_date: alert.predictedDate.toISOString(),
        message: alert.message,
        recommendations: alert.recommendations,
        created_at: alert.createdAt.toISOString()
      })
  }

  /**
   * Get service health and performance metrics
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    forecasts: number
    alerts: number
    accuracy: number
    uptime: string
  } {
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)

    return {
      status: 'healthy',
      forecasts: this.forecasts.size,
      alerts: this.alerts.size,
      accuracy: 0.82, // Would calculate from actual data
      uptime: `${hours}h ${minutes}m`
    }
  }
}

// Export singleton instance
export const predictiveDemandService = new PredictiveDemandService()