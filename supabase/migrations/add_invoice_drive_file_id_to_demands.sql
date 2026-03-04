-- Store Drive file ID for invoice - enables replacing old file when re-uploading

ALTER TABLE demands ADD COLUMN IF NOT EXISTS invoice_drive_file_id text;
