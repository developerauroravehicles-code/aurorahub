/**
 * Installation consumption is recorded by DB trigger
 * `fn_record_inventory_v2_consumption_for_completed_demand` on demands.status = completed.
 *
 * On each completed installation demand:
 * - One unit is consumed from the dealer inventory location.
 * - If assigned_specialist_id is set, one unit is also consumed from that specialist's field location.
 *
 * Idempotency is per demand + from_location (two consumption rows max per demand).
 * Specialist field stock is assigned via dealer → specialist transfer in Inventory admin.
 */
export const INVENTORY_V2_CONSUMPTION_NOTE =
  'Completed installation demands auto-consume one unit from dealer stock and one from assigned specialist field stock when applicable.'

export const INVENTORY_V2_SPECIALIST_STOCK_NOTE =
  'Specialist field stock is assigned via Inventory → Specialists (dealer to specialist transfer).'
