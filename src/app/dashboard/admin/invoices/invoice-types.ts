import type { DemandServiceType } from '@/lib/demand-pricing'

export type InvoiceDealerRow = {
  name: string
  address?: string | null
  phone?: string | null
  warranty_years?: number | null
} | null

export type InvoicePreviewRecord = {
  id: string
  demand_number: string | null
  dealer_id: string | null
  stock_number: string | null
  vin_last6: string | null
  customer_phone: string | null
  customer_firstname: string
  customer_lastname: string
  customer_address: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  camera_model: string
  updated_at: string
  completed_at: string | null
  service_type?: DemandServiceType | null
  invoice_total_amount: number | null
  invoice_comments: string | null
  invoice_extra_rows?: { col1: string; col2: string }[] | null
  invoice_saved_at?: string | null
  invoice_downloaded_at?: string | null
  invoice_drive_uploaded_at?: string | null
  invoice_approved_at?: string | null
  invoice_approved_by?: string | null
  invoice_financial_summary?: {
    gstEnabled: boolean
    gstPercent: number
    pstEnabled: boolean
    pstPercent: number
    salesTaxEnabled: boolean
    salesTaxPercent: number
    otherEnabled: boolean
    otherAmount: number
  } | null
  dealers: InvoiceDealerRow | InvoiceDealerRow[] | null
}

export function getInvoiceDealer(row: InvoicePreviewRecord): InvoiceDealerRow {
  if (!row.dealers) return null
  return Array.isArray(row.dealers) ? row.dealers[0] : row.dealers
}

export const DEFAULT_INVOICE_FINANCIAL_SUMMARY = {
  gstEnabled: true,
  gstPercent: 5,
  pstEnabled: false,
  pstPercent: 7,
  salesTaxEnabled: false,
  salesTaxPercent: 0,
  otherEnabled: false,
  otherAmount: 0,
}

export type InvoiceFinancialSummary = {
  gstEnabled: boolean
  gstPercent: number
  pstEnabled: boolean
  pstPercent: number
  salesTaxEnabled: boolean
  salesTaxPercent: number
  otherEnabled: boolean
  otherAmount: number
}
