-- Update auth.users metadata
UPDATE auth.users
SET 
    email = '+244923668856@bloodlink.app',
    phone = '+244923668856',
    raw_user_meta_data = jsonb_build_object(
        'name', 'Real User',
        'blood_type', 'Unknown',
        'location', 'Angola',
        'phone', '+244923668856'
    ),
    raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']
    )
WHERE id = '747217d0-5cfc-4973-8fe9-5605db33a727'; 