-- Invoice durum takibi: kayıt edildi, Local indirildi, Drive kayıt edildi

ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_saved_at timestamptz;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_downloaded_at timestamptz;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_drive_uploaded_at timestamptz;

-- Backfill: demands with invoice_total_amount are considered "saved"
UPDATE demands
SET invoice_saved_at = COALESCE(invoice_saved_at, updated_at)
WHERE status = 'completed' AND invoice_total_amount IS NOT NULL AND invoice_saved_at IS NULL;
