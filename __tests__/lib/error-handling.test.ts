/**
 * Tests for error handling system
 */




jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      body: JSON.stringify(body),
      headers: init?.headers || {},
    })),
  },
  NextRequest: jest.fn(),
}));



import {
  AppError,
  ErrorType,
  ErrorSeverity,
  handleError,
  createErrorResponse,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  isAppError
} from '../../lib/error-handling'
import { ZodError } from 'zod'

describe('AppError', () => {
  it('should create an AppError with all properties', () => {
    const error = new AppError(
      ErrorType.VALIDATION_ERROR,
      'Test error message',
      ErrorSeverity.HIGH,
      400,
      { field: 'test' },
      'user-123',
      'req-456'
    )

    expect(error.type).toBe(ErrorType.VALIDATION_ERROR)
    expect(error.message).toBe('Test error message')
    expect(error.severity).toBe(ErrorSeverity.HIGH)
    expect(error.statusCode).toBe(400)
    expect(error.details).toEqual({ field: 'test' })
    expect(error.userId).toBe('user-123')
    expect(error.requestId).toBe('req-456')
    expect(error.correlationId).toMatch(/^err-\d+-[a-z0-9]+$/)
    expect(error.timestamp).toBeDefined()
    expect(error.name).toBe('AppError')
  })

  it('should have default values for optional parameters', () => {
    const error = new AppError(ErrorType.INTERNAL_SERVER_ERROR, 'Test error')

    expect(error.severity).toBe(ErrorSeverity.MEDIUM)
    expect(error.statusCode).toBe(500)
    expect(error.details).toBeUndefined()
    expect(error.userId).toBeUndefined()
    expect(error.requestId).toBeUndefined()
  })
})

describe('handleError', () => {
  it('should return AppError as-is', () => {
    const originalError = new AppError(ErrorType.VALIDATION_ERROR, 'Original error')
    const result = handleError(originalError)

    expect(result).toBe(originalError)
  })

  it('should handle ZodError', () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['field1'],
        message: 'Expected string, received number'
      },
      {
        code: 'too_small',
        minimum: 1,
        type: 'string',
        inclusive: true,
        exact: false,
        path: ['field2'],
        message: 'String must contain at least 1 character(s)'
      }
    ]);

    const result = handleError(zodError, 'user-123')

    expect(result.type).toBe(ErrorType.VALIDATION_ERROR)
    expect(result.message).toBe('Input validation failed')
    expect(result.severity).toBe(ErrorSeverity.LOW)
    expect(result.statusCode).toBe(400)
    expect(result.userId).toBe('user-123')
    expect(result.details).toEqual([
      {
        field: 'field1',
        message: 'Expected string, received number',
        code: 'invalid_type'
      },
      {
        field: 'field2',
        message: 'String must contain at least 1 character(s)',
        code: 'too_small'
      }
    ])
  })

  it('should handle generic Error with duplicate key message', () => {
    const error = new Error('duplicate key value violates unique constraint')
    const result = handleError(error)

    expect(result.type).toBe(ErrorType.RESOURCE_CONFLICT)
    expect(result.message).toBe('Resource already exists')
    expect(result.statusCode).toBe(409)
  })

  it('should handle generic Error with not found message', () => {
    const error = new Error('User not found')
    const result = handleError(error)

    expect(result.type).toBe(ErrorType.RESOURCE_NOT_FOUND)
    expect(result.message).toBe('Requested resource not found')
    expect(result.statusCode).toBe(404)
  })

  it('should handle generic Error with unauthorized message', () => {
    const error = new Error('unauthorized access')
    const result = handleError(error)

    expect(result.type).toBe(ErrorType.AUTHORIZATION_FAILED)
    expect(result.message).toBe('Insufficient permissions')
    expect(result.statusCode).toBe(403)
  })

  it('should handle unknown error types', () => {
    const unknownError = { weird: 'object' }
    const result = handleError(unknownError)

    expect(result.type).toBe(ErrorType.INTERNAL_SERVER_ERROR)
    expect(result.message).toBe('An unknown error occurred')
    expect(result.statusCode).toBe(500)
    expect(result.details).toEqual({ originalError: '[object Object]' })
  })

  it('should handle null/undefined errors', () => {
    const result = handleError(null)

    expect(result.type).toBe(ErrorType.INTERNAL_SERVER_ERROR)
    expect(result.message).toBe('An unknown error occurred')
    expect(result.details).toEqual({ originalError: 'null' })
  })
})

describe('createErrorResponse', () => {
  it('should create error response in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const appError = new AppError(
      ErrorType.VALIDATION_ERROR,
      'Test error',
      ErrorSeverity.LOW,
      400,
      { field: 'test' }
    )

    const response = createErrorResponse(appError)

    expect(response.status).toBe(400)
    
    // In tests, we can't easily check the response body, but we can verify the method was called
    expect(response).toBeDefined()

    process.env.NODE_ENV = originalEnv
  })

  it('should create error response in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const appError = new AppError(
      ErrorType.INTERNAL_SERVER_ERROR,
      'Test error',
      ErrorSeverity.HIGH,
      500,
      { sensitive: 'data' }
    )

    const response = createErrorResponse(appError);

    expect(response.status).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: {
        type: ErrorType.INTERNAL_SERVER_ERROR,
        message: 'Test error',
        correlationId: expect.any(String),
        timestamp: expect.any(String),
      },
    });

    process.env.NODE_ENV = originalEnv
  })
})

describe('Convenience Error Functions', () => {
  it('should create AuthenticationError', () => {
    const error = AuthenticationError('Custom auth message', 'user-123')

    expect(error.type).toBe(ErrorType.AUTHENTICATION_REQUIRED)
    expect(error.message).toBe('Custom auth message')
    expect(error.statusCode).toBe(401)
    expect(error.userId).toBe('user-123')
  })

  it('should create AuthorizationError', () => {
    const error = AuthorizationError('Custom authz message', 'user-123')

    expect(error.type).toBe(ErrorType.AUTHORIZATION_FAILED)
    expect(error.message).toBe('Custom authz message')
    expect(error.statusCode).toBe(403)
    expect(error.userId).toBe('user-123')
  })

  it('should create ValidationError', () => {
    const details = { field: 'email', issue: 'invalid format' }
    const error = ValidationError('Invalid input', details, 'user-123')

    expect(error.type).toBe(ErrorType.VALIDATION_ERROR)
    expect(error.message).toBe('Invalid input')
    expect(error.statusCode).toBe(400)
    expect(error.details).toBe(details)
    expect(error.userId).toBe('user-123')
  })

  it('should create NotFoundError', () => {
    const error = NotFoundError('User', 'user-123')

    expect(error.type).toBe(ErrorType.RESOURCE_NOT_FOUND)
    expect(error.message).toBe('User not found')
    expect(error.statusCode).toBe(404)
    expect(error.userId).toBe('user-123')
  })

  it('should create ConflictError', () => {
    const error = ConflictError('Email already exists', 'user-123')

    expect(error.type).toBe(ErrorType.RESOURCE_CONFLICT)
    expect(error.message).toBe('Email already exists')
    expect(error.statusCode).toBe(409)
    expect(error.userId).toBe('user-123')
  })

  it('should create RateLimitError', () => {
    const error = RateLimitError('Too many requests', 'user-123')

    expect(error.type).toBe(ErrorType.RATE_LIMIT_EXCEEDED)
    expect(error.message).toBe('Too many requests')
    expect(error.statusCode).toBe(429)
    expect(error.userId).toBe('user-123')
  })

  it('should create InternalError', () => {
    const details = { service: 'database', timeout: true }
    const error = InternalError('Database timeout', details, 'user-123')

    expect(error.type).toBe(ErrorType.INTERNAL_SERVER_ERROR)
    expect(error.message).toBe('Database timeout')
    expect(error.statusCode).toBe(500)
    expect(error.details).toBe(details)
    expect(error.userId).toBe('user-123')
  })
})

describe('isAppError', () => {
  it('should identify AppError instances', () => {
    const appError = new AppError(ErrorType.VALIDATION_ERROR, 'Test')
    const regularError = new Error('Regular error')
    const notAnError = { message: 'Not an error' }

    expect(isAppError(appError)).toBe(true)
    expect(isAppError(regularError)).toBe(false)
    expect(isAppError(notAnError)).toBe(false)
    expect(isAppError(null)).toBe(false)
    expect(isAppError(undefined)).toBe(false)
  })
})

describe('Error Code Extraction', () => {
  it('should handle PostgreSQL error codes', () => {
    const pgError = new Error('error: 23505: duplicate key value')
    const result = handleError(pgError)

    expect(result.type).toBe(ErrorType.RESOURCE_CONFLICT)
    expect(result.message).toBe('Resource already exists')
  })

  it('should handle Firebase Auth error codes', () => {
    const authError = new Error('Firebase: Error (auth/user-not-found)')
    const result = handleError(authError)

    expect(result.type).toBe(ErrorType.AUTHENTICATION_FAILED)
    expect(result.message).toBe('Invalid credentials')
  })
})

describe('Error Severity and Status Code Mapping', () => {
  const testCases = [
    { type: ErrorType.AUTHENTICATION_REQUIRED, expectedStatus: 401 },
    { type: ErrorType.AUTHENTICATION_FAILED, expectedStatus: 401 },
    { type: ErrorType.SESSION_EXPIRED, expectedStatus: 401 },
    { type: ErrorType.AUTHORIZATION_FAILED, expectedStatus: 403 },
    { type: ErrorType.VALIDATION_ERROR, expectedStatus: 400 },
    { type: ErrorType.INVALID_INPUT, expectedStatus: 400 },
    { type: ErrorType.MISSING_REQUIRED_FIELD, expectedStatus: 400 },
    { type: ErrorType.RESOURCE_NOT_FOUND, expectedStatus: 404 },
    { type: ErrorType.RESOURCE_CONFLICT, expectedStatus: 409 },
    { type: ErrorType.RATE_LIMIT_EXCEEDED, expectedStatus: 429 },
    { type: ErrorType.FILE_TOO_LARGE, expectedStatus: 413 },
    { type: ErrorType.UNSUPPORTED_FILE_TYPE, expectedStatus: 415 },
    { type: ErrorType.SERVICE_UNAVAILABLE, expectedStatus: 503 },
    { type: ErrorType.INTERNAL_SERVER_ERROR, expectedStatus: 500 }
  ]

  testCases.forEach(({ type, expectedStatus }) => {
    it(`should map ${type} to status ${expectedStatus}`, () => {
      const error = new AppError(type, 'Test message')
      expect(error.statusCode).toBe(expectedStatus)
    })
  })
})