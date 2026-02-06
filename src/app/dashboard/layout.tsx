import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from './sidebar'
import { ErrorSignOut } from './error-signout'
import { BackgroundLogo } from '@/components/background-logo'
import { DealerClock } from '@/components/dealer-clock'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, dealer_id, full_name, phone')
    .eq('id', user.id)
    .single()

  if (!profile) {
      // In case user exists but profile not created (should not happen in normal flow)
      return (
        <div className="flex h-screen items-center justify-center flex-col gap-4">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-red-600">Profile Error</h1>
                <p className="text-gray-600">Your user profile was not found in the database.</p>
                <p className="text-sm text-gray-500 mt-2">ID: {user.id}</p>
            </div>
            <ErrorSignOut />
        </div>
      )
  }

  // Fetch dealer timezone if user has a dealer_id
  let timezoneName: string | null = null
  let timezoneDisplayName: string | undefined = undefined
  
  if (profile.dealer_id) {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('region_codes(timezone_id, timezones(name, display_name))')
      .eq('id', profile.dealer_id)
      .single()
    
    if (dealer?.region_codes && (dealer.region_codes as any).timezones) {
      timezoneName = (dealer.region_codes as any).timezones.name
      timezoneDisplayName = (dealer.region_codes as any).timezones.display_name
    }
  }

  return (
    <div className="flex h-screen bg-black text-white relative overflow-hidden">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto p-8 bg-black relative z-10">
        {/* Dealer Clock - Top Right */}
        {timezoneName && (
          <div className="fixed top-4 right-4 z-50">
            <DealerClock timezoneName={timezoneName} timezoneDisplayName={timezoneDisplayName} />
          </div>
        )}
        {children}
      </main>
      <BackgroundLogo />
    </div>
  )
}

