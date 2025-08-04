-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  blood_type TEXT NOT NULL,
  location TEXT NOT NULL,
  allow_location BOOLEAN DEFAULT TRUE,
  receive_alerts BOOLEAN DEFAULT TRUE,
  last_donation TEXT,
  medical_conditions TEXT,
  available BOOLEAN DEFAULT TRUE,
  points INTEGER DEFAULT 0
);

-- Create blood_requests table
CREATE TABLE IF NOT EXISTS blood_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  patient_name TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  blood_type TEXT NOT NULL,
  units_needed INTEGER NOT NULL,
  urgency TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  additional_info TEXT,
  status TEXT DEFAULT 'pending',
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

-- Create donations table
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id),
  request_id UUID REFERENCES blood_requests(id),
  donation_type TEXT NOT NULL,
  hospital TEXT NOT NULL,
  points_earned INTEGER DEFAULT 100,
  status TEXT DEFAULT 'completed'
);

-- Create blood_banks table
CREATE TABLE IF NOT EXISTS blood_banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  hours TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT DEFAULT 'Normal'
);

-- Create blood_inventory table
CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blood_bank_id UUID NOT NULL REFERENCES blood_banks(id),
  blood_type TEXT NOT NULL,
  status TEXT DEFAULT 'normal',
  quantity INTEGER DEFAULT 0
);

-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create user_rewards table
CREATE TABLE IF NOT EXISTS user_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id),
  reward_id UUID NOT NULL REFERENCES rewards(id),
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'redeemed'
);

-- Create donor_responses table
CREATE TABLE IF NOT EXISTS donor_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id),
  request_id UUID NOT NULL REFERENCES blood_requests(id),
  status TEXT NOT NULL,
  eta INTEGER
);
