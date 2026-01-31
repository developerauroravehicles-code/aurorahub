import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SystemLogo } from '@/components/system-logo'
import { LandingContent } from '@/components/landing-content'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // If user is already logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 lg:gap-24 items-center">
          {/* Left: Logo - Fixed, no animation */}
          <div className="flex items-center justify-center lg:justify-start w-full lg:w-auto">
            <div className="w-full max-w-md lg:max-w-lg">
              <SystemLogo />
            </div>
          </div>

          {/* Right: Content - Animated */}
          <LandingContent />
        </div>
      </div>
    </div>
  )
}

