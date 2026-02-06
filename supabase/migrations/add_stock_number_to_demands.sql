-- Migration: Add stock_number column to demands table
-- This allows tracking stock numbers for each demand

-- Add stock_number column if it doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'demands') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'demands' 
      AND column_name = 'stock_number'
    ) THEN
      ALTER TABLE demands ADD COLUMN stock_number text;
      RAISE NOTICE 'Column stock_number added to demands table';
    ELSE
      RAISE NOTICE 'Column stock_number already exists in demands table';
    END IF;
  END IF;
END $$;

