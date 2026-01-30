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
      <div className="flex flex-col items-center justify-center h-24 px-4 py-4 border-b border-gray-800 bg-white/5">
        <img
          src={logoUrl}
          alt="Aurora Vehicles"
          className="max-h-16 max-w-full object-contain mb-2"
        />
        <p className="text-xs font-semibold text-gray-300 tracking-wider">AURORA VEHICLES</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-24 items-center justify-center px-4 py-4 border-b border-gray-800 bg-white/5">
      <div className="text-2xl font-bold tracking-wider text-[#C27E00] mb-1">A</div>
      <p className="text-xs font-semibold text-gray-300 tracking-wider">AURORA VEHICLES</p>
    </div>
  )
}
