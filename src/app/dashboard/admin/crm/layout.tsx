import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CrmNav } from './crm-nav'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-1">CRM</h1>
      <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
        Dealer relationships, notes, and performance (Pacific Time periods).
      </p>
      <Suspense fallback={null}>
        <CrmNav />
      </Suspense>
      {children}
    </div>
  )
}