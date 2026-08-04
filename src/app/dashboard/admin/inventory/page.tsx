import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchInventoryStockAlerts } from '@/lib/inventory-stock-alerts'
import { InventoryDashboard } from './inventory-dashboard'

const VALID_TABS = new Set(['dashboard', 'alerts', 'stock', 'movements', 'pricing', 'setup'])

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'aurora_manager') {
    redirect('/dashboard')
  }

  const params = await searchParams
  const initialTab = params.tab && VALID_TABS.has(params.tab) ? params.tab : 'dashboard'

  const [
    provincesRes,
    citiesRes,
    regionsRes,
    locationsRes,
    balancesRes,
    movementsRes,
    thresholdsRes,
    camerasRes,
    dealersRes,
    specialistsRes,
    pricingRes,
    nationalLocRes,
    inventoryAlertsRes,
  ] = await Promise.all([
    supabase.from('inventory_provinces').select('id, code, name, sort_order').order('sort_order'),
    supabase
      .from('inventory_cities')
      .select('id, code, name, province_id, inventory_provinces(code, name)')
      .order('name'),
    supabase
      .from('inventory_regions')
      .select('id, code, name, city_id, province_id, inventory_cities(code, name)')
      .order('name'),
    supabase
      .from('inventory_locations')
      .select('id, location_type, label, province_id, city_id, region_id, dealer_id')
      .order('label'),
    supabase.from('inventory_balances_v2').select('location_id, camera_model_id, quantity'),
    supabase
      .from('inventory_movements_v2')
      .select(
        `id, movement_type, quantity, note, created_at, camera_model_id,
         camera_models(name),
         from_loc:inventory_locations!inventory_movements_v2_from_location_id_fkey(label),
         to_loc:inventory_locations!inventory_movements_v2_to_location_id_fkey(label)`
      )
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('inventory_thresholds').select('location_id, camera_model_id, min_qty'),
    supabase.from('camera_models').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('dealers')
      .select(
        'id, name, inventory_region_id, inventory_regions(code, name, city_id, inventory_cities(name, code))'
      )
      .order('name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'specialist').order('full_name'),
    supabase
      .from('inventory_pricing_rules')
      .select('id, scope_type, scope_id, camera_model_id, service_type, price_cad'),
    supabase.from('inventory_locations').select('id').eq('location_type', 'national').maybeSingle(),
    fetchInventoryStockAlerts(supabase),
  ])

  const balances = (balancesRes.data ?? [])
    .filter((b) => b.camera_model_id)
    .map((b) => ({
      location_id: b.location_id as string,
      camera_model_id: b.camera_model_id as string,
      quantity:
        typeof b.quantity === 'string' ? parseInt(b.quantity, 10) : Number(b.quantity ?? 0),
    }))

  const movements = (movementsRes.data ?? []).map((m) => ({
    ...m,
    from_loc: Array.isArray(m.from_loc) ? m.from_loc[0] : m.from_loc,
    to_loc: Array.isArray(m.to_loc) ? m.to_loc[0] : m.to_loc,
    camera_models: Array.isArray(m.camera_models) ? m.camera_models[0] : m.camera_models,
  }))

  const { alerts, summary, customRules } = inventoryAlertsRes

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Inventory</h1>
        <p className="text-zinc-500 dark:text-gray-400">
          <strong>Dashboard</strong> genel görünüm; <strong>Alerts</strong> uyarılar (e-posta + bildirim);
          <strong> Stok ağacı</strong> ile Kanada → Eyalet → Şehir → İç bölge → Bayi.
        </p>
      </div>
      <InventoryDashboard
        provinces={provincesRes.data ?? []}
        cities={(citiesRes.data ?? []).map((c) => ({
          ...c,
          inventory_provinces: Array.isArray(c.inventory_provinces)
            ? c.inventory_provinces[0]
            : c.inventory_provinces,
        }))}
        regions={(regionsRes.data ?? []).map((r) => ({
          ...r,
          inventory_cities: Array.isArray(r.inventory_cities)
            ? r.inventory_cities[0]
            : r.inventory_cities,
        }))}
        locations={locationsRes.data ?? []}
        balances={balances}
        movements={movements as never}
        thresholds={thresholdsRes.data ?? []}
        cameras={camerasRes.data ?? []}
        dealers={(dealersRes.data ?? []).map((d) => {
          const ir = Array.isArray(d.inventory_regions) ? d.inventory_regions[0] : d.inventory_regions
          const invCities = ir?.inventory_cities
          const cityNorm = Array.isArray(invCities) ? invCities[0] : invCities
          return {
            ...d,
            inventory_regions: ir ? { ...ir, inventory_cities: cityNorm ?? null } : null,
          }
        })}
        specialists={specialistsRes.data ?? []}
        pricingRules={(pricingRes.data ?? []).map((p) => ({
          ...p,
          price_cad: Number(p.price_cad),
        }))}
        alerts={alerts}
        summary={summary}
        customRules={customRules}
        nationalLocationId={nationalLocRes.data?.id ?? null}
        initialTab={initialTab as 'dashboard' | 'alerts' | 'stock' | 'movements' | 'pricing' | 'setup'}
      />
    </div>
  )
}
