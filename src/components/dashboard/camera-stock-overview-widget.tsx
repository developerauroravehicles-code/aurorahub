import Link from 'next/link'
import { Camera, ChevronRight } from 'lucide-react'
import type { CameraStockOverview } from '@/lib/inventory-v2/camera-stock-overview'

function StatLink({
  href,
  label,
  value,
  warn,
}: {
  href: string
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/50 dark:bg-zinc-900/55 px-3 py-2 hover:border-[#C27E00]/40 hover:bg-[#C27E00]/5 transition-colors group"
    >
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-gray-500">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums ${warn ? 'text-red-400' : 'text-zinc-900 dark:text-white'}`}
      >
        {value}
      </p>
      <p className="text-[10px] text-[#C27E00] opacity-0 group-hover:opacity-100 mt-1">View stock →</p>
    </Link>
  )
}

export function CameraStockOverviewWidget({
  overview,
  barcodeModeEnabled,
}: {
  overview: CameraStockOverview
  barcodeModeEnabled: boolean
}) {
  const { ledger, specialists, barcode } = overview
  const stockHref = '/dashboard/admin/inventory?tab=stock'
  const specialistsHref = '/dashboard/admin/inventory?tab=specialists'
  const barcodeHref = '/dashboard/admin/inventory?tab=barcode'

  const withStock = specialists.filter((s) => s.total_units > 0)

  return (
    <div
      id="camera-stock-overview"
      className="rounded-xl border border-zinc-200 dark:border-gray-800/80 bg-gradient-to-b from-white/[0.04] to-transparent p-6 shadow-lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-200/50 dark:bg-zinc-900/60">
            <Camera className="h-5 w-5 text-[#C27E00]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Camera stock overview</h2>
            <p className="text-xs text-zinc-500 dark:text-gray-500">
              Totals from inventory ledger (units move between dealer and field stock)
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
        <StatLink href={stockHref} label="Total units" value={ledger.totalUnits} />
        <StatLink href={stockHref} label="National (Canada)" value={ledger.nationalUnits} />
        <StatLink
          href={stockHref}
          label="Dealer stock"
          value={ledger.dealerUnits}
          warn={ledger.dealerUnits < 0}
        />
        <StatLink href={specialistsHref} label="Field (specialists)" value={ledger.specialistUnits} />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-gray-200">By specialist (field stock)</h3>
        <Link href={specialistsHref} className="text-xs text-[#C27E00] hover:underline">
          All specialists →
        </Link>
      </div>

      {withStock.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-500 py-2">No units on specialist field stock.</p>
      ) : (
        <ul className="max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-gray-800 divide-y divide-zinc-200 dark:divide-gray-800">
          {withStock.map((s) => (
            <li key={s.specialist_id}>
              <Link
                href={`/dashboard/admin/inventory?tab=specialists&specialist=${s.specialist_id}`}
                className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-[#C27E00]/5 transition-colors group"
              >
                <span className="text-zinc-900 dark:text-white truncate">{s.specialist_name}</span>
                <span className="flex items-center gap-1 shrink-0 tabular-nums text-zinc-600 dark:text-gray-300">
                  {s.total_units} units
                  <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-[#C27E00]" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {specialists.length > withStock.length && (
        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-2">
          {specialists.length - withStock.length} specialist(s) with zero field stock —{' '}
          <Link href={specialistsHref} className="text-[#C27E00] hover:underline">
            open list
          </Link>
        </p>
      )}

      {barcodeModeEnabled && barcode && (
        <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-zinc-600 dark:text-gray-400">Unit barcode labels (registry)</p>
            <Link href={barcodeHref} className="text-xs text-[#C27E00] hover:underline">
              Barcode registry →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
            {(
              [
                ['Generated', barcode.generated],
                ['At dealer', barcode.at_dealer],
                ['At specialist', barcode.at_specialist],
                ['Consumed', barcode.consumed],
                ['Void', barcode.void],
                ['Other', barcode.other],
              ] as const
            ).map(([label, n]) => (
              <Link
                key={label}
                href={barcodeHref}
                className="rounded-md border border-zinc-200 dark:border-gray-800 px-2 py-1.5 hover:border-[#C27E00]/30"
              >
                <p className="text-[10px] uppercase text-zinc-500">{label}</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">{n}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
