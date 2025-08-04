-- Fix permissions and staff tables
-- This script adds missing tables and functions for RBAC

-- Create institution_staff table
CREATE TABLE IF NOT EXISTS institution_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    department TEXT,
    position TEXT,
    hire_date DATE,
    UNIQUE(user_id, institution_id)
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    conditions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role TEXT NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_institution_staff_user_id ON institution_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_institution_staff_institution_id ON institution_staff(institution_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Enable RLS
ALTER TABLE institution_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "institution_staff_all_operations"
ON institution_staff
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "permissions_all_operations"
ON permissions
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "role_permissions_all_operations"
ON role_permissions
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON institution_staff TO authenticated;
GRANT ALL ON institution_staff TO anon;
GRANT ALL ON permissions TO authenticated;
GRANT ALL ON permissions TO anon;
GRANT ALL ON role_permissions TO authenticated;
GRANT ALL ON role_permissions TO anon;

-- Create user_permissions view
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
LEFT JOIN role_permissions rp ON u.role = rp.role
LEFT JOIN permissions p ON rp.permission_id = p.id;

-- Create institution_staff_permissions view
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

-- Create function to get user's full permissions
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

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
    ('view_own_profile', 'View own profile', 'profile', 'read'),
    ('update_own_profile', 'Update own profile', 'profile', 'write'),
    ('view_blood_requests', 'View blood requests', 'requests', 'read'),
    ('create_blood_requests', 'Create blood requests', 'requests', 'write'),
    ('respond_to_requests', 'Respond to blood requests', 'requests', 'write'),
    ('view_donation_history', 'View donation history', 'donations', 'read'),
    ('view_rewards', 'View rewards', 'rewards', 'read'),
    ('manage_inventory', 'Manage blood inventory', 'inventory', 'write'),
    ('emergency_access', 'Emergency access to all data', 'all', 'read')
ON CONFLICT (name) DO NOTHING;

-- Insert role permissions with conflict handling
WITH donor_permissions AS (
    SELECT id FROM permissions WHERE name IN (
        'view_own_profile',
        'update_own_profile',
        'view_blood_requests',
        'respond_to_requests',
        'view_donation_history',
        'view_rewards'
    )
)
INSERT INTO role_permissions (role, permission_id)
SELECT 'donor', id FROM donor_permissions
ON CONFLICT (role, permission_id) DO NOTHING;

WITH admin_permissions AS (
    SELECT id FROM permissions
)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM admin_permissions
ON CONFLICT (role, permission_id) DO NOTHING; 