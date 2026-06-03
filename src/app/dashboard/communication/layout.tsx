import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CommunicationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col md:h-[calc(100vh-5rem)]">{children}</div>
}
