-- Seed script for Angolan users and hospitals
-- This script adds realistic test data for Angola

-- First, let's add some Angolan provinces and cities
INSERT INTO locations (name, type, parent_id, coordinates) VALUES
('Luanda', 'province', NULL, '{"lat": -8.8390, "lng": 13.2894}'),
('Benguela', 'province', NULL, '{"lat": -12.5763, "lng": 13.4055}'),
('Huambo', 'province', NULL, '{"lat": -12.7762, "lng": 15.7380}'),
('Lobito', 'city', 1, '{"lat": -12.3598, "lng": 13.5375}'),
('Cabinda', 'province', NULL, '{"lat": -5.5548, "lng": 12.2019}'),
('Namibe', 'province', NULL, '{"lat": -15.1961, "lng": 12.1522}')
ON CONFLICT (name, type) DO NOTHING;

-- Add major Angolan hospitals
INSERT INTO institutions (name, type, address, phone, email, latitude, longitude, verified, created_at) VALUES
-- Luanda Hospitals
('Hospital Central Dr. António Agostinho Neto', 'hospital', 'Rua Dr. António Agostinho Neto, Luanda', '+244 222 334 521', 'geral@hospitalcentral.ao', -8.8181, 13.2361, true, NOW()),
('Hospital Américo Boavida', 'hospital', 'Rua Américo Boavida, Luanda', '+244 222 393 031', 'info@hospitalboavida.ao', -8.8305, 13.2478, true, NOW()),
('Hospital Militar Principal', 'hospital', 'Rua Major Kanhangulo, Luanda', '+244 222 334 782', 'contato@hospitalmilitar.ao', -8.8167, 13.2302, true, NOW()),
('Clínica Girassol', 'clinic', 'Miramar, Luanda', '+244 222 444 789', 'clinica@girassol.ao', -8.8034, 13.2840, true, NOW()),
('Hospital Josina Machel', 'hospital', 'Ilha de Luanda', '+244 222 370 456', 'info@josinamachel.ao', -8.7890, 13.2456, true, NOW()),

-- Benguela Hospitals
('Hospital Central de Benguela', 'hospital', 'Avenida Norton de Matos, Benguela', '+244 272 234 567', 'geral@hcbenguela.ao', -12.5842, 13.4055, true, NOW()),
('Hospital Regional de Lobito', 'hospital', 'Rua da Independência, Lobito', '+244 272 225 891', 'info@hlobito.ao', -12.3665, 13.5348, true, NOW()),

-- Huambo Hospitals
('Hospital Central do Huambo', 'hospital', 'Rua José Martí, Huambo', '+244 241 223 456', 'contato@hchuambo.ao', -12.7762, 15.7380, true, NOW()),
('Hospital Pediátrico David Bernardino', 'hospital', 'Bairro Comercial, Huambo', '+244 241 267 891', 'pediatrico@davidbernardino.ao', -12.7689, 15.7421, true, NOW()),

-- Other provinces
('Hospital Central de Cabinda', 'hospital', 'Rua Marien Ngouabi, Cabinda', '+244 231 222 345', 'geral@hccabinda.ao', -5.5548, 12.2019, true, NOW()),
('Hospital Central do Namibe', 'hospital', 'Avenida da República, Namibe', '+244 264 234 567', 'info@hcnamibe.ao', -15.1961, 12.1522, true, NOW())
ON CONFLICT (name) DO NOTHING;

-- Add realistic Angolan users (donors and patients)
INSERT INTO users (id, phone, name, blood_type, location, allow_location, receive_alerts, available, points, last_donation, medical_conditions, created_at) VALUES
-- Luanda Users
(gen_random_uuid(), '+244912345001', 'António Silva Mendes', 'O+', 'Maianga, Luanda', true, true, true, 250, '2024-09-15', NULL, NOW()),
(gen_random_uuid(), '+244923456002', 'Maria José Santos', 'A+', 'Ingombotas, Luanda', true, true, true, 180, '2024-10-20', NULL, NOW()),
(gen_random_uuid(), '+244934567003', 'João Carlos Pereira', 'B+', 'Rangel, Luanda', true, true, true, 320, '2024-08-10', NULL, NOW()),
(gen_random_uuid(), '+244945678004', 'Ana Paula Fernandes', 'AB+', 'Viana, Luanda', true, true, true, 150, '2024-11-05', NULL, NOW()),
(gen_random_uuid(), '+244956789005', 'Carlos Eduardo Nunes', 'O-', 'Kilamba, Luanda', true, true, true, 420, '2024-07-25', NULL, NOW()),
(gen_random_uuid(), '+244967890006', 'Isabel Maria Costa', 'A-', 'Talatona, Luanda', true, true, true, 290, '2024-09-30', NULL, NOW()),
(gen_random_uuid(), '+244978901007', 'Manuel Francisco Dias', 'B-', 'Cacuaco, Luanda', true, true, false, 80, '2024-12-01', 'Hipertensão controlada', NOW()),
(gen_random_uuid(), '+244989012008', 'Rosa Benedita Morais', 'AB-', 'Belas, Luanda', true, true, true, 370, '2024-06-15', NULL, NOW()),

-- Benguela Users
(gen_random_uuid(), '+244912345011', 'Pedro Miguel Tavares', 'O+', 'Centro, Benguela', true, true, true, 190, '2024-10-12', NULL, NOW()),
(gen_random_uuid(), '+244923456012', 'Esperança João Mateus', 'A+', 'Praia Morena, Benguela', true, true, true, 270, '2024-08-28', NULL, NOW()),
(gen_random_uuid(), '+244934567013', 'Domingos Bernardo Silva', 'B+', 'Compão, Benguela', true, true, true, 220, '2024-09-18', NULL, NOW()),
(gen_random_uuid(), '+244945678014', 'Catarina Lúcia Rodrigues', 'O-', 'Lobito, Benguela', true, true, true, 340, '2024-07-10', NULL, NOW()),

-- Huambo Users
(gen_random_uuid(), '+244912345021', 'Augusto Tomás Ventura', 'A+', 'Centro, Huambo', true, true, true, 160, '2024-11-08', NULL, NOW()),
(gen_random_uuid(), '+244923456022', 'Benedita Carolina Sousa', 'B+', 'Comercial, Huambo', true, true, true, 300, '2024-09-05', NULL, NOW()),
(gen_random_uuid(), '+244934567023', 'Francisco José Martins', 'AB+', 'Josina Machel, Huambo', true, true, false, 120, '2024-12-15', 'Diabetes tipo 2', NOW()),
(gen_random_uuid(), '+244945678024', 'Joana Filomena Cardoso', 'O+', 'São Pedro, Huambo', true, true, true, 380, '2024-06-22', NULL, NOW()),

-- Cabinda Users
(gen_random_uuid(), '+244912345031', 'Simão Lopes Gaspar', 'A-', 'Centro, Cabinda', true, true, true, 210, '2024-10-01', NULL, NOW()),
(gen_random_uuid(), '+244923456032', 'Palmira Santos Neto', 'B-', 'Tchiowa, Cabinda', true, true, true, 280, '2024-08-15', NULL, NOW()),

-- Namibe Users
(gen_random_uuid(), '+244912345041', 'Alfredo Miguel Cunha', 'O+', 'Centro, Namibe', true, true, true, 240, '2024-09-20', NULL, NOW()),
(gen_random_uuid(), '+244923456042', 'Lurdes Antónia Brito', 'A+', 'Tombwa, Namibe', true, true, true, 195, '2024-11-12', NULL, NOW())
ON CONFLICT (phone) DO NOTHING;

-- Add some blood requests from hospitals
DO $$
DECLARE
    hospital_record RECORD;
    user_record RECORD;
    request_id UUID;
BEGIN
    -- Create blood requests for each hospital
    FOR hospital_record IN 
        SELECT id, name, latitude, longitude FROM institutions WHERE type = 'hospital' AND name LIKE '%Angola%' OR name LIKE '%Luanda%' OR name LIKE '%Benguela%' OR name LIKE '%Huambo%' OR name LIKE '%Cabinda%' OR name LIKE '%Namibe%'
    LOOP
        -- Create urgent O- request
        INSERT INTO blood_requests (
            id, user_id, hospital_name, blood_type, units_needed, 
            urgency_level, location, latitude, longitude, 
            status, description, created_at
        ) VALUES (
            gen_random_uuid(),
            (SELECT id FROM users WHERE blood_type = 'O+' LIMIT 1),
            hospital_record.name,
            'O-',
            3,
            'critical',
            hospital_record.name,
            hospital_record.latitude,
            hospital_record.longitude,
            'active',
            'Paciente em estado crítico após acidente de viação. Necessita transfusão urgente.',
            NOW() - INTERVAL '2 hours'
        );

        -- Create moderate A+ request  
        INSERT INTO blood_requests (
            id, user_id, hospital_name, blood_type, units_needed,
            urgency_level, location, latitude, longitude,
            status, description, created_at
        ) VALUES (
            gen_random_uuid(),
            (SELECT id FROM users WHERE blood_type = 'A+' LIMIT 1),
            hospital_record.name,
            'A+',
            2,
            'moderate',
            hospital_record.name,
            hospital_record.latitude,
            hospital_record.longitude,
            'active', 
            'Paciente com anemia severa programada para cirurgia.',
            NOW() - INTERVAL '6 hours'
        );
    END LOOP;
END $$;

-- Add some donation history
DO $$
DECLARE
    user_record RECORD;
    request_record RECORD;
BEGIN
    -- Create donations for some users
    FOR user_record IN 
        SELECT id, name, blood_type, location FROM users WHERE available = true LIMIT 10
    LOOP
        -- Find a compatible request
        SELECT id, hospital_name, location INTO request_record 
        FROM blood_requests 
        WHERE blood_type = user_record.blood_type 
        AND status = 'active' 
        LIMIT 1;

        IF request_record.id IS NOT NULL THEN
            INSERT INTO donations (
                id, user_id, request_id, blood_type, amount,
                location, hospital_name, status, created_at
            ) VALUES (
                gen_random_uuid(),
                user_record.id,
                request_record.id,
                user_record.blood_type,
                450, -- Standard donation amount in ml
                request_record.location,
                request_record.hospital_name,
                'completed',
                NOW() - INTERVAL '1 month'
            );
        END IF;
    END LOOP;
END $$;

-- Add some rewards data
INSERT INTO rewards (id, name, description, points_required, type, created_at) VALUES
(gen_random_uuid(), 'Certificado de Doador', 'Certificado oficial de reconhecimento por doação de sangue', 100, 'certificate', NOW()),
(gen_random_uuid(), 'Camiseta BloodLink', 'Camiseta oficial do BloodLink Africa', 200, 'merchandise', NOW()),
(gen_random_uuid(), 'Desconto Farmácia', '10% de desconto em farmácias parceiras', 150, 'discount', NOW()),
(gen_random_uuid(), 'Consulta Médica Gratuita', 'Consulta médica gratuita em clínicas parceiras', 300, 'service', NOW()),
(gen_random_uuid(), 'Medalha de Ouro', 'Medalha para doadores com mais de 10 doações', 500, 'medal', NOW())
ON CONFLICT (name) DO NOTHING;

-- Assign some rewards to users
DO $$
DECLARE
    user_record RECORD;
    reward_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT id, points FROM users WHERE points >= 200 LIMIT 5
    LOOP
        -- Give certificate reward to eligible users
        SELECT id, points_required INTO reward_record 
        FROM rewards 
        WHERE name = 'Certificado de Doador' 
        LIMIT 1;

        IF reward_record.id IS NOT NULL AND user_record.points >= reward_record.points_required THEN
            INSERT INTO user_rewards (
                id, user_id, reward_id, points, status, created_at
            ) VALUES (
                gen_random_uuid(),
                user_record.id,
                reward_record.id,
                reward_record.points_required,
                'redeemed',
                NOW() - INTERVAL '2 weeks'
            );
        END IF;
    END LOOP;
END $$;

-- Update user statistics
UPDATE users SET 
    last_updated = NOW(),
    total_donations = (
        SELECT COUNT(*) 
        FROM donations 
        WHERE donations.user_id = users.id 
        AND donations.status = 'completed'
    )
WHERE EXISTS (
    SELECT 1 FROM donations WHERE donations.user_id = users.id
);

-- Add some emergency alerts
INSERT INTO emergency_alerts (
    id, blood_type, hospital_name, location, latitude, longitude,
    urgency_level, units_needed, description, status, expires_at, created_at
) VALUES
(gen_random_uuid(), 'O-', 'Hospital Central Dr. António Agostinho Neto', 'Luanda', -8.8181, 13.2361, 'critical', 5, 'Múltiplas vítimas de acidente rodoviário. Necessidade urgente de sangue tipo O negativo.', 'active', NOW() + INTERVAL '6 hours', NOW()),
(gen_random_uuid(), 'A+', 'Hospital Central de Benguela', 'Benguela', -12.5842, 13.4055, 'high', 3, 'Paciente oncológico necessita transfusão para quimioterapia.', 'active', NOW() + INTERVAL '12 hours', NOW()),
(gen_random_uuid(), 'B+', 'Hospital Central do Huambo', 'Huambo', -12.7762, 15.7380, 'moderate', 2, 'Preparação para cirurgia cardíaca programada.', 'active', NOW() + INTERVAL '24 hours', NOW())
ON CONFLICT DO NOTHING;

COMMIT;

-- Display summary
SELECT 
    'Database seeded successfully!' as message,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM institutions WHERE type = 'hospital') as total_hospitals,
    (SELECT COUNT(*) FROM blood_requests) as total_requests,
    (SELECT COUNT(*) FROM donations) as total_donations,
    (SELECT COUNT(*) FROM emergency_alerts) as total_alerts;