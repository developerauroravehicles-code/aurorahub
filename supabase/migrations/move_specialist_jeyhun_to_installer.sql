-- Move Specialist "Jeyhun" from Aurora HQ to Installer Network
-- If in profiles only: create personnel + installer_profile
-- If in personnel: update to installer_technician + create installer_profile if needed

-- Step 1: Create personnel for Jeyhun if only in profiles (specialist)
INSERT INTO personnel (profile_id, dealer_id, worker_id, worker_type, status, full_name, avatar_url, phone, position, worker_classification)
SELECT
  p.id, NULL,
  'WRK-INST-' || UPPER(REPLACE(p.id::text, '-', ''))::text,
  'installer_technician'::worker_type,
  'active'::personnel_status,
  COALESCE(p.full_name, 'Jeyhun'),
  p.avatar_url, p.phone,
  'Installer Technician', 'specialist'
FROM profiles p
WHERE p.full_name ILIKE '%Jeyhun%'
  AND p.role = 'specialist'
  AND NOT EXISTS (SELECT 1 FROM personnel per WHERE per.profile_id = p.id);

-- Step 2: Update existing personnel to installer_technician
UPDATE personnel
SET worker_type = 'installer_technician',
    position = COALESCE(NULLIF(position, 'Technical Support'), 'Installer Technician'),
    updated_at = now()
WHERE full_name ILIKE '%Jeyhun%'
   OR (profile_id IN (SELECT id FROM profiles WHERE full_name ILIKE '%Jeyhun%'));

-- Step 3: Create installer_profile if not exists
INSERT INTO installer_profiles (personnel_id, experience_level, installer_status)
SELECT per.id, 'intermediate', 'active'
FROM personnel per
WHERE per.full_name ILIKE '%Jeyhun%'
  AND NOT EXISTS (SELECT 1 FROM installer_profiles ip WHERE ip.personnel_id = per.id);
