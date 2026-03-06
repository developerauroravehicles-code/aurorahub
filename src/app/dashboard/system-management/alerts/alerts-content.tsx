'use client'

import { useState, useEffect } from 'react'
import { getAlertSettings, saveAlertSettings, getAlertLogs, type AlertRule } from './actions'
import { Bell, Clock, CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react'

const ALERT_TYPE_LABELS: Record<string, string> = {
  sla_breach_ticket: 'SLA Breach',
  critical_incident: 'Critical Incident',
  low_stock: 'Low Stock',
  new_critical_ticket: 'New Critical Ticket',
}

export function AlertsContent() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [logs, setLogs] = useState<Array<{
    id: string
    alert_type: string
    entity_type: string
    entity_id: string | null
    subject: string | null
    recipient_count: number | null
    success: boolean
    error_message: string | null
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const [settingsRes, logsRes] = await Promise.all([
      getAlertSettings(),
      getAlertLogs(30),
    ])
    setLoading(false)
    if (settingsRes.error) {
      setMessage({ type: 'error', text: settingsRes.error })
    } else {
      setRules(settingsRes.rules)
    }
    if (logsRes.error) {
      // non-blocking
    } else {
      setLogs(logsRes.logs)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    )
  }

  const setThreshold = (id: string, value: number) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, params: { ...(r.params ?? {}), threshold: value } } : r
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const res = await saveAlertSettings(rules)
    setSaving(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setMessage({ type: 'success', text: 'Alert settings saved' })
      load()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Recipients info */}
      <div className="rounded-lg border border-gray-800 bg-amber-900/10 p-4">
        <div className="flex items-center gap-2 text-amber-400">
          <Mail className="h-5 w-5" />
          <span className="font-medium">Recipients</span>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          Alerts are sent via email to all users with IT and Aurora Manager roles. Ensure mail settings are configured in Infrastructure → Mail Settings.
        </p>
      </div>

      {/* Alert rules */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Alert rules</h3>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-800 bg-black/30 p-4"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleRule(rule.id)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    rule.enabled ? 'bg-amber-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      rule.enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <div className="font-medium text-white">{rule.name}</div>
                  {rule.description && (
                    <div className="text-sm text-gray-500">{rule.description}</div>
                  )}
                </div>
              </div>
              {rule.type === 'low_stock' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400">Threshold:</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={Number(rule.params?.threshold ?? 5)}
                    onChange={(e) => setThreshold(rule.id, parseInt(e.target.value, 10) || 5)}
                    className="w-20 rounded bg-gray-900 border border-gray-700 px-2 py-1 text-white text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>

      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === 'success' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Cron setup */}
      <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Bell className="h-5 w-5" />
          <span className="font-medium">Automatic triggers</span>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Alerts run automatically via cron. Call <code className="rounded bg-gray-800 px-1">GET /api/run-alerts</code> periodically
          (e.g. every 5–15 minutes). If CRON_SECRET is set, include <code className="rounded bg-gray-800 px-1">Authorization: Bearer &#123;CRON_SECRET&#125;</code>.
        </p>
      </div>

      {/* Recent alerts */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent alerts</h3>
        {logs.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-black/30 p-8 text-center text-gray-500">
            No alerts sent yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-black/30">
                  <th className="px-4 py-2 text-left text-gray-400">Time</th>
                  <th className="px-4 py-2 text-left text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-gray-400">Subject</th>
                  <th className="px-4 py-2 text-center text-gray-400">Recipients</th>
                  <th className="px-4 py-2 text-center text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800/50 hover:bg-white/5">
                    <td className="px-4 py-2 text-gray-300">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-300">
                      {ALERT_TYPE_LABELS[log.alert_type] ?? log.alert_type}
                    </td>
                    <td className="px-4 py-2 text-gray-400 max-w-xs truncate">
                      {log.subject ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-400">
                      {log.recipient_count ?? 0}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <span title={log.error_message ?? 'Failed'}><XCircle className="h-4 w-4 text-red-400" /></span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
