import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IndividualSalesNav } from './individual-sales-nav'

export default async function IndividualSalesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-1">Individual Sales</h1>
      <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
        Direct appointments created by Aurora Manager — no dealer calendar. SMS and invoicing work the same
        as dealer demands.
      </p>
      <IndividualSalesNav />
      {children}
    </div>
  )
}