-- Create blood_banks table if it doesn't exist
CREATE TABLE IF NOT EXISTS blood_banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  operating_hours TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Insert sample blood banks
INSERT INTO blood_banks (name, location, address, phone, email, operating_hours)
VALUES
  ('Nairobi Blood Center', 'Nairobi', '123 Hospital Road, Nairobi', '+254123456789', 'nairobi@bloodlink.com', 'Mon-Fri: 9AM-5PM, Sat: 10AM-2PM'),
  ('Mombasa Blood Bank', 'Mombasa', '456 Beach Avenue, Mombasa', '+254987654321', 'mombasa@bloodlink.com', 'Mon-Fri: 8AM-4PM, Sat: 9AM-1PM'),
  ('Kisumu Donation Center', 'Kisumu', '789 Lake Street, Kisumu', '+254567891234', 'kisumu@bloodlink.com', 'Mon-Fri: 9AM-5PM'),
  ('Nakuru Regional Blood Bank', 'Nakuru', '321 Central Road, Nakuru', '+254432156789', 'nakuru@bloodlink.com', 'Mon-Fri: 8:30AM-4:30PM, Sat: 10AM-2PM'),
  ('Eldoret Blood Donation Facility', 'Eldoret', '654 Highland Avenue, Eldoret', '+254789123456', 'eldoret@bloodlink.com', 'Mon-Fri: 9AM-5PM, Sat: 9AM-12PM');
