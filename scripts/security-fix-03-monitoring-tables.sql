-- Security Fix 03: Security Monitoring Tables
-- This script creates tables for comprehensive security monitoring and logging

-- Create security_events table for comprehensive security logging
CREATE TABLE IF NOT EXISTS security_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES auth.users(id),
  session_id text,
  ip_address inet,
  user_agent text,
  endpoint text,
  method text CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  request_id text,
  details jsonb NOT NULL DEFAULT '{}',
  timestamp timestamp with time zone DEFAULT now() NOT NULL,
  resolved boolean DEFAULT false NOT NULL,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES auth.users(id),
  notes text,
  
  -- Constraints
  CONSTRAINT valid_resolution CHECK (
    (resolved = false AND resolved_at IS NULL AND resolved_by IS NULL) OR
    (resolved = true AND resolved_at IS NOT NULL)
  ),
  CONSTRAINT valid_timestamp CHECK (resolved_at IS NULL OR resolved_at >= timestamp)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_risk_level ON security_events(risk_level);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_endpoint ON security_events(endpoint) WHERE endpoint IS NOT NULL;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_events_user_time ON security_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_risk_time ON security_events(risk_level, timestamp DESC) WHERE risk_level IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_security_events_ip_time ON security_events(ip_address, timestamp DESC) WHERE ip_address IS NOT NULL;

-- Create GIN index for JSON details searching
CREATE INDEX IF NOT EXISTS idx_security_events_details ON security_events USING gin(details);

-- Enable RLS
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only service role and admins can manage security events
CREATE POLICY "security_events_service_role" ON security_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "security_events_admin_read" ON security_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create security_metrics table for aggregated metrics
CREATE TABLE IF NOT EXISTS security_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  time_period text NOT NULL CHECK (time_period IN ('1h', '24h', '7d', '30d')),
  calculated_at timestamp with time zone DEFAULT now() NOT NULL,
  details jsonb DEFAULT '{}',
  
  -- Unique constraint to prevent duplicate metrics for same period
  UNIQUE(metric_type, metric_name, time_period, calculated_at::date)
);

-- Indexes for security metrics
CREATE INDEX IF NOT EXISTS idx_security_metrics_type_period ON security_metrics(metric_type, time_period);
CREATE INDEX IF NOT EXISTS idx_security_metrics_calculated_at ON security_metrics(calculated_at DESC);

-- Enable RLS for security metrics
ALTER TABLE security_metrics ENABLE ROW LEVEL SECURITY;

-- Only service role and admins can manage security metrics
CREATE POLICY "security_metrics_service_role" ON security_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "security_metrics_admin_read" ON security_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create function to clean up old security events (for data retention)
CREATE OR REPLACE FUNCTION cleanup_old_security_events()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Keep high and critical events for 1 year
  DELETE FROM security_events 
  WHERE risk_level IN ('high', 'critical') 
    AND timestamp < (now() - interval '1 year');
  
  -- Keep medium events for 6 months
  DELETE FROM security_events 
  WHERE risk_level = 'medium' 
    AND timestamp < (now() - interval '6 months');
  
  -- Keep low events for 3 months
  DELETE FROM security_events 
  WHERE risk_level = 'low' 
    AND timestamp < (now() - interval '3 months');
    
  -- Clean up old metrics (keep for 1 year)
  DELETE FROM security_metrics 
  WHERE calculated_at < (now() - interval '1 year');
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_old_security_events() TO service_role;

-- Create function to get security event summary
CREATE OR REPLACE FUNCTION get_security_event_summary(
  time_range text DEFAULT '24h',
  risk_levels text[] DEFAULT ARRAY['low', 'medium', 'high', 'critical']
)
RETURNS TABLE (
  event_type text,
  risk_level text,
  event_count bigint,
  unique_users bigint,
  unique_ips bigint,
  latest_event timestamp with time zone
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  time_cutoff timestamp with time zone;
BEGIN
  -- Calculate time cutoff based on range
  CASE time_range
    WHEN '1h' THEN time_cutoff := now() - interval '1 hour';
    WHEN '24h' THEN time_cutoff := now() - interval '24 hours';
    WHEN '7d' THEN time_cutoff := now() - interval '7 days';
    WHEN '30d' THEN time_cutoff := now() - interval '30 days';
    ELSE time_cutoff := now() - interval '24 hours';
  END CASE;

  RETURN QUERY
  SELECT 
    se.event_type,
    se.risk_level,
    COUNT(*) as event_count,
    COUNT(DISTINCT se.user_id) as unique_users,
    COUNT(DISTINCT se.ip_address) as unique_ips,
    MAX(se.timestamp) as latest_event
  FROM security_events se
  WHERE se.timestamp >= time_cutoff
    AND se.risk_level = ANY(risk_levels)
  GROUP BY se.event_type, se.risk_level
  ORDER BY event_count DESC, latest_event DESC;
END;
$$;

-- Grant execute permission to authenticated users with admin role
GRANT EXECUTE ON FUNCTION get_security_event_summary(text, text[]) TO authenticated;

-- Create function to check for suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_patterns()
RETURNS TABLE (
  pattern_type text,
  description text,
  affected_users uuid[],
  affected_ips inet[],
  event_count bigint,
  risk_score numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Detect multiple failed logins from same IP
  RETURN QUERY
  SELECT 
    'multiple_failed_logins'::text as pattern_type,
    'Multiple failed login attempts from same IP'::text as description,
    array_agg(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as affected_users,
    array_agg(DISTINCT ip_address) as affected_ips,
    COUNT(*) as event_count,
    LEAST(COUNT(*) * 10, 100)::numeric as risk_score
  FROM security_events
  WHERE event_type = 'login_failure'
    AND timestamp >= now() - interval '1 hour'
    AND ip_address IS NOT NULL
  GROUP BY ip_address
  HAVING COUNT(*) >= 5;

  -- Detect unusual access patterns
  RETURN QUERY
  SELECT 
    'unusual_access_pattern'::text as pattern_type,
    'Unusual API access pattern detected'::text as description,
    array_agg(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as affected_users,
    array_agg(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) as affected_ips,
    COUNT(*) as event_count,
    LEAST(COUNT(*) * 5, 100)::numeric as risk_score
  FROM security_events
  WHERE event_type = 'sensitive_data_access'
    AND timestamp >= now() - interval '1 hour'
  GROUP BY user_id
  HAVING COUNT(*) >= 20;

  -- Detect rate limit violations
  RETURN QUERY
  SELECT 
    'rate_limit_violations'::text as pattern_type,
    'Repeated rate limit violations'::text as description,
    array_agg(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as affected_users,
    array_agg(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) as affected_ips,
    COUNT(*) as event_count,
    LEAST(COUNT(*) * 15, 100)::numeric as risk_score
  FROM security_events
  WHERE event_type = 'rate_limit_exceeded'
    AND timestamp >= now() - interval '1 hour'
  GROUP BY ip_address
  HAVING COUNT(*) >= 3;
END;
$$;

-- Grant execute permission to service role and admins
GRANT EXECUTE ON FUNCTION detect_suspicious_patterns() TO service_role;

-- Create trigger to automatically update security metrics
CREATE OR REPLACE FUNCTION update_security_metrics()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update hourly metrics
  INSERT INTO security_metrics (metric_type, metric_name, metric_value, time_period, details)
  VALUES (
    'event_count',
    NEW.event_type,
    1,
    '1h',
    jsonb_build_object('risk_level', NEW.risk_level, 'user_id', NEW.user_id)
  )
  ON CONFLICT (metric_type, metric_name, time_period, calculated_at::date) 
  DO UPDATE SET 
    metric_value = security_metrics.metric_value + 1,
    calculated_at = now();

  RETURN NEW;
END;
$$;

-- Create trigger on security_events
CREATE TRIGGER trigger_update_security_metrics
  AFTER INSERT ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION update_security_metrics();

-- Add comments for documentation
COMMENT ON TABLE security_events IS 'Comprehensive security event logging for monitoring and incident response';
COMMENT ON TABLE security_metrics IS 'Aggregated security metrics for dashboard and reporting';
COMMENT ON FUNCTION cleanup_old_security_events() IS 'Cleans up old security events based on retention policy';
COMMENT ON FUNCTION get_security_event_summary(text, text[]) IS 'Returns security event summary for specified time range';
COMMENT ON FUNCTION detect_suspicious_patterns() IS 'Detects suspicious security patterns and potential threats';

-- Insert initial security event types for reference
INSERT INTO security_metrics (metric_type, metric_name, metric_value, time_period, details)
VALUES 
  ('system', 'security_monitoring_initialized', 1, '24h', jsonb_build_object('initialized_at', now()))
ON CONFLICT DO NOTHING;

-- Log the completion of security monitoring setup
INSERT INTO security_events (event_type, risk_level, details)
VALUES (
  'configuration_change',
  'low',
  jsonb_build_object(
    'change_type', 'security_monitoring_setup',
    'tables_created', array['security_events', 'security_metrics'],
    'functions_created', array[
      'cleanup_old_security_events',
      'get_security_event_summary', 
      'detect_suspicious_patterns'
    ],
    'setup_completed_at', now()
  )
);