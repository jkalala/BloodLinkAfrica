-- First, check if the blood_banks table exists and add the location column if needed
DO $$
BEGIN
    -- Check if the table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blood_banks') THEN
        -- Check if the location column exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'blood_banks' 
            AND column_name = 'location'
        ) THEN
            -- Add the location column if it doesn't exist
            ALTER TABLE blood_banks ADD COLUMN location TEXT;
        END IF;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE blood_banks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            location TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            operating_hours TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END
$$;

-- Create donation_appointments table if it doesn't exist
CREATE TABLE IF NOT EXISTS donation_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_bank_id UUID REFERENCES blood_banks(id) ON DELETE CASCADE,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  donation_type TEXT NOT NULL DEFAULT 'whole_blood',
  status TEXT NOT NULL DEFAULT 'confirmed',
  blood_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Now insert the data, but first check if we already have these blood banks
DO $$
BEGIN
    -- Only insert if the table is empty
    IF NOT EXISTS (SELECT 1 FROM blood_banks LIMIT 1) THEN
        INSERT INTO blood_banks (name, location, address, phone, email, operating_hours)
        VALUES
            ('Nairobi Blood Center', 'Nairobi', '123 Hospital Road, Nairobi', '+254123456789', 'nairobi@bloodlink.com', 'Mon-Fri: 9AM-5PM, Sat: 10AM-2PM'),
            ('Mombasa Blood Bank', 'Mombasa', '456 Beach Avenue, Mombasa', '+254987654321', 'mombasa@bloodlink.com', 'Mon-Fri: 8AM-4PM, Sat: 9AM-1PM'),
            ('Kisumu Donation Center', 'Kisumu', '789 Lake Street, Kisumu', '+254567891234', 'kisumu@bloodlink.com', 'Mon-Fri: 9AM-5PM'),
            ('Nakuru Regional Blood Bank', 'Nakuru', '321 Central Road, Nakuru', '+254432156789', 'nakuru@bloodlink.com', 'Mon-Fri: 8:30AM-4:30PM, Sat: 10AM-2PM'),
            ('Eldoret Blood Donation Facility', 'Eldoret', '654 Highland Avenue, Eldoret', '+254789123456', 'eldoret@bloodlink.com', 'Mon-Fri: 9AM-5PM, Sat: 9AM-12PM');
    END IF;
END
$$;
