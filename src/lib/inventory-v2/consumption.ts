/**
 * Installation consumption is recorded by DB trigger
 * `fn_record_inventory_v2_consumption_for_completed_demand` on demands.status = completed.
 * Dealer stock is decremented; specialist stock is updated only via manual transfer.
 */
export const INVENTORY_V2_CONSUMPTION_NOTE =
  'Completed installation demands auto-consume one unit from the dealer inventory location.'
