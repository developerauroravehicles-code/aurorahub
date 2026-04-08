import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SystemManagementTitle } from '@/app/dashboard/system-management/system-management-title'
import { SystemManagementTabs } from '@/app/dashboard/system-management/system-management-tabs'

export default async function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Only IT can access Integrations (IT-only section)
  if (profile?.role !== 'it') {
    redirect('/dashboard')
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <SystemManagementTitle />
      <SystemManagementTabs activeTab="" userRole={profile?.role ?? undefined} />
      {children}
    </div>
  )
}
