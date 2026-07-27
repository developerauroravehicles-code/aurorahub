/**
 * Webhook dispatch – sends HTTP POST requests to configured URLs when events occur.
 * Payload includes event type, timestamp, and event-specific data.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type WebhookEvent =
  | 'demand_created'
  | 'demand_status_change'
  | 'demand_approved'
  | 'demand_cancelled'
  | 'appointment_completed'
  | 'demand_completed'

interface WebhookConfig {
  id: string
  event: WebhookEvent
  url: string
  enabled: boolean
  secret?: string
}

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  [key: string]: unknown
}

async function getWebhooks(supabase: SupabaseClient, event: WebhookEvent): Promise<WebhookConfig[]> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'webhook_settings')
    .single()
  if (!data?.value) return []
  try {
    const parsed = JSON.parse(data.value) as { webhooks?: WebhookConfig[] }
    return (parsed.webhooks ?? []).filter((w) => w.enabled && w.event === event)
  } catch {
    return []
  }
}

export async function dispatchWebhooks(
  supabase: SupabaseClient,
  event: WebhookEvent,
  payload: Omit<WebhookPayload, 'event' | 'timestamp'>
): Promise<void> {
  const webhooks = await getWebhooks(supabase, event)
  const fullPayload: WebhookPayload = {
    ...payload,
    event,
    timestamp: new Date().toISOString(),
  }
  const body = JSON.stringify(fullPayload)

  await Promise.allSettled(
    webhooks.map(async (w) => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'AuroraHub-Webhook/1.0',
          'X-Webhook-Event': event,
        }
        const res = await fetch(w.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) {
          console.error(`Webhook ${w.id} failed: ${res.status} ${res.statusText}`)
        }
      } catch (err) {
        console.error(`Webhook ${w.id} error:`, err)
      }
    })
  )
}
