'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type AlertRuleType =
  | 'sla_breach_ticket'
  | 'critical_incident'
  | 'low_stock'
  | 'new_critical_ticket'

export interface AlertRule {
  id: string
  type: AlertRuleType
  enabled: boolean
  name: string
  description?: string
  params?: Record<string, unknown>
}

export interface AlertSettings {
  rules: AlertRule[]
}

const ALERT_SETTINGS_KEY = 'alert_settings'

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'sla_breach',
    type: 'sla_breach_ticket',
    enabled: true,
    name: 'SLA Breach (Ticket)',
    description: 'Email when an IT ticket exceeds its SLA due date.',
    params: {},
  },
  {
    id: 'critical_incident',
    type: 'critical_incident',
    enabled: true,
    name: 'Critical Incident',
    description: 'Email when a critical incident is open.',
    params: {},
  },
  {
    id: 'low_stock',
    type: 'low_stock',
    enabled: true,
    name: 'Low Stock',
    description: 'Email when camera stock falls below threshold.',
    params: { threshold: 5 },
  },
  {
    id: 'new_critical_ticket',
    type: 'new_critical_ticket',
    enabled: true,
    name: 'New Critical Ticket',
    description: 'Email when a new critical-priority ticket is created.',
    params: {},
  },
]

async function verifyAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!['aurora_manager', 'it'].includes(profile?.role ?? '')) {
    throw new Error('Only Aurora Manager or IT can manage alerts')
  }
}

export async function getAlertSettings(): Promise<{
  rules: AlertRule[]
  error?: string
}> {
  try {
    await verifyAccess()
    const supabase = await createClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', ALERT_SETTINGS_KEY)
      .single()

    if (!data?.value) {
      return { rules: DEFAULT_RULES }
    }
    const parsed = JSON.parse(data.value) as AlertSettings
    const rules = (parsed.rules ?? DEFAULT_RULES).map((r) => ({
      ...DEFAULT_RULES.find((d) => d.id === r.id) ?? r,
      ...r,
      params: { ...(DEFAULT_RULES.find((d) => d.id === r.id)?.params ?? {}), ...(r.params ?? {}) },
    }))
    return { rules }
  } catch (err) {
    return {
      rules: DEFAULT_RULES,
      error: err instanceof Error ? err.message : 'Failed to load',
    }
  }
}

export async function saveAlertSettings(rules: AlertRule[]): Promise<{ error?: string }> {
  try {
    await verifyAccess()
    const supabase = await createClient()
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: ALERT_SETTINGS_KEY,
          value: JSON.stringify({ rules }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )
    if (error) return { error: error.message }
    revalidatePath('/dashboard/observability/alerts')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save' }
  }
}

export async function getAlertLogs(limit = 50): Promise<{
  logs: Array<{
    id: string
    alert_type: string
    entity_type: string
    entity_id: string | null
    subject: string | null
    recipient_count: number | null
    success: boolean
    error_message: string | null
    created_at: string
  }>
  error?: string
}> {
  try {
    await verifyAccess()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('alert_logs')
      .select('id, alert_type, entity_type, entity_id, subject, recipient_count, success, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return { logs: [], error: error.message }
    return { logs: data ?? [] }
  } catch (err) {
    return {
      logs: [],
      error: err instanceof Error ? err.message : 'Failed to load',
    }
  }
}
