-- Phase 3: Advanced Features Schema
-- AI Matching, Blockchain Tracking, IoT Monitoring, Advanced Analytics

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_donor_analytics_trigger ON donor_responses;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own AI predictions" ON ai_match_predictions;
DROP POLICY IF EXISTS "Users can view blockchain records they're involved in" ON blockchain_records;
DROP POLICY IF EXISTS "Blood bank staff can view IoT devices" ON iot_devices;
DROP POLICY IF EXISTS "Users can view their own blood units" ON blood_units;
DROP POLICY IF EXISTS "Blood bank staff can view quality alerts" ON quality_alerts;
DROP POLICY IF EXISTS "Analytics cache is readable by all" ON analytics_cache;

-- AI Matching Tables
CREATE TABLE IF NOT EXISTS ai_match_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  compatibility_score INTEGER NOT NULL,
  success_probability DECIMAL(5,4) NOT NULL,
  response_time_prediction INTEGER NOT NULL,
  factors TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_request ON ai_match_predictions(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_donor ON ai_match_predictions(donor_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_score ON ai_match_predictions(compatibility_score DESC);

-- Blockchain Tracking Tables
CREATE TABLE IF NOT EXISTS blockchain_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('blood_request', 'donor_response', 'donation_completed', 'verification')),
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blockchain_timestamp ON blockchain_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_blockchain_event_type ON blockchain_records(event_type);
CREATE INDEX IF NOT EXISTS idx_blockchain_metadata ON blockchain_records USING GIN(metadata);

-- IoT Monitoring Tables
CREATE TABLE IF NOT EXISTS iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type TEXT NOT NULL CHECK (device_type IN ('refrigerator', 'centrifuge', 'monitor', 'freezer', 'incubator')),
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance', 'error')),
  last_reading TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  temperature DECIMAL(5,2),
  humidity DECIMAL(5,2),
  pressure DECIMAL(8,2),
  vibration DECIMAL(5,4),
  power_consumption DECIMAL(8,2),
  capacity INTEGER,
  current_load INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_type ON iot_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_iot_devices_status ON iot_devices(status);
CREATE INDEX IF NOT EXISTS idx_iot_devices_location ON iot_devices(location);

CREATE TABLE IF NOT EXISTS blood_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_type TEXT NOT NULL,
  donor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  collection_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  storage_location TEXT NOT NULL,
  device_id UUID REFERENCES iot_devices(id) ON DELETE SET NULL,
  temperature_history DECIMAL(5,2)[] DEFAULT '{}',
  quality_score INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'stored' CHECK (status IN ('stored', 'in_transit', 'expired', 'used')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_units_donor ON blood_units(donor_id);
CREATE INDEX IF NOT EXISTS idx_blood_units_device ON blood_units(device_id);
CREATE INDEX IF NOT EXISTS idx_blood_units_status ON blood_units(status);
CREATE INDEX IF NOT EXISTS idx_blood_units_expiry ON blood_units(expiry_date);

CREATE TABLE IF NOT EXISTS quality_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('temperature', 'humidity', 'power', 'capacity', 'expiry')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_quality_alerts_device ON quality_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_severity ON quality_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_resolved ON quality_alerts(resolved);

-- Analytics Tables
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);

-- Add new columns to existing tables for Phase 3 features
ALTER TABLE users ADD COLUMN IF NOT EXISTS response_rate DECIMAL(5,4) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_response_time INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,4) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reliability_score INTEGER DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_times TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_locations TEXT[] DEFAULT '{}';

-- Add blockchain tracking to existing tables
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS blockchain_tracked BOOLEAN DEFAULT FALSE;
ALTER TABLE donor_responses ADD COLUMN IF NOT EXISTS blockchain_tracked BOOLEAN DEFAULT FALSE;

-- Add updated_at column to blood_requests if it doesn't exist
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create views for analytics
CREATE OR REPLACE VIEW donor_analytics_view AS
SELECT 
  u.id as donor_id,
  u.name,
  u.blood_type,
  u.location,
  u.response_rate,
  u.avg_response_time,
  u.success_rate,
  u.reliability_score,
  u.preferred_times,
  u.preferred_locations,
  COUNT(br.id) as total_requests_responded,
  COUNT(CASE WHEN br.status = 'completed' THEN 1 END) as successful_donations
FROM users u
LEFT JOIN donor_responses dr ON u.id = dr.donor_id
LEFT JOIN blood_requests br ON dr.request_id = br.id
WHERE u.available = true
GROUP BY u.id, u.name, u.blood_type, u.location, u.response_rate, u.avg_response_time, u.success_rate, u.reliability_score, u.preferred_times, u.preferred_locations;

CREATE OR REPLACE VIEW request_analytics_view AS
SELECT 
  br.id as request_id,
  br.blood_type,
  br.emergency_level as urgency,
  br.location,
  br.status,
  COUNT(dr.id) as response_count,
  AVG(EXTRACT(EPOCH FROM (dr.created_at - br.created_at))/60) as avg_response_time_minutes,
  MIN(CASE WHEN dr.response_type = 'accept' THEN EXTRACT(EPOCH FROM (dr.created_at - br.created_at))/60 END) as time_to_first_accept,
  CASE WHEN br.status = 'completed' THEN EXTRACT(EPOCH FROM (COALESCE(br.updated_at, NOW()) - br.created_at))/60 END as completion_time_minutes
FROM blood_requests br
LEFT JOIN donor_responses dr ON br.id = dr.request_id
GROUP BY br.id, br.blood_type, br.emergency_level, br.location, br.status, br.created_at, br.updated_at;

-- Create functions for analytics
CREATE OR REPLACE FUNCTION update_donor_analytics(donor_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update response rate
  UPDATE users 
  SET response_rate = (
    SELECT COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM blood_requests), 0)
    FROM donor_responses 
    WHERE donor_responses.donor_id = users.id
  )
  WHERE users.id = donor_id;
  
  -- Update average response time
  UPDATE users 
  SET avg_response_time = (
    SELECT AVG(EXTRACT(EPOCH FROM (dr.created_at - br.created_at))/60)::INTEGER
    FROM donor_responses dr
    JOIN blood_requests br ON dr.request_id = br.id
    WHERE dr.donor_id = users.id
  )
  WHERE users.id = donor_id;
  
  -- Update success rate
  UPDATE users 
  SET success_rate = (
    SELECT COUNT(CASE WHEN br.status = 'completed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)
    FROM donor_responses dr
    JOIN blood_requests br ON dr.request_id = br.id
    WHERE dr.donor_id = users.id
  )
  WHERE users.id = donor_id;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic analytics updates
CREATE OR REPLACE FUNCTION trigger_update_donor_analytics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_donor_analytics(NEW.donor_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_donor_analytics_trigger
  AFTER INSERT OR UPDATE ON donor_responses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_donor_analytics();

-- Enable RLS on new tables
ALTER TABLE ai_match_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables
CREATE POLICY "Users can view their own AI predictions" ON ai_match_predictions
  FOR SELECT USING (auth.uid() = donor_id);

CREATE POLICY "Users can view blockchain records they're involved in" ON blockchain_records
  FOR SELECT USING (
    auth.uid()::text = metadata->>'user_id' OR
    auth.uid()::text = metadata->>'donor_id'
  );

CREATE POLICY "Blood bank staff can view IoT devices" ON iot_devices
  FOR ALL USING (true);

CREATE POLICY "Users can view their own blood units" ON blood_units
  FOR SELECT USING (auth.uid() = donor_id);

CREATE POLICY "Blood bank staff can view quality alerts" ON quality_alerts
  FOR ALL USING (true);

CREATE POLICY "Analytics cache is readable by all" ON analytics_cache
  FOR SELECT USING (true);

-- Insert sample IoT devices
INSERT INTO iot_devices (device_type, location, status, temperature, humidity, capacity, current_load) VALUES
('refrigerator', 'Blood Bank A', 'online', 4.2, 45.0, 100, 75),
('freezer', 'Blood Bank A', 'online', -18.5, 30.0, 50, 20),
('centrifuge', 'Lab 1', 'online', 25.0, 55.0, 10, 3),
('monitor', 'Storage Room B', 'online', 22.0, 40.0, 200, 150);

-- Insert sample blood units
INSERT INTO blood_units (blood_type, donor_id, collection_date, expiry_date, storage_location, device_id, quality_score) VALUES
('O+', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '1 day', NOW() + INTERVAL '41 days', 'Blood Bank A', (SELECT id FROM iot_devices WHERE device_type = 'refrigerator' LIMIT 1), 95),
('A-', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '2 days', NOW() + INTERVAL '40 days', 'Blood Bank A', (SELECT id FROM iot_devices WHERE device_type = 'refrigerator' LIMIT 1), 92),
('B+', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '3 days', NOW() + INTERVAL '39 days', 'Blood Bank A', (SELECT id FROM iot_devices WHERE device_type = 'refrigerator' LIMIT 1), 88);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_analytics ON users(response_rate, avg_response_time, success_rate, reliability_score);
CREATE INDEX IF NOT EXISTS idx_blood_requests_analytics ON blood_requests(created_at, status, emergency_level);
CREATE INDEX IF NOT EXISTS idx_donor_responses_analytics ON donor_responses(created_at, response_type);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_match_predictions TO authenticated;
GRANT SELECT, INSERT ON blockchain_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON iot_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON blood_units TO authenticated;
GRANT SELECT, INSERT, UPDATE ON quality_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON analytics_cache TO authenticated;

-- Create function to clean up expired analytics cache
CREATE OR REPLACE FUNCTION cleanup_expired_analytics_cache()
RETURNS VOID AS $$
BEGIN
  DELETE FROM analytics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (this would be called by a cron job in production)
-- SELECT cleanup_expired_analytics_cache();

COMMIT; 