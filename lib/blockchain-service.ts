import { getSupabase } from "./supabase"

export interface BlockchainRecord {
  id: string
  transaction_hash: string
  block_number: number
  timestamp: string
  event_type: 'blood_request' | 'donor_response' | 'donation_completed' | 'verification'
  data: unknown
  metadata: {
    user_id: string
    request_id?: string
    donor_id?: string
    hospital_id?: string
    blood_type: string
    units: number
    location: string
  }
}

export interface DonationTrace {
  request_id: string
  donor_id: string
  hospital_id: string
  blood_type: string
  units: number
  request_time: string
  response_time: string
  completion_time: string
  verification_status: string
  blockchain_records: BlockchainRecord[]
}

export class BlockchainService {
  private supabase = getSupabase()
  private chainId = process.env.NEXT_PUBLIC_CHAIN_ID || '1' // Mainnet by default
  private contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x...'

  /**
   * Create a blockchain record for transparency
   */
  async createBlockchainRecord(
    eventType: BlockchainRecord['event_type'],
    metadata: BlockchainRecord['metadata'],
    additionalData?: unknown
  ): Promise<{ success: boolean; record?: BlockchainRecord; error?: string }> {
    try {
      // Generate a unique transaction hash (in production, this would be a real blockchain transaction)
      const transactionHash = this.generateTransactionHash()
      const blockNumber = await this.getCurrentBlockNumber()
      
      const record: BlockchainRecord = {
        id: crypto.randomUUID(),
        transaction_hash: transactionHash,
        block_number: blockNumber,
        timestamp: new Date().toISOString(),
        event_type: eventType,
        data: additionalData || {},
        metadata
      }

      // Store in database
      const { error } = await this.supabase
        .from('blockchain_records')
        .insert(record)

      if (error) {
        console.error('Error creating blockchain record:', error)
        return { success: false, error: error.message }
      }

      // In a real implementation, this would also be sent to the blockchain
      await this.sendToBlockchain(record)

      return { success: true, record }
    } catch (error: any) {
      console.error('Error in createBlockchainRecord:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Track blood request creation
   */
  async trackBloodRequest(requestData: Record<string, unknown>): Promise<void> {
    const metadata = {
      user_id: requestData.user_id,
      request_id: requestData.id,
      blood_type: requestData.blood_type,
      units: requestData.units_needed,
      location: requestData.location
    }

    await this.createBlockchainRecord('blood_request', metadata, {
      urgency: requestData.urgency,
      hospital_name: requestData.hospital_name,
      patient_name: requestData.patient_name
    })
  }

  /**
   * Track donor response
   */
  async trackDonorResponse(responseData: Record<string, unknown>): Promise<void> {
    const metadata = {
      user_id: responseData.donor_id,
      request_id: responseData.request_id,
      donor_id: responseData.donor_id,
      blood_type: responseData.blood_type,
      units: 1, // Default unit for response
      location: responseData.location || 'Unknown'
    }

    await this.createBlockchainRecord('donor_response', metadata, {
      response_type: responseData.response_type,
      eta_minutes: responseData.eta_minutes,
      notes: responseData.notes
    })
  }

  /**
   * Track donation completion
   */
  async trackDonationCompletion(completionData: Record<string, unknown>): Promise<void> {
    const metadata = {
      user_id: completionData.donor_id,
      request_id: completionData.request_id,
      donor_id: completionData.donor_id,
      hospital_id: completionData.hospital_id,
      blood_type: completionData.blood_type,
      units: completionData.units,
      location: completionData.location
    }

    await this.createBlockchainRecord('donation_completed', metadata, {
      completion_time: completionData.completion_time,
      verification_status: completionData.verification_status,
      quality_metrics: completionData.quality_metrics
    })
  }

  /**
   * Track verification events
   */
  async trackVerification(verificationData: Record<string, unknown>): Promise<void> {
    const metadata = {
      user_id: verificationData.user_id,
      blood_type: verificationData.blood_type,
      units: 0, // Verification doesn't involve units
      location: verificationData.location
    }

    await this.createBlockchainRecord('verification', metadata, {
      verification_type: verificationData.verification_type,
      status: verificationData.status,
      verified_by: verificationData.verified_by
    })
  }

  /**
   * Get complete donation trace
   */
  async getDonationTrace(requestId: string): Promise<DonationTrace | null> {
    try {
      // Get all blockchain records for this request
      const { data: records, error } = await this.supabase
        .from('blockchain_records')
        .select('*')
        .eq('metadata->request_id', requestId)
        .order('timestamp', { ascending: true })

      if (error || !records || records.length === 0) {
        return null
      }

      // Get request details
      const { data: request } = await this.supabase
        .from('blood_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (!request) return null

      // Get donor response
      const { data: response } = await this.supabase
        .from('donor_responses')
        .select('*')
        .eq('request_id', requestId)
        .eq('response_type', 'accept')
        .single()

      const trace: DonationTrace = {
        request_id: requestId,
        donor_id: response?.donor_id || 'Unknown',
        hospital_id: request.hospital_name,
        blood_type: request.blood_type,
        units: request.units_needed,
        request_time: request.created_at,
        response_time: response?.created_at || 'Pending',
        completion_time: request.status === 'completed' ? request.updated_at : 'Pending',
        verification_status: request.status,
        blockchain_records: records
      }

      return trace
    } catch (error: any) {
      console.error('Error getting donation trace:', error)
      return null
    }
  }

  /**
   * Verify blockchain integrity
   */
  async verifyBlockchainIntegrity(): Promise<{ success: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // Check for missing records
      const { data: requests } = await this.supabase
        .from('blood_requests')
        .select('id, created_at')

      for (const request of requests || []) {
        const { data: records } = await this.supabase
          .from('blockchain_records')
          .select('id')
          .eq('metadata->request_id', request.id)

        if (!records || records.length === 0) {
          issues.push(`Missing blockchain record for request ${request.id}`)
        }
      }

      // Check for orphaned records
      const { data: orphanedRecords } = await this.supabase
        .from('blockchain_records')
        .select('id, metadata')
        .not('metadata->request_id', 'is', null)

      for (const record of orphanedRecords || []) {
        const requestId = record.metadata?.request_id
        if (requestId) {
          const { data: request } = await this.supabase
            .from('blood_requests')
            .select('id')
            .eq('id', requestId)
            .single()

          if (!request) {
            issues.push(`Orphaned blockchain record ${record.id} for non-existent request ${requestId}`)
          }
        }
      }

      return { success: issues.length === 0, issues }
    } catch (error: any) {
      console.error('Error verifying blockchain integrity:', error)
      return { success: false, issues: ['Verification failed'] }
    }
  }

  /**
   * Get blockchain statistics
   */
  async getBlockchainStats(): Promise<{
    total_records: number
    total_requests: number
    total_donations: number
    total_verifications: number
    chain_integrity: number
  }> {
    try {
      const { count: totalRecords } = await this.supabase
        .from('blockchain_records')
        .select('*', { count: 'exact', head: true })

      const { count: totalRequests } = await this.supabase
        .from('blockchain_records')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'blood_request')

      const { count: totalDonations } = await this.supabase
        .from('blockchain_records')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'donation_completed')

      const { count: totalVerifications } = await this.supabase
        .from('blockchain_records')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'verification')

      const integrityCheck = await this.verifyBlockchainIntegrity()
      const chainIntegrity = integrityCheck.success ? 100 : 100 - (integrityCheck.issues.length * 10)

      return {
        total_records: totalRecords || 0,
        total_requests: totalRequests || 0,
        total_donations: totalDonations || 0,
        total_verifications: totalVerifications || 0,
        chain_integrity: Math.max(chainIntegrity, 0)
      }
    } catch (error: any) {
      console.error('Error getting blockchain stats:', error)
      return {
        total_records: 0,
        total_requests: 0,
        total_donations: 0,
        total_verifications: 0,
        chain_integrity: 0
      }
    }
  }

  /**
   * Generate a unique transaction hash
   */
  private generateTransactionHash(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2)
    return `0x${timestamp.toString(16)}${random}`
  }

  /**
   * Get current block number (simulated)
   */
  private async getCurrentBlockNumber(): Promise<number> {
    // In a real implementation, this would query the blockchain
    return Math.floor(Date.now() / 1000) // Use timestamp as block number for demo
  }

  /**
   * Send record to blockchain (simulated)
   */
  private async sendToBlockchain(record: BlockchainRecord): Promise<void> {
    // In a real implementation, this would send the record to the actual blockchain
    console.log('Sending to blockchain:', record.transaction_hash)
    
    // Simulate blockchain confirmation delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  /**
   * Export blockchain data for external verification
   */
  async exportBlockchainData(startDate?: string, endDate?: string): Promise<BlockchainRecord[]> {
    try {
      let query = this.supabase
        .from('blockchain_records')
        .select('*')
        .order('timestamp', { ascending: false })

      if (startDate) {
        query = query.gte('timestamp', startDate)
      }
      if (endDate) {
        query = query.lte('timestamp', endDate)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error exporting blockchain data:', error)
        return []
      }

      return data || []
    } catch (error: any) {
      console.error('Error in exportBlockchainData:', error)
      return []
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService() 