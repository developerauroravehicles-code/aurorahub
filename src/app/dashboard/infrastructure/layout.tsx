import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function InfrastructureLayout({
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

  // Only IT can access Infrastructure (IT-only section)
  if (profile?.role !== 'it') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
