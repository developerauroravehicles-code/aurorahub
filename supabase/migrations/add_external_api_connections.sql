-- External API Connections: Multiple entries per source type (e.g. different Drive folders)
-- Existing system_settings (twilio_settings, whatsapp_settings, google_drive_settings) remain unchanged.

CREATE TABLE IF NOT EXISTS external_api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL CHECK (provider_type IN ('twilio', 'whatsapp', 'google_drive')),
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_api_provider ON external_api_connections(provider_type);

ALTER TABLE external_api_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_api_connections_manage"
  ON external_api_connections FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));
