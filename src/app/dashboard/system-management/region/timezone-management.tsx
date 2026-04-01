'use client'

interface Timezone {
  id: string
  name: string
  display_name: string
  utc_offset: string
}

export function TimezoneManagement({ timezones }: { timezones: Timezone[] }) {
  return (
    <div className="space-y-4">
      {timezones.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {timezones.map(tz => (
            <div key={tz.id} className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-3 rounded">
              <p className="font-medium text-zinc-900 dark:text-white">
                <span className="text-[#C27E00]">{tz.display_name}</span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-gray-400 mt-1">{tz.name}</p>
              <p className="text-xs text-zinc-500 dark:text-gray-400">UTC {tz.utc_offset}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 dark:text-gray-400 text-sm">No timezones found. Run the migration to add default timezones.</p>
      )}
    </div>
  )
}

