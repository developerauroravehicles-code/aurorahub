import { createClient } from '@/lib/supabase/server'
import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { CalendarManagementContent } from './calendar-management-content'
import { createCalendarSetting, updateCalendarSetting, deleteCalendarSetting, getCalendarBlocksInRange, createCalendarBlock, createCalendarBlocks, deleteCalendarBlock } from './actions'

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

  const today = new Date().toISOString().slice(0, 10)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 90)
  const toDate = endDate.toISOString().slice(0, 10)
  const blocks = await getCalendarBlocksInRange(today, toDate)

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        
        <SystemManagementTabs activeTab="calendar" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <CalendarManagementContent 
            settings={settings || []}
            dealers={dealers || []}
            blocks={blocks}
            createCalendarSetting={createCalendarSetting}
            updateCalendarSetting={updateCalendarSetting}
            deleteCalendarSetting={deleteCalendarSetting}
            createCalendarBlock={createCalendarBlock}
            createCalendarBlocks={createCalendarBlocks}
            deleteCalendarBlock={deleteCalendarBlock}
          />
        </div>
      </div>
    </div>
  )
}

