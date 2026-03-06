-- Add per_completed_tiered to payment_type enum (IF NOT EXISTS: PG 9.1+)
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'per_completed_tiered';

-- Per-completed tiered compensation (e.g. 15 completed = 2000 CAD base, +50 CAD each additional)
-- Links to personnel via profile: demands.assigned_specialist_id = personnel.profile_id

CREATE TABLE IF NOT EXISTS compensation_per_completed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  base_completed int NOT NULL DEFAULT 15,       -- first N completed = base_amount
  base_amount decimal(12,2) NOT NULL DEFAULT 2000,  -- amount for first base_completed
  per_completed_amount decimal(12,2) NOT NULL DEFAULT 50,  -- each additional completed
  currency text DEFAULT 'CAD',
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compensation_per_completed_personnel ON compensation_per_completed(personnel_id);
CREATE INDEX IF NOT EXISTS idx_compensation_per_completed_effective ON compensation_per_completed(effective_from, effective_to);

ALTER TABLE compensation_per_completed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_manage_compensation_per_completed" ON compensation_per_completed FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('hr', 'aurora_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('hr', 'aurora_manager'))
  );

COMMENT ON TABLE compensation_per_completed IS 'Tiered pay: base_amount for first base_completed installations, then per_completed_amount for each additional';

-- Add per-completed support to payment_records
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS completed_count int;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS deduction_metadata jsonb;
COMMENT ON COLUMN payment_records.completed_count IS 'Number of completed demands for per_completed payment calculation';
COMMENT ON COLUMN payment_records.deduction_metadata IS 'Pay stub: {gross, cpp, ei, federal_tax, provincial_tax, net} for Canadian payroll';
