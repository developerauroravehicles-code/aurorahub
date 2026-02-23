import { DemandForm } from '@/app/dashboard/sales/demands/new/demand-form'
import { getCameraModels } from '@/app/dashboard/sales/demands/new/get-cameras'
import { createClient } from '@/lib/supabase/server'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'

interface CalendarSetting {
  day_type: 'weekday' | 'saturday' | 'sunday'
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
}

export default async function FinanceNewDemandPage() {
  const cameraModels = await getCameraModels()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let dealerName = ''
  let timezoneName: string | null = null
  let dealerId: string | null = null
  let calendarSettings: { weekday?: CalendarSetting; saturday?: CalendarSetting; sunday?: CalendarSetting } = {}

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('dealer_id')
      .eq('id', user.id)
      .single()

    if (profile?.dealer_id) {
      dealerId = profile.dealer_id
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name, region_codes(timezone_id, timezones(name))')
        .eq('id', profile.dealer_id)
        .single()

      if (dealer) {
        dealerName = dealer.name
        timezoneName = getTimezoneFromDealer(dealer as Parameters<typeof getTimezoneFromDealer>[0]) ?? null
      }
      const { data: settings } = await supabase
        .from('dealer_calendar_settings')
        .select('day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes')
        .eq('dealer_id', profile.dealer_id)
      if (settings) {
        settings.forEach((s: CalendarSetting) => {
          if (s.day_type === 'weekday') calendarSettings.weekday = s
          else if (s.day_type === 'saturday') calendarSettings.saturday = s
          else if (s.day_type === 'sunday') calendarSettings.sunday = s
        })
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Create New Demand</h1>
      <DemandForm
        cameraModels={cameraModels}
        defaultAddress={dealerName}
        timezoneName={timezoneName}
        dealerId={dealerId}
        calendarSettings={calendarSettings}
      />
    </div>
  )
}
