-- Add assigned_finance_id column to demands table
-- This allows finance users to claim/assign demands to themselves

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'demands') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'demands' 
      AND column_name = 'assigned_finance_id'
    ) THEN
      ALTER TABLE demands ADD COLUMN assigned_finance_id uuid REFERENCES profiles(id);
    END IF;
  END IF;
END $$;

