import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSystemLogo } from '@/app/dashboard/system-management/logo/actions'
import { InvoiceTable } from './invoice-table'

export default async function InvoicesPage() {
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
      dealers(name, address, phone)
    `)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })

  const { data: demands } = await query
  const logoUrl = await getSystemLogo()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Invoice</h1>
        <p className="text-gray-400">Completed demands as invoices. Total amount and comments are editable.</p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
        <InvoiceTable invoices={(demands ?? []) as Parameters<typeof InvoiceTable>[0]['invoices']} logoDataUrl={logoUrl} />
      </div>
    </div>
  )
}
