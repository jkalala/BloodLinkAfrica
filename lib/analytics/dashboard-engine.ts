/**
 * Real-time Dashboard Engine
 * 
 * Advanced dashboard system with D3.js integration, real-time updates,
 * and interactive visualizations for blood donation analytics
 */

import { getAnalyticsEngine, AnalyticsQuery, AnalyticsResult, DashboardConfig } from './analytics-engine'
import { getWebSocketServer } from '../realtime/websocket-server'
import { getCache } from '../cache/redis-cache'
import { performanceMonitor } from '../performance/metrics'

export interface ChartConfig {
  id: string
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap' | 'gauge' | 'map'
  title: string
  description?: string
  dimensions: {
    width: number
    height: number
    margin: { top: number; right: number; bottom: number; left: number }
  }
  data: {
    query: AnalyticsQuery
    xAxis: string
    yAxis: string | string[]
    groupBy?: string
    colorScheme?: string[]
  }
  styling: {
    theme: 'light' | 'dark'
    colors: string[]
    fontSize: number
    showLegend: boolean
    showGrid: boolean
    showTooltip: boolean
  }
  interactions: {
    zoom: boolean
    pan: boolean
    brush: boolean
    click: boolean
    hover: boolean
  }
  realTime: {
    enabled: boolean
    updateInterval: number // seconds
    maxDataPoints: number
  }
}

export interface DashboardWidget {
  id: string
  type: 'chart' | 'kpi' | 'table' | 'map' | 'gauge' | 'text' | 'filter'
  config: ChartConfig | KPIWidgetConfig | TableWidgetConfig | MapWidgetConfig
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  dependencies?: string[] // Other widget IDs this widget depends on
  filters?: Record<string, any>
}

export interface KPIWidgetConfig {
  id: string
  kpiId: string
  title: string
  format: 'number' | 'percentage' | 'currency' | 'duration'
  showTrend: boolean
  showTarget: boolean
  thresholds: {
    good: number
    warning: number
    critical: number
  }
  styling: {
    size: 'small' | 'medium' | 'large'
    color: string
    backgroundColor: string
  }
}

export interface TableWidgetConfig {
  id: string
  title: string
  query: AnalyticsQuery
  columns: Array<{
    field: string
    title: string
    type: 'text' | 'number' | 'date' | 'boolean'
    format?: string
    sortable: boolean
  }>
  pagination: {
    enabled: boolean
    pageSize: number
  }
  styling: {
    striped: boolean
    bordered: boolean
    compact: boolean
  }
}

export interface MapWidgetConfig {
  id: string
  title: string
  mapType: 'choropleth' | 'bubble' | 'heat'
  query: AnalyticsQuery
  geoData: {
    type: 'regions' | 'hospitals' | 'custom'
    source: string
  }
  styling: {
    colorScale: string[]
    opacity: number
    strokeWidth: number
  }
}

export interface DashboardState {
  id: string
  widgets: Map<string, DashboardWidget>
  filters: Record<string, any>
  timeRange: {
    start: Date
    end: Date
    granularity: string
  }
  autoRefresh: {
    enabled: boolean
    interval: number
  }
  layout: {
    columns: number
    rowHeight: number
    margin: number
  }
}

class DashboardEngine {
  private analyticsEngine = getAnalyticsEngine()
  private webSocketServer = getWebSocketServer()
  private cache = getCache()
  private activeDashboards: Map<string, DashboardState> = new Map()
  private widgetSubscriptions: Map<string, Set<string>> = new Map() // widgetId -> userIds
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map()

  // Configuration
  private readonly CONFIG = {
    maxConcurrentDashboards: 100,
    maxWidgetsPerDashboard: 50,
    defaultUpdateInterval: 30, // seconds
    maxUpdateInterval: 300, // 5 minutes
    minUpdateInterval: 5, // 5 seconds
    cachePrefix: 'dashboard',
    defaultCacheTTL: 60 // 1 minute
  }

  // D3.js chart templates
  private readonly CHART_TEMPLATES = {
    line: {
      script: `
        const svg = d3.select(container).append('svg')
          .attr('width', config.dimensions.width)
          .attr('height', config.dimensions.height);
        
        const margin = config.dimensions.margin;
        const width = config.dimensions.width - margin.left - margin.right;
        const height = config.dimensions.height - margin.top - margin.bottom;
        
        const g = svg.append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        
        const x = d3.scaleTime().range([0, width]);
        const y = d3.scaleLinear().range([height, 0]);
        const line = d3.line()
          .x(d => x(new Date(d[config.data.xAxis])))
          .y(d => y(d[config.data.yAxis]));
        
        x.domain(d3.extent(data, d => new Date(d[config.data.xAxis])));
        y.domain(d3.extent(data, d => d[config.data.yAxis]));
        
        g.append('g')
          .attr('transform', 'translate(0,' + height + ')')
          .call(d3.axisBottom(x));
        
        g.append('g')
          .call(d3.axisLeft(y));
        
        g.append('path')
          .datum(data)
          .attr('fill', 'none')
          .attr('stroke', config.styling.colors[0])
          .attr('stroke-width', 2)
          .attr('d', line);
      `,
      dependencies: ['d3']
    },
    bar: {
      script: `
        const svg = d3.select(container).append('svg')
          .attr('width', config.dimensions.width)
          .attr('height', config.dimensions.height);
        
        const margin = config.dimensions.margin;
        const width = config.dimensions.width - margin.left - margin.right;
        const height = config.dimensions.height - margin.top - margin.bottom;
        
        const g = svg.append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        
        const x = d3.scaleBand().range([0, width]).padding(0.1);
        const y = d3.scaleLinear().range([height, 0]);
        
        x.domain(data.map(d => d[config.data.xAxis]));
        y.domain([0, d3.max(data, d => d[config.data.yAxis])]);
        
        g.append('g')
          .attr('transform', 'translate(0,' + height + ')')
          .call(d3.axisBottom(x));
        
        g.append('g')
          .call(d3.axisLeft(y));
        
        g.selectAll('.bar')
          .data(data)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', d => x(d[config.data.xAxis]))
          .attr('width', x.bandwidth())
          .attr('y', d => y(d[config.data.yAxis]))
          .attr('height', d => height - y(d[config.data.yAxis]))
          .attr('fill', config.styling.colors[0]);
      `,
      dependencies: ['d3']
    },
    pie: {
      script: `
        const svg = d3.select(container).append('svg')
          .attr('width', config.dimensions.width)
          .attr('height', config.dimensions.height);
        
        const width = config.dimensions.width;
        const height = config.dimensions.height;
        const radius = Math.min(width, height) / 2;
        
        const g = svg.append('g')
          .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
        
        const color = d3.scaleOrdinal(config.styling.colors);
        const pie = d3.pie().value(d => d[config.data.yAxis]);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);
        
        const arcs = g.selectAll('.arc')
          .data(pie(data))
          .enter().append('g')
          .attr('class', 'arc');
        
        arcs.append('path')
          .attr('d', arc)
          .attr('fill', (d, i) => color(i));
        
        if (config.styling.showLegend) {
          arcs.append('text')
            .attr('transform', d => 'translate(' + arc.centroid(d) + ')')
            .attr('dy', '0.35em')
            .text(d => d.data[config.data.xAxis]);
        }
      `,
      dependencies: ['d3']
    }
  }

  constructor() {
    this.initializeDefaultDashboards()
    this.startDashboardUpdates()
  }

  async createDashboard(config: DashboardConfig, userId: string): Promise<string> {
    try {
      // Validate dashboard limits
      if (this.activeDashboards.size >= this.CONFIG.maxConcurrentDashboards) {
        throw new Error('Maximum concurrent dashboards reached')
      }

      if (config.layout.widgets.length > this.CONFIG.maxWidgetsPerDashboard) {
        throw new Error('Maximum widgets per dashboard exceeded')
      }

      // Create dashboard state
      const dashboardState: DashboardState = {
        id: config.id,
        widgets: new Map(),
        filters: {},
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          end: new Date(),
          granularity: 'hour'
        },
        autoRefresh: {
          enabled: true,
          interval: this.CONFIG.defaultUpdateInterval
        },
        layout: {
          columns: config.layout.columns,
          rowHeight: 100,
          margin: 10
        }
      }

      // Initialize widgets
      for (const widgetConfig of config.layout.widgets) {
        const widget = await this.createWidget(widgetConfig, dashboardState)
        dashboardState.widgets.set(widget.id, widget)
      }

      // Store dashboard
      this.activeDashboards.set(config.id, dashboardState)

      // Set up real-time updates
      if (dashboardState.autoRefresh.enabled) {
        this.setupDashboardUpdates(config.id)
      }

      // Subscribe user to dashboard updates
      this.subscribeToDashboard(config.id, userId)

      console.log(`Dashboard created: ${config.id} for user ${userId}`)

      return config.id

    } catch (error) {
      throw new Error(`Dashboard creation failed: ${(error as Error).message}`)
    }
  }

  async updateWidget(dashboardId: string, widgetId: string, data: any): Promise<void> {
    const dashboard = this.activeDashboards.get(dashboardId)
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`)
    }

    const widget = dashboard.widgets.get(widgetId)
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`)
    }

    // Update widget data
    const updatedWidget = { ...widget, data }
    dashboard.widgets.set(widgetId, updatedWidget)

    // Broadcast update to subscribed users
    const subscribers = this.widgetSubscriptions.get(widgetId) || new Set()
    for (const userId of subscribers) {
      this.webSocketServer.broadcastToUser(userId, {
        type: 'widget_update',
        data: {
          dashboardId,
          widgetId,
          widget: updatedWidget
        },
        timestamp: new Date(),
        messageId: `widget_update_${widgetId}_${Date.now()}`
      })
    }
  }

  async generateChartCode(config: ChartConfig, data: any[]): Promise<string> {
    const template = this.CHART_TEMPLATES[config.type]
    if (!template) {
      throw new Error(`Unsupported chart type: ${config.type}`)
    }

    // Generate D3.js code with configuration and data
    const chartCode = `
      (function(container, data, config) {
        // Clear existing content
        d3.select(container).selectAll('*').remove();
        
        ${template.script}
        
        // Add interactions if enabled
        ${this.generateInteractionCode(config)}
        
        // Add real-time update handler
        ${config.realTime.enabled ? this.generateRealTimeCode(config) : ''}
        
      })(document.getElementById('${config.id}'), ${JSON.stringify(data)}, ${JSON.stringify(config)});
    `

    return chartCode
  }

  private generateInteractionCode(config: ChartConfig): string {
    let interactionCode = ''

    if (config.interactions.hover && config.styling.showTooltip) {
      interactionCode += `
        // Add tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('opacity', 0);
        
        svg.selectAll('.bar, .arc path, .line')
          .on('mouseover', function(event, d) {
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(d[config.data.yAxis])
              .style('left', (event.pageX) + 'px')
              .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function(d) {
            tooltip.transition().duration(500).style('opacity', 0);
          });
      `
    }

    if (config.interactions.zoom) {
      interactionCode += `
        // Add zoom behavior
        const zoom = d3.zoom()
          .scaleExtent([1, 10])
          .on('zoom', function(event) {
            g.attr('transform', event.transform);
          });
        
        svg.call(zoom);
      `
    }

    return interactionCode
  }

  private generateRealTimeCode(config: ChartConfig): string {
    return `
      // Set up real-time updates
      setInterval(function() {
        fetch('/api/analytics/widget/${config.id}/data')
          .then(response => response.json())
          .then(newData => {
            // Update chart with new data
            updateChart(newData);
          });
      }, ${config.realTime.updateInterval * 1000});
    `
  }

  private async createWidget(widgetConfig: any, dashboard: DashboardState): Promise<DashboardWidget> {
    const widget: DashboardWidget = {
      id: widgetConfig.id,
      type: widgetConfig.type,
      config: widgetConfig.config,
      position: widgetConfig.position,
      dependencies: widgetConfig.dependencies,
      filters: { ...dashboard.filters, ...widgetConfig.filters }
    }

    // Initialize widget data based on type
    switch (widget.type) {
      case 'chart':
        await this.initializeChartWidget(widget, dashboard)
        break
      case 'kpi':
        await this.initializeKPIWidget(widget, dashboard)
        break
      case 'table':
        await this.initializeTableWidget(widget, dashboard)
        break
      case 'map':
        await this.initializeMapWidget(widget, dashboard)
        break
    }

    return widget
  }

  private async initializeChartWidget(widget: DashboardWidget, dashboard: DashboardState): Promise<void> {
    const chartConfig = widget.config as ChartConfig
    
    // Execute analytics query
    const query: AnalyticsQuery = {
      ...chartConfig.data.query,
      timeRange: dashboard.timeRange,
      filters: { ...chartConfig.data.query.filters, ...widget.filters }
    }

    const result = await this.analyticsEngine.executeQuery(query)
    
    // Generate chart code
    const chartCode = await this.generateChartCode(chartConfig, result.data)
    
    // Store chart code and data
    ;(widget as any).chartCode = chartCode
    ;(widget as any).data = result.data
    ;(widget as any).metadata = result.metadata
  }

  private async initializeKPIWidget(widget: DashboardWidget, dashboard: DashboardState): Promise<void> {
    const kpiConfig = widget.config as KPIWidgetConfig
    
    // Get KPI data
    const query: AnalyticsQuery = {
      id: `kpi_${kpiConfig.kpiId}`,
      name: `KPI Query for ${kpiConfig.kpiId}`,
      type: 'kpi',
      timeRange: dashboard.timeRange,
      filters: widget.filters || {}
    }

    const result = await this.analyticsEngine.executeQuery(query)
    const kpiData = result.data.find(d => d.kpi_id === kpiConfig.kpiId)
    
    ;(widget as any).data = kpiData
    ;(widget as any).metadata = result.metadata
  }

  private async initializeTableWidget(widget: DashboardWidget, dashboard: DashboardState): Promise<void> {
    const tableConfig = widget.config as TableWidgetConfig
    
    const query: AnalyticsQuery = {
      ...tableConfig.query,
      timeRange: dashboard.timeRange,
      filters: { ...tableConfig.query.filters, ...widget.filters }
    }

    const result = await this.analyticsEngine.executeQuery(query)
    
    ;(widget as any).data = result.data
    ;(widget as any).metadata = result.metadata
  }

  private async initializeMapWidget(widget: DashboardWidget, dashboard: DashboardState): Promise<void> {
    const mapConfig = widget.config as MapWidgetConfig
    
    const query: AnalyticsQuery = {
      ...mapConfig.query,
      timeRange: dashboard.timeRange,
      filters: { ...mapConfig.query.filters, ...widget.filters }
    }

    const result = await this.analyticsEngine.executeQuery(query)
    
    ;(widget as any).data = result.data
    ;(widget as any).metadata = result.metadata
    ;(widget as any).geoData = await this.loadGeoData(mapConfig.geoData)
  }

  private async loadGeoData(geoConfig: MapWidgetConfig['geoData']): Promise<any> {
    // Load geographical data based on configuration
    // This would typically load from a GeoJSON file or API
    return {
      type: 'FeatureCollection',
      features: [] // Placeholder
    }
  }

  private setupDashboardUpdates(dashboardId: string): void {
    const dashboard = this.activeDashboards.get(dashboardId)
    if (!dashboard || !dashboard.autoRefresh.enabled) return

    const interval = setInterval(async () => {
      try {
        await this.refreshDashboard(dashboardId)
      } catch (error) {
        console.error(`Dashboard refresh failed for ${dashboardId}:`, error)
      }
    }, dashboard.autoRefresh.interval * 1000)

    this.updateIntervals.set(dashboardId, interval)
  }

  private async refreshDashboard(dashboardId: string): Promise<void> {
    const dashboard = this.activeDashboards.get(dashboardId)
    if (!dashboard) return

    // Refresh all widgets
    for (const [widgetId, widget] of dashboard.widgets.entries()) {
      try {
        await this.refreshWidget(dashboardId, widgetId)
      } catch (error) {
        console.error(`Widget refresh failed for ${widgetId}:`, error)
      }
    }
  }

  private async refreshWidget(dashboardId: string, widgetId: string): Promise<void> {
    const dashboard = this.activeDashboards.get(dashboardId)
    if (!dashboard) return

    const widget = dashboard.widgets.get(widgetId)
    if (!widget) return

    // Re-initialize widget with fresh data
    await this.createWidget(widget, dashboard)
    
    // Update the widget in dashboard
    dashboard.widgets.set(widgetId, widget)
    
    // Broadcast update
    await this.updateWidget(dashboardId, widgetId, (widget as any).data)
  }

  private subscribeToDashboard(dashboardId: string, userId: string): void {
    const dashboard = this.activeDashboards.get(dashboardId)
    if (!dashboard) return

    // Subscribe to all widgets in the dashboard
    for (const widgetId of dashboard.widgets.keys()) {
      if (!this.widgetSubscriptions.has(widgetId)) {
        this.widgetSubscriptions.set(widgetId, new Set())
      }
      this.widgetSubscriptions.get(widgetId)!.add(userId)
    }
  }

  private initializeDefaultDashboards(): void {
    // Initialize default dashboard templates
    console.log('Dashboard engine initialized with default templates')
  }

  private startDashboardUpdates(): void {
    // Start background process for dashboard updates
    console.log('Dashboard update process started')
  }

  // Public API methods
  public async getDashboard(dashboardId: string): Promise<DashboardState | undefined> {
    return this.activeDashboards.get(dashboardId)
  }

  public async deleteDashboard(dashboardId: string): Promise<void> {
    // Clean up dashboard resources
    const interval = this.updateIntervals.get(dashboardId)
    if (interval) {
      clearInterval(interval)
      this.updateIntervals.delete(dashboardId)
    }

    // Remove subscriptions
    const dashboard = this.activeDashboards.get(dashboardId)
    if (dashboard) {
      for (const widgetId of dashboard.widgets.keys()) {
        this.widgetSubscriptions.delete(widgetId)
      }
    }

    this.activeDashboards.delete(dashboardId)
  }

  public async updateDashboardFilters(dashboardId: string, filters: Record<string, any>): Promise<void> {
    const dashboard = this.activeDashboards.get(dashboardId)
    if (!dashboard) return

    dashboard.filters = { ...dashboard.filters, ...filters }
    
    // Refresh all widgets with new filters
    await this.refreshDashboard(dashboardId)
  }

  public getSystemStats() {
    return {
      activeDashboards: this.activeDashboards.size,
      totalWidgets: Array.from(this.activeDashboards.values())
        .reduce((sum, dashboard) => sum + dashboard.widgets.size, 0),
      updateIntervals: this.updateIntervals.size,
      subscriptions: this.widgetSubscriptions.size
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = this.getSystemStats()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (stats.activeDashboards > this.CONFIG.maxConcurrentDashboards * 0.8) {
      status = 'degraded'
    }
    
    if (stats.activeDashboards >= this.CONFIG.maxConcurrentDashboards) {
      status = 'unhealthy'
    }

    return {
      status,
      details: {
        ...stats,
        maxDashboards: this.CONFIG.maxConcurrentDashboards,
        maxWidgetsPerDashboard: this.CONFIG.maxWidgetsPerDashboard
      }
    }
  }
}

// Singleton instance
let dashboardEngineInstance: DashboardEngine | null = null

export function getDashboardEngine(): DashboardEngine {
  if (!dashboardEngineInstance) {
    dashboardEngineInstance = new DashboardEngine()
  }
  return dashboardEngineInstance
}

export default DashboardEngine
