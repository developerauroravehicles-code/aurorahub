# Performance Baseline — 2026-11-19 (pre-optimization)

Static scan: `npm run perf:test` (see `performance-reports/performance-report-*.md`).

## Critical routes (measure after login on preview/prod)

| Route | Metric to record | Notes |
|-------|------------------|--------|
| `/dashboard` (aurora_manager) | TTFB, LCP | Full demands load pre-fix |
| `/dashboard/admin/demands` | TTFB, payload | Up to all demands × 1000/chunk |
| `/dashboard/admin/customers` | TTFB | `customer_directory_summaries` RPC |
| `/dashboard/admin/invoices` | TTFB | Unbounded completed rows if no date filter |
| `/dashboard/sales/demands` | TTFB | Dealer-scoped full list |
| `/dashboard/specialist/work` | TTFB | Multiple unbounded queries |

## Static audit snapshot (2026-11-19)

| Check | Result |
|-------|--------|
| `select('*')` files | 20 (warning) |
| Client components | 193 (25 large) |
| `optimizePackageImports` | lucide, date-fns enabled |
| compress / images config | OK |

## Post-optimization

Re-run Lighthouse (`npm run perf:lighthouse`), same route table, and `npm run perf:test`. Compare TTFB and static warnings in `PERFORMANCE_BASELINE_20261119_AFTER.md`.