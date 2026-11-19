import type { SupabaseClient } from '@supabase/supabase-js'

export const INDIVIDUAL_SALES_BASE = '/dashboard/admin/individual-sales'
export const INDIVIDUAL_SALES_DEMANDS = `${INDIVIDUAL_SALES_BASE}/demands`
export const INDIVIDUAL_SALES_CUSTOMERS = `${INDIVIDUAL_SALES_BASE}/customers`
export const INDIVIDUAL_SALES_INVOICES = `${INDIVIDUAL_SALES_BASE}/invoices`

export async function getIndividualSalesDealerId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from('dealers')
    .select('id')
    .eq('is_individual_sales_hub', true)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function getIndividualSalesDealerIdOrThrow(supabase: SupabaseClient): Promise<string> {
  const id = await getIndividualSalesDealerId(supabase)
  if (!id) {
    throw new Error(
      'Individual Sales dealer is not configured. Apply migration 20261119180000_individual_sales.sql.'
    )
  }
  return id
}