-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own data
CREATE POLICY "Users can read their own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- Policy to allow users to update their own data
CREATE POLICY "Users can update their own data"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy to allow users to insert their own data
CREATE POLICY "Users can insert their own data"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy to allow service role to manage all users
CREATE POLICY "Service role can manage all users"
ON users
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy to allow admin role to manage all users
CREATE POLICY "Admin role can manage all users"
ON users
USING (auth.role() = 'admin')
WITH CHECK (auth.role() = 'admin'); 