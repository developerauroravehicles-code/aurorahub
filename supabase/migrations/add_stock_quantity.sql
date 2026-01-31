-- Migration: Add stock_quantity column to camera_models table
-- Run this in Supabase SQL Editor if the column doesn't exist

-- Add stock_quantity column if it doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'camera_models') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'camera_models' 
      AND column_name = 'stock_quantity'
    ) THEN
      ALTER TABLE camera_models ADD COLUMN stock_quantity int DEFAULT 0;
      RAISE NOTICE 'Column stock_quantity added to camera_models table';
    ELSE
      RAISE NOTICE 'Column stock_quantity already exists in camera_models table';
    END IF;
  ELSE
    RAISE NOTICE 'Table camera_models does not exist';
  END IF;
END $$;

