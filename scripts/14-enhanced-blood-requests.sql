-- Enhanced Blood Request Management System
-- This script implements advanced blood request features for all stakeholders

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_update_request_priority ON blood_requests;
DROP TRIGGER IF EXISTS trigger_log_request_status_change ON blood_requests;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own requests" ON blood_requests;
DROP POLICY IF EXISTS "Institution staff can view institution requests" ON blood_requests;
DROP POLICY IF EXISTS "Emergency responders can view all requests" ON blood_requests;
DROP POLICY IF EXISTS "Users can create requests" ON blood_requests;
DROP POLICY IF EXISTS "Coordinators can update assigned requests" ON blood_requests;
DROP POLICY IF EXISTS "Emergency responders can update all requests" ON blood_requests;

-- 1. Create emergency_blood_alerts table first (since blood_requests will reference it)
CREATE TABLE IF NOT EXISTS emergency_blood_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('mass_casualty', 'natural_disaster', 'transport_accident', 'medical_emergency')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  affected_area JSONB NOT NULL,
  blood_types_needed JSONB NOT NULL,
  units_required INTEGER NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  coordinator_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- 2. Enhanced blood_requests table with advanced features
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES users(id);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('normal', 'urgent', 'critical', 'emergency'));
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'donation' CHECK (request_type IN ('donation', 'emergency', 'scheduled', 'reserve'));
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 1;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS insurance_info JSONB;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS medical_notes TEXT;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS donor_requirements JSONB;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS completion_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS emergency_contact JSONB;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS assigned_coordinator UUID REFERENCES users(id);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS emergency_alert_id UUID REFERENCES emergency_blood_alerts(id);

-- 2. Create blood_request_updates table for tracking changes
CREATE TABLE IF NOT EXISTS blood_request_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES users(id),
  update_type TEXT NOT NULL CHECK (update_type IN ('status_change', 'priority_change', 'assignment', 'note', 'emergency_escalation')),
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create blood_request_coordination table for multi-stakeholder coordination
CREATE TABLE IF NOT EXISTS blood_request_coordination (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  coordinator_id UUID NOT NULL REFERENCES users(id),
  institution_id UUID REFERENCES institutions(id),
  role TEXT NOT NULL CHECK (role IN ('primary', 'secondary', 'emergency', 'backup')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'transferred')),
  notes TEXT,
  UNIQUE(request_id, coordinator_id)
);

-- 4. Create blood_request_matching table for donor matching
CREATE TABLE IF NOT EXISTS blood_request_matching (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES users(id),
  match_score DECIMAL(3,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
  match_criteria JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'accepted', 'declined', 'unavailable')),
  contacted_at TIMESTAMP WITH TIME ZONE,
  response_time INTEGER, -- in minutes
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(request_id, donor_id)
);

-- 5. Create blood_request_analytics table for tracking metrics
CREATE TABLE IF NOT EXISTS blood_request_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('response_time', 'fulfillment_time', 'donor_count', 'success_rate')),
  metric_value DECIMAL(10,2) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  context JSONB
);

-- 6. Create blood_inventory_tracking table for real-time inventory
CREATE TABLE IF NOT EXISTS blood_inventory_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  blood_type TEXT NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER NOT NULL DEFAULT 0,
  available_stock INTEGER GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
  minimum_threshold INTEGER NOT NULL DEFAULT 10,
  maximum_capacity INTEGER NOT NULL DEFAULT 1000,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(institution_id, blood_type)
);

-- 7. Create blood_donation_scheduling table for planned donations
CREATE TABLE IF NOT EXISTS blood_donation_scheduling (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_id UUID NOT NULL REFERENCES users(id),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  blood_type TEXT NOT NULL,
  units_to_donate INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create blood_request_prioritization_rules table
CREATE TABLE IF NOT EXISTS blood_request_prioritization_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_name TEXT NOT NULL,
  rule_conditions JSONB NOT NULL,
  priority_score INTEGER NOT NULL CHECK (priority_score >= 1 AND priority_score <= 10),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Insert default prioritization rules
INSERT INTO blood_request_prioritization_rules (rule_name, rule_conditions, priority_score) VALUES
('Emergency Critical', '{"urgency_level": "critical", "request_type": "emergency"}', 10),
('Emergency Urgent', '{"urgency_level": "urgent", "request_type": "emergency"}', 9),
('Mass Casualty', '{"alert_type": "mass_casualty"}', 10),
('Natural Disaster', '{"alert_type": "natural_disaster"}', 9),
('Pediatric Emergency', '{"patient_age": "<18", "urgency_level": "urgent"}', 8),
('Rare Blood Type', '{"blood_type": ["AB-", "B-", "A-"]}', 7),
('High Volume Need', '{"units_needed": ">5"}', 6),
('Scheduled Surgery', '{"request_type": "scheduled"}', 3),
('Regular Donation', '{"request_type": "donation"}', 1);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blood_requests_requester_id ON blood_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_institution_id ON blood_requests(institution_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_urgency_level ON blood_requests(urgency_level);
CREATE INDEX IF NOT EXISTS idx_blood_requests_priority_score ON blood_requests(priority_score);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_created_at ON blood_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_blood_request_updates_request_id ON blood_request_updates(request_id);
CREATE INDEX IF NOT EXISTS idx_blood_request_coordination_request_id ON blood_request_coordination(request_id);
CREATE INDEX IF NOT EXISTS idx_blood_request_matching_request_id ON blood_request_matching(request_id);
CREATE INDEX IF NOT EXISTS idx_blood_request_matching_donor_id ON blood_request_matching(donor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_blood_alerts_status ON emergency_blood_alerts(status);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_tracking_institution_id ON blood_inventory_tracking(institution_id);
CREATE INDEX IF NOT EXISTS idx_blood_donation_scheduling_donor_id ON blood_donation_scheduling(donor_id);

-- 11. Create views for easier querying
CREATE OR REPLACE VIEW active_blood_requests AS
SELECT 
  br.*,
  u.name as requester_name,
  u.phone as requester_phone,
  i.name as institution_name,
  i.type as institution_type,
  COUNT(brm.id) as matched_donors,
  COUNT(CASE WHEN brm.status = 'accepted' THEN 1 END) as accepted_donors
FROM blood_requests br
LEFT JOIN users u ON br.requester_id = u.id
LEFT JOIN institutions i ON br.institution_id = i.id
LEFT JOIN blood_request_matching brm ON br.id = brm.request_id
WHERE br.status IN ('pending', 'matched', 'in_progress')
GROUP BY br.id, u.name, u.phone, i.name, i.type;

CREATE OR REPLACE VIEW blood_inventory_summary AS
SELECT 
  i.name as institution_name,
  i.type as institution_type,
  bit.blood_type,
  bit.current_stock,
  bit.reserved_stock,
  bit.available_stock,
  bit.minimum_threshold,
  CASE 
    WHEN bit.available_stock <= bit.minimum_threshold THEN 'critical'
    WHEN bit.available_stock <= bit.minimum_threshold * 2 THEN 'low'
    ELSE 'adequate'
  END as stock_status,
  bit.last_updated
FROM blood_inventory_tracking bit
JOIN institutions i ON bit.institution_id = i.id
WHERE i.is_active = true;

CREATE OR REPLACE VIEW emergency_alerts_active AS
SELECT 
  eba.*,
  u.name as coordinator_name,
  COUNT(br.id) as related_requests
FROM emergency_blood_alerts eba
LEFT JOIN users u ON eba.coordinator_id = u.id
LEFT JOIN blood_requests br ON br.emergency_alert_id = eba.id
WHERE eba.status = 'active'
GROUP BY eba.id, u.name;

-- 12. Create functions for advanced request management
CREATE OR REPLACE FUNCTION calculate_request_priority(request_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  request_data RECORD;
  priority_score INTEGER := 1;
  rule_record RECORD;
BEGIN
  -- Get request data
  SELECT * INTO request_data FROM blood_requests WHERE id = request_uuid;
  
  -- Apply prioritization rules
  FOR rule_record IN 
    SELECT * FROM blood_request_prioritization_rules WHERE is_active = true
  LOOP
    -- Check if request matches rule conditions
    IF (rule_record.rule_conditions->>'urgency_level' IS NULL OR 
        request_data.urgency_level = rule_record.rule_conditions->>'urgency_level') AND
       (rule_record.rule_conditions->>'request_type' IS NULL OR 
        request_data.request_type = rule_record.rule_conditions->>'request_type') THEN
      
      priority_score = GREATEST(priority_score, rule_record.priority_score);
    END IF;
  END LOOP;
  
  -- Update request priority
  UPDATE blood_requests SET priority_score = priority_score WHERE id = request_uuid;
  
  RETURN priority_score;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_matching_donors(request_uuid UUID)
RETURNS TABLE(donor_id UUID, match_score DECIMAL(3,2), criteria JSONB) AS $$
DECLARE
  request_data RECORD;
  donor_record RECORD;
  match_score DECIMAL(3,2);
  criteria JSONB;
BEGIN
  -- Get request data
  SELECT * INTO request_data FROM blood_requests WHERE id = request_uuid;
  
  -- Find matching donors
  FOR donor_record IN 
    SELECT u.*, 
           CASE WHEN u.blood_type = request_data.blood_type THEN 1.0 ELSE 0.5 END as blood_match,
           CASE WHEN u.available = true THEN 1.0 ELSE 0.0 END as availability,
           CASE WHEN u.last_donation IS NULL OR 
                     u.last_donation < NOW() - INTERVAL '56 days' THEN 1.0 ELSE 0.0 END as eligible
    FROM users u 
    WHERE u.stakeholder_type = 'donor' 
    AND u.blood_type = request_data.blood_type
    AND u.available = true
  LOOP
    -- Calculate match score
    match_score = (donor_record.blood_match * 0.4 + 
                   donor_record.availability * 0.3 + 
                   donor_record.eligible * 0.3);
    
    criteria = jsonb_build_object(
      'blood_match', donor_record.blood_match,
      'availability', donor_record.availability,
      'eligible', donor_record.eligible,
      'location', donor_record.location
    );
    
    donor_id := donor_record.id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_emergency_alert(
  alert_type TEXT,
  severity TEXT,
  affected_area JSONB,
  blood_types_needed JSONB,
  units_required INTEGER,
  deadline TIMESTAMP WITH TIME ZONE,
  coordinator_uuid UUID,
  notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  alert_id UUID;
BEGIN
  INSERT INTO emergency_blood_alerts (
    alert_type, severity, affected_area, blood_types_needed, 
    units_required, deadline, coordinator_id, notes
  ) VALUES (
    alert_type, severity, affected_area, blood_types_needed, 
    units_required, deadline, coordinator_uuid, notes
  ) RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inventory_stock(
  institution_uuid UUID,
  blood_type TEXT,
  units_change INTEGER,
  updated_by_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO blood_inventory_tracking (
    institution_id, blood_type, current_stock, updated_by
  ) VALUES (
    institution_uuid, blood_type, units_change, updated_by_uuid
  )
  ON CONFLICT (institution_id, blood_type) 
  DO UPDATE SET 
    current_stock = blood_inventory_tracking.current_stock + units_change,
    last_updated = NOW(),
    updated_by = updated_by_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 13. Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_request_priority_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate priority when request is updated
  PERFORM calculate_request_priority(NEW.id);
  
  -- Log the update
  INSERT INTO blood_request_updates (
    request_id, updated_by, update_type, old_value, new_value
  ) VALUES (
    NEW.id, COALESCE(NEW.assigned_coordinator, NEW.requester_id), 
    'priority_change', OLD.priority_score::TEXT, NEW.priority_score::TEXT
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_request_priority
  AFTER UPDATE ON blood_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_request_priority_trigger();

CREATE OR REPLACE FUNCTION log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO blood_request_updates (
      request_id, updated_by, update_type, old_value, new_value
    ) VALUES (
      NEW.id, COALESCE(NEW.assigned_coordinator, NEW.requester_id), 
      'status_change', OLD.status, NEW.status
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_request_status_change
  AFTER UPDATE ON blood_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_status_change();

-- 14. Enable RLS on new tables
ALTER TABLE blood_request_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_request_coordination ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_request_matching ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_request_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_blood_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_inventory_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_donation_scheduling ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_request_prioritization_rules ENABLE ROW LEVEL SECURITY;

-- 15. Create RLS policies
-- Users can view their own requests
CREATE POLICY "Users can view own requests" ON blood_requests
FOR SELECT USING (requester_id = auth.uid());

-- Institution staff can view their institution's requests
CREATE POLICY "Institution staff can view institution requests" ON blood_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM institution_staff 
    WHERE user_id = auth.uid() AND institution_id = blood_requests.institution_id
  )
);

-- Emergency responders can view all requests
CREATE POLICY "Emergency responders can view all requests" ON blood_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'emergency_responder'
  )
);

-- Users can create requests
CREATE POLICY "Users can create requests" ON blood_requests
FOR INSERT WITH CHECK (requester_id = auth.uid());

-- Coordinators can update assigned requests
CREATE POLICY "Coordinators can update assigned requests" ON blood_requests
FOR UPDATE USING (assigned_coordinator = auth.uid());

-- Emergency responders can update all requests
CREATE POLICY "Emergency responders can update all requests" ON blood_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'emergency_responder'
  )
);

-- 16. Insert sample data for testing
INSERT INTO blood_inventory_tracking (institution_id, blood_type, current_stock, minimum_threshold, maximum_capacity) 
SELECT i.id, bt.blood_type, 
       CASE WHEN bt.blood_type IN ('O+', 'A+') THEN 150 ELSE 50 END,
       10, 1000
FROM institutions i
CROSS JOIN (VALUES ('A+'), ('A-'), ('B+'), ('B-'), ('AB+'), ('AB-'), ('O+'), ('O-')) AS bt(blood_type)
WHERE i.type IN ('hospital', 'blood_bank')
AND NOT EXISTS (
  SELECT 1 FROM blood_inventory_tracking bit 
  WHERE bit.institution_id = i.id AND bit.blood_type = bt.blood_type
);

-- 17. Create function to get request statistics
CREATE OR REPLACE FUNCTION get_request_statistics(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  total_requests INTEGER,
  pending_requests INTEGER,
  fulfilled_requests INTEGER,
  average_response_time DECIMAL(10,2),
  success_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_requests,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending_requests,
    COUNT(CASE WHEN status = 'fulfilled' THEN 1 END)::INTEGER as fulfilled_requests,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::DECIMAL(10,2) as average_response_time,
    (COUNT(CASE WHEN status = 'fulfilled' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL * 100)::DECIMAL(5,2) as success_rate
  FROM blood_requests 
  WHERE created_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql; 