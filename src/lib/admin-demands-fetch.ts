import type { createClient } from '@/lib/supabase/server'

export const ADMIN_DEMANDS_LIST_SELECT =
  '*, dealers(name, warranty_years, region_codes(timezone_id, timezones(name))), profiles!demands_created_by_fkey(full_name), assigned_specialist:profiles!demands_assigned_specialist_id_fkey(full_name), assigned_finance:profiles!demands_assigned_finance_id_fkey(full_name)'

export const ADMIN_DEMANDS_PAGE_SIZE = 100
export const ADMIN_DEMANDS_SEARCH_MAX = 500

type Supabase = Awaited<ReturnType<typeof createClient>>

function escapeIlike(q: string): string {
  return q.replace(/[%_\\]/g, '\\$&')
}

function applySmartSearchFilter<T extends { or: (f: string) => T }>(query: T, rawQ: string): T {
  const q = rawQ.trim()
  if (q.length < 3) return query
  const escaped = escapeIlike(q)
  const digits = q.replace(/\D/g, '')
  const parts = [
    `demand_number.ilike.%${escaped}%`,
    `stock_number.ilike.%${escaped}%`,
    `vin_last6.ilike.%${escaped}%`,
    `customer_firstname.ilike.%${escaped}%`,
    `customer_lastname.ilike.%${escaped}%`,
  ]
  if (digits.length >= 3) {
    parts.push(`customer_phone.ilike.%${digits}%`)
  }
  return query.or(parts.join(','))
}

export async function fetchAdminDemandsPage(
  supabase: Supabase,
  opts: {
    dealerId?: string | null
    status?: string | null
    q?: string | null
    page?: number
    pageSize?: number
    excludeIndividual?: boolean
    isIndividualOnly?: boolean
  }
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1)
  const hasSearch = !!(opts.q && opts.q.trim().length >= 3)
  const pageSize = Math.min(
    hasSearch ? ADMIN_DEMANDS_SEARCH_MAX : (opts.pageSize ?? ADMIN_DEMANDS_PAGE_SIZE),
    ADMIN_DEMANDS_SEARCH_MAX
  )
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('demands')
    .select(ADMIN_DEMANDS_LIST_SELECT, { count: 'exact' })

  if (opts.isIndividualOnly) {
    query = query.eq('is_individual', true)
  } else if (opts.excludeIndividual !== false) {
    query = query.or('is_individual.is.null,is_individual.eq.false')
  }

  if (opts.dealerId) {
    query = query.eq('dealer_id', opts.dealerId)
  }

  const status = opts.status?.trim()
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (hasSearch) {
    query = applySmartSearchFilter(query, opts.q!)
  }

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to)
  if (error) throw error

  return { data: (data ?? []) as Record<string, unknown>[], total: count ?? data?.length ?? 0 }
}