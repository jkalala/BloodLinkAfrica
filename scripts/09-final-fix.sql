-- Final Database Fix Script
-- This script addresses all UUID/text comparison issues and sets up proper RLS

-- Step 1: Add user_id to blood_requests if it doesn't exist
ALTER TABLE IF EXISTS blood_requests 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Step 2: Disable RLS temporarily
ALTER TABLE blood_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE donor_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_events DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view blood requests" ON blood_requests;
DROP POLICY IF EXISTS "Users can create blood requests" ON blood_requests;
DROP POLICY IF EXISTS "Request creators can update their requests" ON blood_requests;
DROP POLICY IF EXISTS "blood_requests_select_policy" ON blood_requests;
DROP POLICY IF EXISTS "blood_requests_insert_policy" ON blood_requests;
DROP POLICY IF EXISTS "blood_requests_update_policy" ON blood_requests;

DROP POLICY IF EXISTS "Users can view responses to their requests" ON donor_responses;
DROP POLICY IF EXISTS "Donors can create responses" ON donor_responses;
DROP POLICY IF EXISTS "Donors can update their responses" ON donor_responses;
DROP POLICY IF EXISTS "donor_responses_select_policy" ON donor_responses;
DROP POLICY IF EXISTS "donor_responses_insert_policy" ON donor_responses;
DROP POLICY IF EXISTS "donor_responses_update_policy" ON donor_responses;

DROP POLICY IF EXISTS "Users can view their notifications" ON notification_queue;
DROP POLICY IF EXISTS "System can create notifications" ON notification_queue;
DROP POLICY IF EXISTS "notification_queue_select_policy" ON notification_queue;
DROP POLICY IF EXISTS "notification_queue_insert_policy" ON notification_queue;

DROP POLICY IF EXISTS "Users can view their events" ON real_time_events;
DROP POLICY IF EXISTS "System can create events" ON real_time_events;
DROP POLICY IF EXISTS "real_time_events_select_policy" ON real_time_events;
DROP POLICY IF EXISTS "real_time_events_insert_policy" ON real_time_events;

DROP POLICY IF EXISTS "emergency_alerts_select_policy" ON emergency_alerts;
DROP POLICY IF EXISTS "emergency_alerts_insert_policy" ON emergency_alerts;

-- Step 4: Re-enable RLS
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_events ENABLE ROW LEVEL SECURITY;

-- Step 5: Create new simplified policies
-- Blood requests policies
CREATE POLICY "blood_requests_select_policy" ON blood_requests
  FOR SELECT USING (true);

CREATE POLICY "blood_requests_insert_policy" ON blood_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blood_requests_update_policy" ON blood_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- Donor responses policies
CREATE POLICY "donor_responses_select_policy" ON donor_responses
  FOR SELECT USING (true);

CREATE POLICY "donor_responses_insert_policy" ON donor_responses
  FOR INSERT WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "donor_responses_update_policy" ON donor_responses
  FOR UPDATE USING (auth.uid() = donor_id);

-- Notification queue policies
CREATE POLICY "notification_queue_select_policy" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_queue_insert_policy" ON notification_queue
  FOR INSERT WITH CHECK (true);

-- Real-time events policies
CREATE POLICY "real_time_events_select_policy" ON real_time_events
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "real_time_events_insert_policy" ON real_time_events
  FOR INSERT WITH CHECK (true);

-- Emergency alerts policies
CREATE POLICY "emergency_alerts_select_policy" ON emergency_alerts
  FOR SELECT USING (true);

CREATE POLICY "emergency_alerts_insert_policy" ON emergency_alerts
  FOR INSERT WITH CHECK (true);

-- Step 6: Verify the schema
DO $$
BEGIN
  -- Check if all required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'blood_requests' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'user_id column missing from blood_requests table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donor_responses' AND column_name = 'donor_id'
  ) THEN
    RAISE EXCEPTION 'donor_id column missing from donor_responses table';
  END IF;

  -- Check if RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'blood_requests' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on blood_requests table';
  END IF;

  RAISE NOTICE 'Database schema verification completed successfully';
END $$; 