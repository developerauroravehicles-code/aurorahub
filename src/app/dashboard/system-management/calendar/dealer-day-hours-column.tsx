'use client'

import { Edit, Plus, Trash2 } from 'lucide-react'
import { CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'
import type { DealerCalendarDayType } from '@/lib/dealer-calendar-day-type'

export type DealerHoursSetting = {
  id: string
  dealer_id: string
  day_type: DealerCalendarDayType
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
}

type Props = {
  dealerId: string
  dayType: DealerCalendarDayType
  label: string
  setting: DealerHoursSetting | undefined
  editingId: string | null
  showAddFor: { dealerId: string; dayType: DealerCalendarDayType } | null
  onEdit: (id: string) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onShowAdd: () => void
  onCancelAdd: () => void
  onCreate: (formData: FormData) => Promise<void>
  onUpdate: (settingId: string, formData: FormData) => Promise<void>
}

export function DealerDayHoursColumn({
  dealerId,
  dayType,
  label,
  setting,
  editingId,
  showAddFor,
  onEdit,
  onCancelEdit,
  onDelete,
  onShowAdd,
  onCancelAdd,
  onCreate,
  onUpdate,
}: Props) {
  const isAdding = showAddFor?.dealerId === dealerId && showAddFor?.dayType === dayType

  return (
    <div className="bg-zinc-100/90 dark:bg-black/30 rounded-lg p-4">
      <p className="text-sm font-medium text-zinc-600 dark:text-gray-300 mb-3">{label}</p>
      {setting ? (
        editingId === setting.id ? (
          <form action={(formData) => onUpdate(setting.id, formData)} className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start</label>
                <input
                  type="number"
                  name="startHour"
                  min={0}
                  max={23}
                  defaultValue={setting.start_hour}
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
                  defaultValue={setting.end_hour}
                  className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm"
                />
              </div>
              <input type="hidden" name="slotIntervalMinutes" value={CALENDAR_DEFAULTS.slotIntervalMinutes} />
              <input type="hidden" name="appointmentDurationMinutes" value={CALENDAR_DEFAULTS.appointmentDurationMinutes} />
              <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">
                Save
              </button>
              <button type="button" onClick={onCancelEdit} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-900 dark:text-white text-sm">
              {setting.start_hour}:00 – {setting.end_hour}:00
            </span>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => onEdit(setting.id)} className="p-1.5 text-[#C27E00] hover:bg-zinc-200 dark:bg-white/10 rounded" title="Edit">
                <Edit className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => onDelete(setting.id)} className="p-1.5 text-red-400 hover:bg-zinc-200 dark:bg-white/10 rounded" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      ) : isAdding ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            fd.set('dealerId', dealerId)
            fd.set('dayType', dayType)
            fd.set('slotIntervalMinutes', String(CALENDAR_DEFAULTS.slotIntervalMinutes))
            fd.set('appointmentDurationMinutes', String(CALENDAR_DEFAULTS.appointmentDurationMinutes))
            await onCreate(fd)
          }}
          className="space-y-3"
        >
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start (0–23)</label>
              <input type="number" name="startHour" min={0} max={23} defaultValue={9} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End (0–23)</label>
              <input type="number" name="endHour" min={0} max={23} defaultValue={16} required className="w-20 border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm" />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-[#C27E00] text-white rounded text-sm hover:bg-[#a06900]">
              Save
            </button>
            <button type="button" onClick={onCancelAdd} className="px-3 py-1.5 bg-gray-700 text-zinc-900 dark:text-white rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-zinc-500 dark:text-gray-500 text-sm">Default 09:00–16:30</p>
          <button type="button" onClick={onShowAdd} className="mt-2 flex items-center gap-1 text-sm text-[#C27E00] hover:underline">
            <Plus className="w-4 h-4" /> Set hours
          </button>
        </>
      )}
    </div>
  )
}
