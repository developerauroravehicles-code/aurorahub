export function VinDecodeWarningBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="VIN decode failed when this demand was created — verify vehicle details"
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold tracking-tight text-red-700 bg-red-100 dark:bg-red-950/60 dark:text-red-300 ${className}`}
    >
      VIN !
    </span>
  )
}