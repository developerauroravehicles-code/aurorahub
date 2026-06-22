import type { CustomerPortalRow } from '@/types/customer-portal'
import { isDemandServiceType, SERVICE_TYPE_LABELS } from '@/lib/demand-pricing'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'

export function statusLabel(status: string): string {
  const s = (status || '').toLowerCase()
  const map: Record<string, string> = {
    pending_finance: 'Pending approval',
    approved: 'Approved',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return map[s] ?? status.replace(/_/g, ' ')
}

export function isActiveInstallation(status: string): boolean {
  const s = (status || '').toLowerCase()
  return s === 'pending_finance' || s === 'approved'
}

export function serviceTypeLabel(serviceType: string): string {
  if (serviceType && isDemandServiceType(serviceType)) {
    return SERVICE_TYPE_LABELS[serviceType]
  }
  return serviceType || '—'
}

export function resolveAppointmentAddress(row: CustomerPortalRow): string {
  const customer = row.customer_address?.trim()
  if (customer) return customer
  return row.dealer_address?.trim() || ''
}

export function mapsSearchUrl(address: string): string {
  const q = encodeURIComponent(address.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

export function dealerTimezone(row: CustomerPortalRow): string {
  return getEffectiveTimezone(row.dealer_timezone || null)
}

export function rowKey(row: CustomerPortalRow, index: number): string {
  return `${row.demand_number ?? 'ref'}-${row.appointment_date ?? index}-${index}`
}

export type GroupedInstallation = {
  row: CustomerPortalRow
  index: number
}

export function groupInstallations(rows: CustomerPortalRow[]): {
  active: GroupedInstallation[]
  past: GroupedInstallation[]
} {
  const active: GroupedInstallation[] = []
  const past: GroupedInstallation[] = []
  rows.forEach((row, index) => {
    if (isActiveInstallation(row.status)) active.push({ row, index })
    else past.push({ row, index })
  })
  return { active, past }
}

export function isInstallationDayNear(appointmentDate: string | null): boolean {
  if (!appointmentDate) return false
  const appt = new Date(appointmentDate)
  if (Number.isNaN(appt.getTime())) return false
  const diffDays = (appt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diffDays <= 1
}

export function progressStepIndex(status: string, appointmentDate: string | null): number {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return 3
  if (s === 'approved') {
    return isInstallationDayNear(appointmentDate) ? 2 : 1
  }
  if (s === 'pending_finance') return 0
  return 0
}

export function detectStatusChanges(
  prev: CustomerPortalRow[] | null,
  next: CustomerPortalRow[]
): string | null {
  if (!prev?.length) return null
  const prevByRef = new Map(
    prev.map((r) => [r.demand_number ?? r.appointment_date, r.status])
  )
  for (const row of next) {
    const key = row.demand_number ?? row.appointment_date
    const oldStatus = prevByRef.get(key)
    if (oldStatus && oldStatus !== row.status) {
      const ref = row.demand_number ? `#${row.demand_number}` : 'Your installation'
      return `${ref} is now ${statusLabel(row.status).toLowerCase()}.`
    }
  }
  return null
}

export function normalizeVinInput(vin: string): string {
  return vin.trim()
}

export function isValidVinQuery(vin: string): boolean {
  return normalizeVinInput(vin).replace(/[^A-Za-z0-9]/g, '').length >= 6
}
