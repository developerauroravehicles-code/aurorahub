import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SystemManagementLayout({
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

  // Only Aurora Manager can access System Management
  if (profile?.role !== 'aurora_manager') {
    redirect('/dashboard')
  }

  return <>{children}</>
}

