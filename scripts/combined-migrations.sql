-- Combined migrations for fixing user creation and authentication

-- Drop existing tables if they exist
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

-- Create institutions table with correct structure
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('hospital', 'blood_bank', 'government_agency', 'emergency_service')),
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    contact_person TEXT,
    verification_status TEXT DEFAULT 'pending',
    operating_hours JSONB,
    services JSONB,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT true,
    emergency_contact TEXT,
    capacity INTEGER,
    specialties TEXT[]
);

-- Create users table with correct structure
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    blood_type TEXT NOT NULL DEFAULT 'Unknown',
    location TEXT NOT NULL DEFAULT 'Unknown',
    allow_location BOOLEAN DEFAULT true,
    receive_alerts BOOLEAN DEFAULT true,
    last_donation TIMESTAMP WITH TIME ZONE,
    medical_conditions TEXT,
    available BOOLEAN DEFAULT true,
    points INTEGER DEFAULT 0,
    phone_verified BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'donor',
    stakeholder_type TEXT DEFAULT 'donor',
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    permissions JSONB DEFAULT '{}',
    verification_status TEXT DEFAULT 'pending',
    emergency_access BOOLEAN DEFAULT false,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_stakeholder_type ON users(stakeholder_type);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);

CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(type);
CREATE INDEX IF NOT EXISTS idx_institutions_verification_status ON institutions(verification_status);
CREATE INDEX IF NOT EXISTS idx_institutions_is_active ON institutions(is_active);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "users_all_operations" ON users;
DROP POLICY IF EXISTS "institutions_all_operations" ON institutions;

-- Create a single policy that allows everything during development
CREATE POLICY "users_all_operations"
ON users
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "institutions_all_operations"
ON institutions
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON users TO authenticated;
GRANT ALL ON users TO anon;
GRANT ALL ON institutions TO authenticated;
GRANT ALL ON institutions TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Insert test data
INSERT INTO institutions (name, type, address, phone, email, contact_person, verification_status)
VALUES 
    ('Nairobi General Hospital', 'hospital', 'Nairobi, Kenya', '+254700123456', 'info@nairobi-hospital.com', 'Dr. Sarah Johnson', 'verified'),
    ('Kenya Blood Bank', 'blood_bank', 'Nairobi, Kenya', '+254700123457', 'info@kenya-blood-bank.com', 'Dr. Michael Chen', 'verified'),
    ('Emergency Medical Services', 'emergency_service', 'Nairobi, Kenya', '+254700123458', 'emergency@ems-kenya.com', 'Captain David Ochieng', 'verified'),
    ('Ministry of Health Kenya', 'government_agency', 'Nairobi, Kenya', '+254700123459', 'info@health.go.ke', 'Dr. Jane Wanjiku', 'verified');

-- Insert test user
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