-- Per-dealer calendar: start/end with minutes (e.g. 19:30)

ALTER TABLE public.dealer_calendar_settings
  ADD COLUMN IF NOT EXISTS start_minute int NOT NULL DEFAULT 0
    CHECK (start_minute >= 0 AND start_minute <= 59),
  ADD COLUMN IF NOT EXISTS end_minute int NOT NULL DEFAULT 0
    CHECK (end_minute >= 0 AND end_minute <= 59);