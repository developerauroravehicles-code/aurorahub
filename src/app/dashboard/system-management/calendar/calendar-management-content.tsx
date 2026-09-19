'use client'

import { useState } from 'react'
import { Trash2, CalendarX2, Clock } from 'lucide-react'
import { getGlobalSlotMinutes, getSlotMinutesFromConfig, CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'
import { SchedulingPoolsPanel } from './scheduling-pools-panel'
import { DealerDayHoursColumn, type DealerHoursSetting } from './dealer-day-hours-column'
import { DealerWeeklyClosedRow } from './dealer-weekly-closed-row'
import {
  DEALER_CALENDAR_DAY_TYPES,
  ISO_WEEKDAY_LABELS,
  resolveCalendarSettingForIsoDow,
  buildCalendarSettingsMap,
  type DealerCalendarDayType,
} from '@/lib/dealer-calendar-day-type'
import { getISODay } from 'date-fns'
import { toDate } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

interface CalendarBlock {
  id: string
  dealer_id: string
  block_date: string
  start_minutes: number
  end_minutes: number
  created_at?: string
}

interface CalendarSetting extends DealerHoursSetting {
  dealers?: { name: string }
}

const HOUR_DAY_COLUMNS: { dayType: DealerCalendarDayType; label: string }[] =
  DEALER_CALENDAR_DAY_TYPES.map((dayType, i) => ({
    dayType,
    label: ISO_WEEKDAY_LABELS[i]?.label ?? dayType,
  }))

interface Dealer {
  id: string
  name: string
  scheduling_pool_id?: string | null
}

type SchedulingPoolRow = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  dealer_count: number
  specialist_count: number
  specialists: { id: string; full_name: string }[]
  dealers: { id: string; name: string; scheduling_pool_id?: string | null }[]
}

interface CalendarManagementContentProps {
  settings: CalendarSetting[]
  dealers: Dealer[]
  blocks: CalendarBlock[]
  weeklyClosedDays: { dealer_id: string; iso_dow: number }[]
  schedulingPools: SchedulingPoolRow[]
  specialists: { id: string; full_name: string }[]
  createCalendarSetting: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateCalendarSetting: (settingId: string, startHour: number, endHour: number, slotIntervalMinutes: number, appointmentDurationMinutes: number) => Promise<{ success: boolean; error?: string }>
  deleteCalendarSetting: (settingId: string) => Promise<{ success: boolean; error?: string }>
  createCalendarBlock: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  createCalendarBlocks: (dealerId: string, blockDate: string, blocks: { start_minutes: number; end_minutes: number }[]) => Promise<{ success: boolean; error?: string }>
  deleteCalendarBlock: (blockId: string) => Promise<{ success: boolean; error?: string }>
  saveDealerWeeklyClosedDays: (
    dealerId: string,
    closedIsoDays: number[]
  ) => Promise<{ success: boolean; error?: string }>
  createSchedulingPool: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateSchedulingPool: (
    poolId: string,
    code: string,
    name: string,
    description: string | null,
    isActive: boolean
  ) => Promise<{ success: boolean; error?: string }>
  deleteSchedulingPool: (poolId: string) => Promise<{ success: boolean; error?: string }>
  assignDealerToSchedulingPool: (
    dealerId: string,
    poolId: string | null
  ) => Promise<{ success: boolean; error?: string }>
  assignSpecialistToSchedulingPool: (
    poolId: string,
    specialistId: string
  ) => Promise<{ success: boolean; error?: string }>
  removeSpecialistFromSchedulingPool: (
    poolId: string,
    specialistId: string
  ) => Promise<{ success: boolean; error?: string }>
}

/** Global calendar slots (09:00–16:30, 90 min interval). Same as demand form. */
function getSlotsForCloseUI(): { start_minutes: number; end_minutes: number; label: string }[] {
  const duration = CALENDAR_DEFAULTS.appointmentDurationMinutes
  return getGlobalSlotMinutes().map(start_minutes => ({
    start_minutes,
    end_minutes: start_minutes + duration,
    label: `${String(Math.floor(start_minutes / 60)).padStart(2, '0')}:${String(start_minutes % 60).padStart(2, '0')}`
  }))
}

/** Slots for close UI for a specific dealer and date – uses per-day dealer hours when set. */
function getSlotsForDealerDate(
  dealerId: string,
  blockDate: string,
  getSetting: (dealerId: string, dayType: DealerCalendarDayType) => CalendarSetting | undefined
): { start_minutes: number; end_minutes: number; label: string }[] {
  const isoDow = getISODay(toDate(`${blockDate}T12:00:00`, { timeZone: SYSTEM_DEFAULT_TIMEZONE }))
  const settingsMap = buildCalendarSettingsMap(
    DEALER_CALENDAR_DAY_TYPES.map(dt => getSetting(dealerId, dt)).filter(Boolean) as CalendarSetting[]
  )
  const resolved = resolveCalendarSettingForIsoDow(settingsMap, isoDow)
  const slotMinutes = resolved
    ? getSlotMinutesFromConfig({
        startHour: resolved.start_hour,
        endHour: resolved.end_hour,
        slotIntervalMinutes: resolved.slot_interval_minutes,
        appointmentDurationMinutes: resolved.appointment_duration_minutes,
      })
    : getGlobalSlotMinutes()
  const duration = resolved?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes
  return slotMinutes.map(start_minutes => ({
    start_minutes,
    end_minutes: start_minutes + duration,
    label: `${String(Math.floor(start_minutes / 60)).padStart(2, '0')}:${String(start_minutes % 60).padStart(2, '0')}`
  }))
}

function formatBlockLabel(block: CalendarBlock): string {
  const d = new Date(block.block_date + 'T12:00:00')
  const dateStr = d.toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' })
  if (block.start_minutes === 0 && block.end_minutes === 1440) {
    return `${dateStr} (all day)`
  }
  const sh = Math.floor(block.start_minutes / 60)
  const sm = block.start_minutes % 60
  const eh = Math.floor(block.end_minutes / 60)
  const em = block.end_minutes % 60
  return `${dateStr} ${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}-${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

export function CalendarManagementContent({
  settings = [],
  dealers,
  blocks,
  weeklyClosedDays = [],
  schedulingPools,
  specialists,
  createCalendarSetting,
  updateCalendarSetting,
  deleteCalendarSetting,
  createCalendarBlock,
  createCalendarBlocks,
  deleteCalendarBlock,
  saveDealerWeeklyClosedDays,
  createSchedulingPool,
  updateSchedulingPool,
  deleteSchedulingPool,
  assignDealerToSchedulingPool,
  assignSpecialistToSchedulingPool,
  removeSpecialistFromSchedulingPool,
}: CalendarManagementContentProps) {
  const [showAddHoursFor, setShowAddHoursFor] = useState<{ dealerId: string; dayType: DealerCalendarDayType } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [blockError, setBlockError] = useState<string | null>(null)
  const [blockSuccess, setBlockSuccess] = useState<string | null>(null)
  const [blockDateByDealer, setBlockDateByDealer] = useState<Record<string, string>>({})
  const [selectedSlotsByDealer, setSelectedSlotsByDealer] = useState<Record<string, { start_minutes: number; end_minutes: number }[]>>({})

  const handleCreate = async (formData: FormData) => {
    setError(null)
    setSuccess(null)
    const result = await createCalendarSetting(formData)
    if (result.success) {
      setSuccess('Calendar setting created successfully!')
      setShowAddHoursFor(null)
      // Reset form by reloading
      window.location.reload()
    } else {
      setError(result.error || 'Failed to create calendar setting')
    }
  }

  const handleUpdate = async (settingId: string, formData: FormData) => {
    setError(null)
    setSuccess(null)
    const startHour = parseInt(formData.get('startHour') as string)
    const endHour = parseInt(formData.get('endHour') as string)
    const slotIntervalMinutes = parseInt(formData.get('slotIntervalMinutes') as string)
    const appointmentDurationMinutes = parseInt(formData.get('appointmentDurationMinutes') as string)

    const result = await updateCalendarSetting(settingId, startHour, endHour, slotIntervalMinutes, appointmentDurationMinutes)
    if (result.success) {
      setSuccess('Calendar setting updated successfully!')
      setEditingId(null)
      window.location.reload()
    } else {
      setError(result.error || 'Failed to update calendar setting')
    }
  }

  const handleDelete = async (settingId: string) => {
    if (!confirm('Are you sure you want to delete this calendar setting?')) return

    setError(null)
    setSuccess(null)
    const result = await deleteCalendarSetting(settingId)
    if (result.success) {
      setSuccess('Calendar setting deleted successfully!')
      window.location.reload()
    } else {
      setError(result.error || 'Failed to delete calendar setting')
    }
  }

  const handleCloseEntireDay = async (dealerId: string, blockDate: string) => {
    setBlockError(null)
    setBlockSuccess(null)
    const fd = new FormData()
    fd.set('dealerId', dealerId)
    fd.set('blockDate', blockDate)
    fd.set('wholeDay', 'true')
    const result = await createCalendarBlock(fd)
    if (result.success) {
      setBlockSuccess('Day closed successfully.')
      window.location.reload()
    } else {
      setBlockError(result.error || 'Failed to close day.')
    }
  }

  const handleCloseSelectedSlots = async (dealerId: string, blockDate: string, slots: { start_minutes: number; end_minutes: number }[]) => {
    setBlockError(null)
    setBlockSuccess(null)
    if (slots.length === 0) {
      setBlockError('Please select at least one slot to close.')
      return
    }
    const result = await createCalendarBlocks(dealerId, blockDate, slots)
    if (result.success) {
      setBlockSuccess('Selected slots closed successfully.')
      setSelectedSlotsByDealer(prev => ({ ...prev, [dealerId]: [] }))
      window.location.reload()
    } else {
      setBlockError(result.error || 'Failed to close slots.')
    }
  }

  const toggleSlotSelection = (dealerId: string, slot: { start_minutes: number; end_minutes: number }) => {
    setSelectedSlotsByDealer(prev => {
      const current = prev[dealerId] || []
      const exists = current.some(s => s.start_minutes === slot.start_minutes && s.end_minutes === slot.end_minutes)
      if (exists) {
        return { ...prev, [dealerId]: current.filter(s => !(s.start_minutes === slot.start_minutes && s.end_minutes === slot.end_minutes)) }
      }
      return { ...prev, [dealerId]: [...current, slot] }
    })
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Remove this block? Closed slots will become available again.')) return
    setBlockError(null)
    setBlockSuccess(null)
    const result = await deleteCalendarBlock(blockId)
    if (result.success) {
      setBlockSuccess('Block removed.')
      window.location.reload()
    } else {
      setBlockError(result.error || 'Failed to remove block.')
    }
  }

  const settingsByDealer = new Map<string, CalendarSetting[]>()
  settings.forEach(setting => {
    if (!settingsByDealer.has(setting.dealer_id)) {
      settingsByDealer.set(setting.dealer_id, [])
    }
    settingsByDealer.get(setting.dealer_id)!.push(setting)
  })

  const getSetting = (dealerId: string, dayType: DealerCalendarDayType) => {
    const list = settingsByDealer.get(dealerId)
    const found = list?.find(s => s.day_type === dayType)
    if (found) return found
    if (dayType !== 'saturday' && dayType !== 'sunday') {
      const legacy = list?.find(s => (s.day_type as string) === 'weekday')
      if (legacy) return { ...legacy, day_type: dayType }
    }
    return undefined
  }

  const closedDaysByDealer = new Map<string, number[]>()
  weeklyClosedDays.forEach(row => {
    const list = closedDaysByDealer.get(row.dealer_id) || []
    list.push(row.iso_dow)
    closedDaysByDealer.set(row.dealer_id, list)
  })

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-800 text-green-200 p-4 rounded-md">
          {success}
        </div>
      )}
      {blockError && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md">
          {blockError}
        </div>
      )}
      {blockSuccess && (
        <div className="bg-green-900/50 border border-green-800 text-green-200 p-4 rounded-md">
          {blockSuccess}
        </div>
      )}

      <SchedulingPoolsPanel
        pools={schedulingPools}
        dealers={dealers}
        specialists={specialists}
        createSchedulingPool={createSchedulingPool}
        updateSchedulingPool={updateSchedulingPool}
        deleteSchedulingPool={deleteSchedulingPool}
        assignDealerToSchedulingPool={assignDealerToSchedulingPool}
        assignSpecialistToSchedulingPool={assignSpecialistToSchedulingPool}
        removeSpecialistFromSchedulingPool={removeSpecialistFromSchedulingPool}
      />

      {/* Single global calendar – default; dealers can override hours below */}
      <div className="mb-6 p-4 rounded-lg bg-[#C27E00]/10 border border-[#C27E00]/30">
        <p className="text-sm text-zinc-900 dark:text-white">
          <strong>Single calendar for all dealers.</strong> Default: 09:00–16:30, 90 min between slots (75 min appointment). Set custom start/end per dealer below. Times are shown in each dealer&apos;s timezone.
        </p>
      </div>

      {/* Dealer hours – per day of week */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#C27E00]" />
          Dealer hours
        </h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
          Set start and end times for each day. Use weekly closed days below to block appointments on specific weekdays. Default 09:00–16:30 applies when hours are not set.
        </p>
        {dealers.map(dealer => (
            <div key={dealer.id} className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-md font-semibold text-zinc-900 dark:text-white mb-4">{dealer.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {HOUR_DAY_COLUMNS.map(({ dayType, label }) => (
                  <DealerDayHoursColumn
                    key={dayType}
                    dealerId={dealer.id}
                    dayType={dayType}
                    label={label}
                    setting={getSetting(dealer.id, dayType)}
                    editingId={editingId}
                    showAddFor={showAddHoursFor}
                    onEdit={setEditingId}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={handleDelete}
                    onShowAdd={() => setShowAddHoursFor({ dealerId: dealer.id, dayType })}
                    onCancelAdd={() => setShowAddHoursFor(null)}
                    onCreate={handleCreate}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
              <DealerWeeklyClosedRow
                dealerId={dealer.id}
                initialClosedIsoDays={closedDaysByDealer.get(dealer.id) || []}
                saveDealerWeeklyClosedDays={saveDealerWeeklyClosedDays}
                onError={setError}
                onSuccess={setSuccess}
              />
            </div>
        ))}
      </div>

      {/* Close slots or days (dealer-based) */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
          <CalendarX2 className="w-5 h-5 text-[#C27E00]" />
          Close Slots or Days
        </h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
          Close entire days or select specific time slots per dealer. Appointments cannot be created for closed days or slots.
        </p>
        {dealers.map(dealer => {
          const dealerBlocks = blocks.filter(b => b.dealer_id === dealer.id)
          const blockDate = blockDateByDealer[dealer.id] || ''
          const slotsForDate = blockDate ? getSlotsForDealerDate(dealer.id, blockDate, getSetting) : []
          const selectedSlots = selectedSlotsByDealer[dealer.id] || []
          const isSlotSelected = (s: { start_minutes: number; end_minutes: number }) =>
            selectedSlots.some(x => x.start_minutes === s.start_minutes && x.end_minutes === s.end_minutes)
          return (
            <div key={dealer.id} className="bg-zinc-200/50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-md font-semibold text-zinc-900 dark:text-white mb-4">{dealer.name}</h3>
              <div className="space-y-4 mb-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Date</label>
                    <input
                      type="date"
                      value={blockDate}
                      onChange={(e) => setBlockDateByDealer(prev => ({ ...prev, [dealer.id]: e.target.value }))}
                      min={new Date().toISOString().slice(0, 10)}
                      className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded-md px-3 py-2 focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                    />
                  </div>
                  {blockDate && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCloseEntireDay(dealer.id, blockDate)}
                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        Close entire day
                      </button>
                      {slotsForDate.length > 0 && (
                        <div className="w-full mt-2">
                          <p className="text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">
                            Select slots to close (click to toggle). These are the same slots used for appointments.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {slotsForDate.map(slot => (
                              <button
                                key={`${slot.start_minutes}-${slot.end_minutes}`}
                                type="button"
                                onClick={() => toggleSlotSelection(dealer.id, { start_minutes: slot.start_minutes, end_minutes: slot.end_minutes })}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                  isSlotSelected(slot)
                                    ? 'bg-[#C27E00] text-white border border-[#C27E00]'
                                    : 'bg-white dark:bg-black/50 text-zinc-600 dark:text-gray-300 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-200 dark:bg-white/10'
                                }`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCloseSelectedSlots(dealer.id, blockDate, selectedSlots)}
                            disabled={selectedSlots.length === 0}
                            className="mt-3 px-4 py-2 bg-[#C27E00] text-white rounded-md hover:bg-[#a06900] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Close selected slots
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {dealerBlocks.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-500 dark:text-gray-400">Closed days / slots:</p>
                  <ul className="space-y-1">
                    {dealerBlocks.map(block => (
                      <li key={block.id} className="flex items-center justify-between bg-zinc-100/90 dark:bg-black/30 rounded px-3 py-2 text-sm text-zinc-600 dark:text-gray-300">
                        <span>{formatBlockLabel(block)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="p-1.5 text-red-400 hover:bg-zinc-200 dark:bg-white/10 rounded transition-colors"
                          title="Remove block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-gray-500">No closed days or slots for this dealer yet.</p>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}

