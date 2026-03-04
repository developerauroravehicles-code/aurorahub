-- Global notes and reminders for Aurora Manager (independent of demands)

CREATE TABLE IF NOT EXISTS manager_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reminder_at timestamptz,
  is_done boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_notes_created_by ON manager_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_manager_notes_reminder_at ON manager_notes(reminder_at) WHERE reminder_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_manager_notes_is_done ON manager_notes(is_done);

ALTER TABLE manager_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aurora managers can manage notes"
  ON manager_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager'
    )
  );
