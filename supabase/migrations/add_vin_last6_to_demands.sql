-- Add VIN last 6 digits to demands (optional, for specialist verification on complete)
ALTER TABLE demands ADD COLUMN IF NOT EXISTS vin_last6 text;
