-- Add invoice extra rows and financial summary to demands for Invoice preview persistence
-- These store the Additional table (Description/Amount) and Financial summary (GST, PST, etc.)

ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_extra_rows jsonb DEFAULT '[]'::jsonb;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_financial_summary jsonb;
