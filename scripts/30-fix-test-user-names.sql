-- Fix Test User names in the database
-- This script updates any "Test User" or "Real User" entries with more appropriate names

-- First, let's see what we have
SELECT 
  id, 
  name, 
  phone, 
  email,
  created_at
FROM user_profiles 
WHERE name IN ('Test User', 'Real User', 'New User')
ORDER BY created_at DESC;

-- Update Test Users to use phone-based names or email-based names
UPDATE user_profiles 
SET name = CASE 
  WHEN phone IS NOT NULL AND phone != '' THEN 
    'User ' || RIGHT(phone, 4)
  WHEN email IS NOT NULL AND email != '' THEN 
    SPLIT_PART(email, '@', 1)
  ELSE 
    'User'
END,
updated_at = NOW()
WHERE name IN ('Test User', 'Real User', 'New User');

-- Show the updated records
SELECT 
  id, 
  name, 
  phone, 
  email,
  updated_at
FROM user_profiles 
WHERE updated_at > NOW() - INTERVAL '1 minute'
ORDER BY updated_at DESC;

-- If you have specific real names for users, you can update them manually:
-- UPDATE user_profiles 
-- SET name = 'Your Real Name', updated_at = NOW()
-- WHERE phone = '+1234567890' OR email = 'your-email@example.com';