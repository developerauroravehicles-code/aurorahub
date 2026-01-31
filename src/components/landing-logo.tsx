'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LandingLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchLogo() {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'system_logo')
          .single()
        
        if (error) {
          console.error('Error fetching logo:', error)
        }
        
        if (data?.value) {
          setLogoUrl(data.value)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLogo()
  }, [supabase])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="text-[12rem] lg:text-[14rem] font-bold tracking-wider text-white" style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}>A</div>
      </div>
    )
  }

  if (!logoUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="text-[12rem] lg:text-[14rem] font-bold tracking-wider text-white" style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}>A</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <img
        src={logoUrl}
        alt="Aurora Vehicles Logo"
        className="max-w-full max-h-[30rem] w-auto h-auto object-contain brightness-0 invert"
        onError={(e) => {
          // If image fails to load, hide it and show fallback
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

