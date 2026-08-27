import type { SupabaseClient } from '@supabase/supabase-js'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'

export const APPOINTMENT_DURATION_MINUTES = CALENDAR_DEFAULTS.appointmentDurationMinutes

export async function getPoolIdForDealer(
  supabase: SupabaseClient,
  dealerId: string
): Promise<string | null> {
  const { data: dealer } = await supabase
    .from('dealers')
    .select('scheduling_pool_id')
    .eq('id', dealerId)
    .single()

  if (dealer?.scheduling_pool_id) return dealer.scheduling_pool_id

  const { data: fallback } = await supabase
    .from('scheduling_pools')
    .select('id')
    .eq('code', 'DEFAULT')
    .maybeSingle()

  return fallback?.id ?? null
}

export async function getPoolCapacity(
  supabase: SupabaseClient,
  poolId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_scheduling_pool_capacity', {
    p_pool_id: poolId,
  })

  if (error || data == null) {
    const { count } = await countSpecialistsInPool(supabase, poolId)
    return Math.max(count, 1)
  }

  return Math.max(Number(data), 1)
}

async function countSpecialistsInPool(
  supabase: SupabaseClient,
  poolId: string
): Promise<{ count: number }> {
  const { data: dealers } = await supabase
    .from('dealers')
    .select('id')
    .eq('scheduling_pool_id', poolId)

  const dealerIds = (dealers ?? []).map((d) => d.id)
  if (dealerIds.length === 0) return { count: 0 }

  const { data: links } = await supabase
    .from('specialist_dealers')
    .select('specialist_id')
    .in('dealer_id', dealerIds)

  const specialistIds = new Set((links ?? []).map((l) => l.specialist_id))
  return { count: specialistIds.size }
}

export async function getDemandsInPoolForDay(
  supabase: SupabaseClient,
  poolId: string,
  dateStr: string,
  excludeDemandId?: string | null
): Promise<{ appointment_date: string }[]> {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return []

  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const d = parseInt(match[3], 10)
  const start = fromZonedTime(new Date(y, m - 1, d, 0, 0, 0), SYSTEM_DEFAULT_TIMEZONE).toISOString()
  const end = fromZonedTime(new Date(y, m - 1, d, 23, 59, 59, 999), SYSTEM_DEFAULT_TIMEZONE).toISOString()

  const { data: poolDealers } = await supabase
    .from('dealers')
    .select('id')
    .eq('scheduling_pool_id', poolId)

  const dealerIds = (poolDealers ?? []).map((row) => row.id)
  if (dealerIds.length === 0) return []

  let query = supabase
    .from('demands')
    .select('appointment_date')
    .in('dealer_id', dealerIds)
    .gte('appointment_date', start)
    .lte('appointment_date', end)
    .neq('status', 'cancelled')
    .or('is_external.is.null,is_external.eq.false')

  if (excludeDemandId) {
    query = query.neq('id', excludeDemandId)
  }

  const { data } = await query
  return data ?? []
}

export function countOverlapsAtSlot(
  slotStartMs: number,
  slotEndMs: number,
  appointments: { appointment_date: string }[]
): number {
  let count = 0
  for (const appt of appointments) {
    const existingStart = new Date(appt.appointment_date).getTime()
    const existingEnd = existingStart + APPOINTMENT_DURATION_MINUTES * 60 * 1000
    if (slotStartMs < existingEnd && slotEndMs > existingStart) {
      count++
    }
  }
  return count
}

export async function countOverlappingDemandsInPool(
  supabase: SupabaseClient,
  poolId: string,
  slotISO: string,
  excludeDemandId?: string | null
): Promise<number> {
  const slotTime = new Date(slotISO)
  const dateStr = formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
  const appointments = await getDemandsInPoolForDay(supabase, poolId, dateStr, excludeDemandId)
  const slotStart = slotTime.getTime()
  const slotEnd = slotStart + APPOINTMENT_DURATION_MINUTES * 60 * 1000
  return countOverlapsAtSlot(slotStart, slotEnd, appointments)
}

export async function isSlotAvailableForDealer(
  supabase: SupabaseClient,
  dealerId: string,
  slotISO: string,
  excludeDemandId?: string | null
): Promise<boolean> {
  const poolId = await getPoolIdForDealer(supabase, dealerId)
  if (!poolId) return true

  const [capacity, overlapCount] = await Promise.all([
    getPoolCapacity(supabase, poolId),
    countOverlappingDemandsInPool(supabase, poolId, slotISO, excludeDemandId),
  ])

  return overlapCount < capacity
}

export async function isSpecialistDoubleBooked(
  supabase: SupabaseClient,
  specialistId: string,
  appointmentDateISO: string,
  excludeDemandId?: string | null
): Promise<boolean> {
  const slotStart = new Date(appointmentDateISO).getTime()
  const slotEnd = slotStart + APPOINTMENT_DURATION_MINUTES * 60 * 1000

  let query = supabase
    .from('demands')
    .select('id, appointment_date')
    .eq('assigned_specialist_id', specialistId)
    .neq('status', 'cancelled')
    .or('is_external.is.null,is_external.eq.false')

  if (excludeDemandId) {
    query = query.neq('id', excludeDemandId)
  }

  const { data } = await query
  if (!data?.length) return false

  for (const demand of data) {
    const existingStart = new Date(demand.appointment_date).getTime()
    const existingEnd = existingStart + APPOINTMENT_DURATION_MINUTES * 60 * 1000
    if (slotStart < existingEnd && slotEnd > existingStart) {
      return true
    }
  }

  return false
}
