'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function BackgroundLogo() {
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

  return (
    <div className="fixed right-0 top-0 w-[30%] h-full flex items-center justify-center z-[5] pointer-events-none">
      {logoUrl ? (
        <div className="flex flex-col items-center justify-center" style={{ opacity: 0.3 }}>
          <img
            src={logoUrl}
            alt="Aurora Vehicles"
            className="max-w-[200px] max-h-[200px] object-contain mb-4 opacity-40 dark:opacity-30 dark:brightness-0 dark:invert"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25))' }}
          />
          <p className="text-xl font-semibold text-zinc-900 dark:text-white tracking-wider" style={{ 
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
            opacity: 0.3
          }}>AURORA VEHICLES</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center" style={{ opacity: 0.3 }}>
          <div 
            className="text-9xl font-bold tracking-wider text-zinc-900 dark:text-white mb-6" 
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textShadow: '0 4px 12px rgba(0, 0, 0, 0.8)'
            }}
          >
            A
          </div>
          <p 
            className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-wider uppercase"
            style={{
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)'
            }}
          >
            AURORA VEHICLES
          </p>
        </div>
      )}
    </div>
  )
}

