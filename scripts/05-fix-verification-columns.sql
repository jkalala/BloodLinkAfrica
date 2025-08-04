-- Ensure phone_verified column exists with correct default value
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'phone_verified'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
    ELSE
        -- Update existing column to ensure it has the correct default
        ALTER TABLE users ALTER COLUMN phone_verified SET DEFAULT FALSE;
    END IF;

    -- Ensure role column exists with correct default value
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
    ELSE
        -- Update existing column to ensure it has the correct default
        ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
    END IF;
END
$$; 