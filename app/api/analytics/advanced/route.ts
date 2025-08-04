/**
 * Advanced Analytics & Reporting API Endpoint
 * 
 * Provides REST API for business intelligence dashboards,
 * advanced reporting, and predictive analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsEngine } from '@/lib/analytics/analytics-engine'
import { getAdvancedBIDashboard } from '@/lib/analytics/advanced-bi-dashboard'
import { getAdvancedReportingSystem } from '@/lib/analytics/advanced-reporting-system'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const AnalyticsQuerySchema = z.object({
  queryId: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  timeRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    granularity: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional()
  }).optional(),
  filters: z.record(z.any()).optional()
})

const KPICalculationSchema = z.object({
  kpiId: z.string().min(1),
  timeRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional()
  }).optional()
})

const DashboardCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['executive', 'operational', 'clinical', 'financial', 'predictive', 'custom']),
  layout: z.object({
    type: z.enum(['grid', 'masonry', 'tabs', 'accordion']),
    columns: z.number().min(1).max(12),
    responsive: z.boolean()
  }),
  widgets: z.array(z.object({
    id: z.string(),
    type: z.enum(['chart', 'metric_card', 'table', 'map', 'gauge', 'heatmap', 'funnel', 'sankey', 'treemap', 'radar', 'waterfall']),
    title: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    dataSource: z.object({
      queryId: z.string(),
      parameters: z.record(z.any()).optional(),
      refreshStrategy: z.enum(['real_time', 'scheduled', 'on_demand'])
    }),
    visualization: z.object({
      chartType: z.string(),
      dimensions: z.record(z.any()),
      styling: z.record(z.any()),
      axes: z.record(z.any()).optional(),
      animations: z.record(z.any()).optional()
    })
  })),
  realTimeUpdates: z.boolean().default(false),
  refreshInterval: z.number().min(5).max(3600).default(60),
  isPublic: z.boolean().default(false)
})

const ReportTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['operational', 'financial', 'clinical', 'regulatory', 'executive', 'custom']),
  type: z.enum(['tabular', 'dashboard', 'narrative', 'infographic', 'presentation']),
  sections: z.array(z.object({
    id: z.string(),
    type: z.enum(['header', 'summary', 'chart', 'table', 'text', 'image', 'page_break', 'footer']),
    title: z.string().optional(),
    content: z.record(z.any()),
    position: z.object({
      page: z.number().optional(),
      order: z.number()
    })
  })),
  parameters: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['date', 'date_range', 'select', 'multi_select', 'number', 'text', 'boolean']),
    label: z.string(),
    required: z.boolean(),
    defaultValue: z.any().optional()
  })),
  styling: z.object({
    theme: z.enum(['professional', 'modern', 'minimal', 'colorful']),
    colors: z.record(z.string()),
    fonts: z.record(z.string()),
    layout: z.record(z.any())
  })
})

const ReportGenerationSchema = z.object({
  templateId: z.string().min(1),
  parameters: z.record(z.any()),
  format: z.enum(['pdf', 'excel', 'csv', 'html', 'json']).default('pdf')
})

const PredictionRequestSchema = z.object({
  modelId: z.string().min(1),
  features: z.record(z.any()),
  includeExplanation: z.boolean().default(true)
})

export async function POST(request: NextRequest) {
  try {
    // Authentication required for most operations
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createApiResponse(null, 'Authentication required', 401)
    }

    const token = authHeader.substring(7)
    const authManager = getAuthManager()
    const user = await authManager.verifyToken(token)

    if (!user) {
      return createApiResponse(null, 'Invalid token', 401)
    }

    // Parse request body
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'execute_query':
        return await handleExecuteQuery(body, user)
      
      case 'calculate_kpi':
        return await handleCalculateKPI(body, user)
      
      case 'create_dashboard':
        return await handleCreateDashboard(body, user)
      
      case 'render_widget':
        return await handleRenderWidget(body, user)
      
      case 'generate_insights':
        return await handleGenerateInsights(body, user)
      
      case 'export_dashboard':
        return await handleExportDashboard(body, user)
      
      case 'create_report_template':
        return await handleCreateReportTemplate(body, user)
      
      case 'generate_report':
        return await handleGenerateReport(body, user)
      
      case 'generate_prediction':
        return await handleGeneratePrediction(body, user)
      
      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Advanced analytics API error:', error)
    
    return createApiResponse(null, 'Analytics operation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

async function handleExecuteQuery(body: any, user: any) {
  // Validate analytics query request
  const validationResult = AnalyticsQuerySchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid analytics query data', 400, {
      errors: validationResult.error.errors
    })
  }

  const queryData = validationResult.data

  // Execute analytics query
  const analyticsEngine = getAnalyticsEngine()
  const result = await analyticsEngine.executeQuery(queryData.queryId, queryData.parameters)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      queryId: queryData.queryId,
      data: result.data,
      metadata: result.metadata
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      executedAt: new Date().toISOString(),
      parameters: queryData.parameters
    }
  })
}

async function handleCalculateKPI(body: any, user: any) {
  // Validate KPI calculation request
  const validationResult = KPICalculationSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid KPI calculation data', 400, {
      errors: validationResult.error.errors
    })
  }

  const kpiData = validationResult.data

  // Parse time range if provided
  let timeRange
  if (kpiData.timeRange) {
    timeRange = {
      start: kpiData.timeRange.start ? new Date(kpiData.timeRange.start) : undefined,
      end: kpiData.timeRange.end ? new Date(kpiData.timeRange.end) : undefined
    }
  }

  // Calculate KPI
  const analyticsEngine = getAnalyticsEngine()
  const result = await analyticsEngine.calculateKPI(kpiData.kpiId, timeRange)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      kpi: result.metric,
      calculatedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      kpiId: kpiData.kpiId,
      timeRange
    }
  })
}

async function handleCreateDashboard(body: any, user: any) {
  // Validate dashboard creation request
  const validationResult = DashboardCreateSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid dashboard data', 400, {
      errors: validationResult.error.errors
    })
  }

  const dashboardData = validationResult.data

  // Create dashboard
  const biDashboard = getAdvancedBIDashboard()
  const result = await biDashboard.createDashboard({
    ...dashboardData,
    filters: [],
    drillDowns: [],
    permissions: {
      view: [user.id],
      edit: [user.id],
      export: [user.id],
      share: [user.id]
    },
    theme: {
      colorScheme: 'light',
      primaryColor: '#2c3e50',
      accentColors: ['#3498db', '#e74c3c', '#27ae60'],
      fontFamily: 'Arial'
    },
    createdBy: user.id
  })

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      dashboardId: result.dashboardId,
      created: true,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      widgetCount: dashboardData.widgets.length,
      category: dashboardData.category
    }
  })
}

async function handleRenderWidget(body: any, user: any) {
  const { widgetId, dashboardId, filters } = body

  if (!widgetId || !dashboardId) {
    return createApiResponse(null, 'Widget ID and Dashboard ID are required', 400)
  }

  // Render widget
  const biDashboard = getAdvancedBIDashboard()
  const result = await biDashboard.renderWidget(widgetId, dashboardId, filters)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      widget: result.widgetData,
      renderedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      widgetId,
      dashboardId,
      filtersApplied: filters ? Object.keys(filters).length : 0
    }
  })
}

async function handleGenerateInsights(body: any, user: any) {
  const { dashboardId } = body

  if (!dashboardId) {
    return createApiResponse(null, 'Dashboard ID is required', 400)
  }

  // Generate predictive insights
  const biDashboard = getAdvancedBIDashboard()
  const result = await biDashboard.generatePredictiveInsights(dashboardId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      insights: result.insights,
      generatedAt: new Date().toISOString(),
      count: result.insights?.length || 0
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      dashboardId
    }
  })
}

async function handleExportDashboard(body: any, user: any) {
  const { dashboardId, format = 'pdf' } = body

  if (!dashboardId) {
    return createApiResponse(null, 'Dashboard ID is required', 400)
  }

  if (!['pdf', 'png', 'excel', 'json'].includes(format)) {
    return createApiResponse(null, 'Invalid export format', 400)
  }

  // Export dashboard
  const biDashboard = getAdvancedBIDashboard()
  const result = await biDashboard.exportDashboard(dashboardId, format)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      exportData: {
        format: result.exportData?.format,
        filename: result.exportData?.filename,
        mimeType: result.exportData?.mimeType,
        size: result.exportData?.data ? Buffer.byteLength(result.exportData.data as any) : 0
      },
      exportedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      dashboardId,
      format
    }
  })
}

async function handleCreateReportTemplate(body: any, user: any) {
  // Validate report template creation request
  const validationResult = ReportTemplateSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid report template data', 400, {
      errors: validationResult.error.errors
    })
  }

  const templateData = validationResult.data

  // Create report template
  const reportingSystem = getAdvancedReportingSystem()
  const result = await reportingSystem.createReportTemplate({
    ...templateData,
    distribution: {
      recipients: [],
      attachments: true,
      compression: 'none'
    },
    isActive: true,
    createdBy: user.id
  })

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      templateId: result.templateId,
      created: true,
      createdAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      category: templateData.category,
      sectionCount: templateData.sections.length
    }
  })
}

async function handleGenerateReport(body: any, user: any) {
  // Validate report generation request
  const validationResult = ReportGenerationSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid report generation data', 400, {
      errors: validationResult.error.errors
    })
  }

  const reportData = validationResult.data

  // Generate report
  const reportingSystem = getAdvancedReportingSystem()
  const result = await reportingSystem.generateReport(
    reportData.templateId,
    reportData.parameters,
    reportData.format
  )

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      reportId: result.reportId,
      status: 'generating',
      generatedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      templateId: reportData.templateId,
      format: reportData.format,
      parameters: reportData.parameters
    }
  })
}

async function handleGeneratePrediction(body: any, user: any) {
  // Validate prediction request
  const validationResult = PredictionRequestSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid prediction request data', 400, {
      errors: validationResult.error.errors
    })
  }

  const predictionData = validationResult.data

  // Generate prediction
  const analyticsEngine = getAnalyticsEngine()
  const result = await analyticsEngine.generatePrediction(predictionData.modelId, predictionData.features)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      prediction: result.prediction,
      generatedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user.id,
      modelId: predictionData.modelId,
      featuresCount: Object.keys(predictionData.features).length
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    // Some actions may not require authentication
    let user = null
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const authManager = getAuthManager()
      user = await authManager.verifyToken(token)
    }

    switch (action) {
      case 'get_dashboard':
        return await handleGetDashboard(url.searchParams, user)
      
      case 'get_report':
        return await handleGetReport(url.searchParams, user)
      
      case 'download_report':
        return await handleDownloadReport(url.searchParams, user)
      
      case 'get_report_analytics':
        return await handleGetReportAnalytics(url.searchParams, user)
      
      case 'get_core_queries':
        return await handleGetCoreQueries()
      
      case 'get_kpi_definitions':
        return await handleGetKPIDefinitions()
      
      case 'get_dashboard_templates':
        return await handleGetDashboardTemplates()
      
      case 'get_report_templates':
        return await handleGetReportTemplates()
      
      case 'system_stats':
        return await handleGetSystemStats()
      
      default:
        return await handleGetSystemStats()
    }

  } catch (error) {
    console.error('Advanced analytics query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve analytics data', 500)
  }
}

async function handleGetDashboard(searchParams: URLSearchParams, user: any) {
  const dashboardId = searchParams.get('dashboardId')

  if (!dashboardId) {
    return createApiResponse(null, 'Dashboard ID is required', 400)
  }

  const biDashboard = getAdvancedBIDashboard()
  const result = await biDashboard.getDashboard(dashboardId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      dashboard: result.dashboard,
      retrievedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user?.id,
      dashboardId
    }
  })
}

async function handleGetReport(searchParams: URLSearchParams, user: any) {
  const reportId = searchParams.get('reportId')

  if (!reportId) {
    return createApiResponse(null, 'Report ID is required', 400)
  }

  const reportingSystem = getAdvancedReportingSystem()
  const result = await reportingSystem.getReport(reportId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      report: {
        ...result.report,
        data: undefined // Don't include actual content in status response
      },
      retrievedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user?.id,
      reportId
    }
  })
}

async function handleDownloadReport(searchParams: URLSearchParams, user: any) {
  const reportId = searchParams.get('reportId')

  if (!reportId) {
    return createApiResponse(null, 'Report ID is required', 400)
  }

  if (!user) {
    return createApiResponse(null, 'Authentication required for report download', 401)
  }

  const reportingSystem = getAdvancedReportingSystem()
  const result = await reportingSystem.downloadReport(reportId)

  if (!result.success || !result.data) {
    return createApiResponse(null, result.error || 'Report not available', 404)
  }

  // Return file download response
  return new NextResponse(result.data.content as any, {
    status: 200,
    headers: {
      'Content-Type': result.data.mimeType,
      'Content-Disposition': `attachment; filename="${result.data.filename}"`,
      'Content-Length': result.data.size.toString()
    }
  })
}

async function handleGetReportAnalytics(searchParams: URLSearchParams, user: any) {
  const templateId = searchParams.get('templateId')

  if (!templateId) {
    return createApiResponse(null, 'Template ID is required', 400)
  }

  const reportingSystem = getAdvancedReportingSystem()
  const result = await reportingSystem.getReportAnalytics(templateId)

  return createApiResponse({
    success: result.success,
    data: result.success ? {
      analytics: result.analytics,
      retrievedAt: new Date().toISOString()
    } : null,
    error: result.error,
    metadata: {
      userId: user?.id,
      templateId
    }
  })
}

async function handleGetCoreQueries() {
  const analyticsEngine = getAnalyticsEngine()
  const queries = analyticsEngine.getCoreQueries()

  return createApiResponse({
    success: true,
    data: {
      queries,
      count: queries.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetKPIDefinitions() {
  const analyticsEngine = getAnalyticsEngine()
  const kpiDefinitions = analyticsEngine.getKPIDefinitions()

  return createApiResponse({
    success: true,
    data: {
      kpis: Object.entries(kpiDefinitions).map(([id, definition]) => ({
        id,
        ...definition
      })),
      count: Object.keys(kpiDefinitions).length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetDashboardTemplates() {
  const biDashboard = getAdvancedBIDashboard()
  const templates = biDashboard.getDashboardTemplates()

  return createApiResponse({
    success: true,
    data: {
      templates,
      count: templates.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetReportTemplates() {
  const reportingSystem = getAdvancedReportingSystem()
  const templates = reportingSystem.getReportTemplates()

  return createApiResponse({
    success: true,
    data: {
      templates,
      count: templates.length
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

async function handleGetSystemStats() {
  const analyticsEngine = getAnalyticsEngine()
  const biDashboard = getAdvancedBIDashboard()
  const reportingSystem = getAdvancedReportingSystem()

  const [analyticsStats, dashboardStats, reportingStats] = await Promise.all([
    analyticsEngine.getSystemStats(),
    biDashboard.getSystemStats(),
    reportingSystem.getSystemStats()
  ])

  return createApiResponse({
    success: true,
    data: {
      analytics: analyticsStats,
      dashboards: dashboardStats,
      reporting: reportingStats,
      overall: {
        totalQueries: analyticsStats.coreQueries,
        totalKPIs: analyticsStats.kpiDefinitions,
        totalDashboardTemplates: dashboardStats.dashboardTemplates,
        totalReportTemplates: reportingStats.reportTemplates,
        supportedFormats: reportingStats.supportedFormats
      }
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    const analyticsEngine = getAnalyticsEngine()
    const biDashboard = getAdvancedBIDashboard()
    const reportingSystem = getAdvancedReportingSystem()

    const [analyticsHealth, dashboardHealth, reportingHealth] = await Promise.all([
      analyticsEngine.healthCheck(),
      biDashboard.healthCheck(),
      reportingSystem.healthCheck()
    ])

    const overallStatus = [analyticsHealth, dashboardHealth, reportingHealth]
      .every(h => h.status === 'healthy') ? 'healthy' :
      [analyticsHealth, dashboardHealth, reportingHealth]
        .some(h => h.status === 'unhealthy') ? 'unhealthy' : 'degraded'

    return new NextResponse(null, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 206 : 503,
      headers: {
        'X-Analytics-Status': analyticsHealth.status,
        'X-Dashboard-Status': dashboardHealth.status,
        'X-Reporting-Status': reportingHealth.status,
        'X-System-Health': overallStatus
      }
    })

  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-System-Health': 'unhealthy',
        'X-Error': 'Health check failed'
      }
    })
  }
}
