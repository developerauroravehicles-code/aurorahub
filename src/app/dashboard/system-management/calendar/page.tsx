import { createClient } from '@/lib/supabase/server'
import { SystemManagementTabs } from '../system-management-tabs'
import { CalendarManagementContent } from './calendar-management-content'
import { createCalendarSetting, updateCalendarSetting, deleteCalendarSetting } from './actions'

export const dynamic = 'force-dynamic'

export default async function CalendarManagementPage() {
  const supabase = await createClient()
  
  // Fetch calendar settings with dealer info
  const { data: settings } = await supabase
    .from('dealer_calendar_settings')
    .select('*, dealers(name)')
    .order('dealer_id, day_type')

  // Fetch all dealers
  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name')
    .order('name')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="calendar" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <CalendarManagementContent 
            settings={settings || []}
            dealers={dealers || []}
            createCalendarSetting={createCalendarSetting}
            updateCalendarSetting={updateCalendarSetting}
            deleteCalendarSetting={deleteCalendarSetting}
          />
        </div>
      </div>
    </div>
  )
}

