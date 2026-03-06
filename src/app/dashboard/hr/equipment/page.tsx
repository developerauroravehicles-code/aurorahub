import { createClient } from '@/lib/supabase/server'
import { EquipmentContent } from './equipment-content'

export default async function EquipmentPage() {
  const supabase = await createClient()
  const [typesRes, assignmentsRes, personnelRes] = await Promise.all([
    supabase.from('equipment_types').select('*').order('name'),
    supabase.from('equipment_assignments').select('*, personnel(full_name), equipment_types(name)').order('assigned_at', { ascending: false }),
    supabase.from('personnel').select('id, full_name').order('full_name'),
  ])
  const types = typesRes.data ?? []
  const assignments = assignmentsRes.data ?? []
  const personnel = personnelRes.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Equipment & Asset Assignment</h1>
        <p className="text-gray-400">Installation tools, dashcam demo devices, testing equipment, vehicle gear.</p>
      </div>
      <EquipmentContent types={types} assignments={assignments} personnel={personnel} />
    </div>
  )
}
