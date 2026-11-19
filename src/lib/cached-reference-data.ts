import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const CACHE_TAGS = {
  systemLogo: 'system-logo',
  dealerList: 'dealer-list',
} as const

export const getCachedSystemLogo = unstable_cache(
  async (): Promise<string | null> => {
    const supabaseAdmin = createAdminClient()
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'system_logo')
      .single()
    return data?.value || null
  },
  ['cached-system-logo-v1'],
  { revalidate: 300, tags: [CACHE_TAGS.systemLogo] }
)

export type CachedDealerRow = { id: string; name: string }

export const getCachedDealerList = unstable_cache(
  async (): Promise<CachedDealerRow[]> => {
    const supabaseAdmin = createAdminClient()
    const { data } = await supabaseAdmin.from('dealers').select('id, name').order('name')
    return (data ?? []) as CachedDealerRow[]
  },
  ['cached-dealer-list-v1'],
  { revalidate: 120, tags: [CACHE_TAGS.dealerList] }
)