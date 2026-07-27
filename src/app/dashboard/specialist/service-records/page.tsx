import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { CustomerServiceRecord } from '@/types/customer-service-record'
import { SpecialistServiceRecordsContent } from './service-records-content'
import { fetchAssignedServiceRecords } from './actions'

export default async function SpecialistServiceRecordsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'specialist') redirect('/dashboard')

  const records = await fetchAssignedServiceRecords()

  return <SpecialistServiceRecordsContent records={records as CustomerServiceRecord[]} />
}
