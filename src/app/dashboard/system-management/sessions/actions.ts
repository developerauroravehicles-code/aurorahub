'use server'

import { createClient } from '@/lib/supabase/server'

export async function getSessionLogs(limit = 100) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('identity_audit_log')
    .select(`
      id,
      user_id,
      event_type,
      email,
      ip_address,
      user_agent,
      metadata,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data ?? []
}
