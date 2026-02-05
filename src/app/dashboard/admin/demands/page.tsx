import { createClient } from '@/lib/supabase/server'
import { DemandsList } from './demands-list'

export default async function AdminDemandsPage() {
  const supabase = await createClient()
  
  const { data: demands } = await supabase
    .from('demands')
    .select('*, dealers(name), profiles!demands_created_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-white">All Demands</h1>
        <DemandsList demands={demands || []} />
      </div>
    </div>
  )
}
