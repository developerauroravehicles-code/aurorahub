-- Realtime for live invoice status updates (Daily Invoice → Invoice tab sync)
ALTER TABLE public.demands REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demands;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
