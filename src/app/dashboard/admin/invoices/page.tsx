import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSystemLogo } from '@/app/dashboard/system-management/logo/actions'
import { InvoiceTable } from './invoice-table'
import { InvoiceDealerFilter } from './invoice-dealer-filter'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ dealer?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'aurora_manager') {
    redirect('/dashboard')
  }

  const params = await searchParams
  const dealerId = params.dealer && params.dealer !== 'all' ? params.dealer : null

  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name')
    .order('name')

  let query = supabase
    .from('demands')
    .select(`
      id,
      demand_number,
      dealer_id,
      stock_number,
      customer_phone,
      customer_firstname,
      customer_lastname,
      customer_address,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      camera_model,
      updated_at,
      completed_at,
      invoice_total_amount,
      invoice_comments,
      invoice_extra_rows,
      invoice_financial_summary,
      invoice_saved_at,
      invoice_downloaded_at,
      invoice_drive_uploaded_at,
      dealers(name, address, phone)
    `)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })

  if (dealerId) {
    query = query.eq('dealer_id', dealerId)
  }

  const { data: demands } = await query
  const logoUrl = await getSystemLogo()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Invoice</h1>
        <p className="text-gray-400">Completed demands as invoices. Total amount and comments are editable.</p>
      </div>
      <InvoiceDealerFilter
        dealers={dealers ?? []}
        selectedDealerId={params.dealer ?? 'all'}
      />
      <div className="bg-white/5 rounded-lg border border-gray-800 shadow flex flex-col min-h-[calc(100vh-14rem)]">
        <InvoiceTable invoices={(demands ?? []) as Parameters<typeof InvoiceTable>[0]['invoices']} logoDataUrl={logoUrl} />
      </div>
    </div>
  )
}
