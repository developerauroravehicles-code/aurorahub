import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SystemManagementTabs } from '@/app/dashboard/system-management/system-management-tabs'
import { SystemManagementTitle } from '@/app/dashboard/system-management/system-management-title'

export default async function IdentityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const identityRoles = ['it', 'aurora_manager', 'hr']
  if (!identityRoles.includes(profile?.role ?? '')) {
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
