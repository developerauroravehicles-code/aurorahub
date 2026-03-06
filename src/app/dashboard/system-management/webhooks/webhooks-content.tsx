'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

export type WebhookEvent =
  | 'demand_created'
  | 'demand_status_change'
  | 'demand_approved'
  | 'demand_cancelled'
  | 'appointment_completed'

export interface WebhookConfig {
  id: string
  event: WebhookEvent
  url: string
  enabled: boolean
  secret?: string
}

const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: 'demand_created', label: 'Demand Created' },
  { value: 'demand_status_change', label: 'Demand Status Change' },
  { value: 'demand_approved', label: 'Demand Approved' },
  { value: 'demand_cancelled', label: 'Demand Cancelled' },
  { value: 'appointment_completed', label: 'Appointment Completed' },
]

function generateId() {
  return crypto.randomUUID?.() ?? `wh_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function WebhooksContent() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<WebhookConfig>>({
    event: 'demand_created',
    url: '',
    enabled: true,
    secret: '',
  })
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    setMessage(null)
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'webhook_settings')
      .single()
    setLoading(false)
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as { webhooks?: WebhookConfig[] }
        setWebhooks(parsed.webhooks ?? [])
      } catch {
        setWebhooks([])
      }
    } else {
      setWebhooks([])
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (payload: WebhookConfig[]) => {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: 'webhook_settings', value: JSON.stringify({ webhooks: payload }), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Webhooks saved.' })
      setWebhooks(payload)
      setShowForm(false)
      setEditingId(null)
      setForm({ event: 'demand_created', url: '', enabled: true, secret: '' })
    }
  }

  const handleAdd = () => {
    setEditingId(null)
    setForm({ event: 'demand_created', url: '', enabled: true, secret: '' })
    setShowForm(true)
  }

  const handleEdit = (w: WebhookConfig) => {
    setEditingId(w.id)
    setForm({ ...w })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.url?.trim()) {
      setMessage({ type: 'error', text: 'URL is required.' })
      return
    }
    try {
      new URL(form.url)
    } catch {
      setMessage({ type: 'error', text: 'Invalid URL.' })
      return
    }
    const entry: WebhookConfig = {
      id: form.id ?? generateId(),
      event: (form.event as WebhookEvent) ?? 'demand_created',
      url: form.url.trim(),
      enabled: form.enabled ?? true,
      secret: form.secret?.trim() || undefined,
    }
    let updated: WebhookConfig[]
    if (editingId) {
      updated = webhooks.map((w) => (w.id === editingId ? entry : w))
    } else {
      updated = [...webhooks, entry]
    }
    await save(updated)
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this webhook?')) return
    const updated = webhooks.filter((w) => w.id !== id)
    await save(updated)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ event: 'demand_created', url: '', enabled: true, secret: '' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-md text-sm ${
            message.type === 'success' ? 'bg-green-900/50 border border-green-800 text-green-200' : 'bg-red-900/50 border border-red-800 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Define webhooks for events such as Demand created, Status change, Appointment completed.
        </p>
        {!showForm && (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#C27E00] text-white text-sm font-medium hover:bg-[#a66a00] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-lg border border-gray-700 bg-black/30">
          <h4 className="font-medium text-white">{editingId ? 'Edit Webhook' : 'Add Webhook'}</h4>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Event</label>
            <select
              value={form.event ?? 'demand_created'}
              onChange={(e) => setForm((f) => ({ ...f, event: e.target.value as WebhookEvent }))}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm"
            >
              {WEBHOOK_EVENTS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Webhook URL *</label>
            <input
              type="url"
              value={form.url ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://your-server.com/webhook"
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Secret (optional)</label>
            <input
              type="password"
              value={form.secret ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
              placeholder="HMAC secret for signature verification"
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm placeholder-gray-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled ?? true}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
            />
            <span className="text-sm text-gray-300">Enabled</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-[#C27E00] text-white text-sm font-medium hover:bg-[#a66a00] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-md border border-gray-600 text-gray-300 text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {webhooks.length === 0 && !showForm ? (
        <div className="text-center py-12 text-gray-500">
          <p>No webhooks configured.</p>
          <p className="text-sm mt-1">Add a webhook to receive HTTP notifications when events occur.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-800">
          {webhooks.map((w) => (
            <li key={w.id} className="py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{WEBHOOK_EVENTS.find((e) => e.value === w.event)?.label ?? w.event}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      w.enabled ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {w.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate mt-0.5">{w.url}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleEdit(w)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(w.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
