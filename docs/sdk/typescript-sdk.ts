/**
 * BloodLink Africa TypeScript SDK
 * 
 * Official TypeScript/JavaScript SDK for BloodLink Africa API
 * 
 * @version 2.0.0
 * @author BloodLink Africa Team
 */

export interface BloodLinkConfig {
  apiUrl: string
  apiKey?: string
  timeout?: number
  retries?: number
}

export interface User {
  id: string
  name: string
  email: string
  role: 'donor' | 'hospital' | 'admin'
  blood_type: BloodType
  location: string
  phone?: string
  verified: boolean
  available: boolean
  last_donation?: string
  total_donations: number
  created_at: string
  updated_at: string
}

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

export interface BloodRequest {
  id: string
  requester_id: string
  blood_type: BloodType
  units_needed: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'in_progress' | 'fulfilled' | 'cancelled'
  location: string
  latitude?: number
  longitude?: number
  notes?: string
  patient_age?: number
  patient_gender?: 'male' | 'female' | 'other'
  required_by?: string
  created_at: string
  updated_at: string
}

export interface DonorMatch {
  donor_id: string
  donor_name: string
  blood_type: BloodType
  compatibility_score: number
  distance: number
  response_rate: number
  avg_response_time: number
  last_donation?: string
  available: boolean
}

export interface DonorResponse {
  id: string
  donor_id: string
  request_id: string
  status: 'pending' | 'accepted' | 'declined' | 'completed'
  estimated_arrival?: string
  notes?: string
  created_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Array<{
      field: string
      message: string
    }>
  }
}

export class BloodLinkSDK {
  private config: BloodLinkConfig
  private token?: string

  constructor(config: BloodLinkConfig) {
    this.config = {
      timeout: 10000,
      retries: 3,
      ...config
    }
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.apiUrl}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout!)
    })

    if (!response.ok) {
      const error: ApiError = await response.json()
      throw new BloodLinkError(error.error.message, error.error.code, response.status)
    }

    return response.json()
  }

  // Authentication Methods
  async login(email: string, password: string): Promise<{
    user: User
    token: string
    refreshToken: string
    expiresIn: number
  }> {
    const response = await this.request<{
      user: User
      token: string
      refreshToken: string
      expiresIn: number
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })

    this.setToken(response.data.token)
    return response.data
  }

  async register(userData: {
    name: string
    email: string
    password: string
    role: 'donor' | 'hospital'
    blood_type: BloodType
    location: string
    phone?: string
  }): Promise<{ user: User; message: string }> {
    const response = await this.request<{ user: User; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    })

    return response.data
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' })
    this.token = undefined
  }

  // Blood Request Methods
  async getBloodRequests(params?: {
    page?: number
    limit?: number
    blood_type?: BloodType
    urgency?: string
    status?: string
    location?: string
    radius?: number
  }): Promise<{
    requests: BloodRequest[]
    pagination: ApiResponse<any>['pagination']
  }> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }

    const response = await this.request<{
      requests: BloodRequest[]
      pagination: ApiResponse<any>['pagination']
    }>(`/blood-requests?${searchParams}`)

    return response.data
  }

  async getBloodRequest(id: string): Promise<{
    request: BloodRequest
    responses: DonorResponse[]
  }> {
    const response = await this.request<{
      request: BloodRequest
      responses: DonorResponse[]
    }>(`/blood-requests/${id}`)

    return response.data
  }

  async createBloodRequest(requestData: {
    blood_type: BloodType
    units_needed: number
    urgency: 'low' | 'medium' | 'high' | 'critical'
    location: string
    latitude?: number
    longitude?: number
    notes?: string
    patient_age?: number
    patient_gender?: 'male' | 'female' | 'other'
    required_by?: string
  }): Promise<{
    request: BloodRequest
    matching_donors: DonorMatch[]
  }> {
    const response = await this.request<{
      request: BloodRequest
      matching_donors: DonorMatch[]
    }>('/blood-requests', {
      method: 'POST',
      body: JSON.stringify(requestData)
    })

    return response.data
  }

  async updateBloodRequest(id: string, updates: {
    status?: 'active' | 'in_progress' | 'fulfilled' | 'cancelled'
    notes?: string
    units_needed?: number
    urgency?: 'low' | 'medium' | 'high' | 'critical'
  }): Promise<{ request: BloodRequest }> {
    const response = await this.request<{ request: BloodRequest }>(`/blood-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })

    return response.data
  }

  async deleteBloodRequest(id: string): Promise<{ message: string }> {
    const response = await this.request<{ message: string }>(`/blood-requests/${id}`, {
      method: 'DELETE'
    })

    return response.data
  }

  // Donor Methods
  async getDonors(params?: {
    page?: number
    limit?: number
    blood_type?: BloodType
    available?: boolean
    location?: string
    radius?: number
  }): Promise<{
    donors: User[]
    pagination: ApiResponse<any>['pagination']
  }> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }

    const response = await this.request<{
      donors: User[]
      pagination: ApiResponse<any>['pagination']
    }>(`/donors?${searchParams}`)

    return response.data
  }

  async respondToRequest(donorId: string, responseData: {
    request_id: string
    status: 'accepted' | 'declined'
    estimated_arrival?: string
    notes?: string
  }): Promise<{ response: DonorResponse }> {
    const response = await this.request<{ response: DonorResponse }>(
      `/donors/${donorId}/responses`,
      {
        method: 'POST',
        body: JSON.stringify(responseData)
      }
    )

    return response.data
  }

  // AI/ML Methods
  async findMatchingDonors(requestId: string, options?: {
    max_results?: number
    radius?: number
  }): Promise<{
    matches: DonorMatch[]
    algorithm_version: string
    processing_time: number
  }> {
    const response = await this.request<{
      matches: DonorMatch[]
      algorithm_version: string
      processing_time: number
    }>('/ai/donor-matching', {
      method: 'POST',
      body: JSON.stringify({
        request_id: requestId,
        ...options
      })
    })

    return response.data
  }

  async predictResponseTime(donorId: string, requestId: string): Promise<{
    predicted_response_time: number
    confidence: number
    factors: Array<{
      factor: string
      weight: number
    }>
  }> {
    const response = await this.request<{
      predicted_response_time: number
      confidence: number
      factors: Array<{
        factor: string
        weight: number
      }>
    }>('/ai/predict-response-time', {
      method: 'POST',
      body: JSON.stringify({
        donor_id: donorId,
        request_id: requestId
      })
    })

    return response.data
  }

  async recognizeBloodType(imageFile: File): Promise<{
    blood_type: BloodType
    confidence: number
    image_quality: 'poor' | 'fair' | 'good' | 'excellent'
    processing_time: number
    alternative_predictions: Array<{
      blood_type: BloodType
      confidence: number
    }>
  }> {
    const formData = new FormData()
    formData.append('image', imageFile)

    const response = await this.request<{
      blood_type: BloodType
      confidence: number
      image_quality: 'poor' | 'fair' | 'good' | 'excellent'
      processing_time: number
      alternative_predictions: Array<{
        blood_type: BloodType
        confidence: number
      }>
    }>('/ai/vision/blood-type-recognition', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    })

    return response.data
  }

  // Analytics Methods
  async getDashboardAnalytics(params?: {
    period?: 'day' | 'week' | 'month' | 'year'
    region?: string
  }): Promise<{
    total_requests: number
    fulfilled_requests: number
    active_donors: number
    response_rate: number
    avg_response_time: number
    blood_type_distribution: Record<BloodType, number>
  }> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }

    const response = await this.request<{
      total_requests: number
      fulfilled_requests: number
      active_donors: number
      response_rate: number
      avg_response_time: number
      blood_type_distribution: Record<BloodType, number>
    }>(`/analytics/dashboard?${searchParams}`)

    return response.data
  }
}

export class BloodLinkError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'BloodLinkError'
  }
}

// Usage Example:
/*
const sdk = new BloodLinkSDK({
  apiUrl: 'https://api.bloodlink.africa/v2'
})

// Login
const { user, token } = await sdk.login('user@example.com', 'password')

// Create blood request
const { request, matching_donors } = await sdk.createBloodRequest({
  blood_type: 'O+',
  units_needed: 2,
  urgency: 'high',
  location: 'Lagos University Teaching Hospital',
  notes: 'Emergency surgery patient'
})

// Find matching donors
const { matches } = await sdk.findMatchingDonors(request.id, {
  max_results: 10,
  radius: 25
})

// Respond to request (as donor)
await sdk.respondToRequest(user.id, {
  request_id: request.id,
  status: 'accepted',
  notes: 'I can donate immediately'
})
*/
