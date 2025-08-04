-- Phase 4 Database Schema
-- Mobile App, USSD, WhatsApp, Mobile Money Integration

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own transactions" ON mobile_money_transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON mobile_money_transactions;
DROP POLICY IF EXISTS "Users can view their own messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can view their own app data" ON mobile_app_users;
DROP POLICY IF EXISTS "Users can insert their own app data" ON mobile_app_users;
DROP POLICY IF EXISTS "Users can update their own app data" ON mobile_app_users;
DROP POLICY IF EXISTS "Users can view their own offline data" ON offline_data;
DROP POLICY IF EXISTS "Users can insert their own offline data" ON offline_data;
DROP POLICY IF EXISTS "Users can update their own offline data" ON offline_data;
DROP POLICY IF EXISTS "Users can view their own sessions" ON mobile_app_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON mobile_app_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON mobile_app_sessions;
DROP POLICY IF EXISTS "Users can view their own analytics" ON mobile_app_analytics;
DROP POLICY IF EXISTS "Users can insert their own analytics" ON mobile_app_analytics;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_mobile_money_transactions_updated_at ON mobile_money_transactions;
DROP TRIGGER IF EXISTS update_ussd_sessions_updated_at ON ussd_sessions;
DROP TRIGGER IF EXISTS update_mobile_app_users_updated_at ON mobile_app_users;
DROP TRIGGER IF EXISTS update_mobile_money_providers_updated_at ON mobile_money_providers;
DROP TRIGGER IF EXISTS update_ussd_menu_templates_updated_at ON ussd_menu_templates;
DROP TRIGGER IF EXISTS update_whatsapp_templates_updated_at ON whatsapp_templates;

-- Mobile Money Transactions Table
CREATE TABLE IF NOT EXISTS mobile_money_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    type VARCHAR(20) NOT NULL CHECK (type IN ('donation', 'reward', 'subscription', 'emergency')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('mpesa', 'airtel_money', 'mtn_momo', 'orange_money')),
    reference VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    transaction_id VARCHAR(100),
    callback_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USSD Sessions Table
CREATE TABLE IF NOT EXISTS ussd_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    service_code VARCHAR(10) NOT NULL,
    network_code VARCHAR(10),
    current_menu VARCHAR(50),
    session_data JSONB,
    step INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- WhatsApp Messages Table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(100) UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'template', 'interactive', 'media')),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    provider VARCHAR(20) DEFAULT 'whatsapp',
    reference_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Mobile App Users Table
CREATE TABLE IF NOT EXISTS mobile_app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id VARCHAR(100) UNIQUE,
    device_type VARCHAR(20) CHECK (device_type IN ('android', 'ios', 'web')),
    app_version VARCHAR(20),
    push_token VARCHAR(255),
    location_enabled BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offline Data Table
CREATE TABLE IF NOT EXISTS offline_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL,
    data_key VARCHAR(100) NOT NULL,
    data_value JSONB NOT NULL,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, data_type, data_key)
);

-- Mobile App Sessions Table
CREATE TABLE IF NOT EXISTS mobile_app_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mobile Money Providers Table
CREATE TABLE IF NOT EXISTS mobile_money_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    api_url TEXT NOT NULL,
    api_key TEXT,
    supported_countries TEXT[] NOT NULL,
    transaction_fees DECIMAL(5,4) DEFAULT 0.02,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USSD Menu Templates Table
CREATE TABLE IF NOT EXISTS ussd_menu_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    options JSONB,
    parent_menu_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Templates Table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    category VARCHAR(50),
    components JSONB NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_name, language)
);

-- Mobile App Analytics Table
CREATE TABLE IF NOT EXISTS mobile_app_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    screen_name VARCHAR(100),
    session_id VARCHAR(100),
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_phone ON mobile_money_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_status ON mobile_money_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_provider ON mobile_money_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_created ON mobile_money_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_ussd_sessions_session_id ON ussd_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone ON ussd_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_expires ON ussd_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_mobile_app_users_user_id ON mobile_app_users(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_app_users_device_id ON mobile_app_users(device_id);

CREATE INDEX IF NOT EXISTS idx_offline_data_user_type ON offline_data(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_offline_data_sync_status ON offline_data(sync_status);

CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_user ON mobile_app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_token ON mobile_app_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mobile_app_sessions_expires ON mobile_app_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_mobile_app_analytics_user ON mobile_app_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_app_analytics_event ON mobile_app_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_mobile_app_analytics_created ON mobile_app_analytics(created_at);

-- Enable Row Level Security
ALTER TABLE mobile_money_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ussd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_app_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mobile_money_transactions
CREATE POLICY "Users can view their own transactions" ON mobile_money_transactions
    FOR SELECT USING (phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own transactions" ON mobile_money_transactions
    FOR INSERT WITH CHECK (phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid()));

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users can view their own messages" ON whatsapp_messages
    FOR SELECT USING (phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own messages" ON whatsapp_messages
    FOR INSERT WITH CHECK (phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid()));

-- RLS Policies for mobile_app_users
CREATE POLICY "Users can view their own app data" ON mobile_app_users
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own app data" ON mobile_app_users
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own app data" ON mobile_app_users
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for offline_data
CREATE POLICY "Users can view their own offline data" ON offline_data
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own offline data" ON offline_data
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own offline data" ON offline_data
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for mobile_app_sessions
CREATE POLICY "Users can view their own sessions" ON mobile_app_sessions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sessions" ON mobile_app_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions" ON mobile_app_sessions
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for mobile_app_analytics
CREATE POLICY "Users can view their own analytics" ON mobile_app_analytics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own analytics" ON mobile_app_analytics
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Insert sample mobile money providers
INSERT INTO mobile_money_providers (name, code, api_url, supported_countries, transaction_fees)
SELECT 'M-Pesa', 'mpesa', 'https://sandbox.safaricom.co.ke', ARRAY['KE', 'TZ'], 0.01
WHERE NOT EXISTS (SELECT 1 FROM mobile_money_providers WHERE code = 'mpesa');

INSERT INTO mobile_money_providers (name, code, api_url, supported_countries, transaction_fees)
SELECT 'Airtel Money', 'airtel_money', 'https://openapiuat.airtel.africa', ARRAY['UG', 'TZ', 'NG', 'GH', 'ZM'], 0.015
WHERE NOT EXISTS (SELECT 1 FROM mobile_money_providers WHERE code = 'airtel_money');

INSERT INTO mobile_money_providers (name, code, api_url, supported_countries, transaction_fees)
SELECT 'MTN Mobile Money', 'mtn_momo', 'https://sandbox.momodeveloper.mtn.com', ARRAY['GH', 'UG', 'ZM', 'RW'], 0.02
WHERE NOT EXISTS (SELECT 1 FROM mobile_money_providers WHERE code = 'mtn_momo');

INSERT INTO mobile_money_providers (name, code, api_url, supported_countries, transaction_fees)
SELECT 'Orange Money', 'orange_money', 'https://api.orange.com', ARRAY['CI', 'SN', 'ML', 'BF'], 0.018
WHERE NOT EXISTS (SELECT 1 FROM mobile_money_providers WHERE code = 'orange_money');

-- Insert sample USSD menu templates
INSERT INTO ussd_menu_templates (menu_id, title, content, options)
SELECT 'main', 'BloodLink Africa', '1. Request Blood\n2. Donate Blood\n3. Check Status\n4. Emergency Alert\n5. My Profile\n6. Help', 
'{"1": "blood_request", "2": "donate_blood", "3": "check_status", "4": "emergency_alert", "5": "profile", "6": "help"}'
WHERE NOT EXISTS (SELECT 1 FROM ussd_menu_templates WHERE menu_id = 'main');

INSERT INTO ussd_menu_templates (menu_id, title, content, options)
SELECT 'blood_request', 'Blood Request', '1. A+ Blood\n2. A- Blood\n3. B+ Blood\n4. B- Blood\n5. AB+ Blood\n6. AB- Blood\n7. O+ Blood\n8. O- Blood',
'{"1": "A+", "2": "A-", "3": "B+", "4": "B-", "5": "AB+", "6": "AB-", "7": "O+", "8": "O-"}'
WHERE NOT EXISTS (SELECT 1 FROM ussd_menu_templates WHERE menu_id = 'blood_request');

INSERT INTO ussd_menu_templates (menu_id, title, content, options)
SELECT 'donate_blood', 'Donate Blood', '1. Available to Donate\n2. Not Available\n3. Schedule Donation\n4. Check Eligibility',
'{"1": "available", "2": "unavailable", "3": "schedule", "4": "eligibility"}'
WHERE NOT EXISTS (SELECT 1 FROM ussd_menu_templates WHERE menu_id = 'donate_blood');

INSERT INTO ussd_menu_templates (menu_id, title, content, options)
SELECT 'emergency_alert', 'Emergency Alert', '1. Critical Blood Need\n2. Natural Disaster\n3. Mass Casualty\n4. Hospital Emergency',
'{"1": "critical", "2": "disaster", "3": "mass_casualty", "4": "hospital"}'
WHERE NOT EXISTS (SELECT 1 FROM ussd_menu_templates WHERE menu_id = 'emergency_alert');

-- Insert sample WhatsApp templates
INSERT INTO whatsapp_templates (template_name, language, category, components, is_approved)
SELECT 'blood_request_alert', 'en', 'blood_request', 
'{"header": {"type": "text", "text": "🩸 Blood Request Alert"}, "body": {"text": "New blood request in your area!"}, "buttons": [{"type": "reply", "id": "accept", "title": "✅ Accept"}, {"type": "reply", "id": "decline", "title": "❌ Decline"}]}',
true
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE template_name = 'blood_request_alert' AND language = 'en');

INSERT INTO whatsapp_templates (template_name, language, category, components, is_approved)
SELECT 'emergency_alert', 'en', 'emergency',
'{"header": {"type": "text", "text": "🚨 EMERGENCY ALERT"}, "body": {"text": "URGENT blood request!"}, "buttons": [{"type": "reply", "id": "respond_now", "title": "🚨 RESPOND NOW"}]}',
true
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE template_name = 'emergency_alert' AND language = 'en');

INSERT INTO whatsapp_templates (template_name, language, category, components, is_approved)
SELECT 'donation_reminder', 'en', 'reminder',
'{"header": {"type": "text", "text": "🩸 Donation Reminder"}, "body": {"text": "Time to donate blood!"}, "buttons": [{"type": "reply", "id": "yes_donate", "title": "Yes, I can donate"}]}',
true
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE template_name = 'donation_reminder' AND language = 'en');

-- Create functions for mobile money processing
CREATE OR REPLACE FUNCTION process_mobile_money_payment(
    p_phone_number VARCHAR,
    p_amount DECIMAL,
    p_currency VARCHAR,
    p_type VARCHAR,
    p_provider VARCHAR,
    p_description TEXT
) RETURNS JSONB AS $$
DECLARE
    v_reference VARCHAR;
    v_transaction_id UUID;
    v_result JSONB;
BEGIN
    -- Generate unique reference
    v_reference := 'BL' || EXTRACT(EPOCH FROM NOW())::BIGINT || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 5);
    
    -- Insert transaction record
    INSERT INTO mobile_money_transactions (
        phone_number, amount, currency, type, provider, reference, description
    ) VALUES (
        p_phone_number, p_amount, p_currency, p_type, p_provider, v_reference, p_description
    ) RETURNING id INTO v_transaction_id;
    
    -- Return transaction details
    v_result := jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'reference', v_reference,
        'status', 'pending'
    );
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired USSD sessions
CREATE OR REPLACE FUNCTION cleanup_expired_ussd_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM ussd_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get mobile app statistics
CREATE OR REPLACE FUNCTION get_mobile_app_stats()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM mobile_app_users),
        'active_sessions', (SELECT COUNT(*) FROM mobile_app_sessions WHERE expires_at > NOW()),
        'total_transactions', (SELECT COUNT(*) FROM mobile_money_transactions),
        'completed_transactions', (SELECT COUNT(*) FROM mobile_money_transactions WHERE status = 'completed'),
        'total_amount', (SELECT COALESCE(SUM(amount), 0) FROM mobile_money_transactions WHERE status = 'completed'),
        'ussd_sessions', (SELECT COUNT(*) FROM ussd_sessions WHERE expires_at > NOW()),
        'whatsapp_messages', (SELECT COUNT(*) FROM whatsapp_messages WHERE created_at > NOW() - INTERVAL '24 hours')
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Note: Cron job scheduling requires pg_cron extension
-- To enable: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Then run: SELECT cron.schedule('cleanup-expired-ussd-sessions', '0 * * * *', 'SELECT cleanup_expired_ussd_sessions();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create views for easier querying
CREATE OR REPLACE VIEW mobile_money_summary AS
SELECT 
    provider,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_amount,
    AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as average_amount
FROM mobile_money_transactions
GROUP BY provider;

CREATE OR REPLACE VIEW whatsapp_message_summary AS
SELECT 
    type,
    direction,
    status,
    COUNT(*) as message_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as messages_24h
FROM whatsapp_messages
GROUP BY type, direction, status;

-- Add triggers for updated_at timestamps
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $BODY$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $BODY$ LANGUAGE plpgsql;
    END IF;
END $$;

-- Create triggers if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mobile_money_transactions_updated_at') THEN
        CREATE TRIGGER update_mobile_money_transactions_updated_at
            BEFORE UPDATE ON mobile_money_transactions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ussd_sessions_updated_at') THEN
        CREATE TRIGGER update_ussd_sessions_updated_at
            BEFORE UPDATE ON ussd_sessions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mobile_app_users_updated_at') THEN
        CREATE TRIGGER update_mobile_app_users_updated_at
            BEFORE UPDATE ON mobile_app_users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mobile_money_providers_updated_at') THEN
        CREATE TRIGGER update_mobile_money_providers_updated_at
            BEFORE UPDATE ON mobile_money_providers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ussd_menu_templates_updated_at') THEN
        CREATE TRIGGER update_ussd_menu_templates_updated_at
            BEFORE UPDATE ON ussd_menu_templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_whatsapp_templates_updated_at') THEN
        CREATE TRIGGER update_whatsapp_templates_updated_at
            BEFORE UPDATE ON whatsapp_templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$; 