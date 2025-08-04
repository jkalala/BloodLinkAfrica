/**
 * Advanced Blood Inventory Management Service
 * Provides real-time inventory tracking, expiry management, and automated alerts
 */

import { createServerSupabaseClient } from './supabase'
import { performanceMonitor } from './performance-monitoring'
import { websocketService } from './websocket-service'
import { notificationService } from './notification-service'

export interface BloodUnit {
  id: string
  donorId: string
  bloodType: string
  volume: number // in mL
  collectionDate: string
  expiryDate: string
  status: 'available' | 'reserved' | 'used' | 'expired' | 'quarantine' | 'testing'
  location: string
  storageConditions: {
    temperature: number
    humidity: number
    lastChecked: string
  }
  qualityScore: number // 0-100
  batchNumber: string
  testResults: {
    hiv: 'negative' | 'positive' | 'pending'
    hepatitisB: 'negative' | 'positive' | 'pending'
    hepatitisC: 'negative' | 'positive' | 'pending'
    syphilis: 'negative' | 'positive' | 'pending'
    completedAt?: string
  }
  metadata: {
    collectionCenter: string
    processingStaff: string
    notes?: string
  }
}

export interface InventoryAlert {
  id: string
  type: 'low_stock' | 'expiry_warning' | 'critical_shortage' | 'temperature_alert' | 'quality_issue'
  severity: 'low' | 'medium' | 'high' | 'critical'
  bloodType?: string
  message: string
  details: unknown
  createdAt: string
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
}

export interface InventoryStats {
  totalUnits: number
  availableUnits: number
  reservedUnits: number
  expiringSoon: number // within 7 days
  byBloodType: Record<string, {
    available: number
    reserved: number
    expiring: number
    total: number
  }>
  storageUtilization: number // percentage
  qualityMetrics: {
    averageQualityScore: number
    unitsInTesting: number
    qualityIssues: number
  }
}

export interface StorageLocation {
  id: string
  name: string
  type: 'refrigerator' | 'freezer' | 'room_temperature' | 'transport'
  capacity: number
  currentOccupancy: number
  temperature: {
    current: number
    min: number
    max: number
    optimal: number
  }
  humidity: {
    current: number
    optimal: number
  }
  isActive: boolean
  lastMaintenance: string
  alerts: string[]
}

export interface BatchOperation {
  id: string
  type: 'collection' | 'transfer' | 'disposal' | 'testing' | 'quality_check'
  bloodUnits: string[]
  performedBy: string
  performedAt: string
  status: 'pending' | 'completed' | 'failed'
  notes?: string
  results?: unknown
}

export class InventoryManagementService {
  private supabase = createServerSupabaseClient()
  private alertThresholds = {
    lowStock: 5, // units
    criticalStock: 2, // units
    expiryWarning: 7, // days
    temperatureVariance: 2, // degrees Celsius
    qualityThreshold: 80 // quality score
  }

  /**
   * Get comprehensive inventory statistics
   */
  async getInventoryStats(bloodBankId?: string): Promise<InventoryStats> {
    const tracker = performanceMonitor.startTracking('inventory-stats', 'GET')

    try {
      let query = this.supabase
        .from('blood_inventory')
        .select(`
          *,
          blood_units (
            id,
            blood_type,
            volume,
            status,
            expiry_date,
            quality_score,
            collection_date
          )
        `)

      if (bloodBankId) {
        query = query.eq('blood_bank_id', bloodBankId)
      }

      const { data: inventory } = await query

      if (!inventory) {
        throw new Error('Failed to fetch inventory data')
      }

      // Calculate statistics
      const stats: InventoryStats = {
        totalUnits: 0,
        availableUnits: 0,
        reservedUnits: 0,
        expiringSoon: 0,
        byBloodType: {},
        storageUtilization: 0,
        qualityMetrics: {
          averageQualityScore: 0,
          unitsInTesting: 0,
          qualityIssues: 0
        }
      }

      const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
      const now = new Date()
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      // Initialize blood type stats
      bloodTypes.forEach(type => {
        stats.byBloodType[type] = {
          available: 0,
          reserved: 0,
          expiring: 0,
          total: 0
        }
      })

      let totalQuality = 0
      let qualityCount = 0

      // Process each inventory item
      for (const item of inventory) {
        for (const unit of item.blood_units || []) {
          stats.totalUnits++
          
          const bloodType = unit.blood_type
          if (stats.byBloodType[bloodType]) {
            stats.byBloodType[bloodType].total++
          }

          // Status counting
          switch (unit.status) {
            case 'available':
              stats.availableUnits++
              if (stats.byBloodType[bloodType]) {
                stats.byBloodType[bloodType].available++
              }
              break
            case 'reserved':
              stats.reservedUnits++
              if (stats.byBloodType[bloodType]) {
                stats.byBloodType[bloodType].reserved++
              }
              break
            case 'testing':
              stats.qualityMetrics.unitsInTesting++
              break
          }

          // Expiry tracking
          const expiryDate = new Date(unit.expiry_date)
          if (expiryDate <= sevenDaysFromNow && unit.status === 'available') {
            stats.expiringSoon++
            if (stats.byBloodType[bloodType]) {
              stats.byBloodType[bloodType].expiring++
            }
          }

          // Quality metrics
          if (unit.quality_score) {
            totalQuality += unit.quality_score
            qualityCount++
            
            if (unit.quality_score < this.alertThresholds.qualityThreshold) {
              stats.qualityMetrics.qualityIssues++
            }
          }
        }
      }

      // Calculate averages
      stats.qualityMetrics.averageQualityScore = qualityCount > 0 
        ? Math.round(totalQuality / qualityCount) 
        : 0

      // Calculate storage utilization (mock - would integrate with IoT sensors in production)
      stats.storageUtilization = Math.min(Math.round((stats.totalUnits / 1000) * 100), 100)

      console.log(`📊 Generated inventory stats: ${stats.totalUnits} total units`)
      tracker.end(200)

      return stats

    } catch (error) {
      console.error('Error getting inventory stats:', error)
      tracker.end(500)
      throw error
    }
  }

  /**
   * Add new blood units to inventory
   */
  async addBloodUnits(units: Omit<BloodUnit, 'id'>[]): Promise<{ success: boolean; unitsAdded: number; errors: string[] }> {
    const tracker = performanceMonitor.startTracking('inventory-add', 'POST')

    try {
      const results = {
        success: true,
        unitsAdded: 0,
        errors: [] as string[]
      }

      console.log(`🩸 Adding ${units.length} blood units to inventory`)

      for (const unit of units) {
        try {
          // Validate blood unit data
          const validationResult = this.validateBloodUnit(unit)
          if (!validationResult.valid) {
            results.errors.push(`Unit ${unit.batchNumber}: ${validationResult.error}`)
            continue
          }

          // Calculate expiry date if not provided
          const expiryDate = unit.expiryDate || this.calculateExpiryDate(unit.collectionDate, unit.bloodType)

          // Insert blood unit
          const { data: newUnit, error } = await this.supabase
            .from('blood_units')
            .insert([{
              donor_id: unit.donorId,
              blood_type: unit.bloodType,
              volume: unit.volume,
              collection_date: unit.collectionDate,
              expiry_date: expiryDate,
              status: unit.status,
              location: unit.location,
              quality_score: unit.qualityScore,
              batch_number: unit.batchNumber,
              storage_temperature: unit.storageConditions.temperature,
              storage_humidity: unit.storageConditions.humidity,
              test_results: unit.testResults,
              metadata: unit.metadata
            }])
            .select()
            .single()

          if (error) {
            results.errors.push(`Unit ${unit.batchNumber}: ${error.message}`)
            continue
          }

          // Update inventory counts
          await this.updateInventoryCount(unit.bloodType, 1)

          results.unitsAdded++
          console.log(`✅ Added blood unit: ${newUnit.id}`)

        } catch (unitError) {
          results.errors.push(`Unit ${unit.batchNumber}: ${unitError}`)
        }
      }

      // Broadcast inventory update
      await this.broadcastInventoryUpdate()

      // Check for alerts after adding units
      await this.checkInventoryAlerts()

      if (results.errors.length > 0) {
        results.success = false
      }

      console.log(`📦 Added ${results.unitsAdded}/${units.length} blood units successfully`)
      tracker.end(200)

      return results

    } catch (error) {
      console.error('Error adding blood units:', error)
      tracker.end(500)
      throw error
    }
  }

  /**
   * Reserve blood units for a request
   */
  async reserveBloodUnits(
    bloodType: string, 
    unitsNeeded: number, 
    requestId: string,
    expiryPreference: 'oldest_first' | 'newest_first' = 'oldest_first'
  ): Promise<{ success: boolean; reservedUnits: BloodUnit[]; message: string }> {
    const tracker = performanceMonitor.startTracking('inventory-reserve', 'POST')

    try {
      console.log(`🔒 Reserving ${unitsNeeded} ${bloodType} units for request ${requestId}`)

      // Get available compatible blood types
      const compatibleTypes = this.getCompatibleBloodTypes(bloodType)

      // Find available units
      let query = this.supabase
        .from('blood_units')
        .select('*')
        .in('blood_type', compatibleTypes)
        .eq('status', 'available')
        .gte('expiry_date', new Date().toISOString())

      // Order by expiry preference
      if (expiryPreference === 'oldest_first') {
        query = query.order('expiry_date', { ascending: true })
      } else {
        query = query.order('expiry_date', { ascending: false })
      }

      const { data: availableUnits } = await query.limit(unitsNeeded * 2) // Get extra for selection

      if (!availableUnits || availableUnits.length === 0) {
        return {
          success: false,
          reservedUnits: [],
          message: `No available ${bloodType} units found`
        }
      }

      if (availableUnits.length < unitsNeeded) {
        return {
          success: false,
          reservedUnits: [],
          message: `Only ${availableUnits.length} ${bloodType} units available, need ${unitsNeeded}`
        }
      }

      // Select best units based on quality and expiry
      const selectedUnits = this.selectOptimalUnits(availableUnits, unitsNeeded)

      // Reserve the selected units
      const reservedUnitIds = selectedUnits.map(unit => unit.id)
      
      const { error: reserveError } = await this.supabase
        .from('blood_units')
        .update({
          status: 'reserved',
          reserved_for_request: requestId,
          reserved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', reservedUnitIds)

      if (reserveError) {
        throw new Error(`Failed to reserve units: ${reserveError.message}`)
      }

      // Log reservation
      await this.supabase
        .from('inventory_transactions')
        .insert([{
          type: 'reservation',
          blood_units: reservedUnitIds,
          quantity: unitsNeeded,
          blood_type: bloodType,
          request_id: requestId,
          performed_at: new Date().toISOString(),
          notes: `Reserved ${unitsNeeded} ${bloodType} units for request ${requestId}`
        }])

      // Update inventory counts
      await this.updateInventoryCount(bloodType, -unitsNeeded, 'reserved')

      // Broadcast update
      await this.broadcastInventoryUpdate()

      const result = {
        success: true,
        reservedUnits: selectedUnits.map(this.mapToBloodUnit),
        message: `Successfully reserved ${unitsNeeded} ${bloodType} units`
      }

      console.log(`✅ Reserved ${unitsNeeded} ${bloodType} units`)
      tracker.end(200)

      return result

    } catch (error) {
      console.error('Error reserving blood units:', error)
      tracker.end(500)
      throw error
    }
  }

  /**
   * Check inventory for automated alerts
   */
  async checkInventoryAlerts(): Promise<InventoryAlert[]> {
    try {
      const alerts: InventoryAlert[] = []

      // Check low stock levels
      const lowStockAlerts = await this.checkLowStockAlerts()
      alerts.push(...lowStockAlerts)

      // Check expiry warnings
      const expiryAlerts = await this.checkExpiryAlerts()
      alerts.push(...expiryAlerts)

      // Check storage temperature alerts
      const temperatureAlerts = await this.checkTemperatureAlerts()
      alerts.push(...temperatureAlerts)

      // Check quality issues
      const qualityAlerts = await this.checkQualityAlerts()
      alerts.push(...qualityAlerts)

      // Store new alerts in database
      if (alerts.length > 0) {
        await this.storeAlerts(alerts)
        await this.sendAlertNotifications(alerts)
      }

      return alerts

    } catch (error) {
      console.error('Error checking inventory alerts:', error)
      return []
    }
  }

  /**
   * Get inventory alerts
   */
  async getInventoryAlerts(resolved = false): Promise<InventoryAlert[]> {
    try {
      const { data: alerts } = await this.supabase
        .from('inventory_alerts')
        .select('*')
        .eq('resolved', resolved)
        .order('created_at', { ascending: false })
        .limit(50)

      return (alerts || []).map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        bloodType: alert.blood_type,
        message: alert.message,
        details: alert.details,
        createdAt: alert.created_at,
        resolved: alert.resolved,
        resolvedAt: alert.resolved_at,
        resolvedBy: alert.resolved_by
      }))

    } catch (error) {
      console.error('Error getting inventory alerts:', error)
      return []
    }
  }

  /**
   * Process expired blood units
   */
  async processExpiredUnits(): Promise<{ processedCount: number; disposedUnits: string[] }> {
    const tracker = performanceMonitor.startTracking('inventory-expiry', 'POST')

    try {
      console.log('🗑️ Processing expired blood units')

      const now = new Date().toISOString()

      // Find expired units
      const { data: expiredUnits } = await this.supabase
        .from('blood_units')
        .select('*')
        .lt('expiry_date', now)
        .in('status', ['available', 'reserved'])

      if (!expiredUnits || expiredUnits.length === 0) {
        console.log('✅ No expired units found')
        tracker.end(200)
        return { processedCount: 0, disposedUnits: [] }
      }

      const expiredIds = expiredUnits.map(unit => unit.id)

      // Update status to expired
      const { error: updateError } = await this.supabase
        .from('blood_units')
        .update({
          status: 'expired',
          expired_at: now,
          updated_at: now
        })
        .in('id', expiredIds)

      if (updateError) {
        throw new Error(`Failed to update expired units: ${updateError.message}`)
      }

      // Log disposal transaction
      await this.supabase
        .from('inventory_transactions')
        .insert([{
          type: 'disposal',
          blood_units: expiredIds,
          quantity: expiredUnits.length,
          performed_at: now,
          notes: `Automated disposal of ${expiredUnits.length} expired units`,
          metadata: { reason: 'expiry', disposalMethod: 'incineration' }
        }])

      // Update inventory counts
      for (const unit of expiredUnits) {
        await this.updateInventoryCount(unit.blood_type, -1, 'expired')
      }

      // Broadcast update
      await this.broadcastInventoryUpdate()

      // Create alert for expired units
      const alert: Omit<InventoryAlert, 'id'> = {
        type: 'expiry_warning',
        severity: 'medium',
        message: `${expiredUnits.length} blood units have expired and been disposed`,
        details: { expiredUnits: expiredIds, disposalDate: now },
        createdAt: now,
        resolved: true,
        resolvedAt: now
      }

      await this.storeAlerts([alert])

      console.log(`🗑️ Processed ${expiredUnits.length} expired units`)
      tracker.end(200)

      return {
        processedCount: expiredUnits.length,
        disposedUnits: expiredIds
      }

    } catch (error) {
      console.error('Error processing expired units:', error)
      tracker.end(500)
      throw error
    }
  }

  // Private helper methods

  private validateBloodUnit(unit: Omit<BloodUnit, 'id'>): { valid: boolean; error?: string } {
    if (!unit.donorId) return { valid: false, error: 'Donor ID is required' }
    if (!unit.bloodType) return { valid: false, error: 'Blood type is required' }
    if (!unit.volume || unit.volume <= 0) return { valid: false, error: 'Valid volume is required' }
    if (!unit.collectionDate) return { valid: false, error: 'Collection date is required' }
    if (!unit.batchNumber) return { valid: false, error: 'Batch number is required' }

    const validBloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
    if (!validBloodTypes.includes(unit.bloodType)) {
      return { valid: false, error: 'Invalid blood type' }
    }

    return { valid: true }
  }

  private calculateExpiryDate(collectionDate: string, bloodType: string): string {
    const collection = new Date(collectionDate)
    
    // Different blood products have different shelf lives
    const shelfLifeDays = {
      'whole_blood': 35,
      'red_cells': 42,
      'plasma': 365,
      'platelets': 5
    }

    // For simplicity, assume red cells (42 days)
    const expiryDate = new Date(collection.getTime() + shelfLifeDays.red_cells * 24 * 60 * 60 * 1000)
    return expiryDate.toISOString()
  }

  private getCompatibleBloodTypes(requestedType: string): string[] {
    const compatibility: Record<string, string[]> = {
      'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
      'AB-': ['AB-', 'A-', 'B-', 'O-'],
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'A-': ['A-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'B-': ['B-', 'O-'],
      'O+': ['O+', 'O-'],
      'O-': ['O-']
    }

    return compatibility[requestedType] || [requestedType]
  }

  private selectOptimalUnits(availableUnits: BloodUnit[], needed: number): BloodUnit[] {
    // Sort by quality score (desc) and expiry date (asc for FIFO)
    return availableUnits
      .sort((a, b) => {
        const qualityDiff = (b.quality_score || 0) - (a.quality_score || 0)
        if (qualityDiff !== 0) return qualityDiff
        
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      })
      .slice(0, needed)
  }

  private async updateInventoryCount(bloodType: string, delta: number, status = 'available'): Promise<void> {
    // This would update the blood_inventory summary table
    // For now, we'll skip this as it requires more complex aggregation
  }

  private async broadcastInventoryUpdate(): Promise<void> {
    // Broadcast to all connected clients
    websocketService.broadcast('inventory:update', {
      type: 'inventory_updated',
      timestamp: new Date().toISOString()
    })
  }

  private async checkLowStockAlerts(): Promise<InventoryAlert[]> {
    const alerts: InventoryAlert[] = []
    
    const { data: inventory } = await this.supabase
      .from('blood_inventory')
      .select('blood_type, quantity')
      .eq('status', 'normal')

    for (const item of inventory || []) {
      if (item.quantity <= this.alertThresholds.criticalStock) {
        alerts.push({
          id: `low_stock_${item.blood_type}_${Date.now()}`,
          type: 'critical_shortage',
          severity: 'critical',
          bloodType: item.blood_type,
          message: `Critical shortage: Only ${item.quantity} ${item.blood_type} units remaining`,
          details: { currentStock: item.quantity, threshold: this.alertThresholds.criticalStock },
          createdAt: new Date().toISOString(),
          resolved: false
        })
      } else if (item.quantity <= this.alertThresholds.lowStock) {
        alerts.push({
          id: `low_stock_${item.blood_type}_${Date.now()}`,
          type: 'low_stock',
          severity: 'high',
          bloodType: item.blood_type,
          message: `Low stock warning: ${item.quantity} ${item.blood_type} units remaining`,
          details: { currentStock: item.quantity, threshold: this.alertThresholds.lowStock },
          createdAt: new Date().toISOString(),
          resolved: false
        })
      }
    }

    return alerts
  }

  private async checkExpiryAlerts(): Promise<InventoryAlert[]> {
    const alerts: InventoryAlert[] = []
    const warningDate = new Date()
    warningDate.setDate(warningDate.getDate() + this.alertThresholds.expiryWarning)

    const { data: expiringUnits } = await this.supabase
      .from('blood_units')
      .select('blood_type, expiry_date')
      .eq('status', 'available')
      .lt('expiry_date', warningDate.toISOString())

    if (expiringUnits && expiringUnits.length > 0) {
      const expiringByType: Record<string, number> = {}
      
      for (const unit of expiringUnits) {
        expiringByType[unit.blood_type] = (expiringByType[unit.blood_type] || 0) + 1
      }

      for (const [bloodType, count] of Object.entries(expiringByType)) {
        alerts.push({
          id: `expiry_${bloodType}_${Date.now()}`,
          type: 'expiry_warning',
          severity: 'medium',
          bloodType,
          message: `${count} ${bloodType} units expiring within ${this.alertThresholds.expiryWarning} days`,
          details: { count, daysUntilExpiry: this.alertThresholds.expiryWarning },
          createdAt: new Date().toISOString(),
          resolved: false
        })
      }
    }

    return alerts
  }

  private async checkTemperatureAlerts(): Promise<InventoryAlert[]> {
    // This would integrate with IoT temperature sensors
    // For now, return empty array
    return []
  }

  private async checkQualityAlerts(): Promise<InventoryAlert[]> {
    const alerts: InventoryAlert[] = []

    const { data: lowQualityUnits } = await this.supabase
      .from('blood_units')
      .select('*')
      .lt('quality_score', this.alertThresholds.qualityThreshold)
      .eq('status', 'available')

    if (lowQualityUnits && lowQualityUnits.length > 0) {
      alerts.push({
        id: `quality_${Date.now()}`,
        type: 'quality_issue',
        severity: 'high',
        message: `${lowQualityUnits.length} blood units below quality threshold`,
        details: { count: lowQualityUnits.length, threshold: this.alertThresholds.qualityThreshold },
        createdAt: new Date().toISOString(),
        resolved: false
      })
    }

    return alerts
  }

  private async storeAlerts(alerts: Omit<InventoryAlert, 'id'>[]): Promise<void> {
    if (alerts.length === 0) return

    await this.supabase
      .from('inventory_alerts')
      .insert(alerts.map(alert => ({
        type: alert.type,
        severity: alert.severity,
        blood_type: alert.bloodType,
        message: alert.message,
        details: alert.details,
        created_at: alert.createdAt,
        resolved: alert.resolved,
        resolved_at: alert.resolvedAt,
        resolved_by: alert.resolvedBy
      })))
  }

  private async sendAlertNotifications(alerts: InventoryAlert[]): Promise<void> {
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical')
    const highAlerts = alerts.filter(alert => alert.severity === 'high')

    // Send immediate notifications for critical alerts
    for (const alert of criticalAlerts) {
      await notificationService.sendAlert({
        type: 'critical_inventory',
        title: 'Critical Inventory Alert',
        message: alert.message,
        recipients: ['blood_bank_staff', 'administrators'],
        priority: 'high',
        channels: ['push', 'sms', 'email']
      })
    }

    // Send notifications for high-priority alerts
    for (const alert of highAlerts) {
      await notificationService.sendAlert({
        type: 'inventory_warning',
        title: 'Inventory Warning',
        message: alert.message,
        recipients: ['blood_bank_staff'],
        priority: 'medium',
        channels: ['push', 'email']
      })
    }
  }

  private mapToBloodUnit(dbUnit: Record<string, unknown>): BloodUnit {
    return {
      id: dbUnit.id,
      donorId: dbUnit.donor_id,
      bloodType: dbUnit.blood_type,
      volume: dbUnit.volume,
      collectionDate: dbUnit.collection_date,
      expiryDate: dbUnit.expiry_date,
      status: dbUnit.status,
      location: dbUnit.location,
      storageConditions: {
        temperature: dbUnit.storage_temperature,
        humidity: dbUnit.storage_humidity,
        lastChecked: dbUnit.updated_at
      },
      qualityScore: dbUnit.quality_score,
      batchNumber: dbUnit.batch_number,
      testResults: dbUnit.test_results,
      metadata: dbUnit.metadata
    }
  }
}

// Export singleton instance
export const inventoryManagementService = new InventoryManagementService()