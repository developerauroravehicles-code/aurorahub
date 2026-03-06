-- Sync: Ensure all platform profiles (dealer_id null) have personnel records
-- Aligns System Management users with HR Employees

INSERT INTO personnel (
  profile_id,
  dealer_id,
  worker_id,
  worker_type,
  status,
  full_name,
  avatar_url,
  phone,
  platform_role
)
SELECT
  p.id,
  NULL,
  'WRK-' || UPPER(REPLACE(p.id::text, '-', '')),
  'employee'::worker_type,
  'active'::personnel_status,
  COALESCE(p.full_name, 'User'),
  p.avatar_url,
  p.phone,
  CASE
    WHEN p.role IN ('specialist', 'aurora_manager', 'hr', 'it') THEN p.role
    ELSE NULL
  END
FROM profiles p
WHERE p.dealer_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM personnel per WHERE per.profile_id = p.id);
