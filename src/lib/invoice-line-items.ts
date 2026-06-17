import { SERVICE_TYPE_LABELS, isDemandServiceType } from '@/lib/demand-pricing'

export type InvoiceExtraRow = { col1: string; col2: string }

export function hasMeaningfulInvoiceExtraRows(
  rows: InvoiceExtraRow[] | null | undefined
): boolean {
  return Array.isArray(rows) && rows.some((r) => r.col1.trim() !== '' || r.col2.trim() !== '')
}

export function defaultInvoiceExtraRows(input: {
  service_type?: string | null
  camera_model?: string | null
  invoice_total_amount?: number | null
}): InvoiceExtraRow[] {
  const amount = input.invoice_total_amount
  if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return [{ col1: '', col2: '' }]
  }

  const serviceLabel =
    input.service_type && isDemandServiceType(input.service_type)
      ? SERVICE_TYPE_LABELS[input.service_type]
      : 'Installation'

  const camera = input.camera_model?.trim()
  const description = camera ? `${serviceLabel} — ${camera}` : serviceLabel

  return [{ col1: description, col2: Number(amount).toFixed(2) }]
}

/** Saved invoice line items, or auto-generated from service type + amount. */
export function resolveInvoiceExtraRows(
  saved: unknown,
  demand: {
    service_type?: string | null
    camera_model?: string | null
    invoice_total_amount?: number | null
  }
): InvoiceExtraRow[] {
  const parsed = Array.isArray(saved)
    ? (saved as { col1?: unknown; col2?: unknown }[]).map((r) => ({
        col1: String(r?.col1 ?? ''),
        col2: String(r?.col2 ?? ''),
      }))
    : []

  if (hasMeaningfulInvoiceExtraRows(parsed)) return parsed
  return defaultInvoiceExtraRows(demand)
}

export function calculateInvoiceTotalFromExtras(
  extraRows: InvoiceExtraRow[],
  financialSummary: {
    gstEnabled: boolean
    gstPercent: number
    pstEnabled: boolean
    pstPercent: number
    salesTaxEnabled: boolean
    salesTaxPercent: number
    otherEnabled: boolean
    otherAmount: number
  }
): number {
  const subtotal = extraRows.reduce(
    (sum, r) => sum + (parseFloat((r.col2 || '0').replace(/[^0-9.-]/g, '')) || 0),
    0
  )
  const taxRate =
    (financialSummary.gstEnabled ? financialSummary.gstPercent : 0) +
    (financialSummary.pstEnabled ? financialSummary.pstPercent : 0) +
    (financialSummary.salesTaxEnabled ? financialSummary.salesTaxPercent : 0)
  const taxes = subtotal * (taxRate / 100)
  const other = financialSummary.otherEnabled ? financialSummary.otherAmount : 0
  return subtotal + taxes + other
}
