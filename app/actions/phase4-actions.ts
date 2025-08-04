"use server"

import { ussdService } from "@/lib/ussd-service"
import { whatsAppBusinessService } from "@/lib/whatsapp-business-service"
import { mobileMoneyService } from "@/lib/mobile-money-service"
import { getSupabase } from "@/lib/supabase"

// USSD Actions
export async function handleUSSDRequest(request: any) {
  try {
    const response = await ussdService.handleUSSDRequest(request)
    return { success: true, data: response }
  } catch (error: any) {
    console.error('USSD request error:', error)
    return { success: false, error: error.message }
  }
}

export async function getUSSDStats() {
  try {
    const stats = ussdService.getSessionStats()
    return { success: true, data: stats }
  } catch (error: any) {
    console.error('USSD stats error:', error)
    return { success: false, error: error.message }
  }
}

// WhatsApp Actions
export async function sendWhatsAppMessage(phoneNumber: string, messageData: any) {
  try {
    const result = await whatsAppBusinessService.sendBloodRequestNotification(phoneNumber, messageData)
    return { success: result, data: { sent: result } }
  } catch (error: any) {
    console.error('WhatsApp message error:', error)
    return { success: false, error: error.message }
  }
}

export async function sendEmergencyWhatsApp(phoneNumber: string, alertData: any) {
  try {
    const result = await whatsAppBusinessService.sendEmergencyAlert(phoneNumber, alertData)
    return { success: result, data: { sent: result } }
  } catch (error: any) {
    console.error('Emergency WhatsApp error:', error)
    return { success: false, error: error.message }
  }
}

export async function sendDonorMatchWhatsApp(phoneNumber: string, matchData: any) {
  try {
    const result = await whatsAppBusinessService.sendDonorMatchNotification(phoneNumber, matchData)
    return { success: result, data: { sent: result } }
  } catch (error: any) {
    console.error('Donor match WhatsApp error:', error)
    return { success: false, error: error.message }
  }
}

export async function getWhatsAppStats() {
  try {
    const stats = await whatsAppBusinessService.getMessagingStats()
    return { success: true, data: stats }
  } catch (error: any) {
    console.error('WhatsApp stats error:', error)
    return { success: false, error: error.message }
  }
}

// Mobile Money Actions
export async function processMobileMoneyPayment(paymentData: any) {
  try {
    const { phoneNumber, amount, currency, type, provider, description } = paymentData
    
    const result = await mobileMoneyService.processDonationReward(
      phoneNumber, 
      amount, 
      currency || 'USD'
    )
    
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Mobile money payment error:', error)
    return { success: false, error: error.message }
  }
}

export async function processEmergencyPayment(paymentData: any) {
  try {
    const { phoneNumber, amount, currency, country } = paymentData
    
    const result = await mobileMoneyService.processEmergencyPayment(
      phoneNumber, 
      amount, 
      currency || 'USD'
    )
    
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Emergency payment error:', error)
    return { success: false, error: error.message }
  }
}

export async function getTransactionHistory(phoneNumber: string) {
  try {
    const transactions = await mobileMoneyService.getTransactionHistory(phoneNumber)
    return { success: true, data: transactions }
  } catch (error: any) {
    console.error('Transaction history error:', error)
    return { success: false, error: error.message }
  }
}

export async function getMobileMoneyStats() {
  try {
    const stats = await mobileMoneyService.getTransactionStats()
    return { success: true, data: stats }
  } catch (error: any) {
    console.error('Mobile money stats error:', error)
    return { success: false, error: error.message }
  }
}

// Mobile App Actions
export async function registerMobileAppUser(userData: any) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('mobile_app_users')
      .insert({
        user_id: userData.userId,
        device_id: userData.deviceId,
        device_type: userData.deviceType,
        app_version: userData.appVersion,
        push_token: userData.pushToken,
        location_enabled: userData.locationEnabled,
        notifications_enabled: userData.notificationsEnabled
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Mobile app user registration error:', error)
    return { success: false, error: error.message }
  }
}

export async function updateMobileAppUser(userId: string, updateData: any) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('mobile_app_users')
      .update({
        push_token: updateData.pushToken,
        location_enabled: updateData.locationEnabled,
        notifications_enabled: updateData.notificationsEnabled,
        last_active: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Mobile app user update error:', error)
    return { success: false, error: error.message }
  }
}

export async function createMobileAppSession(sessionData: any) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('mobile_app_sessions')
      .insert({
        user_id: sessionData.userId,
        session_token: sessionData.sessionToken,
        device_info: sessionData.deviceInfo,
        ip_address: sessionData.ipAddress,
        user_agent: sessionData.userAgent
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Mobile app session creation error:', error)
    return { success: false, error: error.message }
  }
}

export async function updateMobileAppSession(sessionToken: string) {
  try {
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('mobile_app_sessions')
      .update({
        last_activity: new Date().toISOString()
      })
      .eq('session_token', sessionToken)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Mobile app session update error:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteMobileAppSession(sessionToken: string) {
  try {
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('mobile_app_sessions')
      .delete()
      .eq('session_token', sessionToken)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Mobile app session deletion error:', error)
    return { success: false, error: error.message }
  }
}

// Offline Data Actions
export async function saveOfflineData(offlineData: any) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('offline_data')
      .insert({
        user_id: offlineData.userId,
        data_type: offlineData.dataType,
        data_key: offlineData.dataKey,
        data_value: offlineData.dataValue,
        sync_status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Offline data save error:', error)
    return { success: false, error: error.message }
  }
}

export async function syncOfflineData(userId: string) {
  try {
    const supabase = getSupabase()
    
    // Get pending offline data
    const { data: pendingData, error: fetchError } = await supabase
      .from('offline_data')
      .select('*')
      .eq('user_id', userId)
      .eq('sync_status', 'pending')

    if (fetchError) throw fetchError

    if (!pendingData || pendingData.length === 0) {
      return { success: true, data: { synced: 0 } }
    }

    // Update sync status to synced
    const { error: updateError } = await supabase
      .from('offline_data')
      .update({
        sync_status: 'synced',
        synced_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('sync_status', 'pending')

    if (updateError) throw updateError

    return { success: true, data: { synced: pendingData.length } }
  } catch (error: any) {
    console.error('Offline data sync error:', error)
    return { success: false, error: error.message }
  }
}

export async function getOfflineData(userId: string, dataType?: string) {
  try {
    const supabase = getSupabase()
    
    let query = supabase
      .from('offline_data')
      .select('*')
      .eq('user_id', userId)

    if (dataType) {
      query = query.eq('data_type', dataType)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Offline data fetch error:', error)
    return { success: false, error: error.message }
  }
}

// Analytics Actions
export async function trackMobileAppEvent(eventData: any) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('mobile_app_analytics')
      .insert({
        user_id: eventData.userId,
        event_type: eventData.eventType,
        event_data: eventData.eventData,
        screen_name: eventData.screenName,
        session_id: eventData.sessionId,
        device_info: eventData.deviceInfo
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Mobile app analytics error:', error)
    return { success: false, error: error.message }
  }
}

export async function getMobileAppStats() {
  try {
    const supabase = getSupabase()
    
    // Get mobile app statistics
    const { data: stats, error } = await supabase
      .rpc('get_mobile_app_stats')

    if (error) throw error

    return { success: true, data: stats }
  } catch (error: any) {
    console.error('Mobile app stats error:', error)
    return { success: false, error: error.message }
  }
}

// WhatsApp Template Actions
export async function getWhatsAppTemplates() {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('is_approved', true)
      .order('template_name')

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('WhatsApp templates error:', error)
    return { success: false, error: error.message }
  }
}

export async function createWhatsAppTemplate(templateData: any) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert({
        template_name: templateData.templateName,
        language: templateData.language || 'en',
        category: templateData.category,
        components: templateData.components,
        is_approved: false
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('WhatsApp template creation error:', error)
    return { success: false, error: error.message }
  }
}

// USSD Menu Actions
export async function getUSSDMenuTemplates() {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('ussd_menu_templates')
      .select('*')
      .eq('is_active', true)
      .order('menu_id')

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('USSD menu templates error:', error)
    return { success: false, error: error.message }
  }
}

export async function createUSSDMenuTemplate(menuData: any) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('ussd_menu_templates')
      .insert({
        menu_id: menuData.menuId,
        title: menuData.title,
        content: menuData.content,
        options: menuData.options,
        parent_menu_id: menuData.parentMenuId
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('USSD menu template creation error:', error)
    return { success: false, error: error.message }
  }
}

// Mobile Money Provider Actions
export async function getMobileMoneyProviders() {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('mobile_money_providers')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Mobile money providers error:', error)
    return { success: false, error: error.message }
  }
}

export async function getMobileMoneyProviderByCountry(country: string) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('mobile_money_providers')
      .select('*')
      .eq('is_active', true)
      .contains('supported_countries', [country])
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Mobile money provider by country error:', error)
    return { success: false, error: error.message }
  }
} 