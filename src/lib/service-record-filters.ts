import { getDateRangeInTimezone, SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { isServiceRecordDiagnosisCode } from '@/lib/customer-service-record-utils'
import type { CustomerServiceRecord, ServiceRecordStatus } from '@/types/customer-service-record'

export type ServiceRecordFilterState = {
  status: 'all' | ServiceRecordStatus
  dealerId: string
  diagnosis: string
  dateFrom: string
  dateTo: string
  search: string
}

export function parseServiceRecordFilters(params: {
  status?: string
  dealer?: string
  diagnosis?: string
  from?: string
  to?: string
  q?: string
}): ServiceRecordFilterState {
  const status =
    params.status === 'pending_approval' ||
    params.status === 'scheduled' ||
    params.status === 'rejected'
      ? params.status
      : 'all'

  const dateFrom = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : ''
  const dateTo = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : ''
  const diagnosis =
    params.diagnosis && isServiceRecordDiagnosisCode(params.diagnosis) ? params.diagnosis : ''

  return {
    status,
    dealerId: params.dealer?.trim() || 'all',
    diagnosis,
    dateFrom,
    dateTo,
    search: params.q?.trim() || '',
  }
}

function recordInSubmittedRange(createdAt: string, dateFrom: string, dateTo: string): boolean {
  if (!dateFrom && !dateTo) return true

  const ts = new Date(createdAt).getTime()
  if (Number.isNaN(ts)) return false

  if (dateFrom && dateTo) {
    const { start, end } = getDateRangeInTimezone(dateFrom, dateTo, SYSTEM_DEFAULT_TIMEZONE)
    return ts >= new Date(start).getTime() && ts <= new Date(end).getTime()
  }

  if (dateFrom) {
    const { start } = getDateRangeInTimezone(dateFrom, dateFrom, SYSTEM_DEFAULT_TIMEZONE)
    return ts >= new Date(start).getTime()
  }

  const { end } = getDateRangeInTimezone(dateTo, dateTo, SYSTEM_DEFAULT_TIMEZONE)
  return ts <= new Date(end).getTime()
}

function recordMatchesSearch(record: CustomerServiceRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const digits = q.replace(/\D/g, '')
  const fields = [
    record.demand_number,
    record.vehicle_summary,
    record.customer_firstname,
    record.customer_phone,
    record.vin_last6,
    record.comment,
    record.dealer_name,
    record.diagnosis_other,
  ]

  if (fields.some((f) => f?.toLowerCase().includes(q))) return true

  if (digits.length >= 3) {
    const numericFields = [
      record.demand_number?.replace(/\D/g, ''),
      record.customer_phone?.replace(/\D/g, ''),
      record.vin_last6?.replace(/\D/g, ''),
    ]
    if (numericFields.some((f) => f?.includes(digits))) return true
  }

  return false
}

export function filterServiceRecords(
  records: CustomerServiceRecord[],
  filters: ServiceRecordFilterState,
  dealers: { id: string; name: string }[]
): CustomerServiceRecord[] {
  const dealerName =
    filters.dealerId === 'all'
      ? null
      : filters.dealerId.startsWith('name:')
        ? filters.dealerId.slice(5)
        : (dealers.find((d) => d.id === filters.dealerId)?.name ?? null)

  return records.filter((record) => {
    if (filters.status !== 'all' && record.status !== filters.status) return false

    if (dealerName && record.dealer_name !== dealerName) return false

    if (filters.diagnosis && record.diagnosis_code !== filters.diagnosis) return false

    if (!recordInSubmittedRange(record.created_at, filters.dateFrom, filters.dateTo)) return false

    if (!recordMatchesSearch(record, filters.search)) return false

    return true
  })
}

export function hasActiveServiceRecordFilters(filters: ServiceRecordFilterState): boolean {
  return (
    filters.status !== 'all' ||
    filters.dealerId !== 'all' ||
    Boolean(filters.diagnosis) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.search)
  )
}
