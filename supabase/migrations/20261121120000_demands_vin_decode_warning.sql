ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS vin_decode_warning boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN demands.vin_decode_warning IS 'True when full VIN was entered but NHTSA decode failed at demand creation; vehicle fields may be manual.';