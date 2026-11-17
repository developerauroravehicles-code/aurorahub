-- Dealer quick appointment: stock + VIN + phone; customer completes name/phone via magic link.

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS customer_details_pending boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.demands.customer_details_pending
  IS 'When true, customer must confirm/update name and phone via portal link sent by dealer.';

ALTER TABLE public.customer_portal_access_tokens
  ADD COLUMN IF NOT EXISTS demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_portal_access_tokens_demand
  ON public.customer_portal_access_tokens (demand_id)
  WHERE demand_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.customer_portal_validate_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_row public.customer_portal_access_tokens%ROWTYPE;
BEGIN
  IF NULLIF(trim(COALESCE(p_token, '')), '') IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'expired', false, 'customer_phone', null, 'demand_id', null);
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.customer_portal_access_tokens t
  WHERE t.token_hash = v_hash
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'expired', false, 'customer_phone', null, 'demand_id', null);
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'expired', true, 'customer_phone', null, 'demand_id', null);
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'expired', true,
      'customer_phone', v_row.customer_phone,
      'demand_id', v_row.demand_id
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'expired', false,
    'customer_phone', v_row.customer_phone,
    'demand_id', v_row.demand_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_get_handoff_demand(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_row public.customer_portal_access_tokens%ROWTYPE;
  v_demand public.demands%ROWTYPE;
BEGIN
  IF NULLIF(trim(COALESCE(p_token, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.customer_portal_access_tokens t
  WHERE t.token_hash = v_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_row.demand_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_demand FROM public.demands d WHERE d.id = v_row.demand_id;

  IF NOT FOUND OR v_demand.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pending', COALESCE(v_demand.customer_details_pending, false),
    'demand_id', v_demand.id,
    'demand_number', v_demand.demand_number,
    'customer_firstname', v_demand.customer_firstname,
    'customer_lastname', v_demand.customer_lastname,
    'customer_phone', v_demand.customer_phone,
    'customer_address', v_demand.customer_address,
    'vehicle_year', v_demand.vehicle_year,
    'vehicle_make', v_demand.vehicle_make,
    'vehicle_model', v_demand.vehicle_model,
    'vin_last6', v_demand.vin_last6,
    'stock_number', v_demand.stock_number,
    'camera_model', v_demand.camera_model,
    'appointment_date', v_demand.appointment_date,
    'dealer_id', v_demand.dealer_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_complete_handoff(
  p_token text,
  p_firstname text,
  p_lastname text,
  p_phone text,
  p_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_row public.customer_portal_access_tokens%ROWTYPE;
  v_phone text;
  v_fn text;
  v_ln text;
BEGIN
  v_fn := upper(trim(COALESCE(p_firstname, '')));
  v_ln := upper(trim(COALESCE(p_lastname, '')));
  v_phone := public.normalize_portal_phone(p_phone);

  IF length(v_fn) < 1 OR length(v_ln) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Name is required.');
  END IF;

  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A valid 10-digit phone number is required.');
  END IF;

  IF NULLIF(trim(COALESCE(p_token, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.customer_portal_access_tokens t
  WHERE t.token_hash = v_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_row.demand_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  UPDATE public.demands d
  SET
    customer_firstname = v_fn,
    customer_lastname = v_ln,
    customer_phone = v_phone,
    customer_address = NULLIF(trim(COALESCE(p_address, '')), ''),
    customer_details_pending = false,
    updated_at = now()
  WHERE d.id = v_row.demand_id
    AND d.customer_details_pending = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  UPDATE public.customer_portal_access_tokens t
  SET customer_phone = v_phone
  WHERE t.id = v_row.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_portal_get_handoff_demand(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_complete_handoff(text, text, text, text, text) TO anon, authenticated;