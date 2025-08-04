-- Fix institutions table structure
-- This script ensures the institutions table has the correct structure and constraints

-- Drop existing table if it exists
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(type);
CREATE INDEX IF NOT EXISTS idx_institutions_verification_status ON institutions(verification_status);
CREATE INDEX IF NOT EXISTS idx_institutions_is_active ON institutions(is_active);

-- Enable RLS
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "institutions_all_operations" ON institutions;

-- Create a single policy that allows everything during development
CREATE POLICY "institutions_all_operations"
ON institutions
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
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