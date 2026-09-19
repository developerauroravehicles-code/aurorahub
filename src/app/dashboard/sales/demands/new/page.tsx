import { DemandForm } from './demand-form'
import { getCameraModels } from './get-cameras'
import { createClient } from '@/lib/supabase/server'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { buildCalendarSettingsMap, type DealerCalendarSettingsMap } from '@/lib/dealer-calendar-day-type'

export default async function NewDemandPage() {
  const cameraModels = await getCameraModels()
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  let dealerName = ''
  let timezoneName: string | null = null
  let dealerId: string | null = null
  let calendarSettings: DealerCalendarSettingsMap = {}
  let weeklyClosedIsoDays: number[] = []
  
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
      const [{ data: settings }, { data: closedDays }] = await Promise.all([
        supabase
          .from('dealer_calendar_settings')
          .select('day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes')
          .eq('dealer_id', profile.dealer_id),
        supabase.from('dealer_weekly_closed_days').select('iso_dow').eq('dealer_id', profile.dealer_id),
      ])
      if (settings) calendarSettings = buildCalendarSettingsMap(settings)
      weeklyClosedIsoDays = (closedDays || []).map(r => r.iso_dow)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white mb-6 tracking-tight">Create New Demand</h1>
      <DemandForm 
        cameraModels={cameraModels} 
        defaultAddress={dealerName} 
        timezoneName={timezoneName}
        dealerId={dealerId}
        calendarSettings={calendarSettings}
        weeklyClosedIsoDays={weeklyClosedIsoDays}
      />
    </div>
  )
}

