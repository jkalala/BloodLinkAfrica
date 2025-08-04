import { getSupabase } from "./supabase"

export interface MobileMoneyTransaction {
  id: string
  phoneNumber: string
  amount: number
  currency: string
  type: 'donation' | 'reward' | 'subscription' | 'emergency'
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  provider: 'mpesa' | 'airtel_money' | 'mtn_momo' | 'orange_money'
  reference: string
  description: string
  created_at: string
  updated_at: string
}

export interface MobileMoneyProvider {
  name: string
  code: string
  apiUrl: string
  apiKey: string
  supportedCountries: string[]
  transactionFees: number
}

export interface PaymentRequest {
  phoneNumber: string
  amount: number
  currency: string
  description: string
  reference: string
  callbackUrl?: string
}

export interface PaymentResponse {
  success: boolean
  transactionId?: string
  reference?: string
  message: string
  status: 'pending' | 'completed' | 'failed'
}

export interface TransactionStats {
  totalAmount: number;
  totalTransactions: number;
  donationRewards: number;
  emergencyPayments: number;
  averageAmount: number;
}

export class MobileMoneyService {
  private supabase = getSupabase()
  private providers: Map<string, MobileMoneyProvider> = new Map()

  constructor() {
    this.initializeProviders()
  }

  /**
   * Initialize mobile money providers
   */
  private initializeProviders(): void {
    // M-Pesa (Kenya, Tanzania)
    this.providers.set('mpesa', {
      name: 'M-Pesa',
      code: 'mpesa',
      apiUrl: process.env.MPESA_API_URL || 'https://sandbox.safaricom.co.ke',
      apiKey: process.env.MPESA_API_KEY || '',
      supportedCountries: ['KE', 'TZ'],
      transactionFees: 0.01 // 1%
    })

    // Airtel Money (Multiple countries)
    this.providers.set('airtel_money', {
      name: 'Airtel Money',
      code: 'airtel_money',
      apiUrl: process.env.AIRTEL_MONEY_API_URL || 'https://openapiuat.airtel.africa',
      apiKey: process.env.AIRTEL_MONEY_API_KEY || '',
      supportedCountries: ['UG', 'TZ', 'NG', 'GH', 'ZM'],
      transactionFees: 0.015 // 1.5%
    })

    // MTN Mobile Money (Multiple countries)
    this.providers.set('mtn_momo', {
      name: 'MTN Mobile Money',
      code: 'mtn_momo',
      apiUrl: process.env.MTN_MOMO_API_URL || 'https://sandbox.momodeveloper.mtn.com',
      apiKey: process.env.MTN_MOMO_API_KEY || '',
      supportedCountries: ['GH', 'UG', 'ZM', 'RW'],
      transactionFees: 0.02 // 2%
    })

    // Orange Money (Multiple countries)
    this.providers.set('orange_money', {
      name: 'Orange Money',
      code: 'orange_money',
      apiUrl: process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com',
      apiKey: process.env.ORANGE_MONEY_API_KEY || '',
      supportedCountries: ['CI', 'SN', 'ML', 'BF'],
      transactionFees: 0.018 // 1.8%
    })
  }

  /**
   * Process blood donation reward payment
   */
  async processDonationReward(phoneNumber: string, amount: number, country: string): Promise<PaymentResponse> {
    try {
      const provider = this.getProviderForCountry(country)
      if (!provider) {
        return {
          success: false,
          message: 'No mobile money provider available for this country',
          status: 'failed'
        }
      }

      const transaction = {
        phoneNumber,
        amount,
        currency: this.getCurrencyForCountry(country),
        type: 'donation' as const,
        provider: provider.code,
        description: 'Blood donation reward',
        reference: this.generateReference()
      }

      // Create transaction record
      const { data: transactionRecord, error } = await this.supabase
        .from('mobile_money_transactions')
        .insert({
          phone_number: phoneNumber,
          amount,
          currency: transaction.currency,
          type: transaction.type,
          status: 'pending',
          provider: transaction.provider,
          reference: transaction.reference,
          description: transaction.description
        })
        .select()
        .single()

      if (error) throw error

      // Process payment with provider
      const paymentResult = await this.processPaymentWithProvider(provider, transaction)

      if (paymentResult.success) {
        // Update transaction status
        await this.supabase
          .from('mobile_money_transactions')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionRecord.id)

        return {
          success: true,
          transactionId: transactionRecord.id,
          reference: transaction.reference,
          message: `Successfully sent ${amount} ${transaction.currency} to ${phoneNumber}`,
          status: 'completed'
        }
      } else {
        // Update transaction status to failed
        await this.supabase
          .from('mobile_money_transactions')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionRecord.id)

        return {
          success: false,
          message: paymentResult.message,
          status: 'failed'
        }
      }
    } catch (error: unknown) {
      console.error('Error processing donation reward:', error)
      return {
        success: false,
        message: 'Failed to process payment',
        status: 'failed'
      }
    }
  }

  /**
   * Process emergency blood request payment
   */
  async processEmergencyPayment(phoneNumber: string, amount: number, country: string): Promise<PaymentResponse> {
    try {
      const provider = this.getProviderForCountry(country)
      if (!provider) {
        return {
          success: false,
          message: 'No mobile money provider available for this country',
          status: 'failed'
        }
      }

      const transaction = {
        phoneNumber,
        amount,
        currency: this.getCurrencyForCountry(country),
        type: 'emergency' as const,
        provider: provider.code,
        description: 'Emergency blood request processing fee',
        reference: this.generateReference()
      }

      // Create transaction record
      const { data: transactionRecord, error } = await this.supabase
        .from('mobile_money_transactions')
        .insert({
          phone_number: phoneNumber,
          amount,
          currency: transaction.currency,
          type: transaction.type,
          status: 'pending',
          provider: transaction.provider,
          reference: transaction.reference,
          description: transaction.description
        })
        .select()
        .single()

      if (error) throw error

      // Process payment with provider
      const paymentResult = await this.processPaymentWithProvider(provider, transaction)

      if (paymentResult.success) {
        // Update transaction status
        await this.supabase
          .from('mobile_money_transactions')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionRecord.id)

        return {
          success: true,
          transactionId: transactionRecord.id,
          reference: transaction.reference,
          message: `Emergency payment processed successfully`,
          status: 'completed'
        }
      } else {
        // Update transaction status to failed
        await this.supabase
          .from('mobile_money_transactions')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionRecord.id)

        return {
          success: false,
          message: paymentResult.message,
          status: 'failed'
        }
      }
    } catch (error: unknown) {
      console.error('Error processing emergency payment:', error)
      return {
        success: false,
        message: 'Failed to process emergency payment',
        status: 'failed'
      }
    }
  }

  /**
   * Process subscription payment
   */
  async processSubscriptionPayment(phoneNumber: string, amount: number, country: string, plan: string): Promise<PaymentResponse> {
    try {
      const provider = this.getProviderForCountry(country)
      if (!provider) {
        return {
          success: false,
          message: 'No mobile money provider available for this country',
          status: 'failed'
        }
      }

      const transaction = {
        phoneNumber,
        amount,
        currency: this.getCurrencyForCountry(country),
        type: 'subscription' as const,
        provider: provider.code,
        description: `Premium subscription - ${plan}`,
        reference: this.generateReference()
      }

      // Create transaction record
      const { data: transactionRecord, error } = await this.supabase
        .from('mobile_money_transactions')
        .insert({
          phone_number: phoneNumber,
          amount,
          currency: transaction.currency,
          type: transaction.type,
          status: 'pending',
          provider: transaction.provider,
          reference: transaction.reference,
          description: transaction.description
        })
        .select()
        .single()

      if (error) throw error

      // Process payment with provider
      const paymentResult = await this.processPaymentWithProvider(provider, transaction)

      if (paymentResult.success) {
        // Update transaction status
        await this.supabase
          .from('mobile_money_transactions')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionRecord.id)

        return {
          success: true,
          transactionId: transactionRecord.id,
          reference: transaction.reference,
          message: `Subscription payment processed successfully`,
          status: 'completed'
        }
      } else {
        // Update transaction status to failed
        await this.supabase
          .from('mobile_money_transactions')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionRecord.id)

        return {
          success: false,
          message: paymentResult.message,
          status: 'failed'
        }
      }
    } catch (error: unknown) {
      console.error('Error processing subscription payment:', error)
      return {
        success: false,
        message: 'Failed to process subscription payment',
        status: 'failed'
      }
    }
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(phoneNumber: string): Promise<MobileMoneyTransaction[]> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('mobile_money_transactions')
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      return transactions || []
    } catch (error: unknown) {
      console.error('Error getting transaction history:', error)
      return []
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(): Promise<TransactionStats> {
    try {
      const { data: stats, error } = await this.supabase
        .from('mobile_money_transactions')
        .select('status, amount, currency, type, provider')
        .eq('status', 'completed')

      if (error) throw error

      const totalAmount = stats?.reduce((sum: number, tx: MobileMoneyTransaction) => sum + tx.amount, 0) || 0
      const totalTransactions = stats?.length || 0
      const donationRewards = stats?.filter((tx: MobileMoneyTransaction) => tx.type === 'donation').length || 0
      const emergencyPayments = stats?.filter((tx: MobileMoneyTransaction) => tx.type === 'emergency').length || 0

      return {
        totalAmount,
        totalTransactions,
        donationRewards,
        emergencyPayments,
        averageAmount: totalTransactions > 0 ? totalAmount / totalTransactions : 0
      }
    } catch (error: unknown) {
      console.error('Error getting transaction stats:', error)
      return {
        totalAmount: 0,
        totalTransactions: 0,
        donationRewards: 0,
        emergencyPayments: 0,
        averageAmount: 0
      }
    }
  }

  /**
   * Get provider for country
   */
  private getProviderForCountry(country: string): MobileMoneyProvider | null {
    for (const [code, provider] of this.providers) {
      if (provider.supportedCountries.includes(country)) {
        return provider
      }
    }
    return null
  }

  /**
   * Get currency for country
   */
  private getCurrencyForCountry(country: string): string {
    const currencyMap: Record<string, string> = {
      'KE': 'KES',
      'TZ': 'TZS',
      'UG': 'UGX',
      'NG': 'NGN',
      'GH': 'GHS',
      'ZM': 'ZMW',
      'RW': 'RWF',
      'CI': 'XOF',
      'SN': 'XOF',
      'ML': 'XOF',
      'BF': 'XOF'
    }

    return currencyMap[country] || 'USD'
  }

  /**
   * Generate unique reference
   */
  private generateReference(): string {
    return `BL${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  }

  /**
   * Process payment with specific provider
   */
  private async processPaymentWithProvider(provider: MobileMoneyProvider, transaction: MobileMoneyTransaction): Promise<{ success: boolean; message: string }> {
    try {
      // Simulate payment processing with provider
      // In real implementation, this would call the actual provider API
      
      switch (provider.code) {
        case 'mpesa':
          return await this.processMpesaPayment(provider, transaction)
        
        case 'airtel_money':
          return await this.processAirtelMoneyPayment(provider, transaction)
        
        case 'mtn_momo':
          return await this.processMTNMoMoPayment(provider, transaction)
        
        case 'orange_money':
          return await this.processOrangeMoneyPayment(provider, transaction)
        
        default:
          return { success: false, message: 'Unsupported provider' }
      }
    } catch (error: unknown) {
      console.error('Error processing payment with provider:', error)
      return { success: false, message: 'Payment processing failed' }
    }
  }

  /**
   * Process M-Pesa payment
   */
  private async processMpesaPayment(provider: MobileMoneyProvider, transaction: MobileMoneyTransaction): Promise<{ success: boolean; message: string }> {
    try {
      // Simulate M-Pesa API call
      const response = await fetch(`${provider.apiUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          BusinessShortCode: '174379',
          Password: 'MTc0Mzc5YmZiMjc5ZjlhYTliZGJjZjE1OGU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQ=',
          Timestamp: new Date().toISOString(),
          TransactionType: 'CustomerPayBillOnline',
          Amount: transaction.amount,
          PartyA: transaction.phoneNumber,
          PartyB: '174379',
          PhoneNumber: transaction.phoneNumber,
          CallBackURL: 'https://bloodlinkafrica.com/api/mpesa/callback',
          AccountReference: transaction.reference,
          TransactionDesc: transaction.description
        })
      })

      if (!response.ok) {
        throw new Error(`M-Pesa API error: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.ResponseCode === '0') {
        return { success: true, message: 'Payment initiated successfully' }
      } else {
        return { success: false, message: result.ResponseDescription || 'Payment failed' }
      }
    } catch (error: unknown) {
      console.error('M-Pesa payment error:', error)
      return { success: false, message: 'M-Pesa payment failed' }
    }
  }

  /**
   * Process Airtel Money payment
   */
  private async processAirtelMoneyPayment(provider: MobileMoneyProvider, transaction: MobileMoneyTransaction): Promise<{ success: boolean; message: string }> {
    try {
      // Simulate Airtel Money API call
      const response = await fetch(`${provider.apiUrl}/collection/v1_0/requesttopay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'X-Reference-Id': transaction.reference,
          'X-Target-Environment': 'sandbox',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: transaction.amount.toString(),
          currency: transaction.currency,
          externalId: transaction.reference,
          payer: {
            partyIdType: 'MSISDN',
            partyId: transaction.phoneNumber
          },
          payerMessage: transaction.description,
          payeeNote: transaction.description
        })
      })

      if (!response.ok) {
        throw new Error(`Airtel Money API error: ${response.status}`)
      }

      return { success: true, message: 'Payment initiated successfully' }
    } catch (error: unknown) {
      console.error('Airtel Money payment error:', error)
      return { success: false, message: 'Airtel Money payment failed' }
    }
  }

  /**
   * Process MTN Mobile Money payment
   */
  private async processMTNMoMoPayment(provider: MobileMoneyProvider, transaction: MobileMoneyTransaction): Promise<{ success: boolean; message: string }> {
    try {
      // Simulate MTN MoMo API call
      const response = await fetch(`${provider.apiUrl}/collection/v1_0/requesttopay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'X-Reference-Id': transaction.reference,
          'X-Target-Environment': 'sandbox',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: transaction.amount.toString(),
          currency: transaction.currency,
          externalId: transaction.reference,
          payer: {
            partyIdType: 'MSISDN',
            partyId: transaction.phoneNumber
          },
          payerMessage: transaction.description,
          payeeNote: transaction.description
        })
      })

      if (!response.ok) {
        throw new Error(`MTN MoMo API error: ${response.status}`)
      }

      return { success: true, message: 'Payment initiated successfully' }
    } catch (error: unknown) {
      console.error('MTN MoMo payment error:', error)
      return { success: false, message: 'MTN MoMo payment failed' }
    }
  }

  /**
   * Process Orange Money payment
   */
  private async processOrangeMoneyPayment(provider: MobileMoneyProvider, transaction: MobileMoneyTransaction): Promise<{ success: boolean; message: string }> {
    try {
      // Simulate Orange Money API call
      const response = await fetch(`${provider.apiUrl}/payment/v1/requesttopay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: transaction.amount,
          currency: transaction.currency,
          reference: transaction.reference,
          phoneNumber: transaction.phoneNumber,
          description: transaction.description
        })
      })

      if (!response.ok) {
        throw new Error(`Orange Money API error: ${response.status}`)
      }

      return { success: true, message: 'Payment initiated successfully' }
    } catch (error: unknown) {
      console.error('Orange Money payment error:', error)
      return { success: false, message: 'Orange Money payment failed' }
    }
  }

  /**
   * Handle payment callback
   */
  async handlePaymentCallback(provider: string, callbackData: Record<string, unknown>): Promise<void> {
    try {
      const { reference, status, transactionId } = callbackData

      // Update transaction status
      await this.supabase
        .from('mobile_money_transactions')
        .update({ 
          status: status === 'success' ? 'completed' : 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('reference', reference)

      console.log(`Payment callback processed: ${reference} - ${status}`)
    } catch (error: unknown) {
      console.error('Error handling payment callback:', error)
    }
  }
}

// Export singleton instance
export const mobileMoneyService = new MobileMoneyService() 