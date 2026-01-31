'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LandingLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchLogo() {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'system_logo')
        .single()
      
      if (data?.value) {
        setLogoUrl(data.value)
      }
    }
    fetchLogo()
  }, [supabase])

  if (!logoUrl) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-[12rem] font-bold tracking-wider text-white" style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}>A</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <img
        src={logoUrl}
        alt="Aurora Vehicles Logo"
        className="max-w-xl max-h-[30rem] object-contain brightness-0 invert"
      />
    </div>
  )
}

