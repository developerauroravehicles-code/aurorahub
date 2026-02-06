import { DemandForm } from './demand-form'
import { getCameraModels } from './get-cameras'
import { createClient } from '@/lib/supabase/server'

interface CalendarSetting {
  day_type: 'weekday' | 'weekend'
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
}

export default async function NewDemandPage() {
  const cameraModels = await getCameraModels()
  const supabase = await createClient()
  
  // Get current user's dealer information
  const { data: { user } } = await supabase.auth.getUser()
  let dealerName = ''
  let timezoneName: string | null = null
  let calendarSettings: { weekday?: CalendarSetting; weekend?: CalendarSetting } = {}
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('dealer_id')
      .eq('id', user.id)
      .single()
    
    if (profile?.dealer_id) {
      // Fetch dealer name and timezone
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name, region_codes(timezone_id, timezones(name))')
        .eq('id', profile.dealer_id)
        .single()
      
      if (dealer) {
        dealerName = dealer.name
        if (dealer.region_codes && (dealer.region_codes as any).timezones) {
          timezoneName = (dealer.region_codes as any).timezones.name
        }
      }

      // Fetch calendar settings for this dealer
      const { data: settings } = await supabase
        .from('dealer_calendar_settings')
        .select('day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes')
        .eq('dealer_id', profile.dealer_id)
      
      if (settings) {
        settings.forEach(setting => {
          if (setting.day_type === 'weekday') {
            calendarSettings.weekday = setting as CalendarSetting
          } else if (setting.day_type === 'weekend') {
            calendarSettings.weekend = setting as CalendarSetting
          }
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
        calendarSettings={calendarSettings}
      />
    </div>
  )
}

