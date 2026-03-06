-- Migrate Aurora HQ (platform) employees from profiles to personnel
-- Platform users: dealer_id IS NULL (aurora_manager, hr, it, specialist)

INSERT INTO personnel (
  profile_id,
  dealer_id,
  worker_id,
  worker_type,
  status,
  full_name,
  avatar_url,
  phone,
  position,
  worker_classification
)
SELECT
  p.id,
  NULL,
  'WRK-' || UPPER(SUBSTRING(REPLACE(p.id::text, '-', ''), 1, 12)),
  CASE p.role
    WHEN 'aurora_manager' THEN 'regional_manager'::worker_type
    WHEN 'hr' THEN 'employee'::worker_type
    WHEN 'it' THEN 'employee'::worker_type
    WHEN 'specialist' THEN 'support_staff'::worker_type
    ELSE 'employee'::worker_type
  END,
  'active'::personnel_status,
  COALESCE(p.full_name, 'Unknown'),
  p.avatar_url,
  p.phone,
  CASE p.role
    WHEN 'aurora_manager' THEN 'Aurora Manager'
    WHEN 'hr' THEN 'HR'
    WHEN 'it' THEN 'IT'
    WHEN 'specialist' THEN 'Technical Support'
    ELSE p.role
  END,
  p.role
FROM profiles p
WHERE p.dealer_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM personnel per WHERE per.profile_id = p.id
  );

-- Add timeline event for migrated records
INSERT INTO personnel_timeline (personnel_id, event_type, title, description)
SELECT
  per.id,
  'hired'::personnel_event_type,
  'Migrated from Aurora HQ',
  'Platform employee migrated to personnel registry'
FROM personnel per
JOIN profiles p ON per.profile_id = p.id
WHERE p.dealer_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM personnel_timeline pt
    WHERE pt.personnel_id = per.id AND pt.title = 'Migrated from Aurora HQ'
  );
