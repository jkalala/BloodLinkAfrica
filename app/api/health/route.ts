import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { formatHealthResponse, extractRequestMeta } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const requestMeta = extractRequestMeta(req)
  const startTime = Date.now()

  try {
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkEnvironmentVariables(),
      checkMemoryUsage(),
      checkDiskSpace(),
      checkAIServices()
    ])

    const results = {
      database: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'unhealthy', error: (checks[0] as PromiseRejectedResult).reason },
      environment: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'unhealthy', error: (checks[1] as PromiseRejectedResult).reason },
      memory: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'unhealthy', error: (checks[2] as PromiseRejectedResult).reason },
      disk: checks[3].status === 'fulfilled' ? checks[3].value : { status: 'unhealthy', error: (checks[3] as PromiseRejectedResult).reason },
      aiServices: checks[4].status === 'fulfilled' ? checks[4].value : { status: 'unhealthy', error: (checks[4] as PromiseRejectedResult).reason }
    }

    // Determine overall health status
    const unhealthyChecks = Object.values(results).filter(check => check.status === 'unhealthy')
    const degradedChecks = Object.values(results).filter(check => check.status === 'degraded')

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyChecks.length > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedChecks.length > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    const responseTime = Date.now() - startTime

    return formatHealthResponse(overallStatus, {
      checks: results,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    })

  } catch (error) {
    console.error('Health check error:', error)
    
    return formatHealthResponse('unhealthy', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    })
  }
}

async function checkDatabase(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }> {
  try {
    const supabase = getSupabase()
    const startTime = Date.now()
    
    // Simple database connectivity check
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .maybeSingle()

    const responseTime = Date.now() - startTime

    if (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          responseTime: `${responseTime}ms`
        }
      }
    }

    // Check if response time is acceptable
    if (responseTime > 5000) { // 5 seconds
      return {
        status: 'degraded',
        details: {
          message: 'Database response time is slow',
          responseTime: `${responseTime}ms`
        }
      }
    }

    return {
      status: 'healthy',
      details: {
        responseTime: `${responseTime}ms`
      }
    }

  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Database connection failed'
      }
    }
  }
}

function checkEnvironmentVariables(): { status: 'healthy' | 'degraded' | 'unhealthy'; details?: any } {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]

  const missingVars = requiredVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    return {
      status: 'unhealthy',
      details: {
        missingVariables: missingVars
      }
    }
  }

  const optionalVars = [
    'REDIS_URL',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN'
  ]

  const missingOptionalVars = optionalVars.filter(varName => !process.env[varName])

  if (missingOptionalVars.length > 0) {
    return {
      status: 'degraded',
      details: {
        message: 'Some optional features may not work',
        missingOptionalVariables: missingOptionalVars
      }
    }
  }

  return {
    status: 'healthy',
    details: {
      message: 'All required environment variables are set'
    }
  }
}

function checkMemoryUsage(): { status: 'healthy' | 'degraded' | 'unhealthy'; details?: any } {
  const usage = process.memoryUsage()
  const totalMemoryMB = usage.rss / 1024 / 1024
  const heapUsedMB = usage.heapUsed / 1024 / 1024
  const heapTotalMB = usage.heapTotal / 1024 / 1024

  // Alert if using more than 1GB total memory
  if (totalMemoryMB > 1024) {
    return {
      status: 'degraded',
      details: {
        message: 'High memory usage detected',
        rss: `${Math.round(totalMemoryMB)}MB`,
        heapUsed: `${Math.round(heapUsedMB)}MB`,
        heapTotal: `${Math.round(heapTotalMB)}MB`
      }
    }
  }

  // Alert if using more than 2GB total memory
  if (totalMemoryMB > 2048) {
    return {
      status: 'unhealthy',
      details: {
        message: 'Critical memory usage detected',
        rss: `${Math.round(totalMemoryMB)}MB`,
        heapUsed: `${Math.round(heapUsedMB)}MB`,
        heapTotal: `${Math.round(heapTotalMB)}MB`
      }
    }
  }

  return {
    status: 'healthy',
    details: {
      rss: `${Math.round(totalMemoryMB)}MB`,
      heapUsed: `${Math.round(heapUsedMB)}MB`,
      heapTotal: `${Math.round(heapTotalMB)}MB`
    }
  }
}

function checkDiskSpace(): { status: 'healthy' | 'degraded' | 'unhealthy'; details?: any } {
  try {
    // This is a simplified check - in production you'd want to check actual disk usage
    // For now, just return healthy since we can't easily check disk space in Node.js
    return {
      status: 'healthy',
      details: {
        message: 'Disk space check not implemented (requires native modules)'
      }
    }
  } catch (error) {
    return {
      status: 'degraded',
      details: {
        message: 'Could not check disk space',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

async function checkAIServices(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }> {
  try {
    const { aiMatchingService } = await import('@/lib/ai-matching-service')
    
    // Run health check on AI matching service
    const healthCheck = await aiMatchingService.healthCheck()
    
    if (healthCheck.status === 'unhealthy') {
      return {
        status: 'unhealthy',
        details: {
          service: 'AI Matching Service',
          issues: healthCheck.issues,
          metrics: healthCheck.metrics
        }
      }
    }
    
    if (healthCheck.status === 'degraded') {
      return {
        status: 'degraded',
        details: {
          service: 'AI Matching Service',
          issues: healthCheck.issues,
          metrics: healthCheck.metrics
        }
      }
    }
    
    return {
      status: 'healthy',
      details: {
        service: 'AI Matching Service',
        metrics: {
          cacheSize: healthCheck.metrics.cacheSize,
          activeRequests: healthCheck.metrics.activeRequests,
          memoryUsageMB: Math.round(healthCheck.metrics.memoryUsage.heapUsed / 1024 / 1024)
        }
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        service: 'AI Services',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}