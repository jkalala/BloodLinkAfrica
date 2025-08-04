-- Enhanced RBAC Schema for BloodLink Africa
-- This script implements comprehensive role-based access control for all stakeholders

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_auto_revoke_emergency_access ON emergency_access_logs;
DROP TRIGGER IF EXISTS trigger_audit_user_role_change ON users;

-- Drop existing constraints and indexes if they exist
ALTER TABLE whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_template_name_language_unique;
ALTER TABLE whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_template_name_language_key;
DROP INDEX IF EXISTS idx_users_stakeholder_type;
DROP INDEX IF EXISTS idx_users_institution_id;
DROP INDEX IF EXISTS idx_users_verification_status;
DROP INDEX IF EXISTS idx_institution_staff_user_id;
DROP INDEX IF EXISTS idx_institution_staff_institution_id;
DROP INDEX IF EXISTS idx_role_permissions_role;
DROP INDEX IF EXISTS idx_emergency_access_logs_user_id;
DROP INDEX IF EXISTS idx_emergency_access_logs_created_at;

-- Drop ALL existing policies first
DO $$ 
BEGIN
  -- Drop policies on users table
  DROP POLICY IF EXISTS "Users can read own data" ON users;
  DROP POLICY IF EXISTS "Users can update own data" ON users;
  DROP POLICY IF EXISTS "Admin can manage all users" ON users;
  DROP POLICY IF EXISTS "Users can read their own data" ON users;
  DROP POLICY IF EXISTS "Users can read any user" ON users;
  DROP POLICY IF EXISTS "Users can update their own data" ON users;
  DROP POLICY IF EXISTS "Admins can manage all users" ON users;
  DROP POLICY IF EXISTS "users_read_any" ON users;
  DROP POLICY IF EXISTS "users_update_own" ON users;
  DROP POLICY IF EXISTS "users_insert_own" ON users;
  DROP POLICY IF EXISTS "users_admin_all" ON users;
  
  -- Drop policies on institutions table
  DROP POLICY IF EXISTS "Institution staff can view institution" ON institutions;
  DROP POLICY IF EXISTS "Institution staff can view their institution" ON institutions;
  DROP POLICY IF EXISTS "Admin can manage all institutions" ON institutions;
  DROP POLICY IF EXISTS "Admins can manage institutions" ON institutions;
  DROP POLICY IF EXISTS "institutions_staff_view" ON institutions;
  DROP POLICY IF EXISTS "institutions_admin_all" ON institutions;
  
  -- Drop policies on stakeholder_profiles table
  DROP POLICY IF EXISTS "Users can view own stakeholder profile" ON stakeholder_profiles;
  DROP POLICY IF EXISTS "Users can view their stakeholder profile" ON stakeholder_profiles;
  DROP POLICY IF EXISTS "Users can update own stakeholder profile" ON stakeholder_profiles;
  DROP POLICY IF EXISTS "Users can update their stakeholder profile" ON stakeholder_profiles;
  DROP POLICY IF EXISTS "stakeholder_profiles_view_own" ON stakeholder_profiles;
  DROP POLICY IF EXISTS "stakeholder_profiles_update_own" ON stakeholder_profiles;
  
  -- Drop policies on emergency_access_logs table
  DROP POLICY IF EXISTS "Emergency responders can view emergency logs" ON emergency_access_logs;
  DROP POLICY IF EXISTS "Emergency responders can view logs" ON emergency_access_logs;
  DROP POLICY IF EXISTS "Users can create emergency logs" ON emergency_access_logs;
  DROP POLICY IF EXISTS "Users can create logs" ON emergency_access_logs;
  DROP POLICY IF EXISTS "emergency_logs_responder_view" ON emergency_access_logs;
  DROP POLICY IF EXISTS "emergency_logs_create_own" ON emergency_access_logs;
END $$;

-- Create new policies with consistent naming
-- Users table policies
CREATE POLICY "users_read_any"
  ON users
  FOR SELECT
  USING (true);

CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM auth.users WHERE auth.uid() = id AND raw_user_meta_data->>'is_new_user' = 'true'
  ));

CREATE POLICY "users_insert_own"
  ON users
  FOR INSERT
  WITH CHECK (
    -- Allow users to create their own profile
    auth.uid() = id
    OR
    -- Allow authenticated users to create profiles
    auth.role() = 'authenticated'
    OR
    -- Allow new user creation during signup
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id AND raw_user_meta_data->>'is_new_user' = 'true'
    )
  );

CREATE POLICY "users_admin_all"
  ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'emergency_responder')
    )
  );

-- Also enable RLS on the users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT ALL ON users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Institution policies
CREATE POLICY "institutions_staff_view"
  ON institutions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM institution_staff 
      WHERE user_id = auth.uid() AND institution_id = institutions.id
    )
  );

CREATE POLICY "institutions_admin_all"
  ON institutions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Stakeholder profile policies
CREATE POLICY "stakeholder_profiles_view_own"
  ON stakeholder_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "stakeholder_profiles_update_own"
  ON stakeholder_profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- Emergency access logs policies
CREATE POLICY "emergency_logs_responder_view"
  ON emergency_access_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('emergency_responder', 'admin')
    )
  );

CREATE POLICY "emergency_logs_create_own"
  ON emergency_access_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 1. Enhanced users table with comprehensive role system
ALTER TABLE users ADD COLUMN IF NOT EXISTS stakeholder_type TEXT DEFAULT 'donor';
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_access BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hospital', 'blood_bank', 'government_agency', 'emergency_service')),
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  contact_person TEXT,
  verification_status TEXT DEFAULT 'pending',
  operating_hours JSONB,
  services JSONB,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT TRUE,
  emergency_contact TEXT,
  capacity INTEGER,
  specialties TEXT[]
);

-- 3. Create institution_staff table
CREATE TABLE IF NOT EXISTS institution_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  department TEXT,
  position TEXT,
  hire_date DATE,
  UNIQUE(user_id, institution_id)
);

-- 4. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  conditions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- 6. Create stakeholder_profiles table for additional stakeholder-specific data
CREATE TABLE IF NOT EXISTS stakeholder_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stakeholder_type TEXT NOT NULL,
  profile_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, stakeholder_type)
);

-- 7. Create emergency_access_logs table for audit trail
CREATE TABLE IF NOT EXISTS emergency_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  access_type TEXT NOT NULL,
  resource_accessed TEXT NOT NULL,
  access_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- 8. Insert default permissions
INSERT INTO permissions (name, description, resource, action)
SELECT 'view_own_profile', 'View own donor profile', 'profile', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_own_profile');

INSERT INTO permissions (name, description, resource, action)
SELECT 'update_own_profile', 'Update own donor profile', 'profile', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'update_own_profile');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_blood_requests', 'View blood donation requests', 'requests', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_blood_requests');

INSERT INTO permissions (name, description, resource, action)
SELECT 'respond_to_requests', 'Respond to blood requests', 'requests', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'respond_to_requests');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_donation_history', 'View own donation history', 'donations', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_donation_history');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_rewards', 'View rewards and points', 'rewards', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_rewards');

INSERT INTO permissions (name, description, resource, action)
SELECT 'create_blood_requests', 'Create blood requests', 'requests', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'create_blood_requests');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_own_requests', 'View own blood requests', 'requests', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_own_requests');

INSERT INTO permissions (name, description, resource, action)
SELECT 'track_request_status', 'Track blood request status', 'requests', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'track_request_status');

INSERT INTO permissions (name, description, resource, action)
SELECT 'contact_donors', 'Contact matched donors', 'donors', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'contact_donors');

INSERT INTO permissions (name, description, resource, action)
SELECT 'manage_hospital_requests', 'Manage hospital blood requests', 'requests', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_hospital_requests');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_hospital_inventory', 'View hospital blood inventory', 'inventory', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_hospital_inventory');

INSERT INTO permissions (name, description, resource, action)
SELECT 'coordinate_donors', 'Coordinate with blood donors', 'donors', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'coordinate_donors');

INSERT INTO permissions (name, description, resource, action)
SELECT 'emergency_alerts', 'Send emergency alerts', 'alerts', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'emergency_alerts');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_patient_data', 'View patient blood request data', 'patients', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_patient_data');

INSERT INTO permissions (name, description, resource, action)
SELECT 'manage_inventory', 'Manage blood inventory', 'inventory', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_inventory');

INSERT INTO permissions (name, description, resource, action)
SELECT 'manage_donors', 'Manage donor relationships', 'donors', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_donors');

INSERT INTO permissions (name, description, resource, action)
SELECT 'track_equipment', 'Track blood bank equipment', 'equipment', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'track_equipment');

INSERT INTO permissions (name, description, resource, action)
SELECT 'quality_control', 'Perform quality control checks', 'quality', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'quality_control');

INSERT INTO permissions (name, description, resource, action)
SELECT 'generate_reports', 'Generate blood bank reports', 'reports', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'generate_reports');

INSERT INTO permissions (name, description, resource, action)
SELECT 'emergency_access', 'Emergency access to all data', 'all', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'emergency_access');

INSERT INTO permissions (name, description, resource, action)
SELECT 'send_emergency_alerts', 'Send emergency alerts', 'alerts', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'send_emergency_alerts');

INSERT INTO permissions (name, description, resource, action)
SELECT 'coordinate_emergency_response', 'Coordinate emergency response', 'emergency', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'coordinate_emergency_response');

INSERT INTO permissions (name, description, resource, action)
SELECT 'override_restrictions', 'Override normal access restrictions', 'system', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'override_restrictions');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_public_health_data', 'View public health statistics', 'analytics', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_public_health_data');

INSERT INTO permissions (name, description, resource, action)
SELECT 'monitor_blood_supply', 'Monitor blood supply levels', 'supply', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'monitor_blood_supply');

INSERT INTO permissions (name, description, resource, action)
SELECT 'generate_health_reports', 'Generate public health reports', 'reports', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'generate_health_reports');

INSERT INTO permissions (name, description, resource, action)
SELECT 'manage_emergency_preparedness', 'Manage emergency preparedness', 'emergency', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_emergency_preparedness');

INSERT INTO permissions (name, description, resource, action)
SELECT 'manage_all_users', 'Manage all user accounts', 'users', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_all_users');

INSERT INTO permissions (name, description, resource, action)
SELECT 'view_all_data', 'View all system data', 'all', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_all_data');

INSERT INTO permissions (name, description, resource, action)
SELECT 'system_configuration', 'Configure system settings', 'system', 'write'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'system_configuration');

INSERT INTO permissions (name, description, resource, action)
SELECT 'audit_logs', 'View audit logs', 'audit', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'audit_logs');

-- 9. Insert role-permission mappings
INSERT INTO role_permissions (role, permission_id) 
SELECT 'donor', id 
FROM permissions 
WHERE name IN (
  'view_own_profile', 'update_own_profile', 'view_blood_requests', 
  'respond_to_requests', 'view_donation_history', 'view_rewards'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'donor' AND rp.permission_id = permissions.id
);

INSERT INTO role_permissions (role, permission_id) 
SELECT 'recipient', id 
FROM permissions 
WHERE name IN (
  'create_blood_requests', 'view_own_requests', 'track_request_status', 'contact_donors'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'recipient' AND rp.permission_id = permissions.id
);

INSERT INTO role_permissions (role, permission_id) 
SELECT 'hospital_staff', id 
FROM permissions 
WHERE name IN (
  'manage_hospital_requests', 'view_hospital_inventory', 'coordinate_donors',
  'emergency_alerts', 'view_patient_data'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'hospital_staff' AND rp.permission_id = permissions.id
);

INSERT INTO role_permissions (role, permission_id) 
SELECT 'blood_bank_staff', id 
FROM permissions 
WHERE name IN (
  'manage_inventory', 'manage_donors', 'track_equipment', 'quality_control', 'generate_reports'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'blood_bank_staff' AND rp.permission_id = permissions.id
);

INSERT INTO role_permissions (role, permission_id) 
SELECT 'emergency_responder', id 
FROM permissions 
WHERE name IN (
  'emergency_access', 'send_emergency_alerts', 'coordinate_emergency_response', 'override_restrictions'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'emergency_responder' AND rp.permission_id = permissions.id
);

INSERT INTO role_permissions (role, permission_id) 
SELECT 'government_official', id 
FROM permissions 
WHERE name IN (
  'view_public_health_data', 'monitor_blood_supply', 'generate_health_reports', 'manage_emergency_preparedness'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'government_official' AND rp.permission_id = permissions.id
);

INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id 
FROM permissions 
WHERE name IN (
  'manage_all_users', 'view_all_data', 'system_configuration', 'audit_logs'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'admin' AND rp.permission_id = permissions.id
);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_stakeholder_type ON users(stakeholder_type);
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
CREATE INDEX IF NOT EXISTS idx_institution_staff_user_id ON institution_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_institution_staff_institution_id ON institution_staff(institution_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_emergency_access_logs_user_id ON emergency_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_logs_created_at ON emergency_access_logs(created_at);

-- 11. Create views for easier querying
CREATE OR REPLACE VIEW user_permissions AS
SELECT 
  u.id as user_id,
  u.stakeholder_type,
  u.role,
  p.name as permission_name,
  p.resource,
  p.action,
  rp.granted
FROM users u
JOIN role_permissions rp ON u.role = rp.role
JOIN permissions p ON rp.permission_id = p.id;

CREATE OR REPLACE VIEW institution_staff_permissions AS
SELECT 
  ist.user_id,
  ist.institution_id,
  i.name as institution_name,
  i.type as institution_type,
  ist.role,
  p.name as permission_name,
  p.resource,
  p.action,
  rp.granted
FROM institution_staff ist
JOIN institutions i ON ist.institution_id = i.id
JOIN role_permissions rp ON ist.role = rp.role
JOIN permissions p ON rp.permission_id = p.id
WHERE ist.is_active = true AND i.is_active = true;

-- 12. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_access_logs ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies
-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
FOR UPDATE USING (auth.uid() = id);

-- Admin can manage all users
CREATE POLICY "Admin can manage all users" ON users
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Institution staff can view their institution
CREATE POLICY "Institution staff can view institution" ON institutions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM institution_staff 
    WHERE user_id = auth.uid() AND institution_id = institutions.id
  )
);

-- Admin can manage all institutions
CREATE POLICY "Admin can manage all institutions" ON institutions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Users can view their own stakeholder profile
CREATE POLICY "Users can view own stakeholder profile" ON stakeholder_profiles
FOR SELECT USING (user_id = auth.uid());

-- Users can update their own stakeholder profile
CREATE POLICY "Users can update own stakeholder profile" ON stakeholder_profiles
FOR UPDATE USING (user_id = auth.uid());

-- Emergency responders can view emergency access logs
CREATE POLICY "Emergency responders can view emergency logs" ON emergency_access_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('emergency_responder', 'admin')
  )
);

-- All users can create emergency access logs
CREATE POLICY "Users can create emergency logs" ON emergency_access_logs
FOR INSERT WITH CHECK (user_id = auth.uid());

-- 14. Create functions for permission checking
CREATE OR REPLACE FUNCTION has_permission(user_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = user_uuid 
    AND permission_name = permission_name 
    AND granted = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE(permission_name TEXT, resource TEXT, action TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT up.permission_name, up.resource, up.action
  FROM user_permissions up
  WHERE up.user_id = user_uuid AND up.granted = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Create function to grant emergency access
CREATE OR REPLACE FUNCTION grant_emergency_access(user_uuid UUID, reason TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is emergency responder
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = user_uuid AND role = 'emergency_responder'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Update user emergency access
  UPDATE users SET emergency_access = true WHERE id = user_uuid;
  
  -- Log emergency access
  INSERT INTO emergency_access_logs (user_id, access_type, resource_accessed, access_reason)
  VALUES (user_uuid, 'emergency_access_granted', 'all', reason);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Create function to revoke emergency access
CREATE OR REPLACE FUNCTION revoke_emergency_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users SET emergency_access = false WHERE id = user_uuid;
  
  INSERT INTO emergency_access_logs (user_id, access_type, resource_accessed, access_reason)
  VALUES (user_uuid, 'emergency_access_revoked', 'all', 'Automatic revocation');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. Create trigger to automatically revoke emergency access after 24 hours
CREATE OR REPLACE FUNCTION auto_revoke_emergency_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Revoke emergency access for users who had it granted more than 24 hours ago
  PERFORM revoke_emergency_access(user_id)
  FROM emergency_access_logs
  WHERE access_type = 'emergency_access_granted'
  AND created_at < NOW() - INTERVAL '24 hours'
  AND user_id IN (
    SELECT id FROM users WHERE emergency_access = true
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_revoke_emergency_access
  AFTER INSERT ON emergency_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION auto_revoke_emergency_access();

-- 18. Insert sample institutions for testing
INSERT INTO institutions (name, type, address, phone, email, contact_person, verification_status) VALUES
('Nairobi General Hospital', 'hospital', 'Nairobi, Kenya', '+254700123456', 'info@nairobi-hospital.com', 'Dr. Sarah Johnson', 'verified'),
('Kenya Blood Bank', 'blood_bank', 'Nairobi, Kenya', '+254700123457', 'info@kenya-blood-bank.com', 'Dr. Michael Chen', 'verified'),
('Emergency Medical Services', 'emergency_service', 'Nairobi, Kenya', '+254700123458', 'emergency@ems-kenya.com', 'Captain David Ochieng', 'verified'),
('Ministry of Health Kenya', 'government_agency', 'Nairobi, Kenya', '+254700123459', 'info@health.go.ke', 'Dr. Jane Wanjiku', 'verified');

-- 19. Create audit trigger for user role changes
CREATE OR REPLACE FUNCTION audit_user_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO emergency_access_logs (user_id, access_type, resource_accessed, access_reason)
    VALUES (NEW.id, 'role_change', 'user_role', 
            'Role changed from ' || COALESCE(OLD.role, 'none') || ' to ' || NEW.role);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_user_role_change
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_role_change();

-- 20. Create function to get user's full permissions (including institution permissions)
CREATE OR REPLACE FUNCTION get_user_full_permissions(user_uuid UUID)
RETURNS TABLE(permission_name TEXT, resource TEXT, action TEXT, source TEXT) AS $$
BEGIN
  RETURN QUERY
  -- User role permissions
  SELECT up.permission_name, up.resource, up.action, 'role'::TEXT as source
  FROM user_permissions up
  WHERE up.user_id = user_uuid AND up.granted = true
  
  UNION
  
  -- Institution staff permissions
  SELECT isp.permission_name, isp.resource, isp.action, 'institution'::TEXT as source
  FROM institution_staff_permissions isp
  WHERE isp.user_id = user_uuid AND isp.granted = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 