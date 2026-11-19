-- Performance: RPCs and indexes (no feature changes).

-- Duplicate stock badges (replaces full-table scan in app).
CREATE OR REPLACE FUNCTION public.duplicate_stock_numbers(p_dealer_id uuid DEFAULT NULL)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT upper(trim(stock_number))
  FROM demands
  WHERE status <> 'cancelled'
    AND stock_number IS NOT NULL
    AND trim(stock_number) <> ''
    AND (p_dealer_id IS NULL OR dealer_id = p_dealer_id)
  GROUP BY upper(trim(stock_number))
  HAVING count(*) >= 2;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_stock_numbers(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_demands_stock_upper_active
  ON public.demands (dealer_id, upper(trim(stock_number)))
  WHERE status <> 'cancelled' AND stock_number IS NOT NULL;

-- Monitoring / admin status widgets.
CREATE OR REPLACE FUNCTION public.demand_status_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_object_agg(status, cnt),
    '{}'::jsonb
  )
  FROM (
    SELECT status::text AS status, count(*)::int AS cnt
    FROM demands
    GROUP BY status
  ) s;
$$;

GRANT EXECUTE ON FUNCTION public.demand_status_counts() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_demands_completed_at
  ON public.demands (completed_at DESC)
  WHERE status = 'completed';

-- Aurora Manager dashboard aggregates (counts/trends; finance rows still loaded in app by month).
CREATE OR REPLACE FUNCTION public.aurora_manager_dashboard_aggregates()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  from_30 timestamptz := now() - interval '30 days';
BEGIN
  SELECT jsonb_build_object(
    'pending_finance', count(*) FILTER (WHERE status = 'pending_finance'),
    'approved', count(*) FILTER (WHERE status = 'approved'),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'cancelled', count(*) FILTER (WHERE status = 'cancelled')
  )
  INTO result
  FROM demands;

  result := result || jsonb_build_object(
    'invoice_waiting',
    (SELECT count(*)::int FROM demands d WHERE d.status = 'completed'
      AND d.invoice_drive_uploaded_at IS NULL
      AND d.invoice_downloaded_at IS NULL
      AND d.invoice_saved_at IS NULL
      AND coalesce(d.invoice_total_amount, 0) = 0),
    'invoice_edited',
    (SELECT count(*)::int FROM demands d WHERE d.status = 'completed'
      AND d.invoice_drive_uploaded_at IS NULL
      AND d.invoice_downloaded_at IS NULL
      AND (d.invoice_saved_at IS NOT NULL OR coalesce(d.invoice_total_amount, 0) > 0)),
    'invoice_downloaded',
    (SELECT count(*)::int FROM demands d WHERE d.status = 'completed'
      AND d.invoice_drive_uploaded_at IS NULL
      AND d.invoice_downloaded_at IS NOT NULL),
    'invoice_drive',
    (SELECT count(*)::int FROM demands d WHERE d.status = 'completed'
      AND d.invoice_drive_uploaded_at IS NOT NULL)
  );

  result := result || jsonb_build_object(
    'incomplete_invoices',
    coalesce(
      (SELECT jsonb_agg(row_to_json(t))
       FROM (
         SELECT d.id, d.demand_number::text, coalesce(dr.name, 'Unknown') AS dealer_name
         FROM demands d
         LEFT JOIN dealers dr ON dr.id = d.dealer_id
         WHERE d.status = 'completed' AND d.invoice_drive_uploaded_at IS NULL
         ORDER BY d.updated_at DESC
         LIMIT 10
       ) t),
      '[]'::jsonb
    )
  );

  result := result || jsonb_build_object(
    'statement_30d_total',
    (SELECT count(*)::int FROM demands d
     WHERE d.status = 'completed'
       AND coalesce(d.completed_at, d.updated_at) >= from_30),
    'statement_30d_dealers',
    (SELECT count(DISTINCT d.dealer_id)::int FROM demands d
     WHERE d.status = 'completed'
       AND coalesce(d.completed_at, d.updated_at) >= from_30
       AND d.dealer_id IS NOT NULL)
  );

  result := result || jsonb_build_object(
    'monthly_trend',
    coalesce(
      (SELECT jsonb_agg(row_to_json(m) ORDER BY m.sort_key)
       FROM (
         SELECT
           to_char(mo, 'Mon YYYY') AS month,
           (EXTRACT(epoch FROM mo) * 1000)::bigint AS sort_key,
           (SELECT count(*)::int FROM demands d
            WHERE d.created_at >= mo
              AND d.created_at < mo + interval '1 month') AS demands,
           (SELECT count(*)::int FROM demands d
            WHERE d.created_at >= mo
              AND d.created_at < mo + interval '1 month'
              AND d.status = 'completed') AS completed
         FROM generate_series(
           date_trunc('month', now()) - interval '5 months',
           date_trunc('month', now()),
           interval '1 month'
         ) AS mo
       ) m),
      '[]'::jsonb
    )
  );

  result := result || jsonb_build_object(
    'dealer_demands',
    coalesce(
      (SELECT jsonb_agg(row_to_json(x))
       FROM (
         SELECT coalesce(dr.name, 'Unknown') AS dealer_name,
                count(*)::int AS total,
                count(*) FILTER (WHERE d.status = 'completed')::int AS completed
         FROM demands d
         LEFT JOIN dealers dr ON dr.id = d.dealer_id
         GROUP BY dr.name
         ORDER BY count(*) DESC
         LIMIT 8
       ) x),
      '[]'::jsonb
    )
  );

  result := result || jsonb_build_object(
    'camera_distribution',
    coalesce(
      (SELECT jsonb_agg(row_to_json(c))
       FROM (
         SELECT coalesce(nullif(trim(d.camera_model), ''), 'Unknown') AS model,
                count(*)::int AS count
         FROM demands d
         WHERE d.camera_model IS NOT NULL
         GROUP BY 1
         ORDER BY count(*) DESC
         LIMIT 12
       ) c),
      '[]'::jsonb
    )
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aurora_manager_dashboard_aggregates() TO authenticated;

-- Admin demands: server-side search (parity with smart search basics).
CREATE OR REPLACE FUNCTION public.search_admin_demands(
  p_query text,
  p_dealer_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_exclude_individual boolean DEFAULT true,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS SETOF demands
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT d.*
  FROM demands d
  WHERE (NOT p_exclude_individual OR coalesce(d.is_individual, false) = false)
    AND (p_dealer_id IS NULL OR d.dealer_id = p_dealer_id)
    AND (p_status IS NULL OR p_status = 'all' OR d.status::text = p_status)
    AND (
      p_query IS NULL OR trim(p_query) = '' OR length(regexp_replace(trim(p_query), '\s', '', 'g')) < 3
      OR d.demand_number::text ILIKE '%' || trim(p_query) || '%'
      OR d.stock_number ILIKE '%' || trim(p_query) || '%'
      OR d.vin_last6 ILIKE '%' || trim(p_query) || '%'
      OR regexp_replace(coalesce(d.customer_phone, ''), '\D', '', 'g')
           LIKE '%' || regexp_replace(trim(p_query), '\D', '', 'g') || '%'
      OR upper(d.customer_firstname || d.customer_lastname) ILIKE '%' || upper(regexp_replace(trim(p_query), '\s', '', 'g')) || '%'
      OR upper(d.customer_firstname || ' ' || d.customer_lastname) ILIKE '%' || upper(trim(p_query)) || '%'
    )
  ORDER BY d.created_at DESC
  LIMIT greatest(1, least(p_limit, 500))
  OFFSET greatest(0, p_offset);
$$;

GRANT EXECUTE ON FUNCTION public.search_admin_demands(text, uuid, text, boolean, int, int) TO authenticated;