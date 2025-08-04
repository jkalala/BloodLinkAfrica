import { MLEngine } from '@/lib/ml-engine'
import { TestDataFactory, mockSupabaseResponse } from '../utils/test-utils'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
}

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: () => mockSupabase,
}))

describe('MLEngine', () => {
  let mlEngine: MLEngine

  beforeEach(() => {
    mlEngine = new MLEngine()
    jest.clearAllMocks()
  })

  describe('Model Training', () => {
    it('should train donor matching model successfully', async () => {
      const mockTrainingData = {
        donors: TestDataFactory.donors(10),
        requests: TestDataFactory.bloodRequests(5),
        responses: Array.from({ length: 20 }, (_, i) => ({
          id: `response-${i}`,
          donor_id: `donor-${i % 10}`,
          request_id: `request-${i % 5}`,
          response_time: Math.random() * 60,
          success: Math.random() > 0.3,
        })),
      }

      mockSupabase.from.mockImplementation((table) => {
        const mockData = {
          users: mockTrainingData.donors,
          blood_requests: mockTrainingData.requests,
          donor_responses: mockTrainingData.responses,
        }
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockData[table]))),
        }
      })

      const result = await mlEngine.trainModels()

      expect(result.success).toBe(true)
      expect(result.models).toContain('donor_matching')
      expect(result.accuracy.donor_matching).toBeGreaterThan(0)
    })

    it('should handle training data errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(null, 'Database error'))),
      }))

      const result = await mlEngine.trainModels()

      expect(result.success).toBe(false)
      expect(result.models).toEqual([])
    })

    it('should validate training data quality', async () => {
      const invalidData = {
        donors: [{ id: 'invalid', blood_type: null }], // Invalid data
        requests: [],
        responses: [],
      }

      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(invalidData[table]))),
      }))

      const result = await mlEngine.trainModels()

      expect(result.success).toBe(false)
    })
  })

  describe('Donor Matching Prediction', () => {
    beforeEach(async () => {
      // Train model first
      const mockTrainingData = {
        donors: TestDataFactory.donors(10),
        requests: TestDataFactory.bloodRequests(5),
        responses: Array.from({ length: 20 }, (_, i) => ({
          id: `response-${i}`,
          donor_id: `donor-${i % 10}`,
          request_id: `request-${i % 5}`,
          response_time: Math.random() * 60,
          success: Math.random() > 0.3,
        })),
      }

      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockTrainingData[table]))),
      }))

      await mlEngine.trainModels()
    })

    it('should predict donor match score', async () => {
      const donor = TestDataFactory.donor()
      const request = TestDataFactory.bloodRequest()

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve(mockSupabaseResponse(donor))),
          }
        }
        if (table === 'blood_requests') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve(mockSupabaseResponse(request))),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve(mockSupabaseResponse([]))),
        }
      })

      const prediction = await mlEngine.predictDonorMatch(donor.id, request.id)

      expect(prediction).toBeDefined()
      expect(prediction?.prediction).toBeGreaterThanOrEqual(0)
      expect(prediction?.prediction).toBeLessThanOrEqual(1)
      expect(prediction?.confidence).toBeGreaterThanOrEqual(0)
      expect(prediction?.confidence).toBeLessThanOrEqual(1)
      expect(prediction?.importance).toBeInstanceOf(Array)
      expect(prediction?.explanation).toBeDefined()
    })

    it('should handle missing donor data', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse(null))),
      }))

      const prediction = await mlEngine.predictDonorMatch('invalid-donor', 'invalid-request')

      expect(prediction).toBeNull()
    })

    it('should provide feature importance', async () => {
      const donor = TestDataFactory.donor()
      const request = TestDataFactory.bloodRequest()

      mockSupabase.from.mockImplementation((table) => {
        const mockData = {
          users: donor,
          blood_requests: request,
          donor_responses: [],
        }
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockData[table]))),
        }
      })

      const prediction = await mlEngine.predictDonorMatch(donor.id, request.id)

      expect(prediction?.importance).toBeInstanceOf(Array)
      expect(prediction?.importance.length).toBeGreaterThan(0)
      
      prediction?.importance.forEach(feature => {
        expect(feature).toHaveProperty('feature')
        expect(feature).toHaveProperty('weight')
        expect(typeof feature.weight).toBe('number')
      })
    })
  })

  describe('Response Time Prediction', () => {
    it('should predict response time', async () => {
      const donor = TestDataFactory.donor()
      const request = TestDataFactory.bloodRequest()

      mockSupabase.from.mockImplementation((table) => {
        const mockData = {
          users: donor,
          blood_requests: request,
          donor_responses: [
            { response_time: 30, success: true },
            { response_time: 45, success: true },
            { response_time: 60, success: false },
          ],
        }
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockData[table]))),
        }
      })

      const prediction = await mlEngine.predictResponseTime(donor.id, request.id)

      expect(prediction).toBeDefined()
      expect(prediction?.prediction).toBeGreaterThan(0)
      expect(prediction?.confidence).toBeGreaterThanOrEqual(0)
      expect(prediction?.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('Feature Engineering', () => {
    it('should extract donor features correctly', async () => {
      const donor = TestDataFactory.donor({
        blood_type: 'O+',
        location: 'New York',
        response_rate: 0.85,
        avg_response_time: 30,
      })
      const request = TestDataFactory.bloodRequest({
        blood_type: 'O+',
        location: 'New York',
        urgency: 'high',
      })

      mockSupabase.from.mockImplementation((table) => {
        const mockData = {
          users: donor,
          blood_requests: request,
          donor_responses: [],
        }
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockData[table]))),
        }
      })

      const features = await mlEngine.extractDonorFeatures(donor.id, request.id)

      expect(features).toBeDefined()
      expect(features?.bloodTypeCompatibility).toBe(1) // Perfect match
      expect(features?.responseRate).toBe(0.85)
      expect(features?.avgResponseTime).toBe(30)
      expect(features?.urgencyMatch).toBeGreaterThan(0)
    })

    it('should handle blood type compatibility correctly', async () => {
      const testCases = [
        { donorType: 'O-', requestType: 'A+', expected: 1 }, // Universal donor
        { donorType: 'A+', requestType: 'O+', expected: 0 }, // Incompatible
        { donorType: 'A+', requestType: 'A+', expected: 1 }, // Perfect match
        { donorType: 'AB+', requestType: 'A+', expected: 0 }, // Incompatible
      ]

      for (const testCase of testCases) {
        const donor = TestDataFactory.donor({ blood_type: testCase.donorType })
        const request = TestDataFactory.bloodRequest({ blood_type: testCase.requestType })

        mockSupabase.from.mockImplementation((table) => {
          const mockData = {
            users: donor,
            blood_requests: request,
            donor_responses: [],
          }
          
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve(mockSupabaseResponse(mockData[table]))),
          }
        })

        const features = await mlEngine.extractDonorFeatures(donor.id, request.id)
        expect(features?.bloodTypeCompatibility).toBe(testCase.expected)
      }
    })
  })

  describe('Model Performance', () => {
    it('should calculate model accuracy', () => {
      const predictions = [0.8, 0.6, 0.9, 0.3, 0.7]
      const actual = [1, 1, 1, 0, 1]

      const accuracy = mlEngine.calculateAccuracy(predictions, actual)

      expect(accuracy).toBeGreaterThanOrEqual(0)
      expect(accuracy).toBeLessThanOrEqual(1)
    })

    it('should handle edge cases in accuracy calculation', () => {
      // Empty arrays
      expect(mlEngine.calculateAccuracy([], [])).toBe(0)

      // Single prediction
      expect(mlEngine.calculateAccuracy([0.8], [1])).toBeGreaterThan(0)

      // All correct predictions
      expect(mlEngine.calculateAccuracy([0.9, 0.8, 0.7], [1, 1, 1])).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const result = await mlEngine.trainModels()

      expect(result.success).toBe(false)
      expect(result.models).toEqual([])
    })

    it('should handle invalid input data', async () => {
      const prediction = await mlEngine.predictDonorMatch('', '')

      expect(prediction).toBeNull()
    })

    it('should handle model not trained scenario', async () => {
      const freshEngine = new MLEngine()
      const prediction = await freshEngine.predictDonorMatch('donor-1', 'request-1')

      expect(prediction).toBeNull()
    })
  })
})
