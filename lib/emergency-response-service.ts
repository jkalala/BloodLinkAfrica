
import { SupabaseClient } from '@supabase/supabase-js';
import { sendSMS } from './twilio-service';
import { sendPushNotification } from './push-notification-service';
import { trackGPSEntity } from './gps-tracking-service';
import { Database } from '@/types/supabase';

type Donor = Database['public']['Tables']['donors']['Row'];
type BloodRequest = Database['public']['Tables']['blood_requests']['Row'];

/**
 * Service for handling emergency response functionalities.
 */
export class EmergencyResponseService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Triggers an emergency alert for a critical blood request.
   * @param requestId - The ID of the blood request.
   * @param message - The emergency message.
   */
  async triggerEmergencyAlert(requestId: string, message: string): Promise<void> {
    console.log(`Triggering emergency alert for request: ${requestId}`);

    // 1. Fetch nearby donors
    const { data: donors, error } = await this.supabase
      .rpc('get_nearby_donors', {
        request_id: requestId,
        match_count: 20, // Increase match count for emergencies
      });

    if (error) {
      console.error('Error fetching nearby donors for emergency:', error);
      throw new Error('Could not fetch donors for emergency alert.');
    }

    if (!donors || donors.length === 0) {
      console.warn(`No donors found for emergency request ${requestId}`);
      return;
    }

    // 2. Send automated notifications
    await this.sendAutomatedNotifications(donors, message);

    // 3. Log the crisis event
    await this.logCrisisEvent('Emergency Alert Triggered', { requestId, message, notifiedDonors: donors.length });
  }

  /**
   * Sends automated notifications to a list of donors.
   * @param donors - An array of donor objects.
   * @param message - The notification message.
   */
  async sendAutomatedNotifications(donors: Donor[], message: string): Promise<void> {
    const notificationPromises = donors.map(donor => {
      const smsPromise = donor.phone_number ? sendSMS(donor.phone_number, message) : Promise.resolve();
      // Assuming we have a way to get a push token for a donor
      // const pushPromise = donor.push_token ? sendPushNotification(donor.push_token, 'Emergency Blood Request', message) : Promise.resolve();
      // For now, we'll just simulate the push notification
      const pushPromise = donor.user_id ? sendPushNotification({
        userId: donor.user_id,
        title: 'Emergency Blood Request',
        body: message
      }) : Promise.resolve();


      return Promise.all([smsPromise, pushPromise]);
    });

    await Promise.all(notificationPromises);
    console.log(`Sent emergency notifications to ${donors.length} donors.`);
  }

  /**
   * Creates an emergency coordinator dashboard.
   * This is a placeholder for a more complex implementation.
   * In a real app, this would involve creating a new UI component.
   */
  createEmergencyCoordinatorDashboard(): Record<string, any> {
    // In a real application, this would be a route to a new page/dashboard
    console.log('Emergency Coordinator Dashboard created.');
    return {
      status: 'success',
      message: 'Emergency Coordinator Dashboard is now active.',
      dashboardUrl: '/emergency/dashboard'
    };
  }

  /**
   * Tracks a GPS-enabled entity, like an emergency vehicle.
   * @param vehicleId - The ID of the vehicle to track.
   * @param location - The current location of the vehicle.
   * @returns The tracking information.
   */
  async trackEmergencyVehicle(vehicleId: string, location: { latitude: number; longitude: number }): Promise<any> {
    const trackingInfo = await trackGPSEntity(vehicleId, 'emergency_vehicle', location);
    console.log(`Tracking emergency vehicle ${vehicleId} at`, location);
    return trackingInfo;
  }

  /**
   * Implements crisis management protocols.
   * This is a placeholder for a more complex implementation.
   */
  async implementCrisisManagementProtocols(crisisId: string, protocol: string): Promise<void> {
    console.log(`Implementing crisis management protocol: ${protocol} for crisis: ${crisisId}`);
    // This could involve:
    // - Escalating to authorities
    // - Locking down certain system features
    // - Activating a crisis communication plan
    await this.logCrisisEvent('Crisis Protocol Activated', { crisisId, protocol });
  }

  /**
   * Logs a crisis event to the database for auditing and review.
   * @param event_type - The type of crisis event.
   * @param details - A JSON object with event details.
   */
  async logCrisisEvent(event_type: string, details: Record<string, any>): Promise<void> {
    const { error } = await this.supabase.from('crisis_events').insert({
      event_type,
      details,
    });

    if (error) {
      console.error('Error logging crisis event:', error);
    }
  }
}

// Helper function to get a singleton instance of the service
let emergencyResponseServiceInstance: EmergencyResponseService | null = null;

export const getEmergencyResponseService = (supabase: SupabaseClient<Database>): EmergencyResponseService => {
  if (!emergencyResponseServiceInstance) {
    emergencyResponseServiceInstance = new EmergencyResponseService(supabase);
  }
  return emergencyResponseServiceInstance;
};
