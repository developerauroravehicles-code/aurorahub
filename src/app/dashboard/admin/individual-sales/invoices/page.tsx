import { createClient } from '@/lib/supabase/server'
import { fromZonedTime } from 'date-fns-tz'
import { getDateRangeInTimezone, SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { redirect } from 'next/navigation'
import { getSystemLogo } from '@/lib/get-system-logo'
import { InvoiceTable } from '@/app/dashboard/admin/invoices/invoice-table'
import { InvoiceDateFilter } from '@/app/dashboard/admin/invoices/invoice-date-filter'
import { InvoiceSearchFilter } from '@/app/dashboard/admin/invoices/invoice-search-filter'
export default async function IndividualSalesInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; startDate?: string; endDate?: string; search?: string; searchBy?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const params = await searchParams

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
      service_type,
      invoice_total_amount,
      invoice_comments,
      invoice_extra_rows,
      invoice_financial_summary,
      invoice_saved_at,
      invoice_downloaded_at,
      invoice_drive_uploaded_at,
      dealers(name, address, phone, warranty_years)
    `)
    .eq('status', 'completed')
    .eq('is_individual', true)
    .order('updated_at', { ascending: false })

  const monthParam = params.month
  const startDateParam = params.startDate
  const endDateParam = params.endDate
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    const monthStart = fromZonedTime(new Date(y, m - 1, 1, 0, 0, 0), SYSTEM_DEFAULT_TIMEZONE).toISOString()
    const monthEnd = fromZonedTime(new Date(y, m, 0, 23, 59, 59, 999), SYSTEM_DEFAULT_TIMEZONE).toISOString()
    query = query.gte('completed_at', monthStart).lte('completed_at', monthEnd)
  } else if (
    startDateParam &&
    endDateParam &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDateParam) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDateParam)
  ) {
    const { start, end } = getDateRangeInTimezone(startDateParam, endDateParam, SYSTEM_DEFAULT_TIMEZONE)
    query = query.gte('completed_at', start).lte('completed_at', end)
  }

  const searchParam = params.search?.trim()
  const searchBy =
    params.searchBy === 'vin_last6' || params.searchBy === 'stock_number' || params.searchBy === 'demand_number'
      ? params.searchBy
      : 'demand_number'
  if (searchParam && searchParam.length > 0) {
    const sanitized = searchParam.replace(/["\\]/g, '').replace(/\s+/g, ' ').trim()
    if (sanitized) {
      query = query.ilike(searchBy, `%${sanitized}%`)
    }
  }

  const { data: demands } = await query
  const logoUrl = await getSystemLogo()

  const totalAmount = (demands ?? []).reduce((sum, d) => sum + (d.invoice_total_amount ?? 0), 0)
  const invoiceCount = (demands ?? []).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Invoices</h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400">
          Completed individual sales appointments — same invoice editor and PDF flow as dealer invoices.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <InvoiceDateFilter
          selectedMonth={params.month ?? ''}
          startDate={params.startDate ?? ''}
          endDate={params.endDate ?? ''}
        />
        <InvoiceSearchFilter
          searchValue={params.search ?? ''}
          searchBy={(params.searchBy as 'demand_number' | 'stock_number' | 'vin_last6') || 'demand_number'}
        />
      </div>
      <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-gray-300">
        <span>
          Total:{' '}
          <strong className="text-[#C27E00]">
            ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </span>
        <span>|</span>
        <span>
          {invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 shadow flex flex-col min-h-[calc(100vh-14rem)]">
        <InvoiceTable
          invoices={(demands ?? []) as Parameters<typeof InvoiceTable>[0]['invoices']}
          logoDataUrl={logoUrl}
          canEdit
        />
      </div>
    </div>
  )
}