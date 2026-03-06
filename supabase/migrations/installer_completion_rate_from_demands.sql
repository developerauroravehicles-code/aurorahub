-- Completion Rate for installers: auto-calculated from assigned demands (completed / total, excl. cancelled)
-- personnel.profile_id links to demands.assigned_specialist_id

-- Create view that computes completion_rate from demands
CREATE OR REPLACE VIEW installer_profiles_with_completion AS
SELECT
  ip.id,
  ip.personnel_id,
  ip.service_region_ids,
  ip.installation_skills,
  ip.device_compatibility,
  ip.experience_level,
  ip.customer_rating,
  ip.dealer_feedback_score,
  ip.quality_score,
  ip.installer_status,
  ip.created_at,
  ip.updated_at,
  ROUND(
    (SELECT COUNT(*)::numeric FROM demands d
     WHERE d.assigned_specialist_id = per.profile_id AND d.status = 'completed')
    / NULLIF(
        (SELECT COUNT(*) FROM demands d
         WHERE d.assigned_specialist_id = per.profile_id AND d.status != 'cancelled'),
        0
    ) * 100,
    2
  ) AS completion_rate
FROM installer_profiles ip
JOIN personnel per ON ip.personnel_id = per.id;

-- Grant select to authenticated (RLS on underlying tables will apply)
GRANT SELECT ON installer_profiles_with_completion TO authenticated;
