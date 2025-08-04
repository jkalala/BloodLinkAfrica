-- Seed blood banks
INSERT INTO blood_banks (name, address, phone, hours, latitude, longitude, status)
VALUES
  ('Central Blood Bank', '123 Medical Avenue, Nairobi', '+254 123 456 789', '8:00 AM - 6:00 PM', -1.286389, 36.817223, 'High Need'),
  ('Red Cross Donation Center', '45 Health Street, Nairobi', '+254 987 654 321', '9:00 AM - 5:00 PM', -1.292066, 36.821945, 'Normal'),
  ('Community Hospital Blood Center', '78 Community Road, Nairobi', '+254 456 789 123', '8:30 AM - 4:30 PM', -1.300000, 36.830000, 'Low Need');

-- Seed blood inventory
INSERT INTO blood_inventory (blood_bank_id, blood_type, status, quantity)
VALUES
  ((SELECT id FROM blood_banks WHERE name = 'Central Blood Bank'), 'A+', 'low', 5),
  ((SELECT id FROM blood_banks WHERE name = 'Central Blood Bank'), 'B+', 'normal', 10),
  ((SELECT id FROM blood_banks WHERE name = 'Central Blood Bank'), 'O+', 'critical', 2),
  ((SELECT id FROM blood_banks WHERE name = 'Central Blood Bank'), 'AB-', 'normal', 8),
  ((SELECT id FROM blood_banks WHERE name = 'Red Cross Donation Center'), 'A+', 'normal', 12),
  ((SELECT id FROM blood_banks WHERE name = 'Red Cross Donation Center'), 'B+', 'normal', 9),
  ((SELECT id FROM blood_banks WHERE name = 'Red Cross Donation Center'), 'O+', 'low', 4),
  ((SELECT id FROM blood_banks WHERE name = 'Red Cross Donation Center'), 'AB+', 'critical', 1),
  ((SELECT id FROM blood_banks WHERE name = 'Community Hospital Blood Center'), 'A-', 'normal', 7),
  ((SELECT id FROM blood_banks WHERE name = 'Community Hospital Blood Center'), 'B-', 'normal', 6),
  ((SELECT id FROM blood_banks WHERE name = 'Community Hospital Blood Center'), 'O-', 'low', 3),
  ((SELECT id FROM blood_banks WHERE name = 'Community Hospital Blood Center'), 'AB-', 'normal', 5);

-- Seed rewards
INSERT INTO rewards (name, description, points_required, is_active)
VALUES
  ('100 MB Data Bundle', 'Mobile data bundle valid for 7 days', 100, true),
  ('200 Airtime Credit', 'Airtime credit for any network', 200, true),
  ('Coffee Shop Voucher', 'Free coffee at participating cafes', 300, true),
  ('Transport Credit', 'Credit for ride-sharing apps', 500, true);
