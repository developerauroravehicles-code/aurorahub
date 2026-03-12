import { SectionHeader } from './section-header'

interface DataCardProps {
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
}

export function DataCard({ title, action, children }: DataCardProps) {
  return (
    <div className="rounded-xl border border-gray-800/80 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden shadow-lg">
      <div className="border-b border-gray-800/80 px-6 py-4">
        <SectionHeader title={title} action={action} />
      </div>
      <div className="p-6 pt-0">
        {children}
      </div>
    </div>
  )
}
