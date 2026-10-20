import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchSpecialistStockSummary,
  type SpecialistStockSummaryRow,
} from '@/lib/inventory-v2/specialist-stock'

export type CameraStockLedgerOverview = {
  nationalUnits: number
  dealerUnits: number
  specialistUnits: number
  totalUnits: number
}

export type CameraStockBarcodeOverview = {
  generated: number
  at_dealer: number
  at_specialist: number
  consumed: number
  void: number
  other: number
}

export type CameraStockOverview = {
  ledger: CameraStockLedgerOverview
  specialists: SpecialistStockSummaryRow[]
  barcode: CameraStockBarcodeOverview | null
}

function sumQuantities(
  balances: { location_type: string; quantity: number }[],
  locationType: string
): number {
  let total = 0
  for (const b of balances) {
    if (b.location_type !== locationType) continue
    total += b.quantity
  }
  return total
}

export async function fetchCameraStockOverview(
  supabase: SupabaseClient,
  options?: { includeBarcodeCounts?: boolean }
): Promise<CameraStockOverview> {
  const [{ data: balancesRaw }, specialistRows] = await Promise.all([
    supabase
      .from('inventory_balances_v2')
      .select('location_type, quantity, camera_model_id')
      .not('camera_model_id', 'is', null),
    fetchSpecialistStockSummary(supabase),
  ])

  const balances = (balancesRaw ?? []).map((b) => ({
    location_type: String(b.location_type ?? ''),
    quantity:
      typeof b.quantity === 'string' ? parseInt(b.quantity, 10) : Number(b.quantity ?? 0),
  }))

  const nationalUnits = sumQuantities(balances, 'national')
  const dealerUnits = sumQuantities(balances, 'dealer')
  const specialistUnits = sumQuantities(balances, 'specialist')
  const totalUnits = nationalUnits + dealerUnits + specialistUnits

  const specialists = [...specialistRows].sort((a, b) => {
    if (b.total_units !== a.total_units) return b.total_units - a.total_units
    return a.specialist_name.localeCompare(b.specialist_name)
  })

  let barcode: CameraStockBarcodeOverview | null = null
  if (options?.includeBarcodeCounts) {
    const { data: barcodeRows } = await supabase
      .from('inventory_barcodes')
      .select('status')
      .eq('kind', 'unit')

    const counts: CameraStockBarcodeOverview = {
      generated: 0,
      at_dealer: 0,
      at_specialist: 0,
      consumed: 0,
      void: 0,
      other: 0,
    }
    const known = new Set([
      'generated',
      'at_dealer',
      'at_specialist',
      'consumed',
      'void',
    ] as const)

    for (const row of barcodeRows ?? []) {
      const status = String(row.status ?? '')
      if (status === 'generated') counts.generated += 1
      else if (status === 'at_dealer') counts.at_dealer += 1
      else if (status === 'at_specialist') counts.at_specialist += 1
      else if (status === 'consumed') counts.consumed += 1
      else if (status === 'void') counts.void += 1
      else if (!known.has(status as never)) counts.other += 1
    }
    barcode = counts
  }

  return {
    ledger: { nationalUnits, dealerUnits, specialistUnits, totalUnits },
    specialists,
    barcode,
  }
}
