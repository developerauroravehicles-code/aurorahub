'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SidebarLogo() {
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

  if (logoUrl) {
    return (
      <div className="flex items-center justify-center h-16">
        <img
          src={logoUrl}
          alt="Aurora Vehicles"
          className="max-h-12 max-w-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className="flex h-16 items-center justify-center font-bold text-xl tracking-wider text-white">
      AuroraHub
    </div>
  )
}
