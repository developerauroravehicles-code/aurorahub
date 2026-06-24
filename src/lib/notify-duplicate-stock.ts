import { createAdminClient } from '@/lib/supabase/admin'
import { isStockNumberDuplicate } from '@/lib/demand-stock'

/**
 * Notify all aurora_manager users when a demand uses a stock number
 * that already exists on another non-cancelled demand.
 * Fire-and-forget: caller should .catch(() => {}).
 */
export async function notifyAuroraManagersIfDuplicateStock(params: {
  demandId: string
  demandNumber?: string | null
  stockNumber: string
  dealerId?: string | null
}): Promise<void> {
  const normalized = (params.stockNumber || '').trim().toUpperCase()
  if (!normalized) return

  const { duplicate } = await isStockNumberDuplicate(
    normalized,
    params.demandId,
    params.dealerId
  )
  if (!duplicate) return

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return
  }

  const { data: managers } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'aurora_manager')

  if (!managers?.length) return

  const demandLabel = params.demandNumber ? `#${params.demandNumber}` : params.demandId.slice(0, 8)
  const payload = {
    demandId: params.demandId,
    demandNumber: params.demandNumber ?? null,
    stockNumber: normalized,
    link: `/dashboard/admin/demands/${params.demandId}`,
    message: `Duplicate stock number ${normalized} on demand ${demandLabel}. Please verify.`,
  }

  const { error } = await admin.from('comm_notifications').insert(
    managers.map((m: { id: string }) => ({
      user_id: m.id,
      type: 'duplicate_stock_number' as const,
      payload,
    }))
  )

  if (error) {
    console.error('notifyAuroraManagersIfDuplicateStock failed:', error.message)
  }
}
