-- Screenshots uploaded to Google Drive (metadata references files in ticket-named folder).
ALTER TABLE it_tickets
  ADD COLUMN IF NOT EXISTS screenshots jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN it_tickets.screenshots IS 'Array of {fileId, webViewLink?, name} for ticket screenshots stored in Drive under ServiceDesk/Tickets/<ticket_number>.';
