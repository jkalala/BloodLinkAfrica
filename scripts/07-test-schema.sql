-- Test script to verify database schema
-- This script tests that all tables and columns exist correctly

-- Test 1: Check if all tables exist
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users',
  'blood_requests', 
  'donor_responses',
  'emergency_alerts',
  'notification_queue',
  'real_time_events'
);

-- Test 2: Check if all required columns exist in users table
SELECT 
  column_name,
  data_type,
  CASE WHEN column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
  'id',
  'phone',
  'name',
  'blood_type',
  'location',
  'allow_location',
  'receive_alerts',
  'available',
  'latitude',
  'longitude',
  'phone_verified'
);

-- Test 3: Check if all required columns exist in blood_requests table
SELECT 
  column_name,
  data_type,
  CASE WHEN column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.columns 
WHERE table_name = 'blood_requests' 
AND column_name IN (
  'id',
  'patient_name',
  'hospital_name',
  'blood_type',
  'units_needed',
  'urgency',
  'contact_name',
  'contact_phone',
  'status',
  'matched_donor_id',
  'matched_at',
  'expires_at',
  'response_count',
  'emergency_level',
  'escalation_count'
);

-- Test 4: Check if all required columns exist in donor_responses table
SELECT 
  column_name,
  data_type,
  CASE WHEN column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.columns 
WHERE table_name = 'donor_responses' 
AND column_name IN (
  'id',
  'donor_id',
  'request_id',
  'response_type',
  'eta_minutes',
  'notes',
  'status',
  'confirmed_at'
);

-- Test 5: Check if indexes exist
SELECT 
  indexname,
  tablename,
  CASE WHEN indexname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM pg_indexes 
WHERE tablename IN ('blood_requests', 'donor_responses', 'notification_queue')
AND indexname IN (
  'idx_blood_requests_status',
  'idx_blood_requests_emergency',
  'idx_blood_requests_expires',
  'idx_donor_responses_request',
  'idx_donor_responses_donor',
  'idx_notification_queue_status',
  'idx_notification_queue_user'
);

-- Test 6: Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables 
WHERE tablename IN ('blood_requests', 'donor_responses', 'notification_queue', 'emergency_alerts', 'real_time_events');

-- Test 7: Check if policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('blood_requests', 'donor_responses', 'notification_queue', 'emergency_alerts', 'real_time_events'); 