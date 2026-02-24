-- Add invoice fields to demands for Invoice panel (Aurora Manager)
-- Total amount and comments are manually editable

ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_total_amount numeric(12,2);
ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_comments text;
