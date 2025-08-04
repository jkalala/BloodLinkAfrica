-- Location-based Indexes for Improved Query Performance
-- BloodLink Africa Database Optimization

-- ==============================================
-- 1. Location Indexes for Users Table
-- ==============================================

-- Index for user location queries (donors, blood banks, etc.)
CREATE INDEX IF NOT EXISTS idx_users_location 
ON users(current_latitude, current_longitude) 
WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL;

-- Composite index for location + blood type queries
CREATE INDEX IF NOT EXISTS idx_users_location_blood_type 
ON users(blood_type, current_latitude, current_longitude, available) 
WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL;

-- Index for nearby donor searches
CREATE INDEX IF NOT EXISTS idx_users_donors_location 
ON users(stakeholder_type, blood_type, available, current_latitude, current_longitude) 
WHERE stakeholder_type = 'donor' AND available = true;

-- ==============================================
-- 2. Institution Location Indexes
-- ==============================================

-- Index for blood bank location queries
CREATE INDEX IF NOT EXISTS idx_institutions_location 
ON institutions(location_lat, location_lng, is_active) 
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Composite index for blood bank type + location
CREATE INDEX IF NOT EXISTS idx_institutions_type_location 
ON institutions(type, is_active, location_lat, location_lng) 
WHERE type IN ('blood_bank', 'hospital');

-- ==============================================
-- 3. Blood Request Location Indexes
-- ==============================================

-- Index for blood request location queries
CREATE INDEX IF NOT EXISTS idx_blood_requests_location 
ON blood_requests(location_lat, location_lng, status, urgency) 
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Composite index for urgent requests by location
CREATE INDEX IF NOT EXISTS idx_blood_requests_urgent_location 
ON blood_requests(urgency, status, created_at, location_lat, location_lng) 
WHERE status IN ('pending', 'active');

-- ==============================================
-- 4. Tracking and Movement Indexes
-- ==============================================

-- Index for location tracking queries
CREATE INDEX IF NOT EXISTS idx_location_tracking_user_time 
ON location_tracking(user_id, created_at DESC, is_active);

-- Index for real-time location updates
CREATE INDEX IF NOT EXISTS idx_realtime_location_updates 
ON realtime_location_updates(user_id, created_at DESC);

-- ==============================================
-- 5. Geospatial Indexes (PostGIS if available)
-- ==============================================

-- Enable PostGIS extension if available
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Note: The following indexes require PostGIS extension
-- Uncomment if PostGIS is available in your Supabase instance

-- Geospatial index for users
-- CREATE INDEX IF NOT EXISTS idx_users_geom 
-- ON users USING GIST(ST_Point(current_longitude, current_latitude));

-- Geospatial index for institutions
-- CREATE INDEX IF NOT EXISTS idx_institutions_geom 
-- ON institutions USING GIST(ST_Point(location_lng, location_lat));

-- Geospatial index for blood requests
-- CREATE INDEX IF NOT EXISTS idx_blood_requests_geom 
-- ON blood_requests USING GIST(ST_Point(location_lng, location_lat));

-- ==============================================
-- 6. Performance-Critical Composite Indexes
-- ==============================================

-- Index for AI matching service donor queries
CREATE INDEX IF NOT EXISTS idx_ai_matching_donors 
ON users(blood_type, available, receive_alerts, response_rate DESC, success_rate DESC) 
WHERE stakeholder_type = 'donor' AND available = true;

-- Index for blood bank inventory with location
CREATE INDEX IF NOT EXISTS idx_blood_inventory_location 
ON blood_inventory(blood_type, units_available, institution_id, status)
WHERE status = 'available' AND units_available > 0;

-- ==============================================
-- 7. Time-Series Indexes for Analytics
-- ==============================================

-- Index for donation history by location and time
CREATE INDEX IF NOT EXISTS idx_donations_location_time 
ON donations(created_at DESC, donor_id, recipient_location);

-- Index for emergency response analytics
CREATE INDEX IF NOT EXISTS idx_emergency_responses_location_time 
ON emergency_responses(created_at DESC, location_lat, location_lng, status);

-- ==============================================
-- 8. Specialized Indexes for Real-Time Features
-- ==============================================

-- Index for real-time dashboard queries
CREATE INDEX IF NOT EXISTS idx_realtime_dashboard 
ON blood_requests(status, urgency, created_at DESC, location_lat, location_lng)
WHERE status IN ('pending', 'active', 'urgent');

-- Index for live donor tracking
CREATE INDEX IF NOT EXISTS idx_live_donor_tracking 
ON location_tracking(user_id, is_active, last_updated DESC)
WHERE is_active = true;

-- ==============================================
-- 9. Search and Filter Indexes
-- ==============================================

-- Full-text search index for institutions
CREATE INDEX IF NOT EXISTS idx_institutions_search 
ON institutions USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(address, '')));

-- Index for user search by name and location
CREATE INDEX IF NOT EXISTS idx_users_search 
ON users USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(location, '')));

-- ==============================================
-- 10. ML and Analytics Optimization Indexes
-- ==============================================

-- Index for ML feature store queries
CREATE INDEX IF NOT EXISTS idx_ml_features 
ON users(response_rate, success_rate, avg_response_time, total_donations)
WHERE response_rate IS NOT NULL;

-- Index for prediction analytics
CREATE INDEX IF NOT EXISTS idx_ml_predictions_performance 
ON ml_predictions(created_at DESC, model_type, prediction_accuracy)
WHERE actual_outcome IS NOT NULL;

-- ==============================================
-- Index Usage Statistics and Monitoring
-- ==============================================

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'institutions', 'blood_requests', 'location_tracking')
ORDER BY tablename, attname;

-- ==============================================
-- Performance Optimization Functions
-- ==============================================

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    r DOUBLE PRECISION := 6371; -- Earth's radius in kilometers
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearby users within radius
CREATE OR REPLACE FUNCTION find_nearby_users(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 10,
    user_type TEXT DEFAULT 'donor'
) RETURNS TABLE (
    user_id UUID,
    name TEXT,
    blood_type TEXT,
    distance_km DOUBLE PRECISION,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.blood_type,
        calculate_distance(center_lat, center_lon, u.current_latitude, u.current_longitude) as distance,
        u.current_latitude,
        u.current_longitude
    FROM users u
    WHERE u.stakeholder_type = user_type
        AND u.available = true
        AND u.current_latitude IS NOT NULL
        AND u.current_longitude IS NOT NULL
        AND calculate_distance(center_lat, center_lon, u.current_latitude, u.current_longitude) <= radius_km
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- Maintenance and Optimization
-- ==============================================

-- Create a function to analyze table statistics
CREATE OR REPLACE FUNCTION refresh_location_stats() RETURNS void AS $$
BEGIN
    ANALYZE users;
    ANALYZE institutions;
    ANALYZE blood_requests;
    ANALYZE location_tracking;
    ANALYZE realtime_location_updates;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- Comments and Documentation
-- ==============================================

COMMENT ON INDEX idx_users_location IS 'Optimizes location-based user queries';
COMMENT ON INDEX idx_users_location_blood_type IS 'Optimizes donor matching by location and blood type';
COMMENT ON INDEX idx_institutions_location IS 'Optimizes blood bank location searches';
COMMENT ON INDEX idx_blood_requests_location IS 'Optimizes blood request location queries';
COMMENT ON FUNCTION calculate_distance IS 'Calculates distance between two coordinates using Haversine formula';
COMMENT ON FUNCTION find_nearby_users IS 'Finds users within specified radius of a location';

-- Run initial statistics refresh
SELECT refresh_location_stats();