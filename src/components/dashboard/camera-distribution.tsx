import { Camera } from 'lucide-react'

export interface CameraDistributionItem {
  model: string
  count: number
}

interface CameraDistributionProps {
  items: CameraDistributionItem[]
  /** Month label when filtered by month (e.g. "Mar 2026") */
  monthLabel?: string
}

export function CameraDistribution({ items, monthLabel }: CameraDistributionProps) {
  const total = items.reduce((sum, i) => sum + i.count, 0)
  const sorted = [...items].sort((a, b) => b.count - a.count)

  if (total === 0 || sorted.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800/80 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Camera className="h-5 w-5 text-[#C27E00]" />
          Camera Distribution
        </h2>
        <p className="text-gray-500 text-sm">
          {monthLabel ? `No camera data for ${monthLabel}.` : 'No camera data available.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Camera className="h-5 w-5 text-[#C27E00]" />
        Camera Distribution
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        {total} total demand{total !== 1 ? 's' : ''} by camera model
        {monthLabel ? ` (${monthLabel})` : ''}
      </p>
      <div className="space-y-2">
        {sorted.map(({ model, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div
              key={model}
              className="flex items-center justify-between rounded-lg border border-gray-800/80 bg-white/[0.02] px-4 py-2.5"
            >
              <span className="font-medium text-white">{model || 'Unknown'}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {count} unit{count !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-medium text-[#C27E00] min-w-[3rem] text-right">
                  {pct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
