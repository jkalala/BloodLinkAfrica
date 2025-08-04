-- Simplified RLS Policies
-- This script creates simpler, more reliable RLS policies

-- Disable RLS temporarily to clean up
ALTER TABLE blood_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE donor_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_events DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view blood requests" ON blood_requests;
DROP POLICY IF EXISTS "Users can create blood requests" ON blood_requests;
DROP POLICY IF EXISTS "Request creators can update their requests" ON blood_requests;

DROP POLICY IF EXISTS "Users can view responses to their requests" ON donor_responses;
DROP POLICY IF EXISTS "Donors can create responses" ON donor_responses;
DROP POLICY IF EXISTS "Donors can update their responses" ON donor_responses;

DROP POLICY IF EXISTS "Users can view their notifications" ON notification_queue;
DROP POLICY IF EXISTS "System can create notifications" ON notification_queue;

DROP POLICY IF EXISTS "Users can view their events" ON real_time_events;
DROP POLICY IF EXISTS "System can create events" ON real_time_events;

-- Re-enable RLS
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_events ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for blood_requests
CREATE POLICY "blood_requests_select_policy" ON blood_requests
  FOR SELECT USING (true);

CREATE POLICY "blood_requests_insert_policy" ON blood_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blood_requests_update_policy" ON blood_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- Create simplified policies for donor_responses
CREATE POLICY "donor_responses_select_policy" ON donor_responses
  FOR SELECT USING (true);

CREATE POLICY "donor_responses_insert_policy" ON donor_responses
  FOR INSERT WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "donor_responses_update_policy" ON donor_responses
  FOR UPDATE USING (auth.uid() = donor_id);

-- Create simplified policies for notification_queue
CREATE POLICY "notification_queue_select_policy" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_queue_insert_policy" ON notification_queue
  FOR INSERT WITH CHECK (true);

-- Create simplified policies for real_time_events
CREATE POLICY "real_time_events_select_policy" ON real_time_events
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "real_time_events_insert_policy" ON real_time_events
  FOR INSERT WITH CHECK (true);

-- Create simplified policies for emergency_alerts
CREATE POLICY "emergency_alerts_select_policy" ON emergency_alerts
  FOR SELECT USING (true);

CREATE POLICY "emergency_alerts_insert_policy" ON emergency_alerts
  FOR INSERT WITH CHECK (true); 