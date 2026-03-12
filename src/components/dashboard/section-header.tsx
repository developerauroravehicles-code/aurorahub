import Link from 'next/link'

interface SectionHeaderProps {
  title: string
  action?: {
    label: string
    href: string
  }
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-medium text-[#C27E00] hover:text-[#e09200] transition-colors flex items-center gap-1"
        >
          {action.label}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  )
}
