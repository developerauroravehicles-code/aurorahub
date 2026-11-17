'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'
import {
  DEALER_CALENDAR_DAY_TYPES,
  ISO_WEEKDAY_LABELS,
  type DealerCalendarDayType,
} from '@/lib/dealer-calendar-day-type'
import type { DealerWeekHourPayload } from './actions'
import type { DealerHoursSetting } from './dealer-day-hours-column'

const DEFAULT_START = CALENDAR_DEFAULTS.startHour
const DEFAULT_END = CALENDAR_DEFAULTS.endHour

type DayDraft = {
  dayType: DealerCalendarDayType
  label: string
  startHour: number
  endHour: number
  useDefault: boolean
}

function resolveSetting(
  daySettings: DealerHoursSetting[],
  dayType: DealerCalendarDayType
): DealerHoursSetting | undefined {
  const direct = daySettings.find(s => s.day_type === dayType)
  if (direct) return direct
  if (dayType !== 'saturday' && dayType !== 'sunday') {
    const legacy = daySettings.find(s => (s.day_type as string) === 'weekday')
    if (legacy) return { ...legacy, day_type: dayType }
  }
  return undefined
}

function buildDrafts(daySettings: DealerHoursSetting[]): DayDraft[] {
  return DEALER_CALENDAR_DAY_TYPES.map((dayType, i) => {
    const setting = resolveSetting(daySettings, dayType)
    return {
      dayType,
      label: ISO_WEEKDAY_LABELS[i]?.label ?? dayType,
      startHour: setting?.start_hour ?? DEFAULT_START,
      endHour: setting?.end_hour ?? DEFAULT_END,
      useDefault: !setting,
    }
  })
}

type Props = {
  dealerId: string
  daySettings: DealerHoursSetting[]
  saveDealerWeekHours: (
    dealerId: string,
    days: DealerWeekHourPayload[]
  ) => Promise<{ success: boolean; error?: string }>
  onError: (msg: string | null) => void
  onSuccess: (msg: string | null) => void
}

export function DealerWeekHoursRow({
  dealerId,
  daySettings,
  saveDealerWeekHours,
  onError,
  onSuccess,
}: Props) {
  const router = useRouter()
  const settingsSignature = useMemo(
    () => daySettings.map(s => `${s.day_type}:${s.start_hour}-${s.end_hour}`).join('|'),
    [daySettings]
  )
  const [days, setDays] = useState<DayDraft[]>(() => buildDrafts(daySettings))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDays(buildDrafts(daySettings))
  }, [dealerId, settingsSignature])

  const updateDay = (index: number, patch: Partial<Pick<DayDraft, 'startHour' | 'endHour' | 'useDefault'>>) => {
    setDays(prev =>
      prev.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, ...patch }
        if (patch.startHour !== undefined || patch.endHour !== undefined) {
          next.useDefault = false
        }
        if (patch.useDefault === true) {
          next.startHour = DEFAULT_START
          next.endHour = DEFAULT_END
        }
        return next
      })
    )
  }

  const handleSave = async () => {
    setSaving(true)
    onError(null)
    onSuccess(null)
    const payload: DealerWeekHourPayload[] = days.map(d => ({
      dayType: d.dayType,
      startHour: d.startHour,
      endHour: d.endHour,
      useDefault: d.useDefault,
    }))
    const result = await saveDealerWeekHours(dealerId, payload)
    setSaving(false)
    if (result.success) {
      onSuccess('Dealer hours saved.')
      router.refresh()
    } else {
      onError(result.error || 'Failed to save dealer hours.')
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {days.map((day, index) => (
          <div key={day.dayType} className="bg-zinc-100/90 dark:bg-black/30 rounded-lg p-4">
            <p className="text-sm font-medium text-zinc-600 dark:text-gray-300 mb-3">{day.label}</p>
            {day.useDefault ? (
              <p className="text-zinc-500 dark:text-gray-500 text-xs mb-2">Default 09:00–16:30</p>
            ) : (
              <p className="text-xs text-[#C27E00] mb-2">Custom hours</p>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 dark:text-gray-400 shrink-0">Start</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={day.startHour}
                  disabled={day.useDefault}
                  onChange={e => updateDay(index, { startHour: parseInt(e.target.value, 10) || 0 })}
                  className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm disabled:opacity-60"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 dark:text-gray-400 shrink-0">End</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={day.endHour}
                  disabled={day.useDefault}
                  onChange={e => updateDay(index, { endHour: parseInt(e.target.value, 10) || 0 })}
                  className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm disabled:opacity-60"
                />
              </div>
              {day.useDefault ? (
                <button
                  type="button"
                  onClick={() => updateDay(index, { useDefault: false })}
                  className="text-xs text-[#C27E00] hover:underline"
                >
                  Set custom hours
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateDay(index, { useDefault: true })}
                  className="text-xs text-zinc-500 dark:text-gray-400 hover:underline"
                >
                  Use default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-4 px-4 py-2 bg-[#C27E00] text-white rounded-md hover:bg-[#a06900] transition-colors text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save hours'}
      </button>
    </div>
  )
}