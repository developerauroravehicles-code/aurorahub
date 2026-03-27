import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchInventoryStockAlerts } from '@/lib/inventory-stock-alerts'
import { InventoryDashboard } from './inventory-dashboard'

type DealerRow = {
  id: string
  name: string
  region_code_id: string | null
  region_codes: { code: string; name: string } | null
}

type CameraRow = { id: string; name: string; stock_quantity: number | null }

type BalanceRow = { dealer_id: string; camera_model_id: string; quantity: string | number | null }

type MovementRow = {
  id: string
  dealer_id: string
  camera_model_id: string
  quantity_delta: number
  movement_type: string
  note: string | null
  created_at: string
  reference_demand_id: string | null
  dealers: { name: string } | null
  camera_models: { name: string } | null
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    redirect('/dashboard')
  }

  const [dealersRes, camerasRes, balancesRes, movementsRes, inventoryAlertsRes] = await Promise.all([
    supabase
      .from('dealers')
      .select('id, name, region_code_id, region_codes(code, name)')
      .order('name'),
    supabase.from('camera_models').select('id, name, stock_quantity').order('name'),
    supabase.from('dealer_inventory_balances').select('dealer_id, camera_model_id, quantity'),
    supabase
      .from('inventory_movements')
      .select(
        'id, dealer_id, camera_model_id, quantity_delta, movement_type, note, created_at, reference_demand_id, dealers(name), camera_models(name)'
      )
      .order('created_at', { ascending: false })
      .limit(250),
    fetchInventoryStockAlerts(supabase),
  ])

  const dealers = (dealersRes.data ?? []) as unknown as DealerRow[]
  const cameras = (camerasRes.data ?? []) as CameraRow[]
  const balances = (balancesRes.data ?? []) as BalanceRow[]
  const movements = (movementsRes.data ?? []) as unknown as MovementRow[]
  const {
    alerts: suggestions,
    consumption30ByKey,
    overallByModel,
    thresholds,
  } = inventoryAlertsRes

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Inventory</h1>
        <p className="text-gray-400">
          Dealer stock from movements; each completed demand consumes one unit when the camera maps to the catalog.
        </p>
      </div>
      <InventoryDashboard
        dealers={dealers}
        cameras={cameras}
        balances={balances.map((b) => ({
          dealer_id: b.dealer_id,
          camera_model_id: b.camera_model_id,
          quantity:
            typeof b.quantity === 'string' ? parseInt(b.quantity, 10) : Number(b.quantity ?? 0),
        }))}
        movements={movements}
        thresholds={thresholds}
        consumption30ByKey={consumption30ByKey}
        suggestions={suggestions}
        overallByModel={overallByModel}
      />
    </div>
  )
}
