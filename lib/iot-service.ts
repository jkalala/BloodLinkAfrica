import { getSupabase } from "./supabase"

export interface IoTDevice {
  id: string
  device_type: 'refrigerator' | 'centrifuge' | 'monitor' | 'freezer' | 'incubator'
  location: string
  status: 'online' | 'offline' | 'maintenance' | 'error'
  last_reading: string
  temperature?: number
  humidity?: number
  pressure?: number
  vibration?: number
  power_consumption?: number
  capacity?: number
  current_load?: number
}

export interface BloodUnit {
  id: string
  blood_type: string
  donor_id: string
  collection_date: string
  expiry_date: string
  storage_location: string
  device_id: string
  temperature_history: number[]
  quality_score: number
  status: 'stored' | 'in_transit' | 'expired' | 'used'
}

export interface QualityAlert {
  id: string
  device_id: string
  alert_type: 'temperature' | 'humidity' | 'power' | 'capacity' | 'expiry'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: string
  resolved: boolean
}

export class IoTService {
  private supabase = getSupabase()
  private updateInterval: NodeJS.Timeout | null = null

  /**
   * Initialize IoT monitoring
   */
  async initializeIoTMonitoring(): Promise<void> {
    try {
      // Start periodic device monitoring
      this.updateInterval = setInterval(async () => {
        await this.updateDeviceReadings()
        await this.checkQualityAlerts()
        await this.updateBloodUnitStatus()
      }, 30000) // Update every 30 seconds

      console.log('IoT monitoring initialized')
    } catch (error: unknown) {
      console.error('Error initializing IoT monitoring:', error)
    }
  }

  /**
   * Stop IoT monitoring
   */
  stopIoTMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  /**
   * Register a new IoT device
   */
  async registerDevice(deviceData: Partial<IoTDevice>): Promise<{ success: boolean; device?: IoTDevice; error?: string }> {
    try {
      const device: IoTDevice = {
        id: crypto.randomUUID(),
        device_type: deviceData.device_type || 'monitor',
        location: deviceData.location || 'Unknown',
        status: 'online',
        last_reading: new Date().toISOString(),
        temperature: deviceData.temperature,
        humidity: deviceData.humidity,
        pressure: deviceData.pressure,
        vibration: deviceData.vibration,
        power_consumption: deviceData.power_consumption,
        capacity: deviceData.capacity,
        current_load: deviceData.current_load
      }

      const { error } = await this.supabase
        .from('iot_devices')
        .insert(device)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, device }
    } catch (error: unknown) {
      console.error('Error registering IoT device:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update device readings from IoT sensors
   */
  async updateDeviceReadings(): Promise<void> {
    try {
      const { data: devices } = await this.supabase
        .from('iot_devices')
        .select('*')

      for (const device of devices || []) {
        // Simulate sensor readings
        const readings = this.simulateSensorReadings(device)
        
        // Update device with new readings
        await this.supabase
          .from('iot_devices')
          .update({
            ...readings,
            last_reading: new Date().toISOString()
          })
          .eq('id', device.id)

        // Check for quality issues
        await this.checkDeviceQuality(device.id, readings)
      }
    } catch (error: unknown) {
      console.error('Error updating device readings:', error)
    }
  }

  /**
   * Simulate sensor readings for IoT devices
   */
  private simulateSensorReadings(device: IoTDevice): Partial<IoTDevice> {
    const baseTemp = device.device_type === 'refrigerator' ? 4 : 
                    device.device_type === 'freezer' ? -20 : 25
    
    const readings: Partial<IoTDevice> = {
      temperature: baseTemp + (Math.random() - 0.5) * 2,
      humidity: 40 + (Math.random() - 0.5) * 20,
      pressure: 1013 + (Math.random() - 0.5) * 10,
      vibration: Math.random() * 0.1,
      power_consumption: 100 + Math.random() * 50,
      current_load: device.current_load || 0
    }

    // Add some realistic variations
    if (device.device_type === 'centrifuge') {
      readings.vibration = 0.5 + Math.random() * 0.5
      readings.power_consumption = 500 + Math.random() * 200
    }

    return readings
  }

  /**
   * Check device quality and generate alerts
   */
  private async checkDeviceQuality(deviceId: string, readings: Partial<IoTDevice>): Promise<void> {
    const alerts: QualityAlert[] = []

    // Temperature alerts
    if (readings.temperature !== undefined) {
      if (readings.temperature > 8) {
        alerts.push({
          id: crypto.randomUUID(),
          device_id: deviceId,
          alert_type: 'temperature',
          severity: readings.temperature > 12 ? 'critical' : 'high',
          message: `Temperature too high: ${readings.temperature.toFixed(1)}°C`,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      } else if (readings.temperature < 2) {
        alerts.push({
          id: crypto.randomUUID(),
          device_id: deviceId,
          alert_type: 'temperature',
          severity: 'medium',
          message: `Temperature too low: ${readings.temperature.toFixed(1)}°C`,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }
    }

    // Humidity alerts
    if (readings.humidity !== undefined && readings.humidity > 70) {
      alerts.push({
        id: crypto.randomUUID(),
        device_id: deviceId,
        alert_type: 'humidity',
        severity: 'medium',
        message: `High humidity: ${readings.humidity.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        resolved: false
      })
    }

    // Power consumption alerts
    if (readings.power_consumption !== undefined && readings.power_consumption > 600) {
      alerts.push({
        id: crypto.randomUUID(),
        device_id: deviceId,
        alert_type: 'power',
        severity: 'high',
        message: `High power consumption: ${readings.power_consumption.toFixed(1)}W`,
        timestamp: new Date().toISOString(),
        resolved: false
      })
    }

    // Insert alerts
    for (const alert of alerts) {
      await this.supabase
        .from('quality_alerts')
        .insert(alert)
    }
  }

  /**
   * Check for quality alerts
   */
  async checkQualityAlerts(): Promise<void> {
    try {
      const { data: alerts } = await this.supabase
        .from('quality_alerts')
        .select('*')
        .eq('resolved', false)
        .order('timestamp', { ascending: false })

      for (const alert of alerts || []) {
        // Send notifications for critical alerts
        if (alert.severity === 'critical') {
          await this.sendQualityAlertNotification(alert)
        }
      }
    } catch (error: unknown) {
      console.error('Error checking quality alerts:', error)
    }
  }

  /**
   * Send quality alert notifications
   */
  private async sendQualityAlertNotification(alert: QualityAlert): Promise<void> {
    try {
      // Get device details
      const { data: device } = await this.supabase
        .from('iot_devices')
        .select('device_type, location')
        .eq('id', alert.device_id)
        .single()

      if (device) {
        // Create notification for blood bank staff
        await this.supabase
          .from('notification_queue')
          .insert({
            user_id: 'blood-bank-admin', // This would be the blood bank admin
            notification_type: 'quality_alert',
            title: `Quality Alert: ${alert.alert_type}`,
            message: `${alert.message} at ${device.location}`,
            data: {
              device_type: device.device_type,
              location: device.location,
              severity: alert.severity
            },
            status: 'pending'
          })
      }
    } catch (error: unknown) {
      console.error('Error sending quality alert notification:', error)
    }
  }

  /**
   * Update blood unit status based on IoT data
   */
  async updateBloodUnitStatus(): Promise<void> {
    try {
      const { data: bloodUnits } = await this.supabase
        .from('blood_units')
        .select('*')
        .eq('status', 'stored')

      for (const unit of bloodUnits || []) {
        // Check if unit is expired
        if (new Date(unit.expiry_date) < new Date()) {
          await this.supabase
            .from('blood_units')
            .update({ status: 'expired' })
            .eq('id', unit.id)
        }

        // Update quality score based on storage conditions
        const qualityScore = await this.calculateQualityScore(unit)
        await this.supabase
          .from('blood_units')
          .update({ quality_score: qualityScore })
          .eq('id', unit.id)
      }
    } catch (error: unknown) {
      console.error('Error updating blood unit status:', error)
    }
  }

  /**
   * Calculate quality score for blood unit
   */
  private async calculateQualityScore(unit: BloodUnit): Promise<number> {
    try {
      // Get device readings for the storage location
      const { data: device } = await this.supabase
        .from('iot_devices')
        .select('temperature, humidity')
        .eq('id', unit.device_id)
        .single()

      if (!device) return 100

      let score = 100

      // Temperature impact
      if (device.temperature) {
        const tempDiff = Math.abs(device.temperature - 4) // Ideal temp is 4°C
        if (tempDiff > 2) {
          score -= tempDiff * 5
        }
      }

      // Humidity impact
      if (device.humidity && device.humidity > 70) {
        score -= 10
      }

      // Time to expiry impact
      const daysToExpiry = (new Date(unit.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      if (daysToExpiry < 7) {
        score -= 20
      } else if (daysToExpiry < 14) {
        score -= 10
      }

      return Math.max(score, 0)
    } catch (error: unknown) {
      console.error('Error calculating quality score:', error)
      return 100
    }
  }

  /**
   * Get IoT dashboard data
   */
  async getIoTDashboardData(): Promise<{
    total_devices: number
    online_devices: number
    alerts_count: number
    critical_alerts: number
    total_blood_units: number
    quality_average: number
    devices: IoTDevice[]
    recent_alerts: QualityAlert[]
  }> {
    try {
      const { count: totalDevices } = await this.supabase
        .from('iot_devices')
        .select('*', { count: 'exact', head: true })

      const { count: onlineDevices } = await this.supabase
        .from('iot_devices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'online')

      const { count: alertsCount } = await this.supabase
        .from('quality_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false)

      const { count: criticalAlerts } = await this.supabase
        .from('quality_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false)
        .eq('severity', 'critical')

      const { count: totalBloodUnits } = await this.supabase
        .from('blood_units')
        .select('*', { count: 'exact', head: true })

      const { data: devices } = await this.supabase
        .from('iot_devices')
        .select('*')
        .order('last_reading', { ascending: false })

      const { data: recentAlerts } = await this.supabase
        .from('quality_alerts')
        .select('*')
        .eq('resolved', false)
        .order('timestamp', { ascending: false })
        .limit(10)

      // Calculate average quality score
      const { data: bloodUnits } = await this.supabase
        .from('blood_units')
        .select('quality_score')

      const qualityAverage = bloodUnits && bloodUnits.length > 0
        ? bloodUnits.reduce((sum, unit) => sum + (unit.quality_score || 100), 0) / bloodUnits.length
        : 100

      return {
        total_devices: totalDevices || 0,
        online_devices: onlineDevices || 0,
        alerts_count: alertsCount || 0,
        critical_alerts: criticalAlerts || 0,
        total_blood_units: totalBloodUnits || 0,
        quality_average: Math.round(qualityAverage),
        devices: devices || [],
        recent_alerts: recentAlerts || []
      }
    } catch (error: unknown) {
      console.error('Error getting IoT dashboard data:', error)
      return {
        total_devices: 0,
        online_devices: 0,
        alerts_count: 0,
        critical_alerts: 0,
        total_blood_units: 0,
        quality_average: 100,
        devices: [],
        recent_alerts: []
      }
    }
  }

  /**
   * Get device details with history
   */
  async getDeviceDetails(deviceId: string): Promise<{
    device: IoTDevice | null
    alerts: QualityAlert[]
    blood_units: BloodUnit[]
  }> {
    try {
      const { data: device } = await this.supabase
        .from('iot_devices')
        .select('*')
        .eq('id', deviceId)
        .single()

      const { data: alerts } = await this.supabase
        .from('quality_alerts')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })

      const { data: bloodUnits } = await this.supabase
        .from('blood_units')
        .select('*')
        .eq('device_id', deviceId)

      return {
        device: device || null,
        alerts: alerts || [],
        blood_units: bloodUnits || []
      }
    } catch (error: unknown) {
      console.error('Error getting device details:', error)
      return {
        device: null,
        alerts: [],
        blood_units: []
      }
    }
  }
}

// Export singleton instance
export const iotService = new IoTService() 