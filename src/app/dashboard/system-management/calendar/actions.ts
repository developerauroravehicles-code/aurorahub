'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getISODay } from 'date-fns'
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { pad2 } from '@/lib/calendar-wall-date'
import { getSlotMinutesFromConfig, CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'

export async function createCalendarSetting(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['aurora_manager', 'it'].includes(profile.role)) {
    return { success: false, error: 'Only Aurora Managers or IT can manage calendar settings' }
  }

  const dealerId = formData.get('dealerId') as string
  const dayType = formData.get('dayType') as string
  const startHour = parseInt(formData.get('startHour') as string)
  const endHour = parseInt(formData.get('endHour') as string)
  const slotIntervalMinutes = parseInt(formData.get('slotIntervalMinutes') as string)
  const appointmentDurationMinutes = parseInt(formData.get('appointmentDurationMinutes') as string)

  const validDayTypes = ['weekday', 'saturday', 'sunday'] as const
  if (!dealerId || !dayType || isNaN(startHour) || isNaN(endHour) || isNaN(slotIntervalMinutes) || isNaN(appointmentDurationMinutes)) {
    return { success: false, error: 'Missing required fields' }
  }
  if (!validDayTypes.includes(dayType as typeof validDayTypes[number])) {
    return { success: false, error: 'Invalid day type. Must be weekday, saturday, or sunday.' }
  }

  if (startHour >= endHour) {
    return { success: false, error: 'Start hour must be before end hour' }
  }

  // Check if setting already exists
  const { data: existing } = await supabase
    .from('dealer_calendar_settings')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('day_type', dayType)
    .single()

  if (existing) {
    return { success: false, error: 'Calendar setting for this dealer and day type already exists. Please update instead.' }
  }

  const { error } = await supabase
    .from('dealer_calendar_settings')
    .insert({
      dealer_id: dealerId,
      day_type: dayType,
      start_hour: startHour,
      end_hour: endHour,
      slot_interval_minutes: slotIntervalMinutes,
      appointment_duration_minutes: appointmentDurationMinutes
    })

  if (error) {
    console.error('Error creating calendar setting:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/configuration/calendar')
  return { success: true }
}

export async function updateCalendarSetting(
  settingId: string,
  startHour: number,
  endHour: number,
  slotIntervalMinutes: number,
  appointmentDurationMinutes: number
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['aurora_manager', 'it'].includes(profile.role)) {
    return { success: false, error: 'Only Aurora Managers or IT can manage calendar settings' }
  }

  if (startHour >= endHour) {
    return { success: false, error: 'Start hour must be before end hour' }
  }

  const { error } = await supabase
    .from('dealer_calendar_settings')
    .update({
      start_hour: startHour,
      end_hour: endHour,
      slot_interval_minutes: slotIntervalMinutes,
      appointment_duration_minutes: appointmentDurationMinutes
    })
    .eq('id', settingId)

  if (error) {
    console.error('Error updating calendar setting:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/configuration/calendar')
  return { success: true }
}

export async function deleteCalendarSetting(settingId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user is Aurora Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['aurora_manager', 'it'].includes(profile.role)) {
    return { success: false, error: 'Only Aurora Managers or IT can manage calendar settings' }
  }

  const { error } = await supabase
    .from('dealer_calendar_settings')
    .delete()
    .eq('id', settingId)

  if (error) {
    console.error('Error deleting calendar setting:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/configuration/calendar')
  return { success: true }
}

// --- Dealer calendar blocks (slot/day closing) ---

export async function getCalendarBlocks(dealerId: string, fromDate: string, toDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dealer_calendar_blocks')
    .select('id, dealer_id, block_date, start_minutes, end_minutes, created_at')
    .eq('dealer_id', dealerId)
    .gte('block_date', fromDate)
    .lte('block_date', toDate)
    .order('block_date', { ascending: true })
    .order('start_minutes', { ascending: true })

  if (error) {
    console.error('Error fetching calendar blocks:', error)
    return []
  }
  return data || []
}

/** All blocks in date range (any dealer) for admin calendar management. */
export async function getCalendarBlocksInRange(fromDate: string, toDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dealer_calendar_blocks')
    .select('id, dealer_id, block_date, start_minutes, end_minutes, created_at')
    .gte('block_date', fromDate)
    .lte('block_date', toDate)
    .order('block_date', { ascending: true })
    .order('start_minutes', { ascending: true })

  if (error) {
    console.error('Error fetching calendar blocks:', error)
    return []
  }
  return data || []
}

/**
 * Get appointment times already taken on a date (all demands including external).
 * Shared system - one slot taken = blocked for all. Uses Pacific Time (PT).
 */
export async function getTakenSlots(dateStr: string): Promise<string[]> {
  const supabase = await createClient()
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return []
  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const d = parseInt(match[3], 10)
  const isoDay = `${y}-${pad2(m)}-${pad2(d)}`
  const start = toDate(`${isoDay}T00:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }).toISOString()
  const end = toDate(`${isoDay}T23:59:59.999`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }).toISOString()
  const { data } = await supabase
    .from('demands')
    .select('appointment_date')
    .gte('appointment_date', start)
    .lte('appointment_date', end)
    .neq('status', 'cancelled')
    .or('is_external.is.null,is_external.eq.false')
  if (!data || data.length === 0) return []
  return data.map((r: { appointment_date: string }) => r.appointment_date)
}

/** Get blocks for a single date (for demand form slot filtering). */
export async function getDealerBlocksForDate(dealerId: string, dateStr: string): Promise<{ start_minutes: number; end_minutes: number }[]> {
  if (!dealerId || !dateStr) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dealer_calendar_blocks')
    .select('start_minutes, end_minutes')
    .eq('dealer_id', dealerId)
    .eq('block_date', dateStr)

  if (error) return []
  return (data || []).map((r: { start_minutes: number; end_minutes: number }) => ({
    start_minutes: r.start_minutes,
    end_minutes: r.end_minutes
  }))
}

export type CalendarSetting = {
  day_type: string
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
}

/** Get calendar settings for a dealer (for external demand form). Returns weekday/saturday/sunday. */
export async function getCalendarSettingsForDealer(dealerId: string): Promise<{ weekday?: CalendarSetting; saturday?: CalendarSetting; sunday?: CalendarSetting }> {
  if (!dealerId) return {}
  const supabase = await createClient()
  const { data } = await supabase
    .from('dealer_calendar_settings')
    .select('day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes')
    .eq('dealer_id', dealerId)
  const out: { weekday?: CalendarSetting; saturday?: CalendarSetting; sunday?: CalendarSetting } = {}
  ;(data || []).forEach((s: CalendarSetting) => {
    if (s.day_type === 'weekday') out.weekday = s
    else if (s.day_type === 'saturday') out.saturday = s
    else if (s.day_type === 'sunday') out.sunday = s
  })
  return out
}

export async function createCalendarBlock(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['aurora_manager', 'it'].includes(profile.role)) {
    return { success: false, error: 'Only Aurora Managers or IT can manage calendar blocks' }
  }

  const dealerId = formData.get('dealerId') as string
  const blockDate = formData.get('blockDate') as string
  const wholeDay = formData.get('wholeDay') === 'true'
  const startMinutes = wholeDay ? 0 : parseInt(formData.get('startMinutes') as string, 10)
  const endMinutes = wholeDay ? 1440 : parseInt(formData.get('endMinutes') as string, 10)

  if (!dealerId || !blockDate) return { success: false, error: 'Dealer and date are required' }
  if (!wholeDay && (isNaN(startMinutes) || isNaN(endMinutes) || startMinutes >= endMinutes)) {
    return { success: false, error: 'Invalid time range' }
  }

  const { error } = await supabase.from('dealer_calendar_blocks').insert({
    dealer_id: dealerId,
    block_date: blockDate,
    start_minutes: wholeDay ? 0 : startMinutes,
    end_minutes: wholeDay ? 1440 : endMinutes
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuration/calendar')
  return { success: true }
}

/** Create multiple blocks at once (e.g. multiple selected slots). */
export async function createCalendarBlocks(
  dealerId: string,
  blockDate: string,
  blocks: { start_minutes: number; end_minutes: number }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['aurora_manager', 'it'].includes(profile.role)) {
    return { success: false, error: 'Only Aurora Managers or IT can manage calendar blocks' }
  }

  if (!dealerId || !blockDate || !blocks.length) {
    return { success: false, error: 'Dealer, date and at least one slot are required' }
  }

  const rows = blocks.map(({ start_minutes, end_minutes }) => ({
    dealer_id: dealerId,
    block_date: blockDate,
    start_minutes,
    end_minutes
  }))

  const { error } = await supabase.from('dealer_calendar_blocks').insert(rows)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuration/calendar')
  return { success: true }
}

export async function deleteCalendarBlock(blockId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['aurora_manager', 'it'].includes(profile.role)) {
    return { success: false, error: 'Only Aurora Managers or IT can manage calendar blocks' }
  }

  const { error } = await supabase.from('dealer_calendar_blocks').delete().eq('id', blockId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuration/calendar')
  return { success: true }
}

/**
 * Validate that an appointment slot is allowed for a dealer: within dealer hours and not blocked.
 * Used by createDemand and any flow that books appointments. Single calendar system.
 */
export async function validateAppointmentSlot(
  dealerId: string,
  appointmentDateISO: string,
  options?: { allowPast?: boolean }
): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createClient()
  const slotTime = new Date(appointmentDateISO)
  if (isNaN(slotTime.getTime())) return { valid: false, error: 'Invalid appointment time' }

  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('id', dealerId)
    .single()
  if (!dealer) return { valid: false, error: 'Dealer not found' }

  // Appointments stored as Pacific Time (PT)
  const dateStr = formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
  const startMinutes = parseInt(formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'H'), 10) * 60 +
    parseInt(formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'm'), 10)
  const duration = CALENDAR_DEFAULTS.appointmentDurationMinutes
  const endMinutes = startMinutes + duration

  const [y, mo, d] = dateStr.split('-').map(Number)
  const dayOfWeek = new Date(y, mo - 1, d).getDay()
  const dayType: 'weekday' | 'saturday' | 'sunday' = dayOfWeek === 6 ? 'saturday' : dayOfWeek === 0 ? 'sunday' : 'weekday'

  const { data: settings } = await supabase
    .from('dealer_calendar_settings')
    .select('start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes')
    .eq('dealer_id', dealerId)
    .eq('day_type', dayType)
    .maybeSingle()

  const slotStarts = settings
    ? getSlotMinutesFromConfig({
        startHour: settings.start_hour,
        endHour: settings.end_hour,
        slotIntervalMinutes: settings.slot_interval_minutes,
        appointmentDurationMinutes: settings.appointment_duration_minutes,
      })
    : getDefaultSlotMinutes()
  const durationUsed = settings?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes
  const lastAllowedEnd = settings
    ? settings.end_hour * 60
    : CALENDAR_DEFAULTS.endHour * 60 + CALENDAR_DEFAULTS.endMinute

  if (!slotStarts.includes(startMinutes)) {
    return { valid: false, error: 'Selected time is not a valid slot for this dealer\'s calendar.' }
  }
  if (startMinutes + durationUsed > lastAllowedEnd) {
    return { valid: false, error: 'Selected time is outside dealer working hours.' }
  }

  const blocks = await getDealerBlocksForDate(dealerId, dateStr)
  const inBlock = blocks.some(
    b => startMinutes < b.end_minutes && endMinutes > b.start_minutes
  )
  if (inBlock) {
    return { valid: false, error: 'Selected slot is closed for this dealer.' }
  }

  // Reject past dates and past slots - unless allowPast (e.g. external retroactive demands)
  const allowPast = !!options?.allowPast
  if (!allowPast) {
    const now = new Date()
    const slotDateInPacific = formatInTimeZone(slotTime, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    const todayInPacific = formatInTimeZone(now, SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    if (slotDateInPacific < todayInPacific) {
      return { valid: false, error: 'Cannot create appointments for past dates. Please select today or a future date.' }
    }
    if (slotDateInPacific === todayInPacific && slotTime.getTime() <= now.getTime()) {
      return { valid: false, error: 'This time slot has already passed. Please select a future time.' }
    }
  }

  return { valid: true }
}

function getDefaultSlotMinutes(): number[] {
  return getSlotMinutesFromConfig({
    startHour: CALENDAR_DEFAULTS.startHour,
    endHour: CALENDAR_DEFAULTS.endHour,
    endMinute: CALENDAR_DEFAULTS.endMinute,
    slotIntervalMinutes: CALENDAR_DEFAULTS.slotIntervalMinutes,
    appointmentDurationMinutes: CALENDAR_DEFAULTS.appointmentDurationMinutes,
  })
}

/**
 * Get available appointment slots for a dealer on a date (for Edit Demand modal).
 * Uses dealer hours, blocks, and existing demands. Optionally exclude one demand's appointment when editing.
 */
export async function getAvailableSlotsForEdit(
  dealerId: string,
  dateStr: string,
  excludeDemandId?: string | null
): Promise<{ slots: string[]; timezoneName: string | null }> {
  const supabase = await createClient()
  const [y, mo, d] = dateStr.split('-').map(Number)
  // Slots are generated in Pacific; weekday vs weekend follows that wall calendar
  const ptTz = SYSTEM_DEFAULT_TIMEZONE
  const isoDayStr = `${y}-${pad2(mo)}-${pad2(d)}`
  const isoDow = getISODay(toDate(`${isoDayStr}T12:00:00`, { timeZone: ptTz }))
  const dayType: 'weekday' | 'saturday' | 'sunday' =
    isoDow === 7 ? 'sunday' : isoDow === 6 ? 'saturday' : 'weekday'

  const { data: dealer } = await supabase
    .from('dealers')
    .select('id, region_codes(timezone_id, timezones(name))')
    .eq('id', dealerId)
    .single()
  const { getTimezoneFromDealer } = await import('@/lib/dealer-timezone')
  const timezoneName = getTimezoneFromDealer(dealer as Parameters<typeof getTimezoneFromDealer>[0]) ?? null

  const { data: settings } = await supabase
    .from('dealer_calendar_settings')
    .select('start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes')
    .eq('dealer_id', dealerId)
    .eq('day_type', dayType)
    .maybeSingle()

  const slotMinutes = settings
    ? getSlotMinutesFromConfig({
        startHour: settings.start_hour,
        endHour: settings.end_hour,
        slotIntervalMinutes: settings.slot_interval_minutes,
        appointmentDurationMinutes: settings.appointment_duration_minutes,
      })
    : getDefaultSlotMinutes()
  const duration = settings?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes

  const slots: string[] = []
  const isoDay = `${y}-${pad2(mo)}-${pad2(d)}`
  for (const startMinutes of slotMinutes) {
    const h = Math.floor(startMinutes / 60)
    const mins = startMinutes % 60
    const wall = `${isoDay}T${pad2(h)}:${pad2(mins)}:00`
    slots.push(toDate(wall, { timeZone: ptTz }).toISOString())
  }

  const blocks = await getDealerBlocksForDate(dealerId, dateStr)
  let availableSlots = slots.filter(slot => {
    if (blocks.length === 0) return true
    const slotTime = new Date(slot)
    const slotStartMinutes = parseInt(formatInTimeZone(slotTime, ptTz, 'H'), 10) * 60 +
      parseInt(formatInTimeZone(slotTime, ptTz, 'm'), 10)
    const slotEndMinutes = slotStartMinutes + duration
    const inBlock = blocks.some(b => slotStartMinutes < b.end_minutes && slotEndMinutes > b.start_minutes)
    return !inBlock
  })

  const startOfDayISO = toDate(`${isoDay}T00:00:00`, { timeZone: ptTz }).toISOString()
  const endOfDayISO = toDate(`${isoDay}T23:59:59.999`, { timeZone: ptTz }).toISOString()
  let query = supabase
    .from('demands')
    .select('appointment_date')
    .gte('appointment_date', startOfDayISO)
    .lte('appointment_date', endOfDayISO)
    .neq('status', 'cancelled')
  if (excludeDemandId) {
    query = query.neq('id', excludeDemandId)
  }
  const { data: taken } = await query
  const takenSet = new Set((taken || []).map((r: { appointment_date: string }) => r.appointment_date))
  const durationMs = duration * 60 * 1000
  availableSlots = availableSlots.filter(slot => {
    const slotStart = new Date(slot).getTime()
    const slotEnd = slotStart + durationMs
    for (const takenDate of takenSet) {
      const tStart = new Date(takenDate).getTime()
      const tEnd = tStart + durationMs
      if (slotStart < tEnd && slotEnd > tStart) return false
    }
    return true
  })

  // Filter out past slots for today - system base = Pacific (PT)
  const now = Date.now()
  const todayInPacific = formatInTimeZone(new Date(), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
  if (dateStr === todayInPacific) {
    availableSlots = availableSlots.filter(slot => new Date(slot).getTime() > now)
  }

  return { slots: availableSlots, timezoneName }
}

