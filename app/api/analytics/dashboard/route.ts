/**
 * Analytics Dashboard API Endpoint
 * 
 * Provides REST API for creating and managing real-time analytics dashboards
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDashboardEngine, DashboardConfig } from '@/lib/analytics/dashboard-engine'
import { getAnalyticsEngine } from '@/lib/analytics/analytics-engine'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const DashboardCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  layout: z.object({
    rows: z.number().min(1).max(10),
    columns: z.number().min(1).max(12),
    widgets: z.array(z.object({
      id: z.string(),
      type: z.enum(['chart', 'kpi', 'table', 'map', 'gauge', 'text']),
      position: z.object({
        row: z.number(),
        col: z.number(),
        width: z.number(),
        height: z.number()
      }),
      config: z.record(z.any()),
      dataSource: z.string(),
      refreshInterval: z.number().min(5).max(3600).default(30)
    })).max(50)
  }),
  permissions: z.object({
    view: z.array(z.string()),
    edit: z.array(z.string())
  }).optional(),
  autoRefresh: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(5).max(300).default(30)
  }).optional()
})

const DashboardQuerySchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  category: z.string().optional(),
  search: z.string().optional()
})

const DashboardUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  layout: z.object({
    rows: z.number().min(1).max(10),
    columns: z.number().min(1).max(12),
    widgets: z.array(z.object({
      id: z.string(),
      type: z.enum(['chart', 'kpi', 'table', 'map', 'gauge', 'text']),
      position: z.object({
        row: z.number(),
        col: z.number(),
        width: z.number(),
        height: z.number()
      }),
      config: z.record(z.any()),
      dataSource: z.string(),
      refreshInterval: z.number().min(5).max(3600)
    }))
  }).optional(),
  permissions: z.object({
    view: z.array(z.string()),
    edit: z.array(z.string())
  }).optional(),
  autoRefresh: z.object({
    enabled: z.boolean(),
    interval: z.number().min(5).max(300)
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Authentication check
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

    // Check permissions - only certain roles can create dashboards
    if (!['admin', 'super_admin', 'hospital'].includes(user.role)) {
      return createApiResponse(null, 'Insufficient permissions to create dashboards', 403)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = DashboardCreateSchema.safeParse(body)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid dashboard configuration', 400, {
        errors: validationResult.error.errors
      })
    }

    const dashboardData = validationResult.data

    // Create dashboard configuration
    const dashboardConfig: DashboardConfig = {
      id: `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: dashboardData.name,
      description: dashboardData.description || '',
      layout: dashboardData.layout,
      permissions: dashboardData.permissions || {
        view: [user.role],
        edit: [user.id]
      },
      isActive: true
    }

    // Create dashboard
    const dashboardEngine = getDashboardEngine()
    const dashboardId = await dashboardEngine.createDashboard(dashboardConfig, user.id)

    // Log dashboard creation
    console.log(`Dashboard created by user ${user.id}:`, {
      dashboardId,
      name: dashboardConfig.name,
      widgetCount: dashboardConfig.layout.widgets.length,
      permissions: dashboardConfig.permissions
    })

    return createApiResponse({
      success: true,
      data: {
        dashboardId,
        name: dashboardConfig.name,
        description: dashboardConfig.description,
        widgetCount: dashboardConfig.layout.widgets.length,
        autoRefresh: dashboardData.autoRefresh
      },
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: user.id
      }
    })

  } catch (error) {
    console.error('Dashboard creation API error:', error)
    
    return createApiResponse(null, 'Dashboard creation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
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

    // Parse query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    // Convert numeric parameters
    if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit)
    if (queryParams.offset) queryParams.offset = parseInt(queryParams.offset)

    const validationResult = DashboardQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid query parameters', 400, {
        errors: validationResult.error.errors
      })
    }

    const query = validationResult.data

    // Get dashboard engine
    const dashboardEngine = getDashboardEngine()
    const analyticsEngine = getAnalyticsEngine()

    // Check what information to return based on query
    const action = url.searchParams.get('action')
    const dashboardId = url.searchParams.get('dashboardId')

    switch (action) {
      case 'list':
        return await handleListDashboards(user, query, dashboardEngine, analyticsEngine)
      
      case 'get':
        if (!dashboardId) {
          return createApiResponse(null, 'Dashboard ID required', 400)
        }
        return await handleGetDashboard(user, dashboardId, dashboardEngine)
      
      case 'stats':
        return await handleGetDashboardStats(user, dashboardEngine)
      
      case 'templates':
        return await handleGetDashboardTemplates(user)
      
      default:
        return await handleListDashboards(user, query, dashboardEngine, analyticsEngine)
    }

  } catch (error) {
    console.error('Dashboard query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve dashboards', 500)
  }
}

async function handleListDashboards(user: any, query: any, dashboardEngine: any, analyticsEngine: any) {
  // Get available dashboards
  const dashboards = await analyticsEngine.listDashboards()

  // Filter dashboards based on user permissions
  const filteredDashboards = dashboards.filter(dashboard => 
    dashboard.permissions.view.includes(user.role) || 
    dashboard.permissions.view.includes(user.id) ||
    dashboard.permissions.view.includes('all')
  )

  // Apply search filter
  let searchFiltered = filteredDashboards
  if (query.search) {
    const searchTerm = query.search.toLowerCase()
    searchFiltered = filteredDashboards.filter(dashboard =>
      dashboard.name.toLowerCase().includes(searchTerm) ||
      dashboard.description.toLowerCase().includes(searchTerm)
    )
  }

  // Apply pagination
  const paginatedDashboards = searchFiltered.slice(query.offset, query.offset + query.limit)

  return createApiResponse({
    success: true,
    data: {
      dashboards: paginatedDashboards.map(dashboard => ({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        widgetCount: dashboard.layout.widgets.length,
        permissions: dashboard.permissions,
        isActive: dashboard.isActive
      }))
    },
    pagination: {
      total: searchFiltered.length,
      limit: query.limit,
      offset: query.offset
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

async function handleGetDashboard(user: any, dashboardId: string, dashboardEngine: any) {
  // Get specific dashboard
  const dashboard = await dashboardEngine.getDashboard(dashboardId)

  if (!dashboard) {
    return createApiResponse(null, 'Dashboard not found', 404)
  }

  // Check permissions
  const config = await dashboardEngine.analyticsEngine.getDashboard(dashboardId)
  if (!config || 
      (!config.permissions.view.includes(user.role) && 
       !config.permissions.view.includes(user.id) &&
       !config.permissions.view.includes('all'))) {
    return createApiResponse(null, 'Insufficient permissions to view dashboard', 403)
  }

  // Convert dashboard state to API response format
  const dashboardData = {
    id: dashboard.id,
    widgets: Array.from(dashboard.widgets.values()).map(widget => ({
      id: widget.id,
      type: widget.type,
      config: widget.config,
      position: widget.position,
      data: (widget as any).data,
      metadata: (widget as any).metadata
    })),
    filters: dashboard.filters,
    timeRange: dashboard.timeRange,
    autoRefresh: dashboard.autoRefresh,
    layout: dashboard.layout
  }

  return createApiResponse({
    success: true,
    data: {
      dashboard: dashboardData,
      config
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

async function handleGetDashboardStats(user: any, dashboardEngine: any) {
  // Check permissions for viewing stats
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to view dashboard stats', 403)
  }

  const stats = dashboardEngine.getSystemStats()
  const healthCheck = await dashboardEngine.healthCheck()

  return createApiResponse({
    success: true,
    data: {
      systemStats: stats,
      healthCheck,
      timestamp: new Date().toISOString()
    },
    metadata: {
      requestedBy: user.id
    }
  })
}

async function handleGetDashboardTemplates(user: any) {
  // Get available dashboard templates
  const templates = [
    {
      id: 'operational_overview',
      name: 'Operational Overview',
      description: 'Key operational metrics and trends',
      category: 'operational',
      widgets: [
        { type: 'kpi', title: 'Total Donations', dataSource: 'donations' },
        { type: 'chart', title: 'Donation Trends', dataSource: 'trends' },
        { type: 'table', title: 'Recent Requests', dataSource: 'requests' }
      ]
    },
    {
      id: 'executive_summary',
      name: 'Executive Summary',
      description: 'High-level strategic metrics',
      category: 'strategic',
      widgets: [
        { type: 'kpi', title: 'Donor Conversion Rate', dataSource: 'kpis' },
        { type: 'chart', title: 'Regional Performance', dataSource: 'regions' },
        { type: 'gauge', title: 'Supply Adequacy', dataSource: 'supply' }
      ]
    },
    {
      id: 'regional_analysis',
      name: 'Regional Analysis',
      description: 'Regional performance and trends',
      category: 'regional',
      widgets: [
        { type: 'map', title: 'Regional Distribution', dataSource: 'geography' },
        { type: 'chart', title: 'Regional Trends', dataSource: 'regional_trends' },
        { type: 'table', title: 'Regional KPIs', dataSource: 'regional_kpis' }
      ]
    }
  ]

  // Filter templates based on user role
  const filteredTemplates = templates.filter(template => {
    if (template.category === 'strategic' && !['admin', 'super_admin'].includes(user.role)) {
      return false
    }
    return true
  })

  return createApiResponse({
    success: true,
    data: {
      templates: filteredTemplates
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

export async function PUT(request: NextRequest) {
  try {
    // Authentication check
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

    // Get dashboard ID from query
    const url = new URL(request.url)
    const dashboardId = url.searchParams.get('dashboardId')

    if (!dashboardId) {
      return createApiResponse(null, 'Dashboard ID required', 400)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = DashboardUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return createApiResponse(null, 'Invalid dashboard update data', 400, {
        errors: validationResult.error.errors
      })
    }

    const updateData = validationResult.data

    // Get dashboard engine
    const dashboardEngine = getDashboardEngine()
    const dashboard = await dashboardEngine.getDashboard(dashboardId)

    if (!dashboard) {
      return createApiResponse(null, 'Dashboard not found', 404)
    }

    // Check edit permissions
    const config = await dashboardEngine.analyticsEngine.getDashboard(dashboardId)
    if (!config || 
        (!config.permissions.edit.includes(user.role) && 
         !config.permissions.edit.includes(user.id))) {
      return createApiResponse(null, 'Insufficient permissions to edit dashboard', 403)
    }

    // Update dashboard configuration
    const updatedConfig = { ...config, ...updateData }
    dashboardEngine.analyticsEngine.addDashboard(updatedConfig)

    // If layout changed, recreate dashboard
    if (updateData.layout) {
      await dashboardEngine.deleteDashboard(dashboardId)
      await dashboardEngine.createDashboard(updatedConfig, user.id)
    }

    return createApiResponse({
      success: true,
      data: {
        dashboardId,
        updated: true,
        changes: Object.keys(updateData)
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: user.id
      }
    })

  } catch (error) {
    console.error('Dashboard update API error:', error)
    
    return createApiResponse(null, 'Dashboard update failed', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
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

    // Get dashboard ID from query
    const url = new URL(request.url)
    const dashboardId = url.searchParams.get('dashboardId')

    if (!dashboardId) {
      return createApiResponse(null, 'Dashboard ID required', 400)
    }

    // Get dashboard engine
    const dashboardEngine = getDashboardEngine()
    const dashboard = await dashboardEngine.getDashboard(dashboardId)

    if (!dashboard) {
      return createApiResponse(null, 'Dashboard not found', 404)
    }

    // Check delete permissions (only admins or dashboard creators)
    const config = await dashboardEngine.analyticsEngine.getDashboard(dashboardId)
    if (!config || 
        (!['admin', 'super_admin'].includes(user.role) && 
         !config.permissions.edit.includes(user.id))) {
      return createApiResponse(null, 'Insufficient permissions to delete dashboard', 403)
    }

    // Delete dashboard
    await dashboardEngine.deleteDashboard(dashboardId)

    return createApiResponse({
      success: true,
      data: {
        dashboardId,
        deleted: true
      },
      metadata: {
        deletedAt: new Date().toISOString(),
        deletedBy: user.id
      }
    })

  } catch (error) {
    console.error('Dashboard deletion API error:', error)
    
    return createApiResponse(null, 'Dashboard deletion failed', 500)
  }
}
