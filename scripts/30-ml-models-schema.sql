-- Machine Learning Models Schema
-- This script creates tables for storing ML models and training data

-- Create ML models table
CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('donor_matching', 'response_prediction', 'success_prediction')),
  weights DECIMAL[] NOT NULL,
  bias DECIMAL NOT NULL DEFAULT 0,
  accuracy DECIMAL NOT NULL DEFAULT 0 CHECK (accuracy >= 0 AND accuracy <= 1),
  last_trained TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  training_data_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'training', 'deprecated')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create ML training logs table
CREATE TABLE IF NOT EXISTS ml_training_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_type TEXT NOT NULL,
  training_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  training_end TIMESTAMP WITH TIME ZONE,
  training_duration INTEGER, -- in seconds
  data_count INTEGER NOT NULL,
  accuracy DECIMAL,
  loss DECIMAL,
  epochs INTEGER DEFAULT 1000,
  learning_rate DECIMAL DEFAULT 0.01,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  metrics JSONB DEFAULT '{}'::jsonb
);

-- Create ML predictions table for tracking and evaluation
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_type TEXT NOT NULL,
  model_version INTEGER NOT NULL DEFAULT 1,
  donor_id UUID REFERENCES users(id),
  request_id UUID REFERENCES blood_requests(id),
  prediction_value DECIMAL NOT NULL,
  confidence DECIMAL NOT NULL DEFAULT 0,
  features JSONB NOT NULL,
  feature_importance JSONB,
  explanation TEXT,
  actual_outcome BOOLEAN, -- null until outcome is known
  prediction_accuracy DECIMAL, -- calculated after outcome
  response_time_actual INTEGER, -- actual response time in minutes
  prediction_error DECIMAL -- difference between predicted and actual
);

-- Create ML feature store table
CREATE TABLE IF NOT EXISTS ml_feature_store (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('donor', 'request', 'match')),
  entity_id UUID NOT NULL,
  feature_name TEXT NOT NULL,
  feature_value DECIMAL NOT NULL,
  feature_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  computation_version TEXT DEFAULT 'v1',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create donor profiles enhanced for ML
ALTER TABLE users ADD COLUMN IF NOT EXISTS response_rate DECIMAL DEFAULT 0.5 CHECK (response_rate >= 0 AND response_rate <= 1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS success_rate DECIMAL DEFAULT 0.5 CHECK (success_rate >= 0 AND success_rate <= 1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_response_time INTEGER DEFAULT 30; -- in minutes
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_donations INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS preference_urgency TEXT[] DEFAULT ARRAY['normal'];
ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_score DECIMAL DEFAULT 0.5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add response time tracking to donor_responses
ALTER TABLE donor_responses ADD COLUMN IF NOT EXISTS response_time INTEGER; -- in minutes
ALTER TABLE donor_responses ADD COLUMN IF NOT EXISTS success_prediction DECIMAL;
ALTER TABLE donor_responses ADD COLUMN IF NOT EXISTS ml_confidence DECIMAL;

-- Create indexes for ML performance
CREATE INDEX IF NOT EXISTS idx_ml_models_type ON ml_models(type);
CREATE INDEX IF NOT EXISTS idx_ml_models_status ON ml_models(status);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model ON ml_predictions(model_type, model_version);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_donor ON ml_predictions(donor_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_request ON ml_predictions(request_id);
CREATE INDEX IF NOT EXISTS idx_ml_feature_store_entity ON ml_feature_store(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ml_feature_store_feature ON ml_feature_store(feature_name);
CREATE INDEX IF NOT EXISTS idx_users_ml_score ON users(ml_score);
CREATE INDEX IF NOT EXISTS idx_users_response_rate ON users(response_rate);
CREATE INDEX IF NOT EXISTS idx_users_success_rate ON users(success_rate);

-- Create function to update ML features automatically
CREATE OR REPLACE FUNCTION update_donor_ml_features()
RETURNS TRIGGER AS $$
DECLARE
  donor_response_count INTEGER;
  donor_success_count INTEGER;
  donor_avg_response INTEGER;
  donor_response_rate DECIMAL;
  donor_success_rate DECIMAL;
BEGIN
  -- Calculate response rate
  SELECT COUNT(*) INTO donor_response_count
  FROM donor_responses dr
  WHERE dr.user_id = NEW.user_id;

  -- Calculate success rate (accepted responses)
  SELECT COUNT(*) INTO donor_success_count
  FROM donor_responses dr
  WHERE dr.user_id = NEW.user_id AND dr.status = 'accept';

  -- Calculate average response time
  SELECT AVG(response_time) INTO donor_avg_response
  FROM donor_responses dr
  WHERE dr.user_id = NEW.user_id AND response_time IS NOT NULL;

  -- Calculate rates
  donor_response_rate := CASE 
    WHEN donor_response_count > 0 THEN donor_success_count::DECIMAL / donor_response_count
    ELSE 0.5
  END;

  donor_success_rate := donor_response_rate; -- Same calculation for now

  -- Update user profile
  UPDATE users SET
    response_rate = donor_response_rate,
    success_rate = donor_success_rate,
    avg_response_time = COALESCE(donor_avg_response, 30),
    ml_last_updated = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update ML features
DROP TRIGGER IF EXISTS trigger_update_donor_ml_features ON donor_responses;
CREATE TRIGGER trigger_update_donor_ml_features
  AFTER INSERT OR UPDATE ON donor_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_donor_ml_features();

-- Create function to calculate prediction accuracy after outcomes
CREATE OR REPLACE FUNCTION calculate_prediction_accuracy()
RETURNS TRIGGER AS $$
DECLARE
  prediction_record RECORD;
BEGIN
  -- Find corresponding prediction
  SELECT * INTO prediction_record
  FROM ml_predictions mp
  WHERE mp.donor_id = NEW.user_id 
    AND mp.request_id = NEW.request_id
    AND mp.actual_outcome IS NULL
  ORDER BY mp.created_at DESC
  LIMIT 1;

  IF prediction_record.id IS NOT NULL THEN
    -- Update with actual outcome
    UPDATE ml_predictions SET
      actual_outcome = (NEW.status = 'accept'),
      response_time_actual = NEW.response_time,
      prediction_accuracy = CASE
        WHEN (NEW.status = 'accept') = (prediction_record.prediction_value > 0.5) THEN 1.0
        ELSE 0.0
      END,
      prediction_error = ABS(prediction_record.prediction_value - 
        CASE WHEN NEW.status = 'accept' THEN 1.0 ELSE 0.0 END)
    WHERE id = prediction_record.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to calculate prediction accuracy
DROP TRIGGER IF EXISTS trigger_calculate_prediction_accuracy ON donor_responses;
CREATE TRIGGER trigger_calculate_prediction_accuracy
  AFTER INSERT OR UPDATE ON donor_responses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_prediction_accuracy();

-- Insert sample rewards for gamification
INSERT INTO rewards (name, description, points_required, is_active) VALUES
('First Drop', 'Complete your first blood donation', 0, true),
('Life Saver', 'Save a life with your donation', 100, true),
('Regular Hero', 'Complete 5 donations', 500, true),
('Super Donor', 'Complete 10 donations', 1000, true),
('Golden Heart', 'Complete 25 donations', 2500, true),
('Platinum Guardian', 'Complete 50 donations', 5000, true),
('Emergency Responder', 'Respond to 3 emergency requests', 300, true),
('Speed Demon', 'Average response time under 10 minutes', 200, true),
('Community Champion', 'Help 10 different recipients', 800, true),
('Perfect Match', 'Achieve 95% success rate with 20+ donations', 1500, true)
ON CONFLICT (name) DO NOTHING;

-- Create view for ML dashboard
CREATE OR REPLACE VIEW ml_dashboard AS
SELECT 
  m.type,
  m.accuracy,
  m.last_trained,
  m.training_data_count,
  m.version,
  COUNT(p.id) as prediction_count,
  AVG(p.prediction_accuracy) as avg_accuracy,
  AVG(p.confidence) as avg_confidence
FROM ml_models m
LEFT JOIN ml_predictions p ON m.type = p.model_type AND m.version = p.model_version
WHERE m.status = 'active'
GROUP BY m.id, m.type, m.accuracy, m.last_trained, m.training_data_count, m.version
ORDER BY m.type;

-- Create view for donor insights
CREATE OR REPLACE VIEW donor_insights AS
SELECT 
  u.id,
  u.name,
  u.blood_type,
  u.response_rate,
  u.success_rate,
  u.avg_response_time,
  u.total_donations,
  u.ml_score,
  COUNT(dr.id) as total_responses,
  COUNT(CASE WHEN dr.status = 'accept' THEN 1 END) as successful_responses,
  AVG(dr.response_time) as actual_avg_response_time,
  MAX(dr.created_at) as last_response
FROM users u
LEFT JOIN donor_responses dr ON u.id = dr.user_id
WHERE u.blood_type IS NOT NULL
GROUP BY u.id, u.name, u.blood_type, u.response_rate, u.success_rate, 
         u.avg_response_time, u.total_donations, u.ml_score
ORDER BY u.ml_score DESC, u.response_rate DESC;

-- Enable RLS for ML tables
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_feature_store ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ML tables (admin only)
CREATE POLICY "ml_models_admin_policy" ON ml_models
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ml_training_logs_admin_policy" ON ml_training_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ml_predictions_admin_policy" ON ml_predictions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ml_feature_store_admin_policy" ON ml_feature_store
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE ml_models IS 'Stores trained machine learning models for donor matching and predictions';
COMMENT ON TABLE ml_training_logs IS 'Logs ML model training sessions and performance metrics';
COMMENT ON TABLE ml_predictions IS 'Stores ML predictions for evaluation and improvement';
COMMENT ON TABLE ml_feature_store IS 'Feature store for ML model inputs and computed features';