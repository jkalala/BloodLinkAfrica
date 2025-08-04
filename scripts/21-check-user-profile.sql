-- Check current user profile
SELECT 
    u.id,
    u.name,
    u.phone,
    u.role,
    u.stakeholder_type,
    au.raw_user_meta_data,
    au.raw_app_meta_data,
    au.email,
    au.phone as auth_phone
FROM users u
JOIN auth.users au ON au.id = u.id
WHERE u.id = '747217d0-5cfc-4973-8fe9-5605db33a727';

-- Update user profile with correct information
UPDATE users 
SET 
    name = 'Real User',
    phone = '+244923668856',
    blood_type = 'Unknown',
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

-- Update auth user metadata
UPDATE auth.users
SET 
    raw_user_meta_data = jsonb_build_object(
        'name', 'Real User',
        'blood_type', 'Unknown',
        'location', 'Angola',
        'phone', '+244923668856'
    ),
    raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']
    ),
    email = '+244923668856@bloodlink.app',
    phone = '+244923668856',
    updated_at = NOW()
WHERE id = '747217d0-5cfc-4973-8fe9-5605db33a727'; 