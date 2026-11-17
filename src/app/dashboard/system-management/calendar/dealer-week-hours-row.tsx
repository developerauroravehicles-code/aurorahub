'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CALENDAR_DEFAULTS } from '@/lib/calendar-defaults'
import { formatHm } from '@/lib/calendar-wall-time'
import {
  DEALER_CALENDAR_DAY_TYPES,
  ISO_WEEKDAY_LABELS,
  type DealerCalendarDayType,
} from '@/lib/dealer-calendar-day-type'
import type { DealerWeekHourPayload } from './actions'
import type { DealerHoursSetting } from './dealer-day-hours-column'

const DEFAULT_START_H = CALENDAR_DEFAULTS.startHour
const DEFAULT_START_M = CALENDAR_DEFAULTS.startMinute
const DEFAULT_END_H = CALENDAR_DEFAULTS.endHour
const DEFAULT_END_M = CALENDAR_DEFAULTS.endMinute

type DayDraft = {
  dayType: DealerCalendarDayType
  label: string
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
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
      startHour: setting?.start_hour ?? DEFAULT_START_H,
      startMinute: setting?.start_minute ?? DEFAULT_START_M,
      endHour: setting?.end_hour ?? DEFAULT_END_H,
      endMinute: setting?.end_minute ?? DEFAULT_END_M,
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
    () =>
      daySettings
        .map(
          s =>
            `${s.day_type}:${s.start_hour}:${s.start_minute ?? 0}-${s.end_hour}:${s.end_minute ?? 0}`
        )
        .join('|'),
    [daySettings]
  )
  const [days, setDays] = useState<DayDraft[]>(() => buildDrafts(daySettings))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDays(buildDrafts(daySettings))
  }, [dealerId, settingsSignature])

  const updateDay = (
    index: number,
    patch: Partial<Pick<DayDraft, 'startHour' | 'startMinute' | 'endHour' | 'endMinute' | 'useDefault'>>
  ) => {
    setDays(prev =>
      prev.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, ...patch }
        if (
          patch.startHour !== undefined ||
          patch.startMinute !== undefined ||
          patch.endHour !== undefined ||
          patch.endMinute !== undefined
        ) {
          next.useDefault = false
        }
        if (patch.useDefault === true) {
          next.startHour = DEFAULT_START_H
          next.startMinute = DEFAULT_START_M
          next.endHour = DEFAULT_END_H
          next.endMinute = DEFAULT_END_M
        }
        return next
      })
    )
  }

  const applyTime = (index: number, field: 'start' | 'end', value: string) => {
    const [h, m] = value.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return
    if (field === 'start') {
      updateDay(index, { startHour: h, startMinute: m })
    } else {
      updateDay(index, { endHour: h, endMinute: m })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    onError(null)
    onSuccess(null)
    const payload: DealerWeekHourPayload[] = days.map(d => ({
      dayType: d.dayType,
      startHour: d.startHour,
      startMinute: d.startMinute,
      endHour: d.endHour,
      endMinute: d.endMinute,
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
              <p className="text-zinc-500 dark:text-gray-500 text-xs mb-2">
                Default {formatHm(DEFAULT_START_H, DEFAULT_START_M)}–{formatHm(DEFAULT_END_H, DEFAULT_END_M)}
              </p>
            ) : (
              <p className="text-xs text-[#C27E00] mb-2">
                {formatHm(day.startHour, day.startMinute)} – {formatHm(day.endHour, day.endMinute)}
              </p>
            )}
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Start</label>
                <input
                  type="time"
                  step={60}
                  value={formatHm(day.startHour, day.startMinute)}
                  disabled={day.useDefault}
                  onChange={e => applyTime(index, 'start', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">End</label>
                <input
                  type="time"
                  step={60}
                  value={formatHm(day.endHour, day.endMinute)}
                  disabled={day.useDefault}
                  onChange={e => applyTime(index, 'end', e.target.value)}
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