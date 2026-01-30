import { AdminTabs } from './admin-tabs'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminTabs />
      {children}
    </div>
  )
}
