import { addYears } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'

const DEFAULT_FINANCIAL_SUMMARY: NonNullable<InvoiceRowData['financialSummary']> = {
  gstEnabled: true,
  gstPercent: 5,
  pstEnabled: false,
  pstPercent: 7,
  salesTaxEnabled: false,
  salesTaxPercent: 0,
  otherEnabled: false,
  otherAmount: 0,
}

type DealerLite = { name?: string; address?: string | null; phone?: string | null } | null

/** Normalize demand row from DB (invoices list / bulk send) into `InvoiceRowData` for PDF generation. */
export function demandRecordToInvoiceRowData(
  row: {
    demand_number: string | null
    completed_at: string | null
    updated_at: string
    stock_number: string | null
    vin_last6: string | null
    customer_phone: string | null
    vehicle_year: number
    vehicle_make: string
    vehicle_model: string
    camera_model: string
    invoice_total_amount: number | null
    invoice_comments: string | null
    invoice_extra_rows?: unknown
    invoice_financial_summary?: unknown
    dealers: DealerLite | DealerLite[] | null
  },
  logoDataUrl: string | null
): InvoiceRowData {
  const dealer: DealerLite = Array.isArray(row.dealers) ? row.dealers[0] ?? null : row.dealers
  const completionDate = new Date(row.completed_at ?? row.updated_at)
  const warrantyEnd = addYears(completionDate, 3)

  const savedExtra = Array.isArray(row.invoice_extra_rows)
    ? (row.invoice_extra_rows as { col1?: unknown; col2?: unknown }[])
    : []
  const parsedExtra = savedExtra.map((r) => ({
    col1: String(r?.col1 ?? ''),
    col2: String(r?.col2 ?? ''),
  }))
  const hasMeaningfulExtra = parsedExtra.some((r) => r.col1.trim() !== '' || r.col2.trim() !== '')

  const rawFs = row.invoice_financial_summary
  const fs: NonNullable<InvoiceRowData['financialSummary']> =
    rawFs && typeof rawFs === 'object' && !Array.isArray(rawFs)
      ? { ...DEFAULT_FINANCIAL_SUMMARY, ...(rawFs as Record<string, unknown>) } as NonNullable<InvoiceRowData['financialSummary']>
      : DEFAULT_FINANCIAL_SUMMARY

  let totalAmount: string
  let extraTableRows: { col1: string; col2: string }[] | undefined
  let financialSummary: InvoiceRowData['financialSummary'] | undefined

  if (hasMeaningfulExtra) {
    extraTableRows = parsedExtra
    financialSummary = fs
    const subtotal = parsedExtra.reduce(
      (sum, r) => sum + (parseFloat((r.col2 || '0').replace(/[^0-9.-]/g, '')) || 0),
      0
    )
    const taxRate =
      (fs.gstEnabled ? fs.gstPercent : 0) +
      (fs.pstEnabled ? fs.pstPercent : 0) +
      (fs.salesTaxEnabled ? fs.salesTaxPercent : 0)
    const taxes = subtotal * (taxRate / 100)
    const other = fs.otherEnabled ? fs.otherAmount : 0
    totalAmount = `$${(subtotal + taxes + other).toFixed(2)}`
  } else {
    const amt = row.invoice_total_amount != null ? String(row.invoice_total_amount) : ''
    totalAmount = amt
      ? `$${(parseFloat(amt.replace(/[^0-9.-]/g, '')) || 0).toFixed(2)}`
      : '$0.00'
  }

  return {
    demand_number: row.demand_number,
    customerName: dealer?.name ?? '—',
    phone: dealer?.phone ?? row.customer_phone ?? '—',
    stockNumber: row.stock_number ?? '—',
    customerAddress: dealer?.address ?? '—',
    vehicleInfo: `${row.vehicle_year} ${row.vehicle_make} ${row.vehicle_model} - Stock ${row.stock_number ?? '—'}`,
    vinNo: row.vin_last6?.trim() ? row.vin_last6.trim() : null,
    productModel: row.camera_model,
    completeDate: formatInTimeZone(completionDate, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
    warrantyEnd: formatInTimeZone(warrantyEnd, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
    totalAmount,
    comments: (row.invoice_comments ?? '').trim() || '—',
    logoDataUrl: logoDataUrl ?? null,
    extraTableRows,
    financialSummary,
  }
}
