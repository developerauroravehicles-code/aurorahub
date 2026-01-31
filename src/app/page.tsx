import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingContent } from '@/components/landing-content'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // If user is already logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  return <LandingContent />
}

