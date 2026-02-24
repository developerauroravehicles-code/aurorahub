-- Add phone number to dealers table
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS phone text;
