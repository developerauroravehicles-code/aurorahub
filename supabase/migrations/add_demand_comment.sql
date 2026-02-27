-- Comment from the person who creates the demand (Sales/Finance)
ALTER TABLE demands ADD COLUMN IF NOT EXISTS comment text;
