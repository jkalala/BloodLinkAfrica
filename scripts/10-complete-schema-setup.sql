-- Complete Schema Setup Script
-- This script creates all missing tables and sets up RLS properly

-- Step 1: Create all missing tables first

-- Create notification_queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('blood_request', 'donor_match', 'emergency', 'reminder')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0
);

-- Create emergency_alerts table
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id UUID NOT NULL REFERENCES blood_requests(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('escalation', 'broadcast', 'hospital_alert')),
  message TEXT NOT NULL,
  target_region TEXT,
  target_blood_type TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create real_time_events table
CREATE TABLE IF NOT EXISTS real_time_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Step 2: Update existing tables with missing columns

-- Add missing columns to users table
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Update blood_requests table with all required fields
ALTER TABLE IF EXISTS blood_requests 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'completed', 'expired', 'cancelled')),
ADD COLUMN IF NOT EXISTS matched_donor_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
ADD COLUMN IF NOT EXISTS response_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS emergency_level TEXT DEFAULT 'normal' CHECK (emergency_level IN ('normal', 'urgent', 'critical')),
ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0;

-- Drop and recreate donor_responses table with correct structure
DROP TABLE IF EXISTS donor_responses CASCADE;

CREATE TABLE IF NOT EXISTS donor_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  donor_id UUID NOT NULL REFERENCES users(id),
  request_id UUID NOT NULL REFERENCES blood_requests(id),
  response_type TEXT NOT NULL CHECK (response_type IN ('accept', 'decline', 'maybe')),
  eta_minutes INTEGER,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(donor_id, request_id)
);

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_emergency ON blood_requests(emergency_level);
CREATE INDEX IF NOT EXISTS idx_blood_requests_expires ON blood_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_donor_responses_request ON donor_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_responses_donor ON donor_responses(donor_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_real_time_events_processed ON real_time_events(processed);

-- Step 4: Enable RLS on all tables
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_events ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop any existing policies to avoid conflicts
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

-- Step 6: Create new simplified policies
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

-- Step 7: Verify the schema
DO $$
BEGIN
  -- Check if all required tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_queue') THEN
    RAISE EXCEPTION 'notification_queue table missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_alerts') THEN
    RAISE EXCEPTION 'emergency_alerts table missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'real_time_events') THEN
    RAISE EXCEPTION 'real_time_events table missing';
  END IF;

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

  RAISE NOTICE 'Complete schema setup completed successfully';
END $$; 