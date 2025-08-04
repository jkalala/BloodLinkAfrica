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

-- Verify the changes
SELECT 
    id,
    email,
    phone,
    raw_user_meta_data,
    raw_app_meta_data,
    updated_at
FROM auth.users 
WHERE id = '747217d0-5cfc-4973-8fe9-5605db33a727'; 