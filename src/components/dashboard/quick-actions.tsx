import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface QuickAction {
  label: string
  href: string
  icon?: LucideIcon
}

interface QuickActionsProps {
  actions: QuickAction[]
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-700/80 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-gray-200 transition-all duration-200 hover:border-[#C27E00]/50 hover:bg-[#C27E00]/10 hover:text-white"
        >
          {Icon && <Icon className="h-4 w-4 text-[#C27E00]/80" strokeWidth={1.75} />}
          {label}
        </Link>
      ))}
    </div>
  )
}
