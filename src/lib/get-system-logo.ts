import { createAdminClient } from '@/lib/supabase/admin'

/** Read system logo from settings (Server Components / route handlers only). */
export async function getSystemLogo(): Promise<string | null> {
  const supabaseAdmin = createAdminClient()

  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'system_logo')
    .single()

  return data?.value || null
}
