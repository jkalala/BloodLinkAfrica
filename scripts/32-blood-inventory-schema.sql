/**
 * Blood Inventory Management Database Schema
 * Comprehensive system for tracking blood units, inventory, and alerts
 */

-- Drop existing tables if they exist (in dependency order)
DROP TABLE IF EXISTS inventory_alerts CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS blood_units CASCADE;
DROP TABLE IF EXISTS blood_inventory CASCADE;
DROP TABLE IF EXISTS storage_locations CASCADE;

-- Create storage locations table
CREATE TABLE storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blood_bank_id UUID REFERENCES blood_banks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('refrigerator', 'freezer', 'room_temperature', 'transport')),
    capacity INTEGER NOT NULL DEFAULT 100,
    current_occupancy INTEGER NOT NULL DEFAULT 0,
    temperature_current DECIMAL(5,2),
    temperature_min DECIMAL(5,2),
    temperature_max DECIMAL(5,2),
    temperature_optimal DECIMAL(5,2),
    humidity_current DECIMAL(5,2),
    humidity_optimal DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    last_maintenance TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    alerts TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blood inventory summary table
CREATE TABLE blood_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blood_bank_id UUID REFERENCES blood_banks(id) ON DELETE CASCADE,
    blood_type VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'normal' CHECK (status IN ('normal', 'low', 'critical', 'emergency')),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(blood_bank_id, blood_type)
);

-- Create blood units table
CREATE TABLE blood_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    blood_bank_id UUID REFERENCES blood_banks(id) ON DELETE CASCADE,
    storage_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
    blood_type VARCHAR(10) NOT NULL,
    volume INTEGER NOT NULL, -- in mL
    collection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used', 'expired', 'quarantine', 'testing', 'disposed')),
    location VARCHAR(255),
    storage_temperature DECIMAL(5,2),
    storage_humidity DECIMAL(5,2),
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    batch_number VARCHAR(100) NOT NULL,
    test_results JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    reserved_for_request UUID REFERENCES blood_requests(id) ON DELETE SET NULL,
    reserved_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure blood type is valid
    CONSTRAINT valid_blood_type CHECK (blood_type IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'))
);

-- Create inventory transactions table for audit trail
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('collection', 'reservation', 'usage', 'disposal', 'transfer', 'testing', 'quality_check', 'expiry')),
    blood_units UUID[] NOT NULL,
    quantity INTEGER NOT NULL,
    blood_type VARCHAR(10),
    blood_bank_id UUID REFERENCES blood_banks(id) ON DELETE SET NULL,
    request_id UUID REFERENCES blood_requests(id) ON DELETE SET NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Create inventory alerts table
CREATE TABLE inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blood_bank_id UUID REFERENCES blood_banks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('low_stock', 'expiry_warning', 'critical_shortage', 'temperature_alert', 'quality_issue')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    blood_type VARCHAR(10),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for faster queries
    INDEX (blood_bank_id, resolved, created_at),
    INDEX (severity, resolved),
    INDEX (type, blood_type)
);

-- Create indexes for better performance
CREATE INDEX idx_blood_units_blood_type ON blood_units(blood_type);
CREATE INDEX idx_blood_units_status ON blood_units(status);
CREATE INDEX idx_blood_units_expiry ON blood_units(expiry_date) WHERE status = 'available';
CREATE INDEX idx_blood_units_blood_bank ON blood_units(blood_bank_id);
CREATE INDEX idx_blood_units_donor ON blood_units(donor_id);
CREATE INDEX idx_blood_units_reserved ON blood_units(reserved_for_request) WHERE reserved_for_request IS NOT NULL;

CREATE INDEX idx_blood_inventory_blood_bank ON blood_inventory(blood_bank_id);
CREATE INDEX idx_blood_inventory_type ON blood_inventory(blood_type);
CREATE INDEX idx_blood_inventory_status ON blood_inventory(status);

CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(type);
CREATE INDEX idx_inventory_transactions_blood_bank ON inventory_transactions(blood_bank_id);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(performed_at);

CREATE INDEX idx_storage_locations_blood_bank ON storage_locations(blood_bank_id);
CREATE INDEX idx_storage_locations_type ON storage_locations(type);
CREATE INDEX idx_storage_locations_active ON storage_locations(is_active);

-- Create trigger to update blood_inventory when blood_units change
CREATE OR REPLACE FUNCTION update_blood_inventory()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        INSERT INTO blood_inventory (blood_bank_id, blood_type, quantity)
        VALUES (NEW.blood_bank_id, NEW.blood_type, 1)
        ON CONFLICT (blood_bank_id, blood_type)
        DO UPDATE SET 
            quantity = blood_inventory.quantity + 1,
            last_updated = NOW();
        RETURN NEW;
    END IF;

    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- If status changed from/to available, update quantities
        IF OLD.status != NEW.status THEN
            -- Decrease count for old status
            IF OLD.status = 'available' THEN
                UPDATE blood_inventory 
                SET quantity = quantity - 1, last_updated = NOW()
                WHERE blood_bank_id = OLD.blood_bank_id AND blood_type = OLD.blood_type;
            ELSIF OLD.status = 'reserved' THEN
                UPDATE blood_inventory 
                SET reserved_quantity = reserved_quantity - 1, last_updated = NOW()
                WHERE blood_bank_id = OLD.blood_bank_id AND blood_type = OLD.blood_type;
            END IF;

            -- Increase count for new status
            IF NEW.status = 'available' THEN
                UPDATE blood_inventory 
                SET quantity = quantity + 1, last_updated = NOW()
                WHERE blood_bank_id = NEW.blood_bank_id AND blood_type = NEW.blood_type;
            ELSIF NEW.status = 'reserved' THEN
                UPDATE blood_inventory 
                SET reserved_quantity = reserved_quantity + 1, last_updated = NOW()
                WHERE blood_bank_id = NEW.blood_bank_id AND blood_type = NEW.blood_type;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'available' THEN
            UPDATE blood_inventory 
            SET quantity = quantity - 1, last_updated = NOW()
            WHERE blood_bank_id = OLD.blood_bank_id AND blood_type = OLD.blood_type;
        ELSIF OLD.status = 'reserved' THEN
            UPDATE blood_inventory 
            SET reserved_quantity = reserved_quantity - 1, last_updated = NOW()
            WHERE blood_bank_id = OLD.blood_bank_id AND blood_type = OLD.blood_type;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER blood_units_inventory_trigger
    AFTER INSERT OR UPDATE OR DELETE ON blood_units
    FOR EACH ROW
    EXECUTE FUNCTION update_blood_inventory();

-- Create function to calculate inventory status
CREATE OR REPLACE FUNCTION calculate_inventory_status(p_blood_bank_id UUID, p_blood_type VARCHAR(10))
RETURNS VARCHAR(50) AS $$
DECLARE
    v_quantity INTEGER;
    v_status VARCHAR(50);
BEGIN
    SELECT quantity INTO v_quantity
    FROM blood_inventory
    WHERE blood_bank_id = p_blood_bank_id AND blood_type = p_blood_type;

    IF v_quantity IS NULL OR v_quantity = 0 THEN
        v_status := 'emergency';
    ELSIF v_quantity <= 2 THEN
        v_status := 'critical';
    ELSIF v_quantity <= 5 THEN
        v_status := 'low';
    ELSE
        v_status := 'normal';
    END IF;

    -- Update the status
    UPDATE blood_inventory 
    SET status = v_status, last_updated = NOW()
    WHERE blood_bank_id = p_blood_bank_id AND blood_type = p_blood_type;

    RETURN v_status;
END;
$$ LANGUAGE plpgsql;

-- Create function to get inventory statistics
CREATE OR REPLACE FUNCTION get_inventory_stats(p_blood_bank_id UUID DEFAULT NULL)
RETURNS TABLE(
    total_units BIGINT,
    available_units BIGINT,
    reserved_units BIGINT,
    expiring_soon BIGINT,
    blood_type_stats JSONB,
    quality_stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH unit_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'available') as available,
            COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
            COUNT(*) FILTER (WHERE status = 'available' AND expiry_date <= NOW() + INTERVAL '7 days') as expiring,
            jsonb_object_agg(
                blood_type,
                jsonb_build_object(
                    'total', COUNT(*),
                    'available', COUNT(*) FILTER (WHERE status = 'available'),
                    'reserved', COUNT(*) FILTER (WHERE status = 'reserved'),
                    'expiring', COUNT(*) FILTER (WHERE status = 'available' AND expiry_date <= NOW() + INTERVAL '7 days')
                )
            ) as type_stats,
            jsonb_build_object(
                'average_quality', COALESCE(AVG(quality_score), 0),
                'units_in_testing', COUNT(*) FILTER (WHERE status = 'testing'),
                'quality_issues', COUNT(*) FILTER (WHERE quality_score < 80)
            ) as quality_stats
        FROM blood_units
        WHERE (p_blood_bank_id IS NULL OR blood_bank_id = p_blood_bank_id)
    )
    SELECT 
        total::BIGINT,
        available::BIGINT,
        reserved::BIGINT,
        expiring::BIGINT,
        type_stats,
        quality_stats
    FROM unit_stats;
END;
$$ LANGUAGE plpgsql;

-- Insert sample storage locations
INSERT INTO storage_locations (blood_bank_id, name, type, capacity, temperature_optimal, humidity_optimal) 
SELECT 
    bb.id,
    'Main ' || type || ' Storage',
    type,
    CASE 
        WHEN type = 'refrigerator' THEN 500
        WHEN type = 'freezer' THEN 200
        ELSE 100
    END,
    CASE 
        WHEN type = 'refrigerator' THEN 4.0
        WHEN type = 'freezer' THEN -18.0
        ELSE 20.0
    END,
    45.0
FROM blood_banks bb
CROSS JOIN (VALUES ('refrigerator'), ('freezer'), ('room_temperature')) AS storage_types(type)
WHERE bb.id IS NOT NULL
LIMIT 30; -- Limit to avoid too many inserts

-- Initialize blood inventory for all blood banks
INSERT INTO blood_inventory (blood_bank_id, blood_type, quantity)
SELECT 
    bb.id,
    bt.blood_type,
    FLOOR(RANDOM() * 20 + 5)::INTEGER -- Random quantity between 5-24
FROM blood_banks bb
CROSS JOIN (VALUES ('O+'), ('O-'), ('A+'), ('A-'), ('B+'), ('B-'), ('AB+'), ('AB-')) AS bt(blood_type)
WHERE bb.id IS NOT NULL
ON CONFLICT (blood_bank_id, blood_type) DO NOTHING;

-- Insert sample blood units
INSERT INTO blood_units (
    donor_id, 
    blood_bank_id, 
    blood_type, 
    volume, 
    collection_date, 
    expiry_date, 
    status,
    location,
    quality_score,
    batch_number,
    test_results,
    metadata
)
SELECT 
    u.id,
    bb.id,
    u.blood_type,
    450, -- Standard blood donation volume
    NOW() - (RANDOM() * INTERVAL '30 days'),
    NOW() + (RANDOM() * INTERVAL '35 days' + INTERVAL '7 days'), -- 7-42 days from now
    CASE 
        WHEN RANDOM() > 0.8 THEN 'reserved'
        WHEN RANDOM() > 0.95 THEN 'testing'
        ELSE 'available'
    END,
    'Main Storage',
    FLOOR(RANDOM() * 20 + 80)::INTEGER, -- Quality score 80-100
    'BATCH-' || LPAD((ROW_NUMBER() OVER())::TEXT, 6, '0'),
    jsonb_build_object(
        'hiv', 'negative',
        'hepatitisB', 'negative', 
        'hepatitisC', 'negative',
        'syphilis', 'negative',
        'completedAt', NOW()::TEXT
    ),
    jsonb_build_object(
        'collectionCenter', bb.name,
        'processingStaff', 'Staff-' || FLOOR(RANDOM() * 10 + 1)::TEXT,
        'notes', 'Standard collection and processing'
    )
FROM users u
CROSS JOIN blood_banks bb
WHERE u.role = 'donor' 
    AND u.blood_type IS NOT NULL
    AND RANDOM() > 0.7 -- Only 30% of donors have blood units
LIMIT 500; -- Limit total blood units

-- Create some sample alerts
INSERT INTO inventory_alerts (blood_bank_id, type, severity, blood_type, message, details)
SELECT 
    bb.id,
    CASE 
        WHEN bi.quantity <= 2 THEN 'critical_shortage'
        WHEN bi.quantity <= 5 THEN 'low_stock'
        ELSE 'expiry_warning'
    END,
    CASE 
        WHEN bi.quantity <= 2 THEN 'critical'
        WHEN bi.quantity <= 5 THEN 'high'
        ELSE 'medium'
    END,
    bi.blood_type,
    CASE 
        WHEN bi.quantity <= 2 THEN 'Critical shortage: Only ' || bi.quantity || ' ' || bi.blood_type || ' units remaining'
        WHEN bi.quantity <= 5 THEN 'Low stock warning: ' || bi.quantity || ' ' || bi.blood_type || ' units remaining'
        ELSE 'Units expiring within 7 days for ' || bi.blood_type
    END,
    jsonb_build_object(
        'currentStock', bi.quantity,
        'threshold', CASE WHEN bi.quantity <= 2 THEN 2 ELSE 5 END
    )
FROM blood_inventory bi
JOIN blood_banks bb ON bi.blood_bank_id = bb.id
WHERE bi.quantity <= 5 OR RANDOM() > 0.8
LIMIT 50;

-- Enable RLS
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view storage locations of their blood bank" ON storage_locations
    FOR SELECT USING (
        blood_bank_id IN (
            SELECT blood_bank_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view inventory of their blood bank" ON blood_inventory
    FOR SELECT USING (
        blood_bank_id IN (
            SELECT blood_bank_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view blood units of their blood bank" ON blood_units
    FOR SELECT USING (
        blood_bank_id IN (
            SELECT blood_bank_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Blood bank staff can manage blood units" ON blood_units
    FOR ALL USING (
        blood_bank_id IN (
            SELECT blood_bank_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('blood_bank_staff', 'blood_bank_admin')
        )
    );

CREATE POLICY "Users can view inventory transactions" ON inventory_transactions
    FOR SELECT USING (
        blood_bank_id IN (
            SELECT blood_bank_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view inventory alerts" ON inventory_alerts
    FOR SELECT USING (
        blood_bank_id IN (
            SELECT blood_bank_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON blood_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON blood_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_alerts TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE storage_locations IS 'Physical storage locations for blood units with environmental monitoring';
COMMENT ON TABLE blood_inventory IS 'Summary inventory levels by blood type per blood bank';
COMMENT ON TABLE blood_units IS 'Individual blood units with full lifecycle tracking';
COMMENT ON TABLE inventory_transactions IS 'Audit trail for all inventory operations';
COMMENT ON TABLE inventory_alerts IS 'Automated alerts for inventory management';

COMMENT ON FUNCTION update_blood_inventory() IS 'Automatically updates inventory summary when blood units change';
COMMENT ON FUNCTION calculate_inventory_status(UUID, VARCHAR) IS 'Calculates and updates inventory status based on quantity thresholds';
COMMENT ON FUNCTION get_inventory_stats(UUID) IS 'Returns comprehensive inventory statistics for dashboard reporting';

-- Success message
SELECT 'Blood Inventory Management schema created successfully! 🩸📦' as status;