import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { CustomerServiceRecord } from '@/types/customer-service-record'
import { ServiceRecordsContent } from './service-records-content'
import { fetchPendingExpenses } from './actions'

type PageProps = {
  searchParams: Promise<{
    status?: string
    dealer?: string
    diagnosis?: string
    from?: string
    to?: string
    q?: string
  }>
}

export default async function ServiceRecordsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const [{ data, error }, { data: dealers }, pendingExpenses] = await Promise.all([
    supabase
      .from('customer_service_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('dealers').select('id, name').order('name'),
    fetchPendingExpenses(),
  ])

  if (error) {
    console.error('service-records fetch', error)
  }

  return (
    <ServiceRecordsContent
      records={(data ?? []) as CustomerServiceRecord[]}
      dealers={dealers ?? []}
      pendingExpenses={pendingExpenses}
      filterParams={params}
    />
  )
}
