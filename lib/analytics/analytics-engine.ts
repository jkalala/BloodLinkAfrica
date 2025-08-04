/**
 * Advanced Analytics Engine
 * 
 * Comprehensive analytics system for blood donation data with real-time
 * processing, predictive insights, and business intelligence capabilities
 */

import { getOptimizedDB } from '../database/optimized-queries'
import { getCache } from '../cache/redis-cache'
import { performanceMonitor } from '../performance/metrics'
import { getMLPipelineAPI } from '../ai/ml-pipeline/ml-pipeline-api'

export interface AnalyticsQuery {
  id: string
  name: string
  type: 'metric' | 'dimension' | 'kpi' | 'trend' | 'forecast'
  timeRange: {
    start: Date
    end: Date
    granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
  }
  filters: {
    regions?: string[]
    bloodTypes?: string[]
    userRoles?: string[]
    hospitalIds?: string[]
    donorIds?: string[]
    customFilters?: Record<string, any>
  }
  groupBy?: string[]
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>
  limit?: number
}

export interface AnalyticsResult {
  queryId: string
  data: Array<Record<string, any>>
  metadata: {
    totalRecords: number
    executionTime: number
    cacheHit: boolean
    dataFreshness: Date
    confidence?: number
  }
  insights?: {
    trends: Array<{
      metric: string
      direction: 'up' | 'down' | 'stable'
      change: number
      significance: 'low' | 'medium' | 'high'
    }>
    anomalies: Array<{
      metric: string
      value: number
      expected: number
      severity: 'low' | 'medium' | 'high'
      timestamp: Date
    }>
    predictions: Array<{
      metric: string
      forecast: number[]
      confidence: number
      horizon: number
    }>
  }
}

export interface KPIDefinition {
  id: string
  name: string
  description: string
  category: 'operational' | 'financial' | 'clinical' | 'engagement'
  calculation: {
    numerator: string
    denominator?: string
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
  }
  targets: {
    green: number
    yellow: number
    red: number
  }
  format: 'number' | 'percentage' | 'currency' | 'duration'
  refreshInterval: number // minutes
}

export interface DashboardConfig {
  id: string
  name: string
  description: string
  layout: {
    rows: number
    columns: number
    widgets: Array<{
      id: string
      type: 'chart' | 'kpi' | 'table' | 'map' | 'gauge' | 'text'
      position: { row: number; col: number; width: number; height: number }
      config: Record<string, any>
      dataSource: string
      refreshInterval: number
    }>
  }
  permissions: {
    view: string[]
    edit: string[]
  }
  isActive: boolean
}

class AnalyticsEngine {
  private db = getOptimizedDB()
  private cache = getCache()
  private mlPipeline = getMLPipelineAPI()
  private kpiDefinitions: Map<string, KPIDefinition> = new Map()
  private dashboards: Map<string, DashboardConfig> = new Map()

  // Configuration
  private readonly CONFIG = {
    cachePrefix: 'analytics',
    defaultCacheTTL: 300, // 5 minutes
    maxQueryResults: 10000,
    anomalyThreshold: 2.5, // Standard deviations
    trendSignificanceThreshold: 0.05,
    realTimeUpdateInterval: 30000, // 30 seconds
    dataRetentionDays: 365
  }

  // Pre-defined KPIs
  private readonly DEFAULT_KPIS: KPIDefinition[] = [
    {
      id: 'total_donations',
      name: 'Total Donations',
      description: 'Total number of completed donations',
      category: 'operational',
      calculation: {
        numerator: 'COUNT(donations WHERE status = "completed")',
        aggregation: 'count'
      },
      targets: { green: 1000, yellow: 500, red: 100 },
      format: 'number',
      refreshInterval: 15
    },
    {
      id: 'donor_conversion_rate',
      name: 'Donor Conversion Rate',
      description: 'Percentage of registered users who become active donors',
      category: 'engagement',
      calculation: {
        numerator: 'COUNT(DISTINCT donors WHERE donation_count > 0)',
        denominator: 'COUNT(DISTINCT users WHERE role = "donor")',
        aggregation: 'avg'
      },
      targets: { green: 0.3, yellow: 0.2, red: 0.1 },
      format: 'percentage',
      refreshInterval: 60
    },
    {
      id: 'avg_response_time',
      name: 'Average Response Time',
      description: 'Average time from blood request to donor response',
      category: 'operational',
      calculation: {
        numerator: 'AVG(TIMESTAMPDIFF(MINUTE, blood_requests.created_at, donor_responses.created_at))',
        aggregation: 'avg'
      },
      targets: { green: 30, yellow: 60, red: 120 },
      format: 'duration',
      refreshInterval: 30
    },
    {
      id: 'supply_adequacy_ratio',
      name: 'Supply Adequacy Ratio',
      description: 'Ratio of available blood units to demand',
      category: 'clinical',
      calculation: {
        numerator: 'SUM(blood_inventory.units_available)',
        denominator: 'SUM(blood_requests.units_requested)',
        aggregation: 'avg'
      },
      targets: { green: 1.5, yellow: 1.0, red: 0.8 },
      format: 'number',
      refreshInterval: 15
    }
  ]

  constructor() {
    this.initializeKPIs()
    this.initializeDefaultDashboards()
    this.startRealTimeUpdates()
  }

  async executeQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const startTime = performance.now()

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(query)
      
      // Check cache first
      const cachedResult = await this.cache.get<AnalyticsResult>(cacheKey)
      if (cachedResult && this.isCacheValid(cachedResult, query)) {
        cachedResult.metadata.cacheHit = true
        return cachedResult
      }

      // Execute query based on type
      let data: Array<Record<string, any>> = []
      let totalRecords = 0

      switch (query.type) {
        case 'metric':
          ({ data, totalRecords } = await this.executeMetricQuery(query))
          break
        case 'dimension':
          ({ data, totalRecords } = await this.executeDimensionQuery(query))
          break
        case 'kpi':
          ({ data, totalRecords } = await this.executeKPIQuery(query))
          break
        case 'trend':
          ({ data, totalRecords } = await this.executeTrendQuery(query))
          break
        case 'forecast':
          ({ data, totalRecords } = await this.executeForecastQuery(query))
          break
        default:
          throw new Error(`Unsupported query type: ${query.type}`)
      }

      // Generate insights
      const insights = await this.generateInsights(data, query)

      const result: AnalyticsResult = {
        queryId: query.id,
        data,
        metadata: {
          totalRecords,
          executionTime: performance.now() - startTime,
          cacheHit: false,
          dataFreshness: new Date(),
          confidence: insights?.predictions[0]?.confidence
        },
        insights
      }

      // Cache result
      await this.cache.set(cacheKey, result, { 
        ttl: this.CONFIG.defaultCacheTTL,
        tags: ['analytics', query.type]
      })

      // Record metrics
      this.recordQueryMetrics(query, result)

      return result

    } catch (error) {
      const executionTime = performance.now() - startTime
      
      performanceMonitor.recordCustomMetric({
        name: 'analytics_query_duration',
        value: executionTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          success: 'false',
          query_type: query.type,
          error: (error as Error).message
        }
      })

      throw new Error(`Analytics query failed: ${(error as Error).message}`)
    }
  }

  private async executeMetricQuery(query: AnalyticsQuery): Promise<{ data: any[]; totalRecords: number }> {
    // Build SQL query for metrics
    const sqlQuery = this.buildMetricSQL(query)
    const result = await this.db.rawQuery(sqlQuery)
    
    return {
      data: result.rows || [],
      totalRecords: result.rows?.length || 0
    }
  }

  private async executeDimensionQuery(query: AnalyticsQuery): Promise<{ data: any[]; totalRecords: number }> {
    // Build SQL query for dimensional analysis
    const sqlQuery = this.buildDimensionSQL(query)
    const result = await this.db.rawQuery(sqlQuery)
    
    return {
      data: result.rows || [],
      totalRecords: result.rows?.length || 0
    }
  }

  private async executeKPIQuery(query: AnalyticsQuery): Promise<{ data: any[]; totalRecords: number }> {
    const kpiResults: any[] = []

    // Execute all relevant KPIs
    for (const [kpiId, kpi] of this.kpiDefinitions.entries()) {
      if (this.shouldIncludeKPI(kpi, query)) {
        const kpiValue = await this.calculateKPI(kpi, query)
        kpiResults.push({
          kpi_id: kpiId,
          kpi_name: kpi.name,
          value: kpiValue.value,
          target_status: this.getTargetStatus(kpiValue.value, kpi.targets),
          category: kpi.category,
          format: kpi.format,
          timestamp: new Date()
        })
      }
    }

    return {
      data: kpiResults,
      totalRecords: kpiResults.length
    }
  }

  private async executeTrendQuery(query: AnalyticsQuery): Promise<{ data: any[]; totalRecords: number }> {
    // Build time series query
    const sqlQuery = this.buildTrendSQL(query)
    const result = await this.db.rawQuery(sqlQuery)
    
    // Calculate trend metrics
    const trendData = this.calculateTrendMetrics(result.rows || [])
    
    return {
      data: trendData,
      totalRecords: trendData.length
    }
  }

  private async executeForecastQuery(query: AnalyticsQuery): Promise<{ data: any[]; totalRecords: number }> {
    try {
      // Get historical data for forecasting
      const historicalQuery = { ...query, type: 'trend' as const }
      const { data: historicalData } = await this.executeTrendQuery(historicalQuery)

      // Use ML pipeline for forecasting
      const forecastRequest = {
        type: 'forecast' as const,
        data: {
          regions: query.filters.regions || ['all'],
          bloodTypes: query.filters.bloodTypes || ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
          horizonDays: 30,
          includeConfidenceIntervals: true,
          includeFactorAnalysis: true
        }
      }

      const mlResult = await this.mlPipeline.processRequest(forecastRequest)
      
      // Transform ML results to analytics format
      const forecastData = this.transformForecastData(mlResult.forecasts, historicalData)

      return {
        data: forecastData,
        totalRecords: forecastData.length
      }

    } catch (error) {
      console.error('Forecast query failed:', error)
      return { data: [], totalRecords: 0 }
    }
  }

  private buildMetricSQL(query: AnalyticsQuery): string {
    const { timeRange, filters, groupBy, orderBy, limit } = query

    let sql = `
      SELECT 
        ${this.buildSelectClause(query)}
      FROM ${this.buildFromClause(query)}
      WHERE ${this.buildWhereClause(timeRange, filters)}
    `

    if (groupBy && groupBy.length > 0) {
      sql += ` GROUP BY ${groupBy.join(', ')}`
    }

    if (orderBy && orderBy.length > 0) {
      const orderClauses = orderBy.map(o => `${o.field} ${o.direction.toUpperCase()}`)
      sql += ` ORDER BY ${orderClauses.join(', ')}`
    }

    if (limit) {
      sql += ` LIMIT ${limit}`
    }

    return sql
  }

  private buildDimensionSQL(query: AnalyticsQuery): string {
    // Similar to metric SQL but focused on dimensional breakdowns
    return this.buildMetricSQL(query)
  }

  private buildTrendSQL(query: AnalyticsQuery): string {
    const { timeRange, filters } = query
    const granularity = timeRange.granularity

    const dateFormat = this.getDateFormat(granularity)
    
    return `
      SELECT 
        ${dateFormat} as time_period,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_rate
      FROM donations
      WHERE ${this.buildWhereClause(timeRange, filters)}
      GROUP BY ${dateFormat}
      ORDER BY time_period ASC
    `
  }

  private buildSelectClause(query: AnalyticsQuery): string {
    // Default metrics for blood donation analytics
    return `
      COUNT(*) as total_count,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(units) as avg_units,
      SUM(units) as total_units
    `
  }

  private buildFromClause(query: AnalyticsQuery): string {
    // Determine main table based on query context
    if (query.filters.donorIds) return 'donations'
    if (query.filters.hospitalIds) return 'blood_requests'
    return 'donations' // Default
  }

  private buildWhereClause(timeRange: AnalyticsQuery['timeRange'], filters: AnalyticsQuery['filters']): string {
    const conditions: string[] = []

    // Time range condition
    conditions.push(`created_at >= '${timeRange.start.toISOString()}'`)
    conditions.push(`created_at <= '${timeRange.end.toISOString()}'`)

    // Filter conditions
    if (filters.regions && filters.regions.length > 0) {
      conditions.push(`region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`)
    }

    if (filters.bloodTypes && filters.bloodTypes.length > 0) {
      conditions.push(`blood_type IN (${filters.bloodTypes.map(bt => `'${bt}'`).join(', ')})`)
    }

    if (filters.userRoles && filters.userRoles.length > 0) {
      conditions.push(`user_role IN (${filters.userRoles.map(r => `'${r}'`).join(', ')})`)
    }

    // Custom filters
    if (filters.customFilters) {
      for (const [key, value] of Object.entries(filters.customFilters)) {
        if (Array.isArray(value)) {
          conditions.push(`${key} IN (${value.map(v => `'${v}'`).join(', ')})`)
        } else {
          conditions.push(`${key} = '${value}'`)
        }
      }
    }

    return conditions.join(' AND ')
  }

  private getDateFormat(granularity: string): string {
    switch (granularity) {
      case 'hour': return "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')"
      case 'day': return "DATE_FORMAT(created_at, '%Y-%m-%d')"
      case 'week': return "DATE_FORMAT(created_at, '%Y-%u')"
      case 'month': return "DATE_FORMAT(created_at, '%Y-%m')"
      case 'quarter': return "CONCAT(YEAR(created_at), '-Q', QUARTER(created_at))"
      case 'year': return "YEAR(created_at)"
      default: return "DATE_FORMAT(created_at, '%Y-%m-%d')"
    }
  }

  private async calculateKPI(kpi: KPIDefinition, query: AnalyticsQuery): Promise<{ value: number; metadata: any }> {
    try {
      // Build KPI-specific query
      const kpiQuery = this.buildKPIQuery(kpi, query)
      const result = await this.db.rawQuery(kpiQuery)
      
      const value = result.rows?.[0]?.value || 0
      
      return {
        value,
        metadata: {
          calculation: kpi.calculation,
          lastUpdated: new Date(),
          dataPoints: result.rows?.length || 0
        }
      }

    } catch (error) {
      console.error(`KPI calculation failed for ${kpi.id}:`, error)
      return { value: 0, metadata: { error: (error as Error).message } }
    }
  }

  private buildKPIQuery(kpi: KPIDefinition, query: AnalyticsQuery): string {
    const { calculation } = kpi
    const { timeRange, filters } = query

    if (calculation.denominator) {
      // Ratio KPI
      return `
        SELECT 
          (${calculation.numerator}) / NULLIF((${calculation.denominator}), 0) as value
        FROM donations d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN blood_requests br ON d.request_id = br.id
        WHERE ${this.buildWhereClause(timeRange, filters)}
      `
    } else {
      // Simple aggregation KPI
      return `
        SELECT ${calculation.aggregation.toUpperCase()}(${calculation.numerator.replace(/COUNT\(|\)/g, '')}) as value
        FROM donations d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE ${this.buildWhereClause(timeRange, filters)}
      `
    }
  }

  private getTargetStatus(value: number, targets: KPIDefinition['targets']): 'green' | 'yellow' | 'red' {
    if (value >= targets.green) return 'green'
    if (value >= targets.yellow) return 'yellow'
    return 'red'
  }

  private shouldIncludeKPI(kpi: KPIDefinition, query: AnalyticsQuery): boolean {
    // Include KPI based on query filters and KPI category
    return true // Simplified - in production, would have more sophisticated filtering
  }

  private calculateTrendMetrics(data: any[]): any[] {
    if (data.length < 2) return data

    return data.map((point, index) => {
      if (index === 0) {
        return { ...point, change: 0, change_percent: 0 }
      }

      const previous = data[index - 1]
      const change = point.count - previous.count
      const changePercent = previous.count > 0 ? (change / previous.count) * 100 : 0

      return {
        ...point,
        change,
        change_percent: Math.round(changePercent * 100) / 100
      }
    })
  }

  private transformForecastData(mlForecasts: any, historicalData: any[]): any[] {
    if (!mlForecasts || !mlForecasts.demandForecasts) return []

    const forecastData: any[] = []

    for (const forecast of mlForecasts.demandForecasts) {
      for (const prediction of forecast.predictions) {
        forecastData.push({
          time_period: prediction.date,
          blood_type: forecast.bloodType,
          region: forecast.region,
          predicted_demand: prediction.predictedDemand,
          confidence: prediction.confidence,
          factors: prediction.factors,
          type: 'forecast'
        })
      }
    }

    return forecastData
  }

  private async generateInsights(data: any[], query: AnalyticsQuery): Promise<AnalyticsResult['insights']> {
    if (data.length === 0) return undefined

    const insights: AnalyticsResult['insights'] = {
      trends: [],
      anomalies: [],
      predictions: []
    }

    // Generate trend insights
    if (query.type === 'trend' && data.length > 1) {
      insights.trends = this.analyzeTrends(data)
    }

    // Detect anomalies
    insights.anomalies = this.detectAnomalies(data)

    // Generate predictions for relevant queries
    if (['trend', 'forecast'].includes(query.type)) {
      insights.predictions = await this.generatePredictions(data, query)
    }

    return insights
  }

  private analyzeTrends(data: any[]): AnalyticsResult['insights']['trends'] {
    const trends: AnalyticsResult['insights']['trends'] = []

    // Analyze count trend
    const values = data.map(d => d.count || d.value || 0)
    const trend = this.calculateTrendDirection(values)
    
    if (trend.significance > this.CONFIG.trendSignificanceThreshold) {
      trends.push({
        metric: 'count',
        direction: trend.direction,
        change: trend.change,
        significance: trend.significance > 0.1 ? 'high' : trend.significance > 0.05 ? 'medium' : 'low'
      })
    }

    return trends
  }

  private calculateTrendDirection(values: number[]): { direction: 'up' | 'down' | 'stable'; change: number; significance: number } {
    if (values.length < 2) return { direction: 'stable', change: 0, significance: 0 }

    const first = values[0]
    const last = values[values.length - 1]
    const change = ((last - first) / first) * 100

    // Simple trend calculation - in production would use more sophisticated methods
    const direction = change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
    const significance = Math.abs(change) / 100

    return { direction, change: Math.round(change * 100) / 100, significance }
  }

  private detectAnomalies(data: any[]): AnalyticsResult['insights']['anomalies'] {
    const anomalies: AnalyticsResult['insights']['anomalies'] = []

    if (data.length < 10) return anomalies // Need sufficient data for anomaly detection

    const values = data.map(d => d.count || d.value || 0)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length)

    data.forEach((point, index) => {
      const value = point.count || point.value || 0
      const zScore = Math.abs((value - mean) / stdDev)

      if (zScore > this.CONFIG.anomalyThreshold) {
        anomalies.push({
          metric: 'count',
          value,
          expected: mean,
          severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
          timestamp: new Date(point.time_period || point.timestamp || new Date())
        })
      }
    })

    return anomalies
  }

  private async generatePredictions(data: any[], query: AnalyticsQuery): Promise<AnalyticsResult['insights']['predictions']> {
    // Simplified prediction - in production would use more sophisticated ML models
    const predictions: AnalyticsResult['insights']['predictions'] = []

    if (data.length < 5) return predictions

    const values = data.map(d => d.count || d.value || 0)
    const trend = this.calculateTrendDirection(values)
    
    // Simple linear projection
    const lastValue = values[values.length - 1]
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const projectedChange = (trend.change / 100) * (i + 1)
      return Math.max(0, Math.round(lastValue * (1 + projectedChange)))
    })

    predictions.push({
      metric: 'count',
      forecast,
      confidence: Math.max(0.1, 1 - trend.significance), // Inverse relationship
      horizon: 7
    })

    return predictions
  }

  private generateCacheKey(query: AnalyticsQuery): string {
    const keyData = {
      type: query.type,
      timeRange: query.timeRange,
      filters: query.filters,
      groupBy: query.groupBy,
      orderBy: query.orderBy,
      limit: query.limit
    }
    
    return `${this.CONFIG.cachePrefix}:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`
  }

  private isCacheValid(cachedResult: AnalyticsResult, query: AnalyticsQuery): boolean {
    const cacheAge = Date.now() - cachedResult.metadata.dataFreshness.getTime()
    const maxAge = this.CONFIG.defaultCacheTTL * 1000 // Convert to milliseconds
    
    return cacheAge < maxAge
  }

  private recordQueryMetrics(query: AnalyticsQuery, result: AnalyticsResult): void {
    performanceMonitor.recordCustomMetric({
      name: 'analytics_query_duration',
      value: result.metadata.executionTime,
      unit: 'ms',
      timestamp: Date.now(),
      tags: {
        success: 'true',
        query_type: query.type,
        cache_hit: result.metadata.cacheHit.toString(),
        record_count: result.metadata.totalRecords.toString()
      }
    })
  }

  private initializeKPIs(): void {
    for (const kpi of this.DEFAULT_KPIS) {
      this.kpiDefinitions.set(kpi.id, kpi)
    }
  }

  private initializeDefaultDashboards(): void {
    // Initialize default dashboards - implementation would be more comprehensive
    const operationalDashboard: DashboardConfig = {
      id: 'operational_overview',
      name: 'Operational Overview',
      description: 'Key operational metrics and trends',
      layout: {
        rows: 3,
        columns: 4,
        widgets: [
          {
            id: 'total_donations_kpi',
            type: 'kpi',
            position: { row: 0, col: 0, width: 1, height: 1 },
            config: { kpiId: 'total_donations' },
            dataSource: 'kpi',
            refreshInterval: 15
          },
          {
            id: 'donation_trend',
            type: 'chart',
            position: { row: 1, col: 0, width: 2, height: 1 },
            config: { chartType: 'line', metric: 'donations' },
            dataSource: 'trend',
            refreshInterval: 30
          }
        ]
      },
      permissions: {
        view: ['admin', 'super_admin', 'hospital'],
        edit: ['admin', 'super_admin']
      },
      isActive: true
    }

    this.dashboards.set(operationalDashboard.id, operationalDashboard)
  }

  private startRealTimeUpdates(): void {
    // Start real-time update process
    setInterval(async () => {
      try {
        // Invalidate cache for real-time KPIs
        const realTimeKPIs = Array.from(this.kpiDefinitions.values())
          .filter(kpi => kpi.refreshInterval <= 30)

        for (const kpi of realTimeKPIs) {
          const cachePattern = `${this.CONFIG.cachePrefix}:*kpi*${kpi.id}*`
          await this.cache.deletePattern(cachePattern)
        }

      } catch (error) {
        console.error('Real-time update error:', error)
      }
    }, this.CONFIG.realTimeUpdateInterval)
  }

  // Public API methods
  public async getKPIs(category?: string): Promise<KPIDefinition[]> {
    const kpis = Array.from(this.kpiDefinitions.values())
    return category ? kpis.filter(kpi => kpi.category === category) : kpis
  }

  public async getDashboard(dashboardId: string): Promise<DashboardConfig | undefined> {
    return this.dashboards.get(dashboardId)
  }

  public async listDashboards(): Promise<DashboardConfig[]> {
    return Array.from(this.dashboards.values()).filter(d => d.isActive)
  }

  public addKPI(kpi: KPIDefinition): void {
    this.kpiDefinitions.set(kpi.id, kpi)
  }

  public addDashboard(dashboard: DashboardConfig): void {
    this.dashboards.set(dashboard.id, dashboard)
  }

  public getSystemStats() {
    return {
      kpiCount: this.kpiDefinitions.size,
      dashboardCount: this.dashboards.size,
      cachePrefix: this.CONFIG.cachePrefix,
      realTimeUpdateInterval: this.CONFIG.realTimeUpdateInterval
    }
  }
}

// Singleton instance
let analyticsEngineInstance: AnalyticsEngine | null = null

export function getAnalyticsEngine(): AnalyticsEngine {
  if (!analyticsEngineInstance) {
    analyticsEngineInstance = new AnalyticsEngine()
  }
  return analyticsEngineInstance
}

export default AnalyticsEngine
