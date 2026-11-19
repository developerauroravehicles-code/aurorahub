export function RouteLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-sm text-zinc-500 dark:text-gray-400">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-[#C27E00] dark:border-gray-700"
        />
        {label}
      </div>
    </div>
  )
}