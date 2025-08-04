-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_user_full_permissions;

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create role_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role, permission_id)
);

-- Enable RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS permissions_all_operations ON permissions;
DROP POLICY IF EXISTS role_permissions_all_operations ON role_permissions;

-- Create permissive policies for development
CREATE POLICY permissions_all_operations ON permissions
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY role_permissions_all_operations ON role_permissions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant access to authenticated and anon users
GRANT ALL ON permissions TO authenticated;
GRANT ALL ON permissions TO anon;
GRANT ALL ON role_permissions TO authenticated;
GRANT ALL ON role_permissions TO anon;

-- Insert base permissions
INSERT INTO permissions (id, name, description, resource, action) VALUES
    ('a2c3c0e6-14bf-4692-96de-63fa984279d8', 'view_own_profile', 'View own user profile', 'profile', 'view'),
    ('b3d4c1e7-25cf-4793-97ef-74fa985379d9', 'update_own_profile', 'Update own user profile', 'profile', 'update'),
    ('c4e5d2f8-36df-4894-98fe-85fb986479e0', 'view_blood_requests', 'View blood donation requests', 'blood_requests', 'view'),
    ('d5f6e3g9-47ef-4995-99fe-96fc097580f1', 'respond_to_requests', 'Respond to blood donation requests', 'blood_requests', 'respond'),
    ('e6f7f4h0-58ff-5096-90fe-07fd108681f2', 'view_donation_history', 'View donation history', 'donations', 'view'),
    ('f7f8f5i1-69ff-6197-91fe-18fe219782f3', 'view_rewards', 'View rewards and points', 'rewards', 'view')
ON CONFLICT (name) DO UPDATE 
SET 
    description = EXCLUDED.description,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action;

-- Insert role-permission mappings
INSERT INTO role_permissions (role, permission_id) VALUES
    ('donor', 'a2c3c0e6-14bf-4692-96de-63fa984279d8'),  -- view_own_profile
    ('donor', 'b3d4c1e7-25cf-4793-97ef-74fa985379d9'),  -- update_own_profile
    ('donor', 'c4e5d2f8-36df-4894-98fe-85fb986479e0'),  -- view_blood_requests
    ('donor', 'd5f6e3g9-47ef-4995-99fe-96fc097580f1'),  -- respond_to_requests
    ('donor', 'e6f7f4h0-58ff-5096-90fe-07fd108681f2'),  -- view_donation_history
    ('donor', 'f7f8f5i1-69ff-6197-91fe-18fe219782f3')   -- view_rewards
ON CONFLICT (role, permission_id) DO NOTHING;

-- Create the get_user_full_permissions function
CREATE OR REPLACE FUNCTION get_user_full_permissions(user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    resource TEXT,
    action TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.id,
        p.name,
        p.description,
        p.resource,
        p.action
    FROM users u
    JOIN role_permissions rp ON u.role = rp.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 