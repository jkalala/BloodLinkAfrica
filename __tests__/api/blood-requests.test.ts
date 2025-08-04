import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/blood-requests/route'
import { TestDataFactory, mockSupabaseResponse } from '../utils/test-utils'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
}

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: () => mockSupabase,
}))

describe('/api/blood-requests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/blood-requests', () => {
    it('should return blood requests for authenticated user', async () => {
      const mockRequests = TestDataFactory.bloodRequests(3)
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockRequests))),
      })

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.requests).toHaveLength(3)
      expect(data.requests[0]).toHaveProperty('id')
      expect(data.requests[0]).toHaveProperty('blood_type')
    })

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: 'Unauthorized',
      })

      const { req, res } = createMocks({
        method: 'GET',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      const data = JSON.parse(res._getData())
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn(() => Promise.resolve(mockSupabaseResponse(null, 'Database error'))),
      })

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const data = JSON.parse(res._getData())
      expect(data.error).toBe('Internal server error')
    })

    it('should support pagination', async () => {
      const mockRequests = TestDataFactory.bloodRequests(10)
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        limit: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockRequests.slice(0, 5)))),
      })

      const { req, res } = createMocks({
        method: 'GET',
        query: {
          page: '1',
          limit: '5',
        },
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.requests).toHaveLength(5)
      expect(data.pagination).toHaveProperty('page', 1)
      expect(data.pagination).toHaveProperty('limit', 5)
    })

    it('should support filtering by blood type', async () => {
      const mockRequests = TestDataFactory.bloodRequests(3, { blood_type: 'O+' })
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockRequests))),
      })

      const { req, res } = createMocks({
        method: 'GET',
        query: {
          blood_type: 'O+',
        },
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.requests).toHaveLength(3)
      data.requests.forEach(request => {
        expect(request.blood_type).toBe('O+')
      })
    })
  })

  describe('POST /api/blood-requests', () => {
    it('should create new blood request', async () => {
      const newRequest = {
        blood_type: 'A+',
        units_needed: 2,
        urgency: 'high',
        location: 'Test Hospital',
        notes: 'Emergency surgery',
      }

      const createdRequest = TestDataFactory.bloodRequest(newRequest)

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'hospital' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(createdRequest))),
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: newRequest,
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const data = JSON.parse(res._getData())
      expect(data.request).toHaveProperty('id')
      expect(data.request.blood_type).toBe('A+')
      expect(data.request.units_needed).toBe(2)
    })

    it('should validate required fields', async () => {
      const invalidRequest = {
        blood_type: 'A+',
        // Missing required fields
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'hospital' } },
        error: null,
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: invalidRequest,
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('validation')
    })

    it('should check user permissions', async () => {
      const newRequest = {
        blood_type: 'A+',
        units_needed: 2,
        urgency: 'high',
        location: 'Test Hospital',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'donor' } }, // Wrong role
        error: null,
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: newRequest,
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(403)
      const data = JSON.parse(res._getData())
      expect(data.error).toBe('Insufficient permissions')
    })

    it('should validate blood type format', async () => {
      const invalidRequest = {
        blood_type: 'Invalid',
        units_needed: 2,
        urgency: 'high',
        location: 'Test Hospital',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'hospital' } },
        error: null,
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: invalidRequest,
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('blood_type')
    })

    it('should trigger donor matching after creation', async () => {
      const newRequest = {
        blood_type: 'O+',
        units_needed: 1,
        urgency: 'medium',
        location: 'Test Hospital',
      }

      const createdRequest = TestDataFactory.bloodRequest(newRequest)

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'hospital' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(createdRequest))),
      })

      // Mock the donor matching service
      const mockDonorMatching = jest.fn()
      jest.doMock('@/lib/ai-matching-service', () => ({
        findCompatibleDonors: mockDonorMatching,
      }))

      const { req, res } = createMocks({
        method: 'POST',
        body: newRequest,
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(201)
      // In a real implementation, this would trigger background donor matching
    })
  })

  describe('PUT /api/blood-requests/[id]', () => {
    it('should update blood request', async () => {
      const requestId = 'request-1'
      const updates = {
        status: 'fulfilled',
        notes: 'Request completed successfully',
      }

      const updatedRequest = TestDataFactory.bloodRequest({ 
        id: requestId, 
        ...updates 
      })

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'hospital' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(updatedRequest))),
      })

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: requestId },
        body: updates,
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.request.status).toBe('fulfilled')
      expect(data.request.notes).toBe('Request completed successfully')
    })

    it('should return 404 for non-existent request', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'hospital' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(null))),
      })

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: 'non-existent' },
        body: { status: 'fulfilled' },
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(404)
      const data = JSON.parse(res._getData())
      expect(data.error).toBe('Blood request not found')
    })
  })

  describe('DELETE /api/blood-requests/[id]', () => {
    it('should delete blood request', async () => {
      const requestId = 'request-1'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'admin' } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn(() => Promise.resolve(mockSupabaseResponse({ count: 1 }))),
      })

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: requestId },
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.message).toBe('Blood request deleted successfully')
    })

    it('should require admin permissions for deletion', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'donor' } },
        error: null,
      })

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: 'request-1' },
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(403)
      const data = JSON.parse(res._getData())
      expect(data.error).toBe('Insufficient permissions')
    })
  })

  describe('Error Handling', () => {
    it('should handle unsupported HTTP methods', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const data = JSON.parse(res._getData())
      expect(data.error).toBe('Method not allowed')
    })

    it('should handle malformed JSON', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', role: 'hospital' } },
        error: null,
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: 'invalid json',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.error).toContain('Invalid JSON')
    })
  })
})
