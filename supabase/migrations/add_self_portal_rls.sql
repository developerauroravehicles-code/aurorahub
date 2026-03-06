-- Self Portal: Platform users can read their own HR data (personnel, pay, equipment, certs, compliance, etc.)
-- Dealers are excluded (dealer_id IS NULL in their profile)
-- Only SELECT policies - no write access

-- Personnel: platform users can read own record
DROP POLICY IF EXISTS "Platform users can view own personnel" ON personnel;
CREATE POLICY "Platform users can view own personnel" ON personnel FOR SELECT
  USING (
    profile_id = auth.uid()
    AND dealer_id IS NULL
  );

-- Payment records for own personnel
DROP POLICY IF EXISTS "Platform users can view own payment_records" ON payment_records;
CREATE POLICY "Platform users can view own payment_records" ON payment_records FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Equipment assignments for own personnel
DROP POLICY IF EXISTS "Platform users can view own equipment_assignments" ON equipment_assignments;
CREATE POLICY "Platform users can view own equipment_assignments" ON equipment_assignments FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Certifications for own personnel
DROP POLICY IF EXISTS "Platform users can view own personnel_certifications" ON personnel_certifications;
CREATE POLICY "Platform users can view own personnel_certifications" ON personnel_certifications FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Compliance documents for own personnel
DROP POLICY IF EXISTS "Platform users can view own compliance_documents" ON compliance_documents;
CREATE POLICY "Platform users can view own compliance_documents" ON compliance_documents FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Compliance checklists for own personnel
DROP POLICY IF EXISTS "Platform users can view own compliance_checklists" ON compliance_checklists;
CREATE POLICY "Platform users can view own compliance_checklists" ON compliance_checklists FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Personnel availability for own record
DROP POLICY IF EXISTS "Platform users can view own personnel_availability" ON personnel_availability;
CREATE POLICY "Platform users can view own personnel_availability" ON personnel_availability FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Performance feedback for own personnel
DROP POLICY IF EXISTS "Platform users can view own performance_feedback" ON performance_feedback;
CREATE POLICY "Platform users can view own performance_feedback" ON performance_feedback FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Personnel leave blocks for own record
DROP POLICY IF EXISTS "Platform users can view own personnel_leave_blocks" ON personnel_leave_blocks;
CREATE POLICY "Platform users can view own personnel_leave_blocks" ON personnel_leave_blocks FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel
      WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Equipment types: allow authenticated to read (reference data for Self Portal equipment display)
DROP POLICY IF EXISTS "Authenticated can read equipment_types" ON equipment_types;
CREATE POLICY "Authenticated can read equipment_types" ON equipment_types FOR SELECT
  TO authenticated
  USING (true);

-- Onboarding tasks: platform users can view own
DROP POLICY IF EXISTS "Platform users can view own onboarding_tasks" ON onboarding_tasks;
CREATE POLICY "Platform users can view own onboarding_tasks" ON onboarding_tasks FOR SELECT
  USING (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND dealer_id IS NULL)
  );
