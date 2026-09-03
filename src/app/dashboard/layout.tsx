import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from './dashboard-shell'
import { ErrorSignOut } from './error-signout'
import { SystemTimeProvider } from '@/contexts/system-time-context'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: personnel }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, role, dealer_id, full_name, phone')
      .eq('id', user.id)
      .single(),
    supabase
      .from('personnel')
      .select('position, hr_org_roles(name)')
      .eq('profile_id', user.id)
      .maybeSingle(),
  ])

  if (!profile) {
      // In case user exists but profile not created (should not happen in normal flow)
      return (
        <div className="flex h-screen items-center justify-center flex-col gap-4">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-red-600">Profile Error</h1>
                <p className="text-zinc-600 dark:text-gray-600">Your user profile was not found in the database.</p>
                <p className="text-sm text-zinc-500 dark:text-gray-500 mt-2">ID: {user.id}</p>
            </div>
            <ErrorSignOut />
        </div>
      )
  }

  let jobTitle: string | null = null

  if (personnel) {
    const roleRel = personnel.hr_org_roles as { name: string } | { name: string }[] | null
    const orgRoleName = Array.isArray(roleRel) ? roleRel[0]?.name : roleRel?.name
    jobTitle = orgRoleName ?? (personnel.position as string | null) ?? null
  }

  const profileWithJobTitle = { ...profile, jobTitle }

  // Sidebar clock: dealer TZ for Sales/GM, PT for HQ
  let displayTimezone: string = SYSTEM_DEFAULT_TIMEZONE
  let displayTimezoneName: string = 'Pacific Time (PT)'
  if ((profile.role === 'sales' || profile.role === 'finance' || profile.role === 'general_manager' || profile.role === 'inventory_manager') && profile.dealer_id) {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('region_codes(timezone_id, timezones(name))')
      .eq('id', profile.dealer_id)
      .single()
    const tzName = (dealer?.region_codes as { timezones?: { name: string } } | null)?.timezones?.name ?? null
    if (tzName) {
      displayTimezone = tzName
      displayTimezoneName = tzName
    }
  }

  const systemTimezone = displayTimezone
  const systemTimezoneDisplayName = displayTimezoneName

  return (
    <SystemTimeProvider>
      <DashboardShell
        profile={profileWithJobTitle}
        timezoneName={systemTimezone}
        timezoneDisplayName={systemTimezoneDisplayName}
      >
        {children}
      </DashboardShell>
    </SystemTimeProvider>
  )
}

