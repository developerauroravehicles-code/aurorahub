import type { DemandHandoffDemand } from '@/app/dashboard/sales/demands/new/actions'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'

type DealerRow = {
  name?: string
  warranty_years?: number | null
  region_codes?: unknown
} | null

export function toDemandNumber(value: number | string | undefined | null): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function getDealerPrintMeta(
  dealers: DealerRow | DealerRow[] | null | undefined,
  fallback?: { name?: string; warranty_years?: number | null; timezoneName?: string | null }
): { name: string; warranty_years: number | null; timezoneName: string | null } {
  const d = Array.isArray(dealers) ? dealers[0] : dealers
  return {
    name: d?.name ?? fallback?.name ?? 'Dealer',
    warranty_years: d?.warranty_years ?? fallback?.warranty_years ?? null,
    timezoneName:
      getTimezoneFromDealer(d as Parameters<typeof getTimezoneFromDealer>[0]) ??
      fallback?.timezoneName ??
      null,
  }
}

export function toHandoffDemand(demand: {
  id: string
  demand_number?: number | string | null
  customer_firstname: string
  customer_lastname: string
  customer_phone?: string | null
  customer_address?: string | null
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  stock_number?: string | null
  vin_last6?: string | null
  camera_model?: string | null
  appointment_date: string
  comment?: string | null
  status: string
  created_at: string
}): DemandHandoffDemand {
  return {
    id: demand.id,
    demand_number: toDemandNumber(demand.demand_number ?? undefined),
    customer_firstname: demand.customer_firstname,
    customer_lastname: demand.customer_lastname,
    customer_phone: demand.customer_phone ?? '',
    customer_address: demand.customer_address ?? null,
    vehicle_make: demand.vehicle_make,
    vehicle_model: demand.vehicle_model,
    vehicle_year: demand.vehicle_year,
    stock_number: demand.stock_number ?? '',
    vin_last6: demand.vin_last6 ?? null,
    camera_model: demand.camera_model ?? null,
    appointment_date: demand.appointment_date,
    comment: demand.comment ?? null,
    status: demand.status,
    created_at: demand.created_at,
  }
}
