/**
 * Comprehensive Error Handling System
 * Provides standardized error handling, logging, and response formatting
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger, LogLevel } from './logging-service'

// Error types enum for categorization
export enum ErrorType {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Validation & Input
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Database & External Services
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // Rate Limiting & Security
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // Business Logic
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  
  // System & Infrastructure
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // File & Media
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Base error interface
export interface ApplicationError {
  type: ErrorType
  message: string
  severity: ErrorSeverity
  statusCode: number
  details?: unknown
  correlationId?: string
  timestamp: string
  userId?: string
  requestId?: string
  stack?: string
}

// Custom error class

function getStatusCodeForType(type: ErrorType): number {
  switch (type) {
    case ErrorType.AUTHENTICATION_REQUIRED:
    case ErrorType.AUTHENTICATION_FAILED:
    case ErrorType.SESSION_EXPIRED:
      return 401;
    case ErrorType.AUTHORIZATION_FAILED:
      return 403;
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.INVALID_INPUT:
    case ErrorType.MISSING_REQUIRED_FIELD:
      return 400;
    case ErrorType.RESOURCE_NOT_FOUND:
      return 404;
    case ErrorType.RESOURCE_CONFLICT:
      return 409;
    case ErrorType.RATE_LIMIT_EXCEEDED:
      return 429;
    case ErrorType.FILE_TOO_LARGE:
      return 413;
    case ErrorType.UNSUPPORTED_FILE_TYPE:
      return 415;
    case ErrorType.SERVICE_UNAVAILABLE:
      return 503;
    default:
      return 500;
  }
}

export class AppError extends Error {
  // ... (rest of the class is the same)

  constructor(
    public type: ErrorType,
    public message: string,
    public severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public statusCode: number = 500,
    public details?: unknown,
    public userId?: string,
    public requestId?: string,
    public correlationId: string = generateCorrelationId(),
    public timestamp: string = new Date().toISOString()
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = getStatusCodeForType(type);
  }
}


// Utility function to generate correlation IDs
function generateCorrelationId(): string {
  return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Error mapping for common scenarios
const ERROR_MAPPINGS = {
  // Database errors
  '23505': { type: ErrorType.RESOURCE_CONFLICT, message: 'Resource already exists' },
  '23503': { type: ErrorType.VALIDATION_ERROR, message: 'Referenced resource not found' },
  '23502': { type: ErrorType.MISSING_REQUIRED_FIELD, message: 'Required field is missing' },
  '42P01': { type: ErrorType.DATABASE_ERROR, message: 'Database table not found' },
  
  // Authentication errors
  'auth/invalid-email': { type: ErrorType.VALIDATION_ERROR, message: 'Invalid email format' },
  'auth/user-not-found': { type: ErrorType.AUTHENTICATION_FAILED, message: 'Invalid credentials' },
  'auth/wrong-password': { type: ErrorType.AUTHENTICATION_FAILED, message: 'Invalid credentials' },
  'auth/too-many-requests': { type: ErrorType.RATE_LIMIT_EXCEEDED, message: 'Too many login attempts' },
}

// Error handler for different error types
export function handleError(error: unknown, userId?: string, requestId?: string): AppError {
  // If it's already an AppError, return as is
  if (error instanceof AppError) {
    return error
  }

  
  
  

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logger.error('Zod validation error', error);
    const zodError = error as ZodError;
    const details = (error as ZodError).issues.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
    
    return new AppError(
      ErrorType.VALIDATION_ERROR,
      'Input validation failed',
      ErrorSeverity.LOW,
      400,
      details,
      userId,
      requestId
    )
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    // Check for known error patterns
    const errorCode = extractErrorCode(error)
    const mapping = ERROR_MAPPINGS[errorCode as keyof typeof ERROR_MAPPINGS]
    
    if (mapping) {
      return new AppError(
        mapping.type,
        mapping.message,
        ErrorSeverity.MEDIUM,
        getStatusCodeForErrorType(mapping.type),
        { originalError: error.message },
        userId,
        requestId
      )
    }

    // Check for specific error messages
    if (error.message.includes('duplicate key value')) {
      return new AppError(
        ErrorType.RESOURCE_CONFLICT,
        'Resource already exists',
        ErrorSeverity.LOW,
        409,
        { originalError: error.message },
        userId,
        requestId
      )
    }

    if (error.message.includes('not found')) {
      return new AppError(
        ErrorType.RESOURCE_NOT_FOUND,
        'Requested resource not found',
        ErrorSeverity.LOW,
        404,
        { originalError: error.message },
        userId,
        requestId
      )
    }

    if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      return new AppError(
        ErrorType.AUTHORIZATION_FAILED,
        'Insufficient permissions',
        ErrorSeverity.MEDIUM,
        403,
        { originalError: error.message },
        userId,
        requestId
      )
    }

    // Generic error handling
    return new AppError(
      ErrorType.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
      ErrorSeverity.HIGH,
      500,
      { originalError: error.message },
      userId,
      requestId
    )
  }

  // Handle unknown error types
  return new AppError(
    ErrorType.INTERNAL_SERVER_ERROR,
    'An unknown error occurred',
    ErrorSeverity.HIGH,
    500,
    { originalError: String(error) },
    userId,
    requestId
  )
}

// Extract error codes from error messages
function extractErrorCode(error: Error): string | null {
  // PostgreSQL error codes
  const pgErrorMatch = error.message.match(/error:\s*(\d{5})/)
  if (pgErrorMatch) {
    return pgErrorMatch[1]
  }

  // Firebase Auth error codes
  const authErrorMatch = error.message.match(/auth\/([a-z-]+)/)
  if (authErrorMatch) {
    return `auth/${authErrorMatch[1]}`
  }

  return null
}

// Get appropriate HTTP status code for error type
function getStatusCodeForErrorType(type: ErrorType): number {
  switch (type) {
    case ErrorType.AUTHENTICATION_REQUIRED:
    case ErrorType.AUTHENTICATION_FAILED:
    case ErrorType.SESSION_EXPIRED:
      return 401
    
    case ErrorType.AUTHORIZATION_FAILED:
      return 403
    
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.INVALID_INPUT:
    case ErrorType.MISSING_REQUIRED_FIELD:
      return 400
    
    case ErrorType.RESOURCE_NOT_FOUND:
      return 404
    
    case ErrorType.RESOURCE_CONFLICT:
      return 409
    
    case ErrorType.RATE_LIMIT_EXCEEDED:
      return 429
    
    case ErrorType.FILE_TOO_LARGE:
      return 413
    
    case ErrorType.UNSUPPORTED_FILE_TYPE:
      return 415
    
    case ErrorType.SERVICE_UNAVAILABLE:
      return 503
    
    default:
      return 500
  }
}

// Create standardized API error response
export function createErrorResponse(error: AppError): NextResponse {
  // Determine what to expose to client based on environment
  const isProduction = process.env.NODE_ENV === 'production'
  
  const clientError = {
    success: false,
    error: {
      type: error.type,
      message: error.message,
      correlationId: error.correlationId,
      timestamp: error.timestamp,
      ...(isProduction ? {} : { details: error.details })
    }
  }

  // Log error internally
  logger.error('API Error Response', error, logData)

  return NextResponse.json(clientError, { 
    status: error.statusCode,
    headers: {
      'X-Correlation-ID': error.correlationId,
      'X-Error-Type': error.type
    }
  })
}

// Error logging function
export function logError(error: AppError): void {
  const logData = {
    correlationId: error.correlationId,
    type: error.type,
    severity: error.severity,
    message: error.message,
    statusCode: error.statusCode,
    timestamp: error.timestamp,
    userId: error.userId,
    requestId: error.requestId,
    details: error.details,
    stack: error.stack
  }

  // Log based on severity
  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      logger.critical('CRITICAL ERROR', error, logData)
      break
    
    case ErrorSeverity.HIGH:
      logger.error('HIGH SEVERITY ERROR', error, logData)
      break
    
    case ErrorSeverity.MEDIUM:
      logger.warn('MEDIUM SEVERITY ERROR', logData)
      break
    
    case ErrorSeverity.LOW:
      logger.info('LOW SEVERITY ERROR', logData)
      break
  }

  // In production, send to external logging service
  if (process.env.NODE_ENV === 'production') {
    // sendToLoggingService(logData)
  }
}

// Convenience functions for common errors
export const AuthenticationError = (message: string = 'Authentication required', userId?: string) =>
  new AppError(ErrorType.AUTHENTICATION_REQUIRED, message, ErrorSeverity.MEDIUM, 401, undefined, userId)

export const AuthorizationError = (message: string = 'Insufficient permissions', userId?: string) =>
  new AppError(ErrorType.AUTHORIZATION_FAILED, message, ErrorSeverity.MEDIUM, 403, undefined, userId)

export const ValidationError = (message: string, details?: unknown, userId?: string) =>
  new AppError(ErrorType.VALIDATION_ERROR, message, ErrorSeverity.LOW, 400, details, userId)

export const NotFoundError = (resource: string = 'Resource', userId?: string) =>
  new AppError(ErrorType.RESOURCE_NOT_FOUND, `${resource} not found`, ErrorSeverity.LOW, 404, undefined, userId)

export const ConflictError = (message: string = 'Resource conflict', userId?: string) =>
  new AppError(ErrorType.RESOURCE_CONFLICT, message, ErrorSeverity.LOW, 409, undefined, userId)

export const RateLimitError = (message: string = 'Rate limit exceeded', userId?: string) =>
  new AppError(ErrorType.RATE_LIMIT_EXCEEDED, message, ErrorSeverity.MEDIUM, 429, undefined, userId)

export const InternalError = (message: string = 'Internal server error', details?: unknown, userId?: string) =>
  new AppError(ErrorType.INTERNAL_SERVER_ERROR, message, ErrorSeverity.HIGH, 500, details, userId)

// Async error wrapper for API routes
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await fn(...args)
    } catch (error) {
      const appError = handleError(error)
      return createErrorResponse(appError)
    }
  }
}

// Type guard to check if error is AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}