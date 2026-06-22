import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import { DashboardNotificationBell } from './dashboard-notification-bell'

interface WelcomeBannerProps {
  title: string
  subtitle?: string
  userName?: string
  /** When set (e.g. dealer timezone for GM), date and greeting use this timezone */
  timezone?: string | null
  userId?: string
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function WelcomeBanner({ title, subtitle, userName, timezone, userId }: WelcomeBannerProps) {
  const tz = timezone ? getEffectiveTimezone(timezone) : null
  const now = new Date()
  const hour = tz ? parseInt(formatInTimeZone(now, tz, 'H'), 10) : now.getHours()
  const today = tz ? formatInTimeZone(now, tz, 'EEEE, MMMM d, yyyy') : format(now, 'EEEE, MMMM d, yyyy')

  const greeting = userName ? `${getGreeting(hour)}, ${userName}` : getGreeting(hour)

  return (
    <div className="relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-gray-800/80 bg-gradient-to-br from-[#C27E00]/15 via-white/[0.04] to-transparent px-4 py-5 sm:px-8 sm:py-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(194,126,0,0.12),transparent)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#C27E00]/90">{greeting}</p>
          <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl md:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-gray-400">
            {subtitle ? `${subtitle} · ${today}` : today}
          </p>
        </div>
        {userId ? <DashboardNotificationBell userId={userId} /> : null}
      </div>
    </div>
  )
}
