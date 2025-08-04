/**
 * Security scan API endpoint
 * Provides programmatic access to security scanning functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, AuthorizationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { SecurityScanner, runQuickSecurityCheck } from '@/lib/security-scanner'

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/admin/security/scan', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Verify admin permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      throw AuthorizationError('Admin access required')
    }

    // Get scan type from request body
    const body = await request.json().catch(() => ({}))
    const scanType = body.type || 'full'

    let scanResult

    if (scanType === 'quick') {
      // Run quick security check
      scanResult = await runQuickSecurityCheck()
      
      const response = {
        success: true,
        data: {
          scanType: 'quick',
          result: scanResult
        }
      }

      tracker.end(200)
      return NextResponse.json(response)
    } else {
      // Run full security scan
      const scanner = new SecurityScanner()
      scanResult = await scanner.runScan()

      const response = {
        success: true,
        data: {
          scanType: 'full',
          result: scanResult
        }
      }

      tracker.end(200)
      return NextResponse.json(response)
    }

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/admin/security/scan', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Verify admin permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      throw AuthorizationError('Admin access required')
    }

    // Get query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Get scan history from database
    const { data: scanHistory, error: historyError } = await supabase
      .from('security_scan_results')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (historyError) {
      throw new Error(`Failed to fetch scan history: ${historyError.message}`)
    }

    // Get scan statistics
    const { data: stats } = await supabase
      .from('security_scan_results')
      .select('status, summary')
      .order('timestamp', { ascending: false })
      .limit(30) // Last 30 scans for statistics

    const statistics = calculateScanStatistics(stats || [])

    const response = {
      success: true,
      data: {
        scanHistory: scanHistory || [],
        statistics,
        pagination: {
          limit,
          offset,
          hasMore: (scanHistory?.length || 0) === limit
        }
      }
    }

    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

/**
 * Calculate scan statistics from historical data
 */
function calculateScanStatistics(scans: any[]) {
  const total = scans.length
  const passed = scans.filter(s => s.status === 'passed').length
  const warning = scans.filter(s => s.status === 'warning').length
  const failed = scans.filter(s => s.status === 'failed').length

  // Calculate average findings per severity
  const avgFindings = scans.reduce((acc, scan) => {
    if (scan.summary) {
      acc.critical += scan.summary.critical || 0
      acc.high += scan.summary.high || 0
      acc.medium += scan.summary.medium || 0
      acc.low += scan.summary.low || 0
      acc.total += scan.summary.total || 0
    }
    return acc
  }, { critical: 0, high: 0, medium: 0, low: 0, total: 0 })

  if (total > 0) {
    avgFindings.critical = Math.round(avgFindings.critical / total * 100) / 100
    avgFindings.high = Math.round(avgFindings.high / total * 100) / 100
    avgFindings.medium = Math.round(avgFindings.medium / total * 100) / 100
    avgFindings.low = Math.round(avgFindings.low / total * 100) / 100
    avgFindings.total = Math.round(avgFindings.total / total * 100) / 100
  }

  // Get trend (comparing first half vs second half of scans)
  const halfPoint = Math.floor(total / 2)
  const recentScans = scans.slice(0, halfPoint)
  const olderScans = scans.slice(halfPoint)

  const recentAvgIssues = recentScans.reduce((sum, scan) => sum + (scan.summary?.total || 0), 0) / (recentScans.length || 1)
  const olderAvgIssues = olderScans.reduce((sum, scan) => sum + (scan.summary?.total || 0), 0) / (olderScans.length || 1)

  const trend = recentAvgIssues < olderAvgIssues ? 'improving' : 
                recentAvgIssues > olderAvgIssues ? 'declining' : 'stable'

  return {
    totalScans: total,
    statusDistribution: {
      passed: { count: passed, percentage: total > 0 ? Math.round(passed / total * 100) : 0 },
      warning: { count: warning, percentage: total > 0 ? Math.round(warning / total * 100) : 0 },
      failed: { count: failed, percentage: total > 0 ? Math.round(failed / total * 100) : 0 }
    },
    averageFindings: avgFindings,
    trend: {
      direction: trend,
      recentAverage: Math.round(recentAvgIssues * 100) / 100,
      previousAverage: Math.round(olderAvgIssues * 100) / 100
    },
    lastScan: scans[0] ? {
      timestamp: scans[0].timestamp,
      status: scans[0].status,
      totalFindings: scans[0].summary?.total || 0
    } : null
  }
}