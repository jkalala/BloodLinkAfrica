/**
 * Payment Gateway Integration System
 * 
 * Multi-provider payment processing with support for Stripe, PayPal,
 * M-Pesa, Flutterwave, and other African payment methods
 */

import { getOptimizedDB } from '../../database/optimized-queries'
import { getCache } from '../../cache/redis-cache'
import { getSecurityEngine } from '../../security/security-engine'
import { performanceMonitor } from '../../performance/metrics'
import { getRealTimeEventSystem } from '../../realtime/event-system'

export interface PaymentProvider {
  id: string
  name: string
  type: 'card' | 'mobile_money' | 'bank_transfer' | 'digital_wallet' | 'crypto'
  region: string[]
  currencies: string[]
  configuration: {
    apiKey?: string
    secretKey?: string
    publicKey?: string
    merchantId?: string
    webhookSecret?: string
    sandboxMode: boolean
    apiVersion?: string
    baseUrl?: string
  }
  features: {
    recurring: boolean
    refunds: boolean
    disputes: boolean
    webhooks: boolean
    multiCurrency: boolean
    tokenization: boolean
  }
  fees: {
    percentage: number
    fixed: number
    currency: string
    minimumFee?: number
    maximumFee?: number
  }
  isActive: boolean
  priority: number
}

export interface PaymentMethod {
  id: string
  userId: string
  providerId: string
  type: 'card' | 'mobile_money' | 'bank_account' | 'digital_wallet'
  details: {
    // Card details
    last4?: string
    brand?: string
    expiryMonth?: number
    expiryYear?: number
    // Mobile money details
    phoneNumber?: string
    network?: string
    // Bank account details
    accountNumber?: string
    bankName?: string
    routingNumber?: string
    // Digital wallet details
    walletId?: string
    walletType?: string
  }
  token: string // Tokenized payment method
  isDefault: boolean
  isVerified: boolean
  createdAt: Date
  lastUsed?: Date
}

export interface PaymentIntent {
  id: string
  userId: string
  amount: number
  currency: string
  description: string
  metadata: Record<string, any>
  paymentMethodId?: string
  providerId: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'requires_action'
  clientSecret?: string
  confirmationUrl?: string
  errorCode?: string
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export interface PaymentTransaction {
  id: string
  paymentIntentId: string
  userId: string
  providerId: string
  providerTransactionId: string
  amount: number
  currency: string
  fees: {
    platform: number
    provider: number
    total: number
  }
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed'
  paymentMethod: {
    type: string
    details: Record<string, any>
  }
  metadata: Record<string, any>
  processedAt?: Date
  settledAt?: Date
  refundedAt?: Date
  createdAt: Date
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  providerId: string
  providerSubscriptionId: string
  status: 'active' | 'past_due' | 'cancelled' | 'unpaid' | 'incomplete'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  cancelledAt?: Date
  trialStart?: Date
  trialEnd?: Date
  paymentMethodId: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface WebhookEvent {
  id: string
  providerId: string
  eventType: string
  eventData: Record<string, any>
  signature: string
  processed: boolean
  processedAt?: Date
  retryCount: number
  maxRetries: number
  createdAt: Date
}

export interface PaymentAnalytics {
  totalVolume: number
  totalTransactions: number
  successRate: number
  averageAmount: number
  topCurrencies: Array<{ currency: string; volume: number; count: number }>
  topProviders: Array<{ provider: string; volume: number; count: number }>
  monthlyTrends: Array<{ month: string; volume: number; count: number }>
  failureReasons: Array<{ reason: string; count: number }>
}

class PaymentGateway {
  private db = getOptimizedDB()
  private cache = getCache()
  private securityEngine = getSecurityEngine()
  private eventSystem = getRealTimeEventSystem()

  // Supported payment providers for African markets
  private readonly PAYMENT_PROVIDERS: Partial<PaymentProvider>[] = [
    {
      name: 'Stripe',
      type: 'card',
      region: ['global', 'africa'],
      currencies: ['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'KES', 'GHS'],
      features: {
        recurring: true,
        refunds: true,
        disputes: true,
        webhooks: true,
        multiCurrency: true,
        tokenization: true
      },
      fees: { percentage: 2.9, fixed: 0.30, currency: 'USD' }
    },
    {
      name: 'Flutterwave',
      type: 'card',
      region: ['africa'],
      currencies: ['NGN', 'KES', 'GHS', 'ZAR', 'UGX', 'TZS', 'RWF', 'USD'],
      features: {
        recurring: true,
        refunds: true,
        disputes: true,
        webhooks: true,
        multiCurrency: true,
        tokenization: true
      },
      fees: { percentage: 1.4, fixed: 0, currency: 'NGN' }
    },
    {
      name: 'Paystack',
      type: 'card',
      region: ['nigeria', 'ghana', 'south_africa'],
      currencies: ['NGN', 'GHS', 'ZAR', 'USD'],
      features: {
        recurring: true,
        refunds: true,
        disputes: true,
        webhooks: true,
        multiCurrency: true,
        tokenization: true
      },
      fees: { percentage: 1.5, fixed: 0, currency: 'NGN' }
    },
    {
      name: 'M-Pesa',
      type: 'mobile_money',
      region: ['kenya', 'tanzania', 'mozambique', 'lesotho'],
      currencies: ['KES', 'TZS', 'MZN', 'LSL'],
      features: {
        recurring: false,
        refunds: true,
        disputes: false,
        webhooks: true,
        multiCurrency: false,
        tokenization: false
      },
      fees: { percentage: 0, fixed: 10, currency: 'KES' }
    },
    {
      name: 'MTN Mobile Money',
      type: 'mobile_money',
      region: ['uganda', 'ghana', 'cameroon', 'ivory_coast'],
      currencies: ['UGX', 'GHS', 'XAF', 'XOF'],
      features: {
        recurring: false,
        refunds: true,
        disputes: false,
        webhooks: true,
        multiCurrency: false,
        tokenization: false
      },
      fees: { percentage: 1.0, fixed: 0, currency: 'UGX' }
    },
    {
      name: 'Airtel Money',
      type: 'mobile_money',
      region: ['kenya', 'uganda', 'tanzania', 'zambia', 'malawi'],
      currencies: ['KES', 'UGX', 'TZS', 'ZMW', 'MWK'],
      features: {
        recurring: false,
        refunds: true,
        disputes: false,
        webhooks: true,
        multiCurrency: false,
        tokenization: false
      },
      fees: { percentage: 1.5, fixed: 0, currency: 'KES' }
    },
    {
      name: 'PayPal',
      type: 'digital_wallet',
      region: ['global'],
      currencies: ['USD', 'EUR', 'GBP', 'ZAR'],
      features: {
        recurring: true,
        refunds: true,
        disputes: true,
        webhooks: true,
        multiCurrency: true,
        tokenization: true
      },
      fees: { percentage: 3.4, fixed: 0.30, currency: 'USD' }
    }
  ]

  // Common donation amounts for quick selection
  private readonly DONATION_PRESETS = {
    USD: [5, 10, 25, 50, 100, 250],
    EUR: [5, 10, 20, 50, 100, 200],
    GBP: [5, 10, 20, 50, 100, 200],
    NGN: [1000, 2500, 5000, 10000, 25000, 50000],
    KES: [500, 1000, 2500, 5000, 10000, 25000],
    GHS: [50, 100, 250, 500, 1000, 2500],
    ZAR: [50, 100, 250, 500, 1000, 2500]
  }

  constructor() {
    this.initializePaymentGateway()
  }

  async createPaymentProvider(providerData: Omit<PaymentProvider, 'id'>): Promise<{
    success: boolean
    providerId?: string
    error?: string
  }> {
    try {
      const providerId = `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const provider: PaymentProvider = {
        id: providerId,
        ...providerData
      }

      // Validate provider configuration
      const validation = await this.validateProviderConfig(provider)
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') }
      }

      // Test provider connection
      const connectionTest = await this.testProviderConnection(provider)
      if (!connectionTest.success) {
        return { success: false, error: `Provider connection test failed: ${connectionTest.error}` }
      }

      // Store provider
      await this.db.insert('payment_providers', provider)

      // Cache provider
      await this.cache.set(`payment_provider:${providerId}`, provider, {
        ttl: 3600,
        tags: ['payment', 'provider', providerId]
      })

      // Log provider creation
      await this.eventSystem.publishEvent({
        id: `payment_provider_created_${providerId}`,
        type: 'payment_event',
        priority: 'medium',
        source: 'payment_gateway',
        timestamp: new Date(),
        data: {
          type: 'payment_provider_created',
          provider_id: providerId,
          provider_name: provider.name,
          provider_type: provider.type,
          regions: provider.region,
          currencies: provider.currencies
        }
      })

      return { success: true, providerId }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async createPaymentIntent(intentData: {
    userId: string
    amount: number
    currency: string
    description: string
    paymentMethodId?: string
    metadata?: Record<string, any>
    providerId?: string
  }): Promise<{
    success: boolean
    paymentIntent?: PaymentIntent
    error?: string
  }> {
    try {
      // Select best payment provider if not specified
      let providerId = intentData.providerId
      if (!providerId) {
        const providerResult = await this.selectBestProvider(intentData.currency, intentData.amount)
        if (!providerResult.success) {
          return { success: false, error: 'No suitable payment provider found' }
        }
        providerId = providerResult.providerId!
      }

      const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const paymentIntent: PaymentIntent = {
        id: paymentIntentId,
        userId: intentData.userId,
        amount: intentData.amount,
        currency: intentData.currency,
        description: intentData.description,
        metadata: intentData.metadata || {},
        paymentMethodId: intentData.paymentMethodId,
        providerId: providerId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }

      // Create payment intent with provider
      const providerResult = await this.createProviderPaymentIntent(paymentIntent)
      if (!providerResult.success) {
        return { success: false, error: providerResult.error }
      }

      // Update payment intent with provider response
      paymentIntent.clientSecret = providerResult.clientSecret
      paymentIntent.confirmationUrl = providerResult.confirmationUrl

      // Store payment intent
      await this.db.insert('payment_intents', paymentIntent)

      // Cache payment intent
      await this.cache.set(`payment_intent:${paymentIntentId}`, paymentIntent, {
        ttl: 1800, // 30 minutes
        tags: ['payment', 'intent', paymentIntentId]
      })

      // Log payment intent creation
      await this.eventSystem.publishEvent({
        id: `payment_intent_created_${paymentIntentId}`,
        type: 'payment_event',
        priority: 'medium',
        source: 'payment_gateway',
        timestamp: new Date(),
        data: {
          type: 'payment_intent_created',
          payment_intent_id: paymentIntentId,
          user_id: intentData.userId,
          amount: intentData.amount,
          currency: intentData.currency,
          provider_id: providerId
        }
      })

      return { success: true, paymentIntent }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async confirmPayment(paymentIntentId: string, paymentMethodData?: {
    type: 'card' | 'mobile_money' | 'bank_account'
    details: Record<string, any>
  }): Promise<{
    success: boolean
    transaction?: PaymentTransaction
    error?: string
  }> {
    try {
      // Get payment intent
      const intentResult = await this.getPaymentIntent(paymentIntentId)
      if (!intentResult.success || !intentResult.paymentIntent) {
        return { success: false, error: 'Payment intent not found' }
      }

      const paymentIntent = intentResult.paymentIntent

      // Check if payment intent is still valid
      if (paymentIntent.expiresAt < new Date()) {
        return { success: false, error: 'Payment intent has expired' }
      }

      if (paymentIntent.status !== 'pending') {
        return { success: false, error: 'Payment intent is not in pending status' }
      }

      // Update payment intent status
      await this.updatePaymentIntentStatus(paymentIntentId, 'processing')

      // Process payment with provider
      const providerResult = await this.processProviderPayment(paymentIntent, paymentMethodData)
      
      if (!providerResult.success) {
        await this.updatePaymentIntentStatus(paymentIntentId, 'failed', providerResult.error)
        return { success: false, error: providerResult.error }
      }

      // Create transaction record
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const transaction: PaymentTransaction = {
        id: transactionId,
        paymentIntentId,
        userId: paymentIntent.userId,
        providerId: paymentIntent.providerId,
        providerTransactionId: providerResult.transactionId!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        fees: providerResult.fees!,
        status: 'completed',
        paymentMethod: {
          type: paymentMethodData?.type || 'unknown',
          details: paymentMethodData?.details || {}
        },
        metadata: paymentIntent.metadata,
        processedAt: new Date(),
        createdAt: new Date()
      }

      // Store transaction
      await this.db.insert('payment_transactions', transaction)

      // Update payment intent status
      await this.updatePaymentIntentStatus(paymentIntentId, 'succeeded')

      // Log successful payment
      await this.eventSystem.publishEvent({
        id: `payment_completed_${transactionId}`,
        type: 'payment_event',
        priority: 'high',
        source: 'payment_gateway',
        timestamp: new Date(),
        data: {
          type: 'payment_completed',
          transaction_id: transactionId,
          payment_intent_id: paymentIntentId,
          user_id: paymentIntent.userId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          provider_id: paymentIntent.providerId
        }
      })

      return { success: true, transaction }

    } catch (error) {
      // Update payment intent status to failed
      await this.updatePaymentIntentStatus(paymentIntentId, 'failed', (error as Error).message)
      
      return { success: false, error: (error as Error).message }
    }
  }

  async processWebhook(providerId: string, eventData: any, signature: string): Promise<{
    success: boolean
    processed?: boolean
    error?: string
  }> {
    try {
      // Get provider configuration
      const providerResult = await this.getPaymentProvider(providerId)
      if (!providerResult.success || !providerResult.provider) {
        return { success: false, error: 'Payment provider not found' }
      }

      const provider = providerResult.provider

      // Verify webhook signature
      const signatureValid = await this.verifyWebhookSignature(provider, eventData, signature)
      if (!signatureValid) {
        return { success: false, error: 'Invalid webhook signature' }
      }

      // Create webhook event record
      const webhookEventId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const webhookEvent: WebhookEvent = {
        id: webhookEventId,
        providerId,
        eventType: eventData.type || eventData.event_type || 'unknown',
        eventData,
        signature,
        processed: false,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      }

      // Store webhook event
      await this.db.insert('webhook_events', webhookEvent)

      // Process webhook event
      const processed = await this.processWebhookEvent(webhookEvent)

      // Update webhook event status
      await this.db.update('webhook_events', { id: webhookEventId }, {
        processed,
        processedAt: processed ? new Date() : undefined
      })

      return { success: true, processed }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getPaymentAnalytics(timeRange: { start: Date; end: Date }): Promise<{
    success: boolean
    analytics?: PaymentAnalytics
    error?: string
  }> {
    try {
      // Get payment transactions in time range
      const transactionsResult = await this.db.findMany('payment_transactions', {
        createdAt: {
          $gte: timeRange.start,
          $lte: timeRange.end
        },
        status: 'completed'
      })

      if (!transactionsResult.success) {
        return { success: false, error: 'Failed to retrieve payment data' }
      }

      const transactions = transactionsResult.data as PaymentTransaction[]

      // Calculate analytics
      const totalVolume = transactions.reduce((sum, txn) => sum + txn.amount, 0)
      const totalTransactions = transactions.length
      const successRate = totalTransactions > 0 ? 100 : 0 // Simplified - would need failed transactions too
      const averageAmount = totalTransactions > 0 ? totalVolume / totalTransactions : 0

      // Group by currency
      const currencyGroups = transactions.reduce((groups, txn) => {
        if (!groups[txn.currency]) {
          groups[txn.currency] = { volume: 0, count: 0 }
        }
        groups[txn.currency].volume += txn.amount
        groups[txn.currency].count += 1
        return groups
      }, {} as Record<string, { volume: number; count: number }>)

      const topCurrencies = Object.entries(currencyGroups)
        .map(([currency, data]) => ({ currency, ...data }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5)

      // Group by provider
      const providerGroups = transactions.reduce((groups, txn) => {
        if (!groups[txn.providerId]) {
          groups[txn.providerId] = { volume: 0, count: 0 }
        }
        groups[txn.providerId].volume += txn.amount
        groups[txn.providerId].count += 1
        return groups
      }, {} as Record<string, { volume: number; count: number }>)

      const topProviders = Object.entries(providerGroups)
        .map(([provider, data]) => ({ provider, ...data }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5)

      // Monthly trends (simplified)
      const monthlyTrends = [
        { month: 'Current', volume: totalVolume, count: totalTransactions }
      ]

      const analytics: PaymentAnalytics = {
        totalVolume,
        totalTransactions,
        successRate,
        averageAmount,
        topCurrencies,
        topProviders,
        monthlyTrends,
        failureReasons: [] // Would need failed transaction data
      }

      return { success: true, analytics }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  // Private helper methods
  private async validateProviderConfig(provider: PaymentProvider): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // Validate basic properties
    if (!provider.name || provider.name.trim().length === 0) {
      errors.push('Provider name is required')
    }

    if (!provider.type) {
      errors.push('Provider type is required')
    }

    if (!provider.region || provider.region.length === 0) {
      errors.push('At least one region is required')
    }

    if (!provider.currencies || provider.currencies.length === 0) {
      errors.push('At least one currency is required')
    }

    // Validate configuration based on provider type
    if (provider.type === 'card' && !provider.configuration.apiKey) {
      errors.push('API key is required for card providers')
    }

    if (provider.type === 'mobile_money' && !provider.configuration.merchantId) {
      errors.push('Merchant ID is required for mobile money providers')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private async testProviderConnection(provider: PaymentProvider): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Simulate provider connection test
      // In real implementation, this would make actual API calls to test connectivity
      
      if (provider.configuration.sandboxMode) {
        return { success: true }
      }
      
      // For production, we'd test actual endpoints
      return { success: true }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async selectBestProvider(currency: string, amount: number): Promise<{
    success: boolean
    providerId?: string
    error?: string
  }> {
    try {
      // Get active providers that support the currency
      const providersResult = await this.db.findMany('payment_providers', {
        isActive: true,
        currencies: { $in: [currency] }
      }, {
        orderBy: { priority: 'asc' }
      })

      if (!providersResult.success || !providersResult.data || providersResult.data.length === 0) {
        return { success: false, error: 'No active providers found for currency' }
      }

      const providers = providersResult.data as PaymentProvider[]

      // Select provider with lowest fees for the amount
      let bestProvider = providers[0]
      let lowestFee = this.calculateFee(bestProvider, amount)

      for (const provider of providers.slice(1)) {
        const fee = this.calculateFee(provider, amount)
        if (fee < lowestFee) {
          bestProvider = provider
          lowestFee = fee
        }
      }

      return { success: true, providerId: bestProvider.id }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private calculateFee(provider: PaymentProvider, amount: number): number {
    const percentageFee = (amount * provider.fees.percentage) / 100
    const totalFee = percentageFee + provider.fees.fixed

    if (provider.fees.minimumFee && totalFee < provider.fees.minimumFee) {
      return provider.fees.minimumFee
    }

    if (provider.fees.maximumFee && totalFee > provider.fees.maximumFee) {
      return provider.fees.maximumFee
    }

    return totalFee
  }

  private async createProviderPaymentIntent(paymentIntent: PaymentIntent): Promise<{
    success: boolean
    clientSecret?: string
    confirmationUrl?: string
    error?: string
  }> {
    // Simulate provider payment intent creation
    // In real implementation, this would call the actual provider APIs
    
    return {
      success: true,
      clientSecret: `pi_${paymentIntent.id}_secret_${Math.random().toString(36).substr(2, 9)}`,
      confirmationUrl: `https://checkout.provider.com/confirm/${paymentIntent.id}`
    }
  }

  private async processProviderPayment(paymentIntent: PaymentIntent, paymentMethodData?: any): Promise<{
    success: boolean
    transactionId?: string
    fees?: PaymentTransaction['fees']
    error?: string
  }> {
    try {
      // Simulate payment processing
      // In real implementation, this would call the actual provider APIs
      
      const provider = await this.getPaymentProvider(paymentIntent.providerId)
      if (!provider.success || !provider.provider) {
        return { success: false, error: 'Provider not found' }
      }

      const providerFee = this.calculateFee(provider.provider, paymentIntent.amount)
      const platformFee = paymentIntent.amount * 0.005 // 0.5% platform fee

      const fees = {
        platform: platformFee,
        provider: providerFee,
        total: platformFee + providerFee
      }

      // Simulate successful payment
      const success = Math.random() > 0.05 // 95% success rate

      if (!success) {
        return { success: false, error: 'Payment declined by provider' }
      }

      return {
        success: true,
        transactionId: `provider_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fees
      }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async getPaymentIntent(paymentIntentId: string): Promise<{
    success: boolean
    paymentIntent?: PaymentIntent
    error?: string
  }> {
    try {
      // Check cache first
      const cachedIntent = await this.cache.get<PaymentIntent>(`payment_intent:${paymentIntentId}`)
      if (cachedIntent) {
        return { success: true, paymentIntent: cachedIntent }
      }

      // Get from database
      const result = await this.db.findOne('payment_intents', { id: paymentIntentId })
      
      if (!result.success || !result.data) {
        return { success: false, error: 'Payment intent not found' }
      }

      const paymentIntent = result.data as PaymentIntent

      // Cache payment intent
      await this.cache.set(`payment_intent:${paymentIntentId}`, paymentIntent, {
        ttl: 1800,
        tags: ['payment', 'intent', paymentIntentId]
      })

      return { success: true, paymentIntent }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async getPaymentProvider(providerId: string): Promise<{
    success: boolean
    provider?: PaymentProvider
    error?: string
  }> {
    try {
      // Check cache first
      const cachedProvider = await this.cache.get<PaymentProvider>(`payment_provider:${providerId}`)
      if (cachedProvider) {
        return { success: true, provider: cachedProvider }
      }

      // Get from database
      const result = await this.db.findOne('payment_providers', { id: providerId })
      
      if (!result.success || !result.data) {
        return { success: false, error: 'Payment provider not found' }
      }

      const provider = result.data as PaymentProvider

      // Cache provider
      await this.cache.set(`payment_provider:${providerId}`, provider, {
        ttl: 3600,
        tags: ['payment', 'provider', providerId]
      })

      return { success: true, provider }

    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async updatePaymentIntentStatus(paymentIntentId: string, status: PaymentIntent['status'], errorMessage?: string): Promise<void> {
    const updateData: Partial<PaymentIntent> = {
      status,
      updatedAt: new Date()
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage
    }

    await this.db.update('payment_intents', { id: paymentIntentId }, updateData)

    // Update cache
    const cachedIntent = await this.cache.get<PaymentIntent>(`payment_intent:${paymentIntentId}`)
    if (cachedIntent) {
      Object.assign(cachedIntent, updateData)
      await this.cache.set(`payment_intent:${paymentIntentId}`, cachedIntent, {
        ttl: 1800,
        tags: ['payment', 'intent', paymentIntentId]
      })
    }
  }

  private async verifyWebhookSignature(provider: PaymentProvider, eventData: any, signature: string): Promise<boolean> {
    // Simulate webhook signature verification
    // In real implementation, this would verify the signature using the provider's webhook secret
    return signature.length > 0
  }

  private async processWebhookEvent(webhookEvent: WebhookEvent): Promise<boolean> {
    try {
      // Process different webhook event types
      switch (webhookEvent.eventType) {
        case 'payment.succeeded':
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(webhookEvent.eventData)
          break

        case 'payment.failed':
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(webhookEvent.eventData)
          break

        case 'payment.refunded':
          await this.handlePaymentRefunded(webhookEvent.eventData)
          break

        default:
          console.log(`Unhandled webhook event type: ${webhookEvent.eventType}`)
      }

      return true

    } catch (error) {
      console.error('Failed to process webhook event:', error)
      return false
    }
  }

  private async handlePaymentSucceeded(eventData: any): Promise<void> {
    // Handle successful payment webhook
    console.log('Payment succeeded:', eventData)
  }

  private async handlePaymentFailed(eventData: any): Promise<void> {
    // Handle failed payment webhook
    console.log('Payment failed:', eventData)
  }

  private async handlePaymentRefunded(eventData: any): Promise<void> {
    // Handle refunded payment webhook
    console.log('Payment refunded:', eventData)
  }

  private initializePaymentGateway(): void {
    console.log('Payment gateway system initialized')
  }

  // Public API methods
  public getPaymentProviders(): Partial<PaymentProvider>[] {
    return this.PAYMENT_PROVIDERS
  }

  public getDonationPresets(currency: string = 'USD'): number[] {
    return this.DONATION_PRESETS[currency as keyof typeof this.DONATION_PRESETS] || this.DONATION_PRESETS.USD
  }

  public async getSystemStats() {
    return {
      supportedProviders: this.PAYMENT_PROVIDERS.length,
      supportedCurrencies: [...new Set(this.PAYMENT_PROVIDERS.flatMap(p => p.currencies || []))].length,
      supportedRegions: [...new Set(this.PAYMENT_PROVIDERS.flatMap(p => p.region || []))].length,
      paymentTypes: [...new Set(this.PAYMENT_PROVIDERS.map(p => p.type))].length
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const stats = await this.getSystemStats()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    // Test database connectivity
    try {
      await this.db.findOne('payment_providers', {})
    } catch (error) {
      status = 'unhealthy'
    }

    return {
      status,
      details: {
        ...stats,
        databaseConnected: status !== 'unhealthy',
        cacheConnected: true
      }
    }
  }
}

// Singleton instance
let paymentGatewayInstance: PaymentGateway | null = null

export function getPaymentGateway(): PaymentGateway {
  if (!paymentGatewayInstance) {
    paymentGatewayInstance = new PaymentGateway()
  }
  return paymentGatewayInstance
}

export default PaymentGateway
