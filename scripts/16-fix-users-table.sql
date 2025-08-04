-- Fix users table structure
-- This script ensures the users table has the correct structure and constraints

-- Drop and recreate users table
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    blood_type TEXT,
    location TEXT,
    allow_location BOOLEAN DEFAULT true,
    receive_alerts BOOLEAN DEFAULT true,
    available BOOLEAN DEFAULT true,
    points INTEGER DEFAULT 0,
    role TEXT NOT NULL,
    stakeholder_type TEXT NOT NULL,
    verification_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    emergency_access BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    permissions JSONB DEFAULT '{}',
    last_donation TIMESTAMPTZ,
    medical_conditions TEXT[],
    institution_id UUID REFERENCES institutions(id)
);

-- Create indexes
CREATE INDEX users_phone_idx ON users(phone);
CREATE INDEX users_role_idx ON users(role);
CREATE INDEX users_stakeholder_type_idx ON users(stakeholder_type);
CREATE INDEX users_verification_status_idx ON users(verification_status);
CREATE INDEX users_institution_id_idx ON users(institution_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS users_all_operations ON users;

-- Create a single permissive policy for development
CREATE POLICY users_all_operations ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant access to authenticated and anon users
GRANT ALL ON users TO authenticated;
GRANT ALL ON users TO anon;

-- Insert test data
INSERT INTO users (id, phone, name, blood_type, location, role, stakeholder_type)
VALUES 
('747217d0-5cfc-4973-8fe9-5605db33a727', '+244923668856', 'Real User', 'Unknown', 'Angola', 'donor', 'donor')
ON CONFLICT (id) DO UPDATE 
SET 
    phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    blood_type = EXCLUDED.blood_type,
    location = EXCLUDED.location,
    role = EXCLUDED.role,
    stakeholder_type = EXCLUDED.stakeholder_type; 