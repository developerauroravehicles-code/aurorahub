'use client'

import { useState } from 'react'
import { Trash2, CalendarX2, Clock, Plus, Edit } from 'lucide-react'
import { createCalendarBlock, createCalendarBlocks, deleteCalendarBlock } from './actions'
import { getGlobalSlotMinutes, getSlotMinutesFromConfig, CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'

interface CalendarBlock {
  id: string
  dealer_id: string
  block_date: string
  start_minutes: number
  end_minutes: number
  created_at?: string
}

type DayType = 'weekday' | 'saturday' | 'sunday'

interface CalendarSetting {
  id: string
  dealer_id: string
  day_type: DayType
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
  dealers?: { name: string }
}

interface Dealer {
  id: string
  name: string
}

interface CalendarManagementContentProps {
  settings: CalendarSetting[]
  dealers: Dealer[]
  blocks: CalendarBlock[]
  createCalendarSetting: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateCalendarSetting: (settingId: string, startHour: number, endHour: number, slotIntervalMinutes: number, appointmentDurationMinutes: number) => Promise<{ success: boolean; error?: string }>
  deleteCalendarSetting: (settingId: string) => Promise<{ success: boolean; error?: string }>
  createCalendarBlock: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  createCalendarBlocks: (dealerId: string, blockDate: string, blocks: { start_minutes: number; end_minutes: number }[]) => Promise<{ success: boolean; error?: string }>
  deleteCalendarBlock: (blockId: string) => Promise<{ success: boolean; error?: string }>
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

/** Slots for close UI for a specific dealer and date – uses dealer hours (weekday/saturday/sunday) when set. */
function getSlotsForDealerDate(
  dealerId: string,
  blockDate: string,
  getSetting: (dealerId: string, dayType: DayType) => CalendarSetting | undefined
): { start_minutes: number; end_minutes: number; label: string }[] {
  const [y, mo, d] = blockDate.split('-').map(Number)
  const dayOfWeek = new Date(y, mo - 1, d).getDay()
  const dayType: DayType = dayOfWeek === 6 ? 'saturday' : dayOfWeek === 0 ? 'sunday' : 'weekday'
  const setting = getSetting(dealerId, dayType)
  const slotMinutes = setting
    ? getSlotMinutesFromConfig({
        startHour: setting.start_hour,
        endHour: setting.end_hour,
        slotIntervalMinutes: setting.slot_interval_minutes,
        appointmentDurationMinutes: setting.appointment_duration_minutes,
      })
    : getGlobalSlotMinutes()
  const duration = setting?.appointment_duration_minutes ?? CALENDAR_DEFAULTS.appointmentDurationMinutes
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
  createCalendarSetting,
  updateCalendarSetting,
  deleteCalendarSetting,
  createCalendarBlock,
  createCalendarBlocks,
  deleteCalendarBlock
}: CalendarManagementContentProps) {
  const [showAddHoursFor, setShowAddHoursFor] = useState<{ dealerId: string; dayType: DayType } | null>(null)
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

  const getSetting = (dealerId: string, dayType: DayType) =>
    settingsByDealer.get(dealerId)?.find(s => s.day_type === dayType)

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

      {/* Single global calendar – default; dealers can override hours below */}
      <div className="mb-6 p-4 rounded-lg bg-[#C27E00]/10 border border-[#C27E00]/30">
        <p className="text-sm text-zinc-900 dark:text-white">
          <strong>Single calendar for all dealers.</strong> Default: 09:00–16:30, 90 min between slots (75 min appointment). Set custom start/end per dealer below. Times are shown in each dealer&apos;s timezone.
        </p>
      </div>

      {/* Dealer hours – start/end per dealer (weekday, saturday, sunday) */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#C27E00]" />
          Dealer hours
        </h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
          Set when each dealer can take appointments (start and end time). If not set, default 09:00–16:30 is used.
        </p>
        {dealers.map(dealer => {
          const weekdaySetting = getSetting(dealer.id, 'weekday')
          const saturdaySetting = getSetting(dealer.id, 'saturday')
          const sundaySetting = getSetting(dealer.id, 'sunday')
          return (
            <div key={dealer.id} className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-md font-semibold text-zinc-900 dark:text-white mb-4">{dealer.name}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Weekday */}
                <div className="bg-zinc-100/90 dark:bg-black/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-zinc-600 dark:text-gray-300 mb-3">Weekday (Mon–Fri)</p>
                  {weekdaySetting ? (
                    editingId === weekdaySetting.id ? (
                      <form
                        action={(formData) => handleUpdate(weekdaySetting.id, formData)}
                        className="space-y-3"
                      >
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start</label>
                            <input
                              type="number"
                              name="startHour"
                              min={0}
                              max={23}
                              defaultValue={weekdaySetting.start_hour}
                              className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End</label>
                            <input
                              type="number"
                              name="endHour"
                              min={0}
                              max={23}
                              defaultValue={weekdaySetting.end_hour}
                              className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm"
                            />
                          </div>
                          <input type="hidden" name="slotIntervalMinutes" value={CALENDAR_DEFAULTS.slotIntervalMinutes} />
                          <input type="hidden" name="appointmentDurationMinutes" value={CALENDAR_DEFAULTS.appointmentDurationMinutes} />
                          <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">Save</button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-900 dark:text-white">{weekdaySetting.start_hour}:00 – {weekdaySetting.end_hour}:00</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingId(weekdaySetting.id)} className="p-1.5 text-[#C27E00] hover:bg-zinc-200 dark:bg-white/10 rounded" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleDelete(weekdaySetting.id)} className="p-1.5 text-red-400 hover:bg-zinc-200 dark:bg-white/10 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )
                  ) : showAddHoursFor?.dealerId === dealer.id && showAddHoursFor?.dayType === 'weekday' ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        const fd = new FormData(e.currentTarget)
                        fd.set('dealerId', dealer.id)
                        fd.set('dayType', 'weekday')
                        fd.set('slotIntervalMinutes', String(CALENDAR_DEFAULTS.slotIntervalMinutes))
                        fd.set('appointmentDurationMinutes', String(CALENDAR_DEFAULTS.appointmentDurationMinutes))
                        await handleCreate(fd)
                        setShowAddHoursFor(null)
                      }}
                      className="space-y-3"
                    >
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start (hour 0–23)</label>
                          <input type="number" name="startHour" min={0} max={23} defaultValue={9} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End (hour 0–23)</label>
                          <input type="number" name="endHour" min={0} max={23} defaultValue={16} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                        </div>
                        <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">Save</button>
                        <button type="button" onClick={() => setShowAddHoursFor(null)} className="px-3 py-1.5 bg-gray-700 text-zinc-900 dark:text-white rounded text-sm">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-zinc-500 dark:text-gray-500 text-sm">Default 09:00–16:30</p>
                  )}
                  {!weekdaySetting && !(showAddHoursFor?.dealerId === dealer.id && showAddHoursFor?.dayType === 'weekday') && (
                    <button type="button" onClick={() => setShowAddHoursFor({ dealerId: dealer.id, dayType: 'weekday' })} className="mt-2 flex items-center gap-1 text-sm text-[#C27E00] hover:underline">
                      <Plus className="w-4 h-4" /> Set hours
                    </button>
                  )}
                </div>
                {/* Saturday */}
                <div className="bg-zinc-100/90 dark:bg-black/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-zinc-600 dark:text-gray-300 mb-3">Saturday</p>
                  {saturdaySetting ? (
                    editingId === saturdaySetting.id ? (
                      <form
                        action={(formData) => handleUpdate(saturdaySetting.id, formData)}
                        className="space-y-3"
                      >
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start</label>
                            <input type="number" name="startHour" min={0} max={23} defaultValue={saturdaySetting.start_hour} className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End</label>
                            <input type="number" name="endHour" min={0} max={23} defaultValue={saturdaySetting.end_hour} className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                          </div>
                          <input type="hidden" name="slotIntervalMinutes" value={CALENDAR_DEFAULTS.slotIntervalMinutes} />
                          <input type="hidden" name="appointmentDurationMinutes" value={CALENDAR_DEFAULTS.appointmentDurationMinutes} />
                          <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">Save</button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-700 text-zinc-900 dark:text-white rounded text-sm">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-900 dark:text-white">{saturdaySetting.start_hour}:00 – {saturdaySetting.end_hour}:00</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingId(saturdaySetting.id)} className="p-1.5 text-[#C27E00] hover:bg-zinc-200 dark:bg-white/10 rounded" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleDelete(saturdaySetting.id)} className="p-1.5 text-red-400 hover:bg-zinc-200 dark:bg-white/10 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )
                  ) : showAddHoursFor?.dealerId === dealer.id && showAddHoursFor?.dayType === 'saturday' ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        const fd = new FormData(e.currentTarget)
                        fd.set('dealerId', dealer.id)
                        fd.set('dayType', 'saturday')
                        fd.set('slotIntervalMinutes', String(CALENDAR_DEFAULTS.slotIntervalMinutes))
                        fd.set('appointmentDurationMinutes', String(CALENDAR_DEFAULTS.appointmentDurationMinutes))
                        await handleCreate(fd)
                        setShowAddHoursFor(null)
                      }}
                      className="space-y-3"
                    >
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start (hour 0–23)</label>
                          <input type="number" name="startHour" min={0} max={23} defaultValue={9} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End (hour 0–23)</label>
                          <input type="number" name="endHour" min={0} max={23} defaultValue={16} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                        </div>
                        <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">Save</button>
                        <button type="button" onClick={() => setShowAddHoursFor(null)} className="px-3 py-1.5 bg-gray-700 text-zinc-900 dark:text-white rounded text-sm">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-zinc-500 dark:text-gray-500 text-sm">Default 09:00–16:30</p>
                  )}
                  {!saturdaySetting && !(showAddHoursFor?.dealerId === dealer.id && showAddHoursFor?.dayType === 'saturday') && (
                    <button type="button" onClick={() => setShowAddHoursFor({ dealerId: dealer.id, dayType: 'saturday' })} className="mt-2 flex items-center gap-1 text-sm text-[#C27E00] hover:underline">
                      <Plus className="w-4 h-4" /> Set hours
                    </button>
                  )}
                </div>
                {/* Sunday */}
                <div className="bg-zinc-100/90 dark:bg-black/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-zinc-600 dark:text-gray-300 mb-3">Sunday</p>
                  {sundaySetting ? (
                    editingId === sundaySetting.id ? (
                      <form
                        action={(formData) => handleUpdate(sundaySetting.id, formData)}
                        className="space-y-3"
                      >
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start</label>
                            <input type="number" name="startHour" min={0} max={23} defaultValue={sundaySetting.start_hour} className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End</label>
                            <input type="number" name="endHour" min={0} max={23} defaultValue={sundaySetting.end_hour} className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                          </div>
                          <input type="hidden" name="slotIntervalMinutes" value={CALENDAR_DEFAULTS.slotIntervalMinutes} />
                          <input type="hidden" name="appointmentDurationMinutes" value={CALENDAR_DEFAULTS.appointmentDurationMinutes} />
                          <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">Save</button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-700 text-zinc-900 dark:text-white rounded text-sm">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-900 dark:text-white">{sundaySetting.start_hour}:00 – {sundaySetting.end_hour}:00</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingId(sundaySetting.id)} className="p-1.5 text-[#C27E00] hover:bg-zinc-200 dark:bg-white/10 rounded" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleDelete(sundaySetting.id)} className="p-1.5 text-red-400 hover:bg-zinc-200 dark:bg-white/10 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )
                  ) : showAddHoursFor?.dealerId === dealer.id && showAddHoursFor?.dayType === 'sunday' ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        const fd = new FormData(e.currentTarget)
                        fd.set('dealerId', dealer.id)
                        fd.set('dayType', 'sunday')
                        fd.set('slotIntervalMinutes', String(CALENDAR_DEFAULTS.slotIntervalMinutes))
                        fd.set('appointmentDurationMinutes', String(CALENDAR_DEFAULTS.appointmentDurationMinutes))
                        await handleCreate(fd)
                        setShowAddHoursFor(null)
                      }}
                      className="space-y-3"
                    >
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start (hour 0–23)</label>
                          <input type="number" name="startHour" min={0} max={23} defaultValue={9} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End (hour 0–23)</label>
                          <input type="number" name="endHour" min={0} max={23} defaultValue={16} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
                        </div>
                        <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">Save</button>
                        <button type="button" onClick={() => setShowAddHoursFor(null)} className="px-3 py-1.5 bg-gray-700 text-zinc-900 dark:text-white rounded text-sm">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-zinc-500 dark:text-gray-500 text-sm">Default 09:00–16:30</p>
                  )}
                  {!sundaySetting && !(showAddHoursFor?.dealerId === dealer.id && showAddHoursFor?.dayType === 'sunday') && (
                    <button type="button" onClick={() => setShowAddHoursFor({ dealerId: dealer.id, dayType: 'sunday' })} className="mt-2 flex items-center gap-1 text-sm text-[#C27E00] hover:underline">
                      <Plus className="w-4 h-4" /> Set hours
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
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
            <div key={dealer.id} className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6 mb-4">
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

