-- Ensure all Aurora Manager profiles have personnel records (for Assigned Manager dropdown)

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
  worker_classification,
  platform_role
)
SELECT
  p.id,
  NULL,
  'WRK-AM-' || UPPER(REPLACE(p.id::text, '-', '')),
  'regional_manager'::worker_type,
  'active'::personnel_status,
  COALESCE(p.full_name, 'Aurora Manager'),
  p.avatar_url,
  p.phone,
  'Aurora Manager',
  'aurora_manager',
  'aurora_manager'
FROM profiles p
WHERE p.role = 'aurora_manager'
  AND NOT EXISTS (SELECT 1 FROM personnel per WHERE per.profile_id = p.id);
