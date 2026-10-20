# Barcode–Inventory E2E checklist

Run on **staging** after migrations. Record pass/fail and notes per row.

| # | Scenario | Verify |
|---|----------|--------|
| 1 | Generate 1 unit barcode | Registry `generated`; optional print/Excel |
| 2 | Assign to dealer | `at_dealer`; receipt movement on dealer location |
| 3 | Assign to specialist | `at_specialist`; transfer movement |
| 4 | Specialist complete — installation — **2 different models** | 2× `consumed`; 2 consumption rows (different `camera_model_id`); no duplicate key |
| 5 | External demand — completed on create — **2 barcodes** | Demand `completed`; no error; both consumed |
| 6 | External demand — **transfer** without barcodes | Creates OK; no consume |
| 6b | External demand — transfer **with** optional barcode | `consumed` + specialist consumption movement |
| 7 | Set flow (`setAutoGenerateUnitBarcodes: false`) | Set scan then unit link |
| 8 | Release consumed | `at_specialist`; adjustment +1; event `release_consumed` |
| 9 | Register printed label | `generated`; event metadata `registered_existing_label` |
| 10 | External demand fail mid-consume (force 2nd invalid code) | No orphan `consumed` without demand; specialist stock restored |

## Per-barcode SQL

```sql
SELECT id, code, status, specialist_id, demand_id, camera_model_id
FROM inventory_barcodes WHERE code ILIKE '%YOUR_CODE%';

SELECT event_type, created_at, metadata
FROM inventory_barcode_events
WHERE barcode_id IN (SELECT id FROM inventory_barcodes WHERE code ILIKE '%YOUR_CODE%')
ORDER BY created_at;

SELECT * FROM inventory_movements_v2
WHERE reference_demand_id = 'DEMAND_UUID_HERE';
```

## Pre-flight

Run [`barcode_inventory_migration_audit.sql`](./barcode_inventory_migration_audit.sql) — all expectations green.
