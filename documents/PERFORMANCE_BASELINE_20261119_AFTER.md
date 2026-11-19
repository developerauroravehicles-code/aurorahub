# Performance — post-optimization (2026-11-19)

## Code changes summary

| Area | Change |
|------|--------|
| DB | `duplicate_stock_numbers`, `demand_status_counts`, `aurora_manager_dashboard_aggregates` RPCs; indexes on stock/completed_at |
| Admin demands | Server pagination (100/page), server search via `q` + Enter |
| Dashboard AM | Overview via RPC; finance month query narrowed; camera distribution from RPC |
| Invoices | Default last 3 calendar months when no filter |
| UI | `loading.tsx` on heavy routes; `recharts` in `optimizePackageImports`; cached system logo |
| Monitoring | `demand_status_counts` RPC with fallback |

## Apply migration

Run [`supabase/migrations/20261120120000_performance_rpc_indexes.sql`](../supabase/migrations/20261120120000_performance_rpc_indexes.sql) on Supabase.

## Re-measure

```bash
npm run perf:test
npm run build
npm test
```

Record Lighthouse TTFB on the same routes as [`PERFORMANCE_BASELINE_20261119.md`](PERFORMANCE_BASELINE_20261119.md).

## Regression checklist

- [ ] Admin demands: filters, search (Enter), pagination, external create, duplicate badge
- [ ] AM dashboard widgets vs SQL spot-check
- [ ] Invoices: default 3-month window; “All time” still works in date filter
- [ ] Individual sales demands pagination
- [ ] CRM / SMS / cron unchanged