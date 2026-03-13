import { createClient } from '@/lib/supabase/server'
import { fromZonedTime } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { redirect } from 'next/navigation'
import { getSystemLogo } from '@/app/dashboard/system-management/logo/actions'
import { InvoiceTable } from './invoice-table'
import { InvoiceDealerFilter } from './invoice-dealer-filter'
import { InvoiceDateFilter } from './invoice-date-filter'
import { InvoiceSearchFilter } from './invoice-search-filter'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ dealer?: string; month?: string; startDate?: string; endDate?: string; search?: string; searchBy?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  const isGM = profile?.role === 'general_manager'
  const isAuroraManager = profile?.role === 'aurora_manager'
  if (!profile || (!isAuroraManager && !isGM)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const dealerId = isGM && profile.dealer_id
    ? profile.dealer_id
    : params.dealer && params.dealer !== 'all'
      ? params.dealer
      : null

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
      vin_last6,
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

  const monthParam = params.month
  const startDateParam = params.startDate
  const endDateParam = params.endDate
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    const monthStart = fromZonedTime(new Date(y, m - 1, 1, 0, 0, 0), SYSTEM_DEFAULT_TIMEZONE).toISOString()
    const monthEnd = fromZonedTime(new Date(y, m, 0, 23, 59, 59, 999), SYSTEM_DEFAULT_TIMEZONE).toISOString()
    query = query.gte('completed_at', monthStart).lte('completed_at', monthEnd)
  } else if (startDateParam && endDateParam) {
    query = query.gte('completed_at', `${startDateParam}T00:00:00.000Z`).lte('completed_at', `${endDateParam}T23:59:59.999Z`)
  }

  const searchParam = params.search?.trim()
  const searchBy = (params.searchBy === 'vin_last6' || params.searchBy === 'stock_number' || params.searchBy === 'demand_number')
    ? params.searchBy
    : 'demand_number'
  if (searchParam && searchParam.length > 0) {
    const sanitized = searchParam.replace(/["\\]/g, '').replace(/\s+/g, ' ').trim()
    if (sanitized) {
      const pattern = `%${sanitized}%`
      query = query.ilike(searchBy, pattern)
    }
  }

  const { data: demands } = await query
  const logoUrl = await getSystemLogo()

  const totalAmount = (demands ?? []).reduce((sum, d) => sum + (d.invoice_total_amount ?? 0), 0)
  const invoiceCount = (demands ?? []).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Invoice</h1>
        <p className="text-gray-400">
          {isGM ? 'View completed demands as invoices. Read-only.' : 'Completed demands as invoices. Total amount and comments are editable.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {!isGM && (
          <InvoiceDealerFilter
            dealers={dealers ?? []}
            selectedDealerId={params.dealer ?? 'all'}
          />
        )}
        <InvoiceDateFilter
          selectedMonth={params.month ?? ''}
          startDate={params.startDate ?? ''}
          endDate={params.endDate ?? ''}
        />
        <InvoiceSearchFilter searchValue={params.search ?? ''} searchBy={(params.searchBy as 'demand_number' | 'stock_number' | 'vin_last6') || 'demand_number'} />
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-300">
        <span>Total: <strong className="text-[#C27E00]">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
        <span>|</span>
        <span>{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 shadow flex flex-col min-h-[calc(100vh-14rem)]">
        <InvoiceTable invoices={(demands ?? []) as Parameters<typeof InvoiceTable>[0]['invoices']} logoDataUrl={logoUrl} canEdit={isAuroraManager} />
      </div>
    </div>
  )
}
