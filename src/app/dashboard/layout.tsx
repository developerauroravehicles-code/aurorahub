import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from './sidebar'
import { ErrorSignOut } from './error-signout'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
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

  return (
    <div className="flex h-screen bg-black text-white">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto p-8 bg-black">
        {children}
      </main>
    </div>
  )
}

