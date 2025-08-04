-- Location Tracking and Real-time Services Schema
-- This script creates tables for location tracking, geofencing, and routing

-- Enable PostGIS extension for geographic functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create location tracking table
CREATE TABLE IF NOT EXISTS location_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('donor', 'blood_bank', 'request', 'transport')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  request_id UUID REFERENCES blood_requests(id),
  high_accuracy BOOLEAN DEFAULT false,
  update_interval INTEGER DEFAULT 30000, -- milliseconds
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stopped_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create location updates table with PostGIS support
CREATE TABLE IF NOT EXISTS location_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('donor', 'blood_bank', 'request', 'transport')),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2), -- in meters
  altitude DECIMAL(10, 2), -- in meters
  speed DECIMAL(10, 2), -- in m/s
  heading DECIMAL(6, 2), -- in degrees
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  request_id UUID REFERENCES blood_requests(id),
  battery_level INTEGER, -- percentage
  network_type TEXT,
  -- PostGIS geometry column for efficient spatial queries
  geom GEOMETRY(POINT, 4326)
);

-- Create function to automatically populate geometry from lat/lng
CREATE OR REPLACE FUNCTION update_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update geometry automatically
DROP TRIGGER IF EXISTS trigger_update_location_geom ON location_updates;
CREATE TRIGGER trigger_update_location_geom
  BEFORE INSERT OR UPDATE ON location_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_location_geom();

-- Add current location fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_latitude DECIMAL(10, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_longitude DECIMAL(11, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_sharing_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_consent BOOLEAN DEFAULT false;

-- Create geofences table
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hospital', 'blood_bank', 'emergency_zone', 'restricted')),
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  radius INTEGER NOT NULL, -- in meters
  is_active BOOLEAN DEFAULT true,
  alert_on_enter BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT false,
  notify_users UUID[] DEFAULT ARRAY[]::UUID[],
  description TEXT,
  -- PostGIS geometry for the geofence circle
  geom GEOMETRY(POLYGON, 4326)
);

-- Create function to generate geofence geometry
CREATE OR REPLACE FUNCTION update_geofence_geom()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a circular polygon around the center point
  NEW.geom = ST_Buffer(
    ST_SetSRID(ST_MakePoint(NEW.center_lng, NEW.center_lat), 4326)::geography,
    NEW.radius
  )::geometry;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for geofence geometry
DROP TRIGGER IF EXISTS trigger_update_geofence_geom ON geofences;
CREATE TRIGGER trigger_update_geofence_geom
  BEFORE INSERT OR UPDATE ON geofences
  FOR EACH ROW
  EXECUTE FUNCTION update_geofence_geom();

-- Create geofence status tracking table
CREATE TABLE IF NOT EXISTS geofence_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  is_inside BOOLEAN NOT NULL DEFAULT false,
  entered_at TIMESTAMP WITH TIME ZONE,
  exited_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, geofence_id)
);

-- Create geofence events table
CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('enter', 'exit')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create route optimizations table
CREATE TABLE IF NOT EXISTS route_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin_lat DECIMAL(10, 8) NOT NULL,
  origin_lng DECIMAL(11, 8) NOT NULL,
  destination_lat DECIMAL(10, 8) NOT NULL,
  destination_lng DECIMAL(11, 8) NOT NULL,
  distance INTEGER NOT NULL, -- in meters
  duration INTEGER NOT NULL, -- in seconds
  traffic_delay INTEGER DEFAULT 0, -- in minutes
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  polyline TEXT, -- encoded polyline string
  waypoints JSONB DEFAULT '[]'::jsonb,
  traffic_condition TEXT DEFAULT 'unknown' CHECK (traffic_condition IN ('light', 'moderate', 'heavy', 'severe', 'unknown')),
  route_status TEXT DEFAULT 'active' CHECK (route_status IN ('active', 'completed', 'cancelled'))
);

-- Create blood bank locations table (enhanced)
CREATE TABLE IF NOT EXISTS blood_bank_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blood_bank_id UUID NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT NOT NULL,
  operating_hours JSONB DEFAULT '{}'::jsonb,
  contact_info JSONB DEFAULT '{}'::jsonb,
  facilities JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  geom GEOMETRY(POINT, 4326)
);

-- Update blood bank locations geometry
CREATE OR REPLACE FUNCTION update_blood_bank_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_blood_bank_geom ON blood_bank_locations;
CREATE TRIGGER trigger_update_blood_bank_geom
  BEFORE INSERT OR UPDATE ON blood_bank_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_blood_bank_geom();

-- Create spatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_updates_geom ON location_updates USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_location_updates_user_time ON location_updates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_updates_type ON location_updates(type);
CREATE INDEX IF NOT EXISTS idx_geofences_geom ON geofences USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_geofence_status_user ON geofence_status(user_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_user_time ON geofence_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_request ON route_optimizations(request_id);
CREATE INDEX IF NOT EXISTS idx_blood_bank_locations_geom ON blood_bank_locations USING GIST (geom);

-- Create PostGIS function to find nearby donors
CREATE OR REPLACE FUNCTION find_nearby_donors(
  request_lat DECIMAL,
  request_lng DECIMAL,
  radius_km INTEGER DEFAULT 10,
  blood_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  blood_type TEXT,
  phone TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  current_address TEXT,
  available BOOLEAN,
  verified BOOLEAN,
  response_rate DECIMAL,
  avg_response_time INTEGER,
  last_location_update TIMESTAMP WITH TIME ZONE,
  distance_km DECIMAL,
  updated_at TIMESTAMP WITH TIME ZONE,
  rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.blood_type,
    u.phone,
    u.current_latitude,
    u.current_longitude,
    u.current_address,
    u.available,
    COALESCE(u.verified, false) as verified,
    u.response_rate,
    u.avg_response_time,
    u.last_location_update,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(request_lng, request_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(u.current_longitude, u.current_latitude), 4326)::geography
      ) / 1000, 2
    ) as distance_km,
    u.updated_at,
    COALESCE(u.rating, 5.0) as rating
  FROM users u
  WHERE 
    u.blood_type = ANY(blood_types)
    AND u.current_latitude IS NOT NULL
    AND u.current_longitude IS NOT NULL
    AND u.location_sharing_enabled = true
    AND u.tracking_consent = true
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(request_lng, request_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(u.current_longitude, u.current_latitude), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km ASC, u.response_rate DESC NULLS LAST
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create function to find nearby blood requests
CREATE OR REPLACE FUNCTION find_nearby_requests(
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_km INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  patient_name TEXT,
  blood_type TEXT,
  urgency TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  location TEXT,
  hospital_name TEXT,
  units_needed INTEGER,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    br.id,
    br.patient_name,
    br.blood_type,
    br.urgency,
    br.latitude,
    br.longitude,
    br.location,
    br.hospital_name,
    br.units_needed,
    br.status,
    br.created_at,
    br.updated_at,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(br.longitude, br.latitude), 4326)::geography
      ) / 1000, 2
    ) as distance_km
  FROM blood_requests br
  WHERE 
    br.latitude IS NOT NULL
    AND br.longitude IS NOT NULL
    AND br.status IN ('pending', 'matched', 'in_progress')
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(br.longitude, br.latitude), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY 
    CASE br.urgency 
      WHEN 'critical' THEN 1
      WHEN 'urgent' THEN 2
      WHEN 'normal' THEN 3
    END,
    distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to find nearby blood banks
CREATE OR REPLACE FUNCTION find_nearby_blood_banks(
  user_lat DECIMAL,
  user_lng DECIMAL,
  radius_km INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  phone TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  operating_hours JSONB,
  is_active BOOLEAN,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bb.id,
    bb.name,
    bbl.address,
    bb.phone,
    bbl.latitude,
    bbl.longitude,
    bbl.operating_hours,
    bbl.is_active,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(bbl.longitude, bbl.latitude), 4326)::geography
      ) / 1000, 2
    ) as distance_km
  FROM blood_banks bb
  JOIN blood_bank_locations bbl ON bb.id = bbl.blood_bank_id
  WHERE 
    bbl.is_active = true
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(bbl.longitude, bbl.latitude), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Insert sample geofences
INSERT INTO geofences (name, type, center_lat, center_lng, radius, alert_on_enter, alert_on_exit) VALUES
('City Hospital Emergency Zone', 'emergency_zone', -25.7479, 28.2293, 500, true, false),
('Central Blood Bank', 'blood_bank', -25.7545, 28.2314, 200, true, true),
('University Hospital', 'hospital', -25.7619, 28.2041, 300, true, false),
('Emergency Response Zone North', 'emergency_zone', -25.7319, 28.2405, 1000, true, false),
('Blood Bank Storage Facility', 'blood_bank', -25.7689, 28.2156, 150, true, true)
ON CONFLICT (name) DO NOTHING;

-- Insert sample blood bank locations
INSERT INTO blood_bank_locations (blood_bank_id, latitude, longitude, address, operating_hours, is_active)
SELECT 
  bb.id,
  bb.latitude,
  bb.longitude,
  bb.address,
  '{"monday": "08:00-17:00", "tuesday": "08:00-17:00", "wednesday": "08:00-17:00", "thursday": "08:00-17:00", "friday": "08:00-17:00", "saturday": "08:00-12:00", "sunday": "closed"}'::jsonb,
  true
FROM blood_banks bb
WHERE bb.latitude IS NOT NULL AND bb.longitude IS NOT NULL
ON CONFLICT DO NOTHING;

-- Enable RLS for location tables
ALTER TABLE location_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_bank_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for location tracking
CREATE POLICY "location_tracking_user_policy" ON location_tracking
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin', 'blood_bank_admin')
    )
  );

CREATE POLICY "location_updates_user_policy" ON location_updates
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin', 'blood_bank_admin')
    )
  );

-- Geofences are admin-only
CREATE POLICY "geofences_admin_policy" ON geofences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "geofence_status_user_policy" ON geofence_status
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "geofence_events_user_policy" ON geofence_events
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "route_optimizations_user_policy" ON route_optimizations
  FOR ALL USING (
    donor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM blood_requests br
      WHERE br.id = request_id AND br.contact_user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin', 'blood_bank_admin')
    )
  );

-- Blood bank locations are publicly readable
CREATE POLICY "blood_bank_locations_public_read" ON blood_bank_locations
  FOR SELECT USING (is_active = true);

CREATE POLICY "blood_bank_locations_admin_write" ON blood_bank_locations
  FOR INSERT, UPDATE, DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin', 'blood_bank_admin')
    )
  );

COMMENT ON TABLE location_tracking IS 'Tracks active location tracking sessions for users';
COMMENT ON TABLE location_updates IS 'Stores real-time location updates with PostGIS support';
COMMENT ON TABLE geofences IS 'Defines geographic zones with entry/exit alerts';
COMMENT ON TABLE geofence_status IS 'Tracks user presence within geofences';
COMMENT ON TABLE geofence_events IS 'Logs geofence entry/exit events';
COMMENT ON TABLE route_optimizations IS 'Stores optimized routes between donors and requests';
COMMENT ON TABLE blood_bank_locations IS 'Enhanced blood bank location data with PostGIS support';