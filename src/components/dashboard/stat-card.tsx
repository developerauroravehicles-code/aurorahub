import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  accentColor?: 'white' | 'blue' | 'green' | 'yellow' | 'red' | 'amber' | 'emerald' | 'orange'
  href?: string
}

const accentMap = {
  white: 'text-white',
  blue: 'text-blue-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  orange: 'text-[#C27E00]',
}

export function StatCard({ title, value, subtitle, icon: Icon, accentColor = 'white', href }: StatCardProps) {
  const accent = accentMap[accentColor]
  const content = (
    <div className="group relative h-full rounded-xl border border-gray-800/80 bg-gradient-to-br from-white/[0.06] to-transparent p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-gray-700/80 hover:from-white/[0.08] hover:shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400/90">{title}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${accent}`}>{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`rounded-lg bg-white/5 p-3 transition-colors group-hover:bg-white/10 ${accent}`}>
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
        )}
      </div>
      {href && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-transparent transition-all group-hover:ring-white/5" />
      )}
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{content}</Link>
  }
  return content
}
