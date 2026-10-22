import {
  fieldHighlightClass,
  type DemandFieldKey,
  type FieldHighlightBucket,
} from '@/lib/demand-field-updates'

export function DemandFieldWrap({
  field,
  highlights,
  children,
  className = '',
}: {
  field: DemandFieldKey
  highlights?: Partial<Record<DemandFieldKey, FieldHighlightBucket>>
  children: React.ReactNode
  className?: string
}) {
  const bucket = highlights?.[field]
  const ring = fieldHighlightClass(bucket)
  if (!ring) {
    return className ? <div className={className}>{children}</div> : <>{children}</>
  }
  return <div className={`${ring} ${className}`.trim()}>{children}</div>
}

export function DemandFieldLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-gray-500 mb-4">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-[#C27E00]/40 ring-1 ring-[#C27E00]/60" />
        Updated by Aurora Manager
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-sky-500/40 ring-1 ring-sky-500/60" />
        Updated by Specialist
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-violet-500/40 ring-1 ring-violet-500/60" />
        Updated by Finance
      </span>
      <span className="text-zinc-400 dark:text-gray-600">(last 30 days)</span>
    </div>
  )
}
