-- Add salary fields to personnel for quick editing on detail page

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS salary_amount decimal(12,2);
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS salary_currency text DEFAULT 'CAD';
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS salary_type text;

COMMENT ON COLUMN personnel.salary_amount IS 'Base salary or hourly/installation rate';
COMMENT ON COLUMN personnel.salary_currency IS 'Currency code, default CAD';
COMMENT ON COLUMN personnel.salary_type IS 'salary, hourly, per_installation, commission, etc.';
