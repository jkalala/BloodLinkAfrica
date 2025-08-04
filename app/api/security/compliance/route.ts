/**
 * Security Compliance API Endpoint
 * 
 * Provides REST API for HIPAA compliance monitoring, audit trails,
 * and security assessments
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHIPAAComplianceSystem } from '@/lib/security/hipaa-compliance'
import { getSecurityEngine } from '@/lib/security/security-engine'
import { getAuthManager } from '@/lib/security/auth-manager'
import { createApiResponse } from '@/lib/api-response'
import { z } from 'zod'

// Request validation schemas
const PHIAccessLogSchema = z.object({
  patientId: z.string().optional(),
  dataType: z.enum(['demographic', 'medical', 'financial', 'genetic', 'biometric']),
  action: z.enum(['create', 'read', 'update', 'delete', 'export', 'print']),
  purpose: z.enum(['treatment', 'payment', 'operations', 'research', 'audit', 'other']),
  justification: z.string().min(10).max(500),
  accessMethod: z.enum(['direct', 'api', 'report', 'export']),
  recordsAccessed: z.number().min(1),
  minimumNecessary: z.boolean(),
  consentStatus: z.enum(['obtained', 'not_required', 'pending', 'denied'])
})

const BreachReportSchema = z.object({
  incidentDate: z.string().datetime(),
  type: z.enum(['unauthorized_access', 'unauthorized_disclosure', 'data_loss', 'system_breach', 'physical_breach']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  affectedRecords: z.number().min(1),
  affectedIndividuals: z.array(z.string()),
  dataTypes: z.array(z.string()),
  rootCause: z.string().min(10).max(1000),
  description: z.string().min(20).max(2000),
  containmentActions: z.array(z.object({
    action: z.string(),
    responsible: z.string(),
    status: z.enum(['completed', 'in_progress', 'planned'])
  })),
  riskAssessment: z.object({
    probabilityOfCompromise: z.enum(['low', 'medium', 'high']),
    typeOfPHI: z.array(z.string()),
    unauthorizedPersons: z.string(),
    actualAcquisition: z.boolean(),
    mitigatingFactors: z.array(z.string())
  })
})

const ComplianceQuerySchema = z.object({
  framework: z.enum(['HIPAA', 'GDPR', 'ISO27001', 'SOC2']).default('HIPAA'),
  category: z.string().optional(),
  status: z.enum(['compliant', 'non_compliant', 'partial', 'under_review']).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
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

    // Parse request body
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'log_phi_access':
        return await handleLogPHIAccess(body, user)
      
      case 'report_breach':
        return await handleReportBreach(body, user)
      
      case 'assess_compliance':
        return await handleAssessCompliance(body, user)
      
      case 'generate_report':
        return await handleGenerateComplianceReport(body, user)
      
      default:
        return createApiResponse(null, 'Invalid action', 400)
    }

  } catch (error) {
    console.error('Security compliance API error:', error)
    
    return createApiResponse(null, 'Compliance operation failed', 500, {
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
  }
}

async function handleLogPHIAccess(body: any, user: any) {
  // Validate PHI access log request
  const validationResult = PHIAccessLogSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid PHI access log data', 400, {
      errors: validationResult.error.errors
    })
  }

  const phiAccessData = validationResult.data

  // Log PHI access
  const hipaaSystem = getHIPAAComplianceSystem()
  await hipaaSystem.logPHIAccess({
    userId: user.id,
    ipAddress: body.ipAddress || 'unknown',
    userAgent: body.userAgent || 'unknown',
    ...phiAccessData
  })

  return createApiResponse({
    success: true,
    data: {
      logged: true,
      timestamp: new Date().toISOString(),
      userId: user.id
    },
    metadata: {
      compliance_framework: 'HIPAA',
      data_classification: 'restricted'
    }
  })
}

async function handleReportBreach(body: any, user: any) {
  // Only admins can report breaches
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to report breaches', 403)
  }

  // Validate breach report
  const validationResult = BreachReportSchema.safeParse(body)

  if (!validationResult.success) {
    return createApiResponse(null, 'Invalid breach report data', 400, {
      errors: validationResult.error.errors
    })
  }

  const breachData = validationResult.data

  // Report breach
  const hipaaSystem = getHIPAAComplianceSystem()
  const breachId = await hipaaSystem.reportBreach({
    discoveryDate: new Date(),
    reportedDate: new Date(),
    notificationRequired: breachData.affectedRecords >= 500,
    notificationsSent: [],
    investigation: {
      investigator: user.id,
      status: 'open',
      findings: '',
      recommendations: []
    },
    ...breachData,
    incidentDate: new Date(breachData.incidentDate)
  })

  return createApiResponse({
    success: true,
    data: {
      breachId,
      reported: true,
      notificationRequired: breachData.affectedRecords >= 500,
      investigationStatus: 'open'
    },
    metadata: {
      reportedAt: new Date().toISOString(),
      reportedBy: user.id,
      severity: breachData.severity
    }
  })
}

async function handleAssessCompliance(body: any, user: any) {
  // Check permissions for compliance assessment
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions for compliance assessment', 403)
  }

  const framework = body.framework || 'HIPAA'

  // Perform compliance assessment
  const hipaaSystem = getHIPAAComplianceSystem()
  const assessment = await hipaaSystem.assessCompliance()

  return createApiResponse({
    success: true,
    data: {
      framework,
      assessment: {
        overallScore: assessment.overallScore,
        status: assessment.status,
        requirementsAssessed: assessment.requirements.length,
        compliantRequirements: assessment.requirements.filter(r => r.status === 'compliant').length,
        criticalFindings: assessment.requirements.filter(r => r.riskLevel === 'critical').length,
        recommendations: assessment.recommendations
      }
    },
    metadata: {
      assessedAt: new Date().toISOString(),
      assessedBy: user.id,
      nextAssessment: assessment.nextAssessmentDate.toISOString()
    }
  })
}

async function handleGenerateComplianceReport(body: any, user: any) {
  // Check permissions for report generation
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions for report generation', 403)
  }

  const format = body.format || 'summary'

  // Generate compliance report
  const hipaaSystem = getHIPAAComplianceSystem()
  const report = await hipaaSystem.generateComplianceReport(format)

  return createApiResponse({
    success: true,
    data: {
      reportId: report.reportId,
      reportType: report.reportType,
      format,
      content: report.content,
      generatedAt: report.generatedAt
    },
    metadata: {
      generatedBy: user.id,
      dataClassification: 'confidential'
    }
  })
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
    const action = url.searchParams.get('action')

    switch (action) {
      case 'compliance_status':
        return await handleGetComplianceStatus(user)
      
      case 'breach_incidents':
        return await handleGetBreachIncidents(user)
      
      case 'audit_trail':
        return await handleGetAuditTrail(user, url.searchParams)
      
      case 'security_metrics':
        return await handleGetSecurityMetrics(user)
      
      default:
        return await handleGetComplianceStatus(user)
    }

  } catch (error) {
    console.error('Security compliance query API error:', error)
    
    return createApiResponse(null, 'Failed to retrieve compliance data', 500)
  }
}

async function handleGetComplianceStatus(user: any) {
  // Check permissions
  if (!['admin', 'super_admin', 'hospital'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to view compliance status', 403)
  }

  const hipaaSystem = getHIPAAComplianceSystem()
  const status = await hipaaSystem.getComplianceStatus()

  return createApiResponse({
    success: true,
    data: {
      complianceStatus: status,
      framework: 'HIPAA'
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

async function handleGetBreachIncidents(user: any) {
  // Only admins can view breach incidents
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to view breach incidents', 403)
  }

  const hipaaSystem = getHIPAAComplianceSystem()
  const incidents = await hipaaSystem.getBreachIncidents()

  return createApiResponse({
    success: true,
    data: {
      incidents: incidents.map(incident => ({
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        discoveryDate: incident.discoveryDate,
        affectedRecords: incident.affectedRecords,
        status: incident.investigation.status,
        notificationRequired: incident.notificationRequired
      })),
      count: incidents.length
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

async function handleGetAuditTrail(user: any, searchParams: URLSearchParams) {
  // Check permissions for audit trail access
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to view audit trail', 403)
  }

  // Parse query parameters
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const userId = searchParams.get('userId')
  const action = searchParams.get('actionFilter')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  // Build query filters
  const filters: any = {}
  if (userId) filters.userId = userId
  if (action) filters.action = action
  if (startDate && endDate) {
    filters.timestamp = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    }
  }

  // Get audit trail data
  const securityEngine = getSecurityEngine()
  // Note: This would need to be implemented in the security engine
  const auditTrail = [] // Placeholder

  return createApiResponse({
    success: true,
    data: {
      auditTrail,
      count: auditTrail.length
    },
    pagination: {
      limit,
      offset,
      total: auditTrail.length
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id,
      filters
    }
  })
}

async function handleGetSecurityMetrics(user: any) {
  // Check permissions for security metrics
  if (!['admin', 'super_admin'].includes(user.role)) {
    return createApiResponse(null, 'Insufficient permissions to view security metrics', 403)
  }

  const securityEngine = getSecurityEngine()
  const hipaaSystem = getHIPAAComplianceSystem()

  const [securityMetrics, complianceStatus, systemStats] = await Promise.all([
    securityEngine.getSecurityMetrics(),
    hipaaSystem.getComplianceStatus(),
    hipaaSystem.getSystemStats()
  ])

  return createApiResponse({
    success: true,
    data: {
      security: securityMetrics,
      compliance: complianceStatus,
      system: systemStats,
      summary: {
        overallRiskLevel: securityMetrics.riskLevel,
        complianceScore: complianceStatus.score,
        activeThreats: securityMetrics.activeThreats,
        criticalIssues: complianceStatus.criticalIssues
      }
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestedBy: user.id
    }
  })
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    const securityEngine = getSecurityEngine()
    const hipaaSystem = getHIPAAComplianceSystem()

    const [securityHealth, complianceStats] = await Promise.all([
      securityEngine.healthCheck(),
      hipaaSystem.getSystemStats()
    ])

    const overallStatus = securityHealth.status === 'healthy' && 
                         complianceStats.requirements > 0 ? 'healthy' : 'degraded'

    return new NextResponse(null, {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: {
        'X-Security-Status': securityHealth.status,
        'X-Compliance-Requirements': complianceStats.requirements.toString(),
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
