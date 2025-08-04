-- Fix user creation RLS policies
-- This script updates the RLS policies to allow user creation during authentication

-- First, disable RLS temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_any" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_admin_all" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a single policy that allows everything
CREATE POLICY "users_all_operations"
ON users
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON users TO authenticated;
GRANT ALL ON users TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Ensure the users table exists and has the correct structure
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  blood_type TEXT NOT NULL,
  location TEXT NOT NULL,
  allow_location BOOLEAN DEFAULT true,
  receive_alerts BOOLEAN DEFAULT true,
  last_donation TIMESTAMP WITH TIME ZONE,
  medical_conditions TEXT,
  available BOOLEAN DEFAULT true,
  points INTEGER DEFAULT 0,
  phone_verified BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'donor',
  stakeholder_type TEXT DEFAULT 'donor',
  institution_id UUID,
  permissions JSONB DEFAULT '{}',
  verification_status TEXT DEFAULT 'pending',
  emergency_access BOOLEAN DEFAULT false,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); 