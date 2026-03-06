-- Add institution (Kurum) and status to personnel_certifications

ALTER TABLE personnel_certifications ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE personnel_certifications ADD COLUMN IF NOT EXISTS status text DEFAULT 'awaiting';

COMMENT ON COLUMN personnel_certifications.institution IS 'Issuing institution/organization (Kurum)';
COMMENT ON COLUMN personnel_certifications.status IS 'sent (Gönderildi), awaiting (Bekleniyor), received (Alındı), approved (Onaylandı), expired (Süresi Doldu)';
