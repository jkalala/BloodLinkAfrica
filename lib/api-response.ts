/**
 * API Response Standardization
 * Provides consistent response formatting, pagination, and metadata for all API endpoints
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

// Standard API response interface
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    type: string
    message: string
    code?: string
    details?: unknown
    correlationId?: string
    timestamp: string
  }
  meta?: {
    timestamp: string
    requestId?: string
    version: string
    pagination?: PaginationMeta
    rateLimit?: RateLimitMeta
  }
}

// Pagination metadata interface
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  nextPage?: number
  prevPage?: number
}

// Rate limiting metadata interface
export interface RateLimitMeta {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

// Request metadata interface  
export interface RequestMeta {
  requestId?: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

// Success response builder
export class ApiSuccessResponse<T = any> {
  private response: ApiResponse<T>

  constructor(data?: T, message?: string) {
    this.response = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0'
      }
    }
  }

  withMeta(meta: Partial<RequestMeta>): this {
    this.response.meta = {
      ...this.response.meta!,
      ...meta
    }
    return this
  }

  withPagination(pagination: PaginationMeta): this {
    this.response.meta!.pagination = pagination
    return this
  }

  withRateLimit(rateLimit: RateLimitMeta): this {
    this.response.meta!.rateLimit = rateLimit
    return this
  }

  build(statusCode: number = 200): NextResponse {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Version': this.response.meta!.version,
      'X-Timestamp': this.response.meta!.timestamp
    }

    // Add request ID header if available
    if (this.response.meta?.requestId) {
      headers['X-Request-ID'] = this.response.meta.requestId
    }

    // Add rate limit headers if available
    if (this.response.meta?.rateLimit) {
      const { limit, remaining, reset, retryAfter } = this.response.meta.rateLimit
      headers['X-RateLimit-Limit'] = limit.toString()
      headers['X-RateLimit-Remaining'] = remaining.toString()
      headers['X-RateLimit-Reset'] = reset.toString()
      
      if (retryAfter) {
        headers['Retry-After'] = retryAfter.toString()
      }
    }

    return NextResponse.json(this.response, { status: statusCode, headers })
  }
}

// Error response builder
export class ApiErrorResponse {
  private response: ApiResponse

  constructor(
    type: string,
    message: string,
    statusCode: number = 500,
    details?: unknown,
    correlationId?: string
  ) {
    this.response = {
      success: false,
      error: {
        type,
        message,
        details,
        correlationId,
        timestamp: new Date().toISOString()
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0'
      }
    }
  }

  withMeta(meta: Partial<RequestMeta>): this {
    this.response.meta = {
      ...this.response.meta!,
      ...meta
    }
    return this
  }

  withCode(code: string): this {
    this.response.error!.code = code
    return this
  }

  build(statusCode: number): NextResponse {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Version': this.response.meta!.version,
      'X-Timestamp': this.response.meta!.timestamp
    }

    // Add correlation ID header if available
    if (this.response.error?.correlationId) {
      headers['X-Correlation-ID'] = this.response.error.correlationId
    }

    // Add request ID header if available
    if (this.response.meta?.requestId) {
      headers['X-Request-ID'] = this.response.meta.requestId
    }

    return NextResponse.json(this.response, { status: statusCode, headers })
  }
}

// Pagination utility
export class PaginationBuilder {
  static build(
    page: number,
    limit: number,
    total: number
  ): PaginationMeta {
    const totalPages = Math.ceil(total / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : undefined,
      prevPage: hasPrev ? page - 1 : undefined
    }
  }

  static parseQuery(query: Record<string, any>): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20))
    const offset = (page - 1) * limit

    return { page, limit, offset }
  }
}

// Query parameter validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
})

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export const searchSchema = z.object({
  q: z.string().optional(),
  filter: z.record(z.string()).optional()
})

// Standard query parameters schema
export const standardQuerySchema = paginationSchema
  .merge(sortSchema)
  .merge(searchSchema)

// Response formatter utilities
export const formatSuccessResponse = <T>(
  data: T,
  meta?: Partial<RequestMeta>,
  pagination?: PaginationMeta,
  statusCode: number = 200
): NextResponse => {
  const builder = new ApiSuccessResponse(data)

  if (meta) {
    builder.withMeta(meta)
  }

  if (pagination) {
    builder.withPagination(pagination)
  }

  return builder.build(statusCode)
}

export const formatErrorResponse = (
  type: string,
  message: string,
  statusCode: number,
  details?: unknown,
  correlationId?: string,
  meta?: Partial<RequestMeta>
): NextResponse => {
  const builder = new ApiErrorResponse(type, message, statusCode, details, correlationId)

  if (meta) {
    builder.withMeta(meta)
  }

  return builder.build(statusCode)
}

export const formatValidationErrorResponse = (
  errors: unknown[],
  meta?: Partial<RequestMeta>
): NextResponse => {
  return formatErrorResponse(
    'VALIDATION_ERROR',
    'Input validation failed',
    400,
    { validationErrors: errors },
    undefined,
    meta
  )
}

export const formatNotFoundResponse = (
  resource: string = 'Resource',
  meta?: Partial<RequestMeta>
): NextResponse => {
  return formatErrorResponse(
    'RESOURCE_NOT_FOUND',
    `${resource} not found`,
    404,
    undefined,
    undefined,
    meta
  )
}

export const formatUnauthorizedResponse = (
  message: string = 'Authentication required',
  meta?: Partial<RequestMeta>
): NextResponse => {
  return formatErrorResponse(
    'AUTHENTICATION_REQUIRED',
    message,
    401,
    undefined,
    undefined,
    meta
  )
}

export const formatForbiddenResponse = (
  message: string = 'Insufficient permissions',
  meta?: Partial<RequestMeta>
): NextResponse => {
  return formatErrorResponse(
    'AUTHORIZATION_FAILED',
    message,
    403,
    undefined,
    undefined,
    meta
  )
}

export const formatRateLimitResponse = (
  retryAfter: number,
  meta?: Partial<RequestMeta>
): NextResponse => {
  const builder = new ApiErrorResponse(
    'RATE_LIMIT_EXCEEDED',
    'Rate limit exceeded. Please try again later.',
    429
  )

  if (meta) {
    builder.withMeta(meta)
  }

  const response = builder.build(429)
  response.headers.set('Retry-After', retryAfter.toString())
  
  return response
}

// Generic list response formatter
export const formatListResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  meta?: Partial<RequestMeta>
): NextResponse => {
  const pagination = PaginationBuilder.build(page, limit, total)
  
  return formatSuccessResponse(
    {
      items,
      pagination
    },
    meta,
    pagination
  )
}

// Health check response formatter
export const formatHealthResponse = (
  status: 'healthy' | 'degraded' | 'unhealthy',
  details?: Record<string, unknown>
): NextResponse => {
  const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503

  return formatSuccessResponse(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.API_VERSION || '1.0.0',
      details
    },
    undefined,
    undefined,
    statusCode
  )
}

// Request metadata extractor
export const extractRequestMeta = (request: Request): RequestMeta => {
  const headers = request.headers
  
  return {
    requestId: headers.get('x-request-id') || undefined,
    userId: headers.get('x-user-id') || undefined,
    ipAddress: headers.get('x-forwarded-for')?.split(',')[0] || 
               headers.get('x-real-ip') || 
               undefined,
    userAgent: headers.get('user-agent') || undefined,
    timestamp: new Date().toISOString()
  }
}

// API version compatibility checker
export const checkApiVersion = (requestVersion?: string): boolean => {
  const currentVersion = process.env.API_VERSION || '1.0.0'
  const supportedVersions = process.env.SUPPORTED_API_VERSIONS?.split(',') || [currentVersion]
  
  return !requestVersion || supportedVersions.includes(requestVersion)
}

// Response cache headers utility
export const addCacheHeaders = (
  response: NextResponse,
  cacheControl: string = 'no-cache',
  etag?: string
): NextResponse => {
  response.headers.set('Cache-Control', cacheControl)
  
  if (etag) {
    response.headers.set('ETag', etag)
  }
  
  response.headers.set('Vary', 'Accept, Authorization, X-API-Version')
  
  return response
}

// CORS headers utility
export const addCorsHeaders = (
  response: NextResponse,
  origin?: string,
  methods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: string[] = ['Content-Type', 'Authorization', 'X-API-Version']
): NextResponse => {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Methods', methods.join(', '))
  response.headers.set('Access-Control-Allow-Headers', headers.join(', '))
  response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
  
  return response
}

// Type definitions for TypeScript support
export type SuccessResponseData<T> = {
  success: true
  data: T
  meta: {
    timestamp: string
    requestId?: string
    version: string
    pagination?: PaginationMeta
    rateLimit?: RateLimitMeta
  }
}

export type ErrorResponseData = {
  success: false
  error: {
    type: string
    message: string
    code?: string
    details?: unknown
    correlationId?: string
    timestamp: string
  }
  meta: {
    timestamp: string
    requestId?: string
    version: string
  }
}