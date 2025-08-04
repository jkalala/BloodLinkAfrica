-- Update user profile with correct information
UPDATE users 
SET 
    phone = '+244923668856',
    name = 'Real User',  -- You can replace this with your actual name
    blood_type = 'Unknown',  -- You can update this if you know your blood type
    location = 'Angola',
    allow_location = true,
    receive_alerts = true,
    available = true,
    points = 0,
    role = 'donor',
    stakeholder_type = 'donor',
    verification_status = 'pending',
    emergency_access = false,
    phone_verified = false,
    permissions = '{}'
WHERE id = '747217d0-5cfc-4973-8fe9-5605db33a727';

-- Update role permissions for the user
WITH user_base_permissions AS (
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
SELECT 'donor', id FROM user_base_permissions
ON CONFLICT (role, permission_id) DO NOTHING; 