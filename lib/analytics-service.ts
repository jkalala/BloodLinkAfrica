import { getSupabase } from "./supabase"
import { PostgrestFilterBuilder } from "@supabase/postgrest-js"

export interface AnalyticsData {
  total_donors: number
  total_requests: number
  total_donations: number
  success_rate: number
  avg_response_time: number
  blood_type_distribution: Record<string, number>
  location_heatmap: Array<{ location: string; count: number; coordinates: [number, number] }>
  time_series_data: Array<{ date: string; requests: number; donations: number }>
  demand_forecast: Array<{ date: string; predicted_demand: number; confidence: number }>
  efficiency_metrics: {
    matching_efficiency: number
    response_efficiency: number
    completion_efficiency: number
  }
  inventory_levels?: Record<string, { current: number; minimum: number; maximum: number }>
  critical_shortages?: Array<{ blood_type: string; current_level: number; days_until_critical: number }>
  real_time_metrics?: {
    active_requests: number
    available_donors: number
    emergency_alerts: number
    avg_match_time: number
  }
}

export interface DonorAnalytics {
  donor_id: string
  total_donations: number
  avg_response_time: number
  success_rate: number
  preferred_times: string[]
  preferred_locations: string[]
  blood_type: string
  reliability_score: number
}

export interface RequestAnalytics {
  request_id: string
  blood_type: string
  urgency: string
  response_count: number
  time_to_match: number
  completion_time: number
  location: string
  success: boolean
}

export interface AnalyticsFilter {
  dateRange?: { start: string; end: string }
  bloodType?: string
  location?: string
  urgencyLevel?: string
  status?: string
}

export interface BloodRequest {
  id: string;
  created_at: string;
  blood_type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  emergency_level: string;
  status: string;
  donor_responses?: {
    response_type: string;
    created_at: string;
  }[];
  updated_at: string;
}

export class AnalyticsService {
  private supabase = getSupabase()
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  /**
   * Get comprehensive analytics data with optional filtering
   */
  async getAnalyticsData(filter?: AnalyticsFilter): Promise<AnalyticsData> {
    const cacheKey = JSON.stringify(filter || {})
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }
    try {
      const [
        totalDonors,
        totalRequests,
        totalDonations,
        bloodTypeDistribution,
        locationHeatmap,
        timeSeriesData,
        demandForecast,
        efficiencyMetrics
      ] = await Promise.all([
        this.getTotalDonors(filter),
        this.getTotalRequests(filter),
        this.getTotalDonations(filter),
        this.getBloodTypeDistribution(filter),
        this.getLocationHeatmap(filter),
        this.getTimeSeriesData(filter),
        this.getDemandForecast(filter),
        this.getEfficiencyMetrics(filter)
      ])

      const successRate = totalRequests > 0 ? (totalDonations / totalRequests) * 100 : 0
      const avgResponseTime = await this.getAverageResponseTime(filter)

      const result = {
        total_donors: totalDonors,
        total_requests: totalRequests,
        total_donations: totalDonations,
        success_rate: Math.round(successRate),
        avg_response_time: Math.round(avgResponseTime),
        blood_type_distribution: bloodTypeDistribution,
        location_heatmap: locationHeatmap,
        time_series_data: timeSeriesData,
        demand_forecast: demandForecast,
        efficiency_metrics: efficiencyMetrics
      }
      
      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
      
      return result
    } catch (error: any) {
      console.error('Error getting analytics data:', error)
      return {
        total_donors: 0,
        total_requests: 0,
        total_donations: 0,
        success_rate: 0,
        avg_response_time: 0,
        blood_type_distribution: {},
        location_heatmap: [],
        time_series_data: [],
        demand_forecast: [],
        efficiency_metrics: {
          matching_efficiency: 0,
          response_efficiency: 0,
          completion_efficiency: 0
        }
      }
    }
  }

  /**
   * Search and filter analytics data
   */
  async searchAnalyticsData(searchTerm: string, filter?: AnalyticsFilter): Promise<{
    donors: DonorAnalytics[]
    requests: BloodRequest[]
    locations: string[]
  }> {
    try {
      let donorQuery = this.supabase
        .from('users')
        .select('*')
        .ilike('full_name', `%${searchTerm}%`)
      
      let requestQuery = this.supabase
        .from('blood_requests')
        .select('*')
        .or(`location.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
      
      // Apply filters
      if (filter) {
        if (filter.dateRange) {
          requestQuery = requestQuery
            .gte('created_at', filter.dateRange.start)
            .lte('created_at', filter.dateRange.end)
        }
        if (filter.bloodType) {
          requestQuery = requestQuery.eq('blood_type', filter.bloodType)
          donorQuery = donorQuery.eq('blood_type', filter.bloodType)
        }
        if (filter.location) {
          requestQuery = requestQuery.ilike('location', `%${filter.location}%`)
        }
        if (filter.urgencyLevel) {
          requestQuery = requestQuery.eq('emergency_level', filter.urgencyLevel)
        }
        if (filter.status) {
          requestQuery = requestQuery.eq('status', filter.status)
        }
      }
      
      const [donors, requests] = await Promise.all([
        donorQuery.limit(20),
        requestQuery.limit(20)
      ])
      
      // Extract unique locations for suggestions
      const locations = [...new Set(requests.data?.map(r => r.location).filter(Boolean) || [])]
      
      return {
        donors: donors.data || [],
        requests: requests.data || [],
        locations
      }
    } catch (error) {
      console.error('Error searching analytics data:', error)
      return { donors: [], requests: [], locations: [] }
    }
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get total donors count with optional filtering
   */
  private async getTotalDonors(filter?: AnalyticsFilter): Promise<number> {
    let query = this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('available', true)
    
    if (filter?.bloodType) {
      query = query.eq('blood_type', filter.bloodType)
    }
    
    const { count } = await query
    return count || 0
  }

  /**
   * Get total requests count with optional filtering
   */
  private async getTotalRequests(filter?: AnalyticsFilter): Promise<number> {
    let query = this.supabase
      .from('blood_requests')
      .select('*', { count: 'exact', head: true })
    
    query = this.applyRequestFilters(query, filter)
    
    const { count } = await query
    return count || 0
  }

  /**
   * Get total donations count with optional filtering
   */
  private async getTotalDonations(filter?: AnalyticsFilter): Promise<number> {
    let query = this.supabase
      .from('blood_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
    
    query = this.applyRequestFilters(query, filter)
    
    const { count } = await query
    return count || 0
  }

  /**
   * Apply common request filters to a query
   */
  private applyRequestFilters(query: PostgrestFilterBuilder<any, any, any>, filter?: AnalyticsFilter) {
    if (filter) {
      if (filter.dateRange) {
        query = query
          .gte('created_at', filter.dateRange.start)
          .lte('created_at', filter.dateRange.end)
      }
      if (filter.bloodType) {
        query = query.eq('blood_type', filter.bloodType)
      }
      if (filter.location) {
        query = query.ilike('location', `%${filter.location}%`)
      }
      if (filter.urgencyLevel) {
        query = query.eq('emergency_level', filter.urgencyLevel)
      }
      if (filter.status) {
        query = query.eq('status', filter.status)
      }
    }
    return query
  }

  /**
   * Get donor analytics for individual donors
   */
  async getDonorAnalytics(donorId: string): Promise<DonorAnalytics | null> {
    try {
      // Get donor's donation history
      const { data: donations } = await this.supabase
        .from('blood_requests')
        .select(`
          *,
          donor_responses!inner (
            response_type,
            created_at,
            eta_minutes
          )
        `)
        .eq('donor_responses.donor_id', donorId)

      if (!donations || donations.length === 0) return null

      // Get donor profile
      const { data: donor } = await this.supabase
        .from('users')
        .select('blood_type, location')
        .eq('id', donorId)
        .single()

      if (!donor) return null

      // Calculate metrics
      const totalDonations = donations.length
      const successfulDonations = donations.filter(d => d.status === 'completed').length
      const successRate = totalDonations > 0 ? (successfulDonations / totalDonations) * 100 : 0

      // Calculate average response time
      const responseTimes = donations
        .map(d => {
          const response = d.donor_responses?.[0]
          if (response) {
            const requestTime = new Date(d.created_at).getTime()
            const responseTime = new Date(response.created_at).getTime()
            return (responseTime - requestTime) / (1000 * 60) // Convert to minutes
          }
          return null
        })
        .filter(time => time !== null && time > 0)

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum: number, time: number | null) => sum + (time || 0), 0) / responseTimes.length
        : 0

      // Analyze preferred times and locations
      const preferredTimes = this.analyzePreferredTimes(donations)
      const preferredLocations = this.analyzePreferredLocations(donations)

      // Calculate reliability score
      const reliabilityScore = this.calculateReliabilityScore(donations, avgResponseTime, successRate)

      return {
        donor_id: donorId,
        total_donations: totalDonations,
        avg_response_time: Math.round(avgResponseTime),
        success_rate: Math.round(successRate),
        preferred_times: preferredTimes,
        preferred_locations: preferredLocations,
        blood_type: donor.blood_type,
        reliability_score: reliabilityScore
      }
    } catch (error: any) {
      console.error('Error getting donor analytics:', error)
      return null
    }
  }

  /**
   * Get request analytics for individual requests
   */
  async getRequestAnalytics(requestId: string): Promise<RequestAnalytics | null> {
    try {
      const { data: request } = await this.supabase
        .from('blood_requests')
        .select(`
          *,
          donor_responses (
            response_type,
            created_at
          )
        `)
        .eq('id', requestId)
        .single()

      if (!request) return null

      // Calculate metrics
      const responseCount = request.donor_responses?.length || 0
      const timeToMatch = this.calculateTimeToMatch(request)
      const completionTime = this.calculateCompletionTime(request)
      const success = request.status === 'completed'

      return {
        request_id: requestId,
        blood_type: request.blood_type,
        urgency: request.emergency_level,
        response_count: responseCount,
        time_to_match: timeToMatch,
        completion_time: completionTime,
        location: request.location,
        success
      }
    } catch (error: any) {
      console.error('Error getting request analytics:', error)
      return null
    }
  }


  /**
   * Get blood type distribution with optional filtering
   */
  private async getBloodTypeDistribution(filter?: AnalyticsFilter): Promise<Record<string, number>> {
    let query = this.supabase
      .from('blood_requests')
      .select('blood_type')
    
    query = this.applyRequestFilters(query, filter)
    
    const { data: requests } = await query

    const distribution: Record<string, number> = {}
    
    requests?.forEach(request => {
      if (request.blood_type) {
        distribution[request.blood_type] = (distribution[request.blood_type] || 0) + 1
      }
    })

    return distribution
  }

  /**
   * Get location heatmap data with optional filtering
   */
  private async getLocationHeatmap(filter?: AnalyticsFilter): Promise<Array<{ location: string; count: number; coordinates: [number, number] }>> {
    let query = this.supabase
      .from('blood_requests')
      .select('location, latitude, longitude')
    
    query = this.applyRequestFilters(query, filter)
    
    const { data: requests } = await query

    const locationMap = new Map<string, { count: number; coordinates: [number, number] }>()

    requests?.forEach(request => {
      if (request.location) {
        const location = request.location
        const coordinates: [number, number] = [
          request.latitude || 0,
          request.longitude || 0
        ]

        if (locationMap.has(location)) {
          locationMap.get(location)!.count++
        } else {
          locationMap.set(location, { count: 1, coordinates })
        }
      }
    })

    return Array.from(locationMap.entries()).map(([location, data]) => ({
      location,
      count: data.count,
      coordinates: data.coordinates
    }))
  }

  /**
   * Get time series data for trends with optional filtering
   */
  private async getTimeSeriesData(filter?: AnalyticsFilter): Promise<Array<{ date: string; requests: number; donations: number }>> {
    let query = this.supabase
      .from('blood_requests')
      .select('created_at, status')
      .order('created_at', { ascending: true })
    
    query = this.applyRequestFilters(query, filter)
    
    const { data: requests } = await query

    const timeSeriesMap = new Map<string, { requests: number; donations: number }>()

    requests?.forEach(request => {
      const date = new Date(request.created_at).toISOString().split('T')[0]
      
      if (timeSeriesMap.has(date)) {
        timeSeriesMap.get(date)!.requests++
        if (request.status === 'completed') {
          timeSeriesMap.get(date)!.donations++
        }
      } else {
        timeSeriesMap.set(date, {
          requests: 1,
          donations: request.status === 'completed' ? 1 : 0
        })
      }
    })

    return Array.from(timeSeriesMap.entries()).map(([date, data]) => ({
      date,
      requests: data.requests,
      donations: data.donations
    }))
  }

  /**
   * Get enhanced demand forecast using multiple algorithms
   */
  private async getDemandForecast(filter?: AnalyticsFilter): Promise<Array<{ date: string; predicted_demand: number; confidence: number }>> {
    const timeSeriesData = await this.getTimeSeriesData(filter)
    
    if (timeSeriesData.length < 7) {
      return []
    }

    // Get seasonal patterns and trends
    const seasonalPatterns = this.analyzeSeasonalPatterns(timeSeriesData)
    const trendData = this.calculateTrend(timeSeriesData)
    
    // Generate forecast for next 14 days using multiple methods
    const forecast = []
    const lastIndex = timeSeriesData.length - 1

    for (let i = 1; i <= 14; i++) {
      // Linear regression prediction
      const linearPrediction = trendData.slope * (lastIndex + i) + trendData.intercept
      
      // Seasonal adjustment
      const dayOfWeek = new Date(Date.now() + i * 24 * 60 * 60 * 1000).getDay()
      const seasonalMultiplier = seasonalPatterns.weeklyPattern[dayOfWeek] || 1
      
      // Moving average prediction
      const movingAverage = this.calculateMovingAverage(timeSeriesData, 7)
      
      // Weighted ensemble prediction
      const ensemblePrediction = (
        linearPrediction * 0.4 + 
        movingAverage * 0.3 + 
        (linearPrediction * seasonalMultiplier) * 0.3
      )
      
      // Calculate confidence based on historical accuracy and forecast horizon
      const baseConfidence = Math.max(0.6, 1 - (i * 0.05))
      const volatilityAdjustment = Math.max(0.7, 1 - seasonalPatterns.volatility)
      const confidence = baseConfidence * volatilityAdjustment

      const forecastDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      if (forecastDate) {
        forecast.push({
          date: forecastDate,
          predicted_demand: Math.max(0, Math.round(ensemblePrediction)),
          confidence: Math.round(confidence * 100)
        })
      }
    }

    return forecast
  }

  /**
   * Get efficiency metrics with optional filtering
   */
  private async getEfficiencyMetrics(filter?: AnalyticsFilter): Promise<{
    matching_efficiency: number
    response_efficiency: number
    completion_efficiency: number
  }> {
    let query = this.supabase
      .from('blood_requests')
      .select(`
        *,
        donor_responses (
          response_type,
          created_at
        )
      `)
    
    query = this.applyRequestFilters(query, filter)
    
    const { data: requests } = await query

    if (!requests || requests.length === 0) {
      return {
        matching_efficiency: 0,
        response_efficiency: 0,
        completion_efficiency: 0
      }
    }

    // Calculate matching efficiency (requests that got responses)
    const requestsWithResponses = requests.filter(r => (r.donor_responses?.length || 0) > 0)
    const matchingEfficiency = (requestsWithResponses.length / requests.length) * 100

    // Calculate response efficiency (average response time)
    const responseTimes = requests
      .map(r => {
        const firstResponse = r.donor_responses?.[0]
        if (firstResponse) {
          const requestTime = new Date(r.created_at).getTime()
          const responseTime = new Date(firstResponse.created_at).getTime()
          return (responseTime - requestTime) / (1000 * 60) // Convert to minutes
        }
        return null
      })
      .filter(time => time !== null && time > 0)

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum: number, time: number | null) => sum + (time || 0), 0) / responseTimes.length
      : 0

    // Response efficiency (inverse of response time, normalized)
    const responseEfficiency = Math.max(0, 100 - (avgResponseTime / 60) * 100)

    // Calculate completion efficiency (completed requests)
    const completedRequests = requests.filter(r => r.status === 'completed')
    const completionEfficiency = (completedRequests.length / requests.length) * 100

    return {
      matching_efficiency: Math.round(matchingEfficiency),
      response_efficiency: Math.round(responseEfficiency),
      completion_efficiency: Math.round(completionEfficiency)
    }
  }

  /**
   * Get average response time with optional filtering
   */
  private async getAverageResponseTime(filter?: AnalyticsFilter): Promise<number> {
    let query = this.supabase
      .from('donor_responses')
      .select('created_at, blood_requests!inner(created_at, blood_type, location, emergency_level, status)')
    
    if (filter) {
      if (filter.dateRange) {
        query = query
          .gte('blood_requests.created_at', filter.dateRange.start)
          .lte('blood_requests.created_at', filter.dateRange.end)
      }
      if (filter.bloodType) {
        query = query.eq('blood_requests.blood_type', filter.bloodType)
      }
      if (filter.location) {
        query = query.ilike('blood_requests.location', `%${filter.location}%`)
      }
      if (filter.urgencyLevel) {
        query = query.eq('blood_requests.emergency_level', filter.urgencyLevel)
      }
      if (filter.status) {
        query = query.eq('blood_requests.status', filter.status)
      }
    }
    
    const { data: responses } = await query

    if (!responses || responses.length === 0) return 0

    // Calculate average time from request to response
    const responseTimes = responses
      .map((response: { blood_requests: BloodRequest; created_at: string }) => {
        if (response.blood_requests && response.created_at) {
          const requestTime = new Date(response.blood_requests.created_at).getTime()
          const responseTime = new Date(response.created_at).getTime()
          return (responseTime - requestTime) / (1000 * 60) // Convert to minutes
        }
        return 30 // Default 30 minutes for incomplete data
      })
      .filter(time => time > 0)

    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 30
  }

  /**
   * Analyze preferred times for donations
   */
  private analyzePreferredTimes(donations: BloodRequest[]): string[] {
    const timeSlots = new Map<string, number>()

    donations.forEach(donation => {
      const hour = new Date(donation.created_at).getHours()
      let timeSlot: string

      if (hour >= 6 && hour < 12) timeSlot = 'Morning (6-12)'
      else if (hour >= 12 && hour < 18) timeSlot = 'Afternoon (12-18)'
      else if (hour >= 18 && hour < 24) timeSlot = 'Evening (18-24)'
      else timeSlot = 'Night (0-6)'

      timeSlots.set(timeSlot, (timeSlots.get(timeSlot) || 0) + 1)
    })

    return Array.from(timeSlots.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([timeSlot]) => timeSlot)
  }

  /**
   * Analyze preferred locations for donations
   */
  private analyzePreferredLocations(donations: BloodRequest[]): string[] {
    const locationCount = new Map<string, number>()

    donations.forEach(donation => {
      const location = donation.location
      locationCount.set(location, (locationCount.get(location) || 0) + 1)
    })

    return Array.from(locationCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([location]) => location)
  }

  /**
   * Calculate reliability score for a donor
   */
  private calculateReliabilityScore(donations: BloodRequest[], avgResponseTime: number, successRate: number): number {
    let score = 50 // Base score

    // Response time factor (faster = higher score)
    if (avgResponseTime < 15) score += 25
    else if (avgResponseTime < 30) score += 15
    else if (avgResponseTime < 60) score += 5

    // Success rate factor
    score += successRate * 0.25

    // Consistency factor (more donations = higher score)
    if (donations.length >= 10) score += 20
    else if (donations.length >= 5) score += 10
    else if (donations.length >= 2) score += 5

    return Math.min(score, 100)
  }

  /**
   * Calculate time to match for a request
   */
  private calculateTimeToMatch(request: BloodRequest): number {
    const firstAcceptance = request.donor_responses?.find((r: any) => r.response_type === 'accept')
    
    if (!firstAcceptance) return -1 // No match

    const requestTime = new Date(request.created_at).getTime()
    const matchTime = new Date(firstAcceptance.created_at).getTime()
    
    return (matchTime - requestTime) / (1000 * 60) // Convert to minutes
  }

  /**
   * Calculate completion time for a request
   */
  private calculateCompletionTime(request: BloodRequest): number {
    if (request.status !== 'completed') return -1

    const requestTime = new Date(request.created_at).getTime()
    const completionTime = new Date(request.updated_at).getTime()
    
    return (completionTime - requestTime) / (1000 * 60) // Convert to minutes
  }

  /**
   * Calculate linear regression for forecasting
   */
  private calculateLinearRegression(xValues: number[], yValues: number[]): { slope: number; intercept: number } {
    const n = xValues.length
    const sumX = xValues.reduce((sum, x) => sum + x, 0)
    const sumY = yValues.reduce((sum, y) => sum + y, 0)
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0)
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    return { slope, intercept }
  }

  /**
   * Analyze seasonal patterns in data
   */
  private analyzeSeasonalPatterns(timeSeriesData: Array<{ date: string; requests: number; donations: number }>): {
    weeklyPattern: Record<number, number>
    volatility: number
  } {
    const weeklyPattern: Record<number, number> = {}
    const dayTotals: Record<number, number[]> = {}
    
    // Group data by day of week
    timeSeriesData.forEach(item => {
      if (item.date) {
        const dayOfWeek = new Date(item.date).getDay()
        if (!dayTotals[dayOfWeek]) dayTotals[dayOfWeek] = []
        dayTotals[dayOfWeek].push(item.requests)
      }
    })
    
    // Calculate average for each day of week
    const overallAverage = timeSeriesData.reduce((sum, item) => sum + item.requests, 0) / timeSeriesData.length
    
    Object.keys(dayTotals).forEach(day => {
      const dayNum = parseInt(day)
      const dayAverage = dayTotals[dayNum].reduce((sum, val) => sum + val, 0) / dayTotals[dayNum].length
      weeklyPattern[dayNum] = dayAverage / overallAverage
    })
    
    // Calculate volatility
    const variance = timeSeriesData.reduce((sum, item) => {
      const diff = item.requests - overallAverage
      return sum + (diff * diff)
    }, 0) / timeSeriesData.length
    
    const volatility = Math.sqrt(variance) / overallAverage
    
    return { weeklyPattern, volatility }
  }

  /**
   * Calculate trend data
   */
  private calculateTrend(timeSeriesData: Array<{ date: string; requests: number; donations: number }>): {
    slope: number
    intercept: number
  } {
    const xValues = timeSeriesData.map((_, index) => index)
    const yValues = timeSeriesData.map(d => d.requests)
    return this.calculateLinearRegression(xValues, yValues)
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(timeSeriesData: Array<{ date: string; requests: number; donations: number }>, window: number): number {
    if (timeSeriesData.length < window) return 0
    
    const recentData = timeSeriesData.slice(-window)
    return recentData.reduce((sum, item) => sum + item.requests, 0) / window
  }

  /**
   * Get blood bank inventory levels
   */
  async getInventoryLevels(): Promise<Record<string, { current: number; minimum: number; maximum: number }>> {
    try {
      const { data: inventory } = await this.supabase
        .from('blood_inventory')
        .select('blood_type, units_available, minimum_threshold, maximum_capacity')
      
      const levels: Record<string, { current: number; minimum: number; maximum: number }> = {}
      
      inventory?.forEach(item => {
        if (item.blood_type) {
          levels[item.blood_type] = {
            current: item.units_available || 0,
            minimum: item.minimum_threshold || 10,
            maximum: item.maximum_capacity || 100
          }
        }
      })
      
      return levels
    } catch (error) {
      console.error('Error getting inventory levels:', error)
      return {}
    }
  }

  /**
   * Get critical shortage alerts
   */
  async getCriticalShortages(): Promise<Array<{ blood_type: string; current_level: number; days_until_critical: number }>> {
    try {
      const inventory = await this.getInventoryLevels()
      const forecast = await this.getDemandForecast()
      const bloodTypeDistribution = await this.getBloodTypeDistribution()
      
      const shortages = []
      
      for (const [bloodType, levels] of Object.entries(inventory)) {
        if (levels.current <= levels.minimum * 1.5) {
          // Calculate average daily consumption for this blood type
          const bloodTypePercentage = bloodTypeDistribution[bloodType] || 0
          const totalDailyDemand = forecast.length > 0 ? forecast[0].predicted_demand : 5
          const dailyConsumption = totalDailyDemand * (bloodTypePercentage / 100)
          
          const daysUntilCritical = dailyConsumption > 0 ? levels.current / dailyConsumption : 999
          
          shortages.push({
            blood_type: bloodType,
            current_level: levels.current,
            days_until_critical: Math.round(daysUntilCritical)
          })
        }
      }
      
      return shortages.sort((a, b) => a.days_until_critical - b.days_until_critical)
    } catch (error) {
      console.error('Error calculating critical shortages:', error)
      return []
    }
  }

  /**
   * Export analytics data to different formats
   */
  async exportData(format: 'csv' | 'json' | 'pdf'): Promise<string | Blob> {
    const data = await this.getAnalyticsData()
    
    switch (format) {
      case 'csv':
        return this.exportToCSV(data)
      case 'json':
        return JSON.stringify(data, null, 2)
      case 'pdf':
        return this.exportToPDF(data)
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  /**
   * Export data to CSV format
   */
  private exportToCSV(data: AnalyticsData): string {
    const headers = ['Date', 'Requests', 'Donations', 'Success Rate']
    const rows = data.time_series_data.map(item => [
      item.date || 'Unknown',
      item.requests.toString(),
      item.donations.toString(),
      ((item.donations / Math.max(item.requests, 1)) * 100).toFixed(2) + '%'
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  /**
   * Export data to PDF format (returns blob)
   */
  private exportToPDF(data: AnalyticsData): Blob {
    // This would require a PDF library like jsPDF in a real implementation
    // For now, return a simple text blob
    const content = `Blood Connect Analytics Report\n\nTotal Donors: ${data.total_donors}\nTotal Requests: ${data.total_requests}\nTotal Donations: ${data.total_donations}\nSuccess Rate: ${data.success_rate}%`
    return new Blob([content], { type: 'text/plain' })
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService() 