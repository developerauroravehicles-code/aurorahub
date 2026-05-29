import { createClient } from '@/lib/supabase/server'

/**
 * Returns stock numbers that appear in 2+ non-cancelled demands (case-insensitive).
 * Used to show "(Duplicate Stock No)" badge next to demands.
 * Optional dealerId scopes duplicates to a single dealer (Inventory Manager).
 */
export async function getDuplicateStockNumbers(dealerId?: string | null): Promise<Set<string>> {
  const supabase = await createClient()
  let query = supabase
    .from('demands')
    .select('stock_number')
    .neq('status', 'cancelled')
    .not('stock_number', 'is', null)

  if (dealerId) {
    query = query.eq('dealer_id', dealerId)
  }

  const { data } = await query

  const byStock = new Map<string, number>()
  for (const row of data ?? []) {
    const sn = (row.stock_number as string)?.trim().toUpperCase()
    if (!sn) continue
    byStock.set(sn, (byStock.get(sn) ?? 0) + 1)
  }
  const duplicates = new Set<string>()
  for (const [stock, count] of byStock) {
    if (count >= 2) duplicates.add(stock)
  }
  return duplicates
}

/**
 * Check if stock_number already exists in another non-cancelled demand.
 * excludeDemandId: when updating, exclude current demand from check.
 */
export async function isStockNumberDuplicate(
  stockNumber: string,
  excludeDemandId?: string | null,
  dealerId?: string | null
): Promise<{ duplicate: boolean; existingDemandId?: string }> {
  const supabase = await createClient()
  const normalized = (stockNumber || '').trim().toUpperCase()
  if (!normalized) return { duplicate: false }

  let query = supabase
    .from('demands')
    .select('id')
    .neq('status', 'cancelled')
    .ilike('stock_number', normalized)

  if (dealerId) {
    query = query.eq('dealer_id', dealerId)
  }

  if (excludeDemandId) {
    query = query.neq('id', excludeDemandId)
  }

  const { data } = await query.limit(1)
  if (data && data.length > 0) {
    return { duplicate: true, existingDemandId: data[0].id }
  }
  return { duplicate: false }
}
