-- Allow up to 3 concurrent dashboard sessions per dealer-linked user (Sales / Finance / GM desks).

CREATE OR REPLACE FUNCTION public.prune_dealer_user_sessions(p_user_id uuid, p_max_sessions int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF p_max_sessions < 1 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND dealer_id IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  DELETE FROM auth.sessions s
  WHERE s.user_id = p_user_id
    AND s.id NOT IN (
      SELECT id
      FROM auth.sessions
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT p_max_sessions
    );
END;
$$;

REVOKE ALL ON FUNCTION public.prune_dealer_user_sessions(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_dealer_user_sessions(uuid, int) TO service_role;