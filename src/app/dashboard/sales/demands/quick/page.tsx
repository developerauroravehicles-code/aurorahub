import { QuickDemandForm } from './quick-demand-form'
import { getCameraModels } from '../new/get-cameras'
import { createClient } from '@/lib/supabase/server'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { buildCalendarSettingsMap, type DealerCalendarSettingsMap } from '@/lib/dealer-calendar-day-type'
import Link from 'next/link'

export default async function QuickDemandPage() {
  const cameraModels = await getCameraModels()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let dealerId: string | null = null
  let timezoneName: string | null = null
  let calendarSettings: DealerCalendarSettingsMap = {}
  let weeklyClosedIsoDays: number[] = []

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('dealer_id, role').eq('id', user.id).single()
    if (profile?.dealer_id && ['sales', 'finance'].includes(profile.role ?? '')) {
      dealerId = profile.dealer_id
      const { data: dealer } = await supabase
        .from('dealers')
        .select('region_codes(timezone_id, timezones(name))')
        .eq('id', profile.dealer_id)
        .single()
      timezoneName = getTimezoneFromDealer(dealer as Parameters<typeof getTimezoneFromDealer>[0]) ?? null
      const [{ data: settings }, { data: closedDays }] = await Promise.all([
        supabase
          .from('dealer_calendar_settings')
          .select(
            'day_type, start_hour, start_minute, end_hour, end_minute, slot_interval_minutes, appointment_duration_minutes'
          )
          .eq('dealer_id', profile.dealer_id),
        supabase.from('dealer_weekly_closed_days').select('iso_dow').eq('dealer_id', profile.dealer_id),
      ])
      if (settings) calendarSettings = buildCalendarSettingsMap(settings)
      weeklyClosedIsoDays = (closedDays || []).map(r => r.iso_dow)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Quick appointment</h1>
        <Link
          href="/dashboard/sales/demands/new"
          className="text-sm text-[#C27E00] hover:underline"
        >
          Full demand form →
        </Link>
      </div>
      <QuickDemandForm
        cameraModels={cameraModels}
        dealerId={dealerId}
        timezoneName={timezoneName}
        calendarSettings={calendarSettings}
        weeklyClosedIsoDays={weeklyClosedIsoDays}
      />
    </div>
  )
}