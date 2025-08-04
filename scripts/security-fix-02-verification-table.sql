-- Security Fix 02: Create secure verification_codes table
-- This replaces the insecure in-memory verification store

-- Create verification_codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL,
  code_hash text NOT NULL, -- Hashed verification code (never store plaintext)
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address inet,
  user_agent text,
  
  -- Constraints
  CONSTRAINT valid_phone_number CHECK (phone_number ~ '^\+[1-9]\d{1,14}$'),
  CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= 10),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_created_at ON verification_codes(created_at);

-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can manage verification codes
CREATE POLICY "verification_codes_service_only" ON verification_codes
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM verification_codes 
  WHERE expires_at < now();
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO service_role;

-- Add verification salt to environment variables (should be set in .env)
-- VERIFICATION_SALT should be a long, random string unique to your application

-- Add comments for documentation
COMMENT ON TABLE verification_codes IS 'Secure storage for phone verification codes with rate limiting and expiry';
COMMENT ON COLUMN verification_codes.code_hash IS 'PBKDF2 hash of verification code - never store plaintext';
COMMENT ON COLUMN verification_codes.attempts IS 'Number of failed verification attempts - blocks after 5 attempts';
COMMENT ON COLUMN verification_codes.ip_address IS 'IP address for rate limiting and audit trail';
COMMENT ON COLUMN verification_codes.user_agent IS 'User agent for security monitoring';

-- Update .env.example to include VERIFICATION_SALT
-- VERIFICATION_SALT=your-long-random-salt-string-change-in-production