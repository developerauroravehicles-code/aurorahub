import Link from 'next/link'
import { Package, AlertTriangle } from 'lucide-react'
import type { InventoryStockAlert, InventoryStockSummary } from '@/lib/inventory-stock-alerts'

export function InventoryStockAlertsWidget({
  alerts,
  summary,
}: {
  alerts: InventoryStockAlert[]
  summary: InventoryStockSummary
}) {
  const top = alerts.slice(0, 8)
  const hasRisk = summary.shortSkuLines > 0 || summary.warningCount > 0 || summary.dealerQtyTotal < 0

  return (
    <div
      id="inventory-stock-alerts"
      className={`rounded-xl border p-6 shadow-lg ${
        hasRisk
          ? 'border-amber-800/50 bg-gradient-to-b from-amber-950/20 to-transparent'
          : 'border-zinc-200 dark:border-gray-800/80 bg-gradient-to-b from-white/[0.04] to-transparent'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-lg ${hasRisk ? 'bg-amber-500/15' : 'bg-zinc-200/50 dark:bg-zinc-900/60'}`}
          >
            <Package className={`h-5 w-5 ${hasRisk ? 'text-amber-400' : 'text-[#C27E00]'}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Inventory &amp; stock alerts</h2>
            <p className="text-xs text-zinc-500 dark:text-gray-500">
              All dealers; completed demands auto-consume catalog-linked cameras
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/admin/inventory"
          className="rounded-lg border border-[#C27E00]/40 bg-[#C27E00]/10 px-3 py-1.5 text-sm font-medium text-[#C27E00] hover:bg-[#C27E00]/20"
        >
          Inventory →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-zinc-900/55 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-gray-500">Negative rows</p>
          <p className={`text-xl font-bold tabular-nums ${summary.shortSkuLines > 0 ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}>
            {summary.shortSkuLines}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-zinc-900/55 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-gray-500">Below min.</p>
          <p className={`text-xl font-bold tabular-nums ${summary.belowMinLines > 0 ? 'text-amber-300' : 'text-zinc-900 dark:text-white'}`}>
            {summary.belowMinLines}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-zinc-900/55 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-gray-500">Negative models</p>
          <p className={`text-xl font-bold tabular-nums ${summary.negModelRollups > 0 ? 'text-red-300' : 'text-zinc-900 dark:text-white'}`}>
            {summary.negModelRollups}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-zinc-900/55 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-gray-500">Total dealer stock</p>
          <p
            className={`text-xl font-bold tabular-nums ${summary.dealerQtyTotal < 0 ? 'text-red-400' : 'text-zinc-800 dark:text-gray-200'}`}
          >
            {summary.dealerQtyTotal}
          </p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-500">No stock data or no alerts generated.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((a, i) => (
            <li
              key={i}
              className={`flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                a.level === 'warning'
                  ? 'border-amber-800/50 bg-amber-950/25 text-amber-50'
                  : 'border-zinc-300 dark:border-gray-700/60 bg-white/[0.03] text-zinc-600 dark:text-gray-300'
              }`}
            >
              {a.level === 'warning' && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              )}
              <div className={a.level === 'warning' ? '' : 'pl-0.5'}>
                <p className="font-medium text-zinc-900 dark:text-white">{a.title}</p>
                <p className="text-xs text-zinc-500 dark:text-gray-400 mt-0.5 leading-relaxed">{a.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {alerts.length > top.length && (
        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-3">
          +{alerts.length - top.length} more alert(s) — see the full list on the Inventory page.
        </p>
      )}
    </div>
  )
}
