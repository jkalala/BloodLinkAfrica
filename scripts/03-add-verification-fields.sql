-- Add phone_verified field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add admin role field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create admin users view for easier admin management
CREATE OR REPLACE VIEW admin_users AS
SELECT * FROM users WHERE role = 'admin';
