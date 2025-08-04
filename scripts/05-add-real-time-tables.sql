-- Add real-time blood request tables
-- This script adds tables for real-time blood request functionality

-- Update blood_requests table with real-time fields
ALTER TABLE IF EXISTS blood_requests 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'completed', 'expired', 'cancelled')),
ADD COLUMN IF NOT EXISTS matched_donor_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
ADD COLUMN IF NOT EXISTS response_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS emergency_level TEXT DEFAULT 'normal' CHECK (emergency_level IN ('normal', 'urgent', 'critical')),
ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0;

-- Add missing columns to users table
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Drop the old donor_responses table if it exists
DROP TABLE IF EXISTS donor_responses CASCADE;

-- Create donor_responses table for tracking responses
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

-- Create notification_queue table for push notifications
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

-- Create real-time events table for WebSocket
CREATE TABLE IF NOT EXISTS real_time_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_emergency ON blood_requests(emergency_level);
CREATE INDEX IF NOT EXISTS idx_blood_requests_expires ON blood_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_donor_responses_request ON donor_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_responses_donor ON donor_responses(donor_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_real_time_events_processed ON real_time_events(processed);

-- Add RLS policies for security
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_events ENABLE ROW LEVEL SECURITY;

-- Blood requests policies
CREATE POLICY "Users can view blood requests" ON blood_requests
  FOR SELECT USING (true);

CREATE POLICY "Users can create blood requests" ON blood_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Request creators can update their requests" ON blood_requests
  FOR UPDATE USING (auth.uid() = contact_phone);

-- Donor responses policies
CREATE POLICY "Users can view responses to their requests" ON donor_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blood_requests 
      WHERE blood_requests.id = donor_responses.request_id 
      AND blood_requests.contact_phone = auth.uid()
    )
  );

CREATE POLICY "Donors can create responses" ON donor_responses
  FOR INSERT WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Donors can update their responses" ON donor_responses
  FOR UPDATE USING (auth.uid() = donor_id);

-- Notification queue policies
CREATE POLICY "Users can view their notifications" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notification_queue
  FOR INSERT WITH CHECK (true);

-- Real-time events policies
CREATE POLICY "Users can view their events" ON real_time_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create events" ON real_time_events
  FOR INSERT WITH CHECK (true); 