-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_user_full_permissions;

-- Create the function in the public schema with a simpler return type
CREATE OR REPLACE FUNCTION public.get_user_full_permissions(user_id UUID)
RETURNS SETOF permissions AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Get the user's role first
    SELECT role INTO user_role
    FROM public.users
    WHERE users.id = user_id;

    IF user_role IS NULL THEN
        RAISE NOTICE 'No user found with ID %', user_id;
        RETURN;
    END IF;

    RAISE NOTICE 'Found user with role: %', user_role;

    -- Return permissions for the user's role
    RETURN QUERY
    SELECT DISTINCT p.*
    FROM public.permissions p
    JOIN public.role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role = user_role;

    -- Log the number of permissions found
    RAISE NOTICE 'Query completed for user %', user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_user_full_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_full_permissions(UUID) TO anon;

-- Test the function with a specific user
DO $$
DECLARE
    test_user_id UUID := '747217d0-5cfc-4973-8fe9-5605db33a727';
    user_role TEXT;
    perm_count INT;
BEGIN
    -- Check if user exists and get role
    SELECT role INTO user_role
    FROM public.users
    WHERE id = test_user_id;

    RAISE NOTICE 'Test user role: %', user_role;

    -- Count permissions for the role
    SELECT COUNT(*) INTO perm_count
    FROM public.role_permissions
    WHERE role = user_role;

    RAISE NOTICE 'Number of permissions for role %: %', user_role, perm_count;

    -- Test the function
    RAISE NOTICE 'Testing get_user_full_permissions...';
    PERFORM * FROM public.get_user_full_permissions(test_user_id);
END;
$$;

-- Verify tables and data
SELECT 'users' as table_name, COUNT(*) as count FROM public.users
UNION ALL
SELECT 'permissions' as table_name, COUNT(*) as count FROM public.permissions
UNION ALL
SELECT 'role_permissions' as table_name, COUNT(*) as count FROM public.role_permissions; 