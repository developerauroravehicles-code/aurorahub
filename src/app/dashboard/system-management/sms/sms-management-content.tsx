'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  type SMSSettings,
  type SMSTriggerType,
  type SMSLifecycleTriggerType,
  DEFAULT_SMS_SETTINGS,
  SMS_PLACEHOLDERS,
  SMS_LIFECYCLE_TRIGGER_LABELS,
} from '@/lib/sms-settings'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { Info, Send, History, RotateCcw, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { getDemandsForManualSms, getSmsLogs, sendManualSms, getSmsSettingsAction, saveSmsSettingsAction, type DemandOption, type SmsLogEntry } from './actions'
import { previewSmsTemplate, getSmsSegmentCount } from '@/lib/sms-preview'

const TRIGGER_LABELS: Record<SMSTriggerType, string> = {
  appointment_created: 'Appointment Created',
  cancellation_notice: 'Cancellation Notice',
  rescheduling_notice: 'Rescheduling Notice',
  four_hour_reminder: '4-Hour Reminder',
  twenty_four_hour_reminder: '24-Hour Reminder',
}

export function SMSManagementContent() {
  const [settings, setSettings] = useState<SMSSettings>(DEFAULT_SMS_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedTriggers, setExpandedTriggers] = useState<SMSTriggerType[]>(['appointment_created'])
  const [showManualSend, setShowManualSend] = useState(false)
  const [demands, setDemands] = useState<DemandOption[]>([])
  const [manualDemandId, setManualDemandId] = useState('')
  const [manualMessageType, setManualMessageType] = useState<SMSTriggerType>('appointment_created')
  const [manualRecipient, setManualRecipient] = useState<'customer' | 'specialist'>('customer')
  const [manualSending, setManualSending] = useState(false)
  const [smsLogs, setSmsLogs] = useState<SmsLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logFilters, setLogFilters] = useState({ dateFrom: '', dateTo: '', customerName: '' })
  const [viewingLog, setViewingLog] = useState<SmsLogEntry | null>(null)
  const [initialSettings, setInitialSettings] = useState<SMSSettings | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      const res = await getSmsSettingsAction()
      if (res.settings) {
        setSettings(res.settings)
        setInitialSettings(res.settings)
      } else if (res.error) {
        setMessage({ type: 'error', text: res.error })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load SMS settings.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    getSmsLogs({})
      .then((res) => {
        if (res.logs) setSmsLogs(res.logs)
        if (res.error) setMessage({ type: 'error', text: res.error })
        else if (res.schemaWarning) {
          setMessage({ type: 'error', text: `${res.schemaWarning} Status tracking requires this migration.` })
        }
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Failed to load SMS logs.' })
      })
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setMessage(null)
    const res = await saveSmsSettingsAction(settings)
    setSaving(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setInitialSettings(settings)
      setMessage({ type: 'success', text: 'SMS settings saved successfully!' })
    }
  }

  const hasUnsavedChanges = initialSettings
    ? JSON.stringify(settings) !== JSON.stringify(initialSettings)
    : false

  const triggerKeys = Object.keys(TRIGGER_LABELS) as SMSTriggerType[]
  const lifecycleKeys = Object.keys(SMS_LIFECYCLE_TRIGGER_LABELS) as SMSLifecycleTriggerType[]
  const expandAll = () => setExpandedTriggers([...triggerKeys])
  const collapseAll = () => setExpandedTriggers([])
  const toggleTrigger = (t: SMSTriggerType) => {
    setExpandedTriggers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  const updateTrigger = (key: SMSTriggerType, updates: Partial<SMSSettings[SMSTriggerType]>) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }))
  }

  const updateLifecycleTrigger = (key: SMSLifecycleTriggerType, updates: Partial<SMSSettings[SMSLifecycleTriggerType]>) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }))
  }

  const resetToDefaults = () => {
    if (confirm('Reset all SMS settings to defaults? This cannot be undone.')) {
      setSettings(DEFAULT_SMS_SETTINGS)
      setMessage({ type: 'success', text: 'Settings reset to defaults. Click Save to apply.' })
    }
  }

  const resetTriggerToDefault = (key: SMSTriggerType) => {
    if (confirm(`Reset "${TRIGGER_LABELS[key]}" to default template and settings?`)) {
      setSettings((prev) => ({
        ...prev,
        [key]: { ...DEFAULT_SMS_SETTINGS[key] },
      }))
      setMessage({ type: 'success', text: `"${TRIGGER_LABELS[key]}" reset to default. Click Save to apply.` })
    }
  }

  const loadDemandsForManual = async () => {
    const res = await getDemandsForManualSms()
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      return
    }
    setDemands(res.demands ?? [])
    if (res.demands?.length) setManualDemandId(res.demands[0].id)
  }

  const handleOpenManualSend = () => {
    setShowManualSend(true)
    setMessage(null)
    loadDemandsForManual()
  }

  const handleSendManualSms = async () => {
    if (!manualDemandId) {
      setMessage({ type: 'error', text: 'Please select an appointment' })
      return
    }
    setManualSending(true)
    setMessage(null)
    const res = await sendManualSms(manualDemandId, manualMessageType, manualRecipient)
    setManualSending(false)
    if (res.success) {
      setMessage({ type: 'success', text: 'SMS sent successfully!' })
      loadSmsLogs()
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Failed to send SMS' })
    }
  }

  const selectedDemand = demands.find((d) => d.id === manualDemandId)
  const canSendToSpecialist = selectedDemand?.assigned_specialist_id && (manualMessageType === 'appointment_created' || manualMessageType === 'four_hour_reminder' || manualMessageType === 'twenty_four_hour_reminder' || manualMessageType === 'cancellation_notice' || manualMessageType === 'rescheduling_notice')

  const loadSmsLogs = async () => {
    setLogsLoading(true)
    const res = await getSmsLogs({
      dateFrom: logFilters.dateFrom || undefined,
      dateTo: logFilters.dateTo || undefined,
      customerName: logFilters.customerName || undefined,
    })
    setLogsLoading(false)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else setSmsLogs(res.logs ?? [])
  }

  if (loading) {
    return (
      <div className="text-zinc-500 dark:text-gray-400 py-8 text-center">Loading SMS settings...</div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">SMS Management</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
          Control when SMS are sent, who receives them, and customize message content. Use placeholders like
          {' '}
          <code className="text-[#C27E00] bg-zinc-100/90 dark:bg-black/30 px-1 rounded">{'{{date}}'}</code>
          {' '}
          in templates.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-800 text-green-200'
              : 'bg-red-900/50 border border-red-800 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Manual Send */}
      <div className="bg-[#C27E00]/10 border border-[#C27E00]/30 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => (showManualSend ? setShowManualSend(false) : handleOpenManualSend())}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#C27E00]/20 transition-colors"
        >
          <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-[#C27E00]" />
            Send SMS Manually
          </span>
          <span className="text-zinc-500 dark:text-gray-500 text-sm">{showManualSend ? '▼' : '▶'}</span>
        </button>
        {showManualSend && (
          <div className="px-4 pb-4 pt-0 border-t border-[#C27E00]/30 space-y-4">
            <p className="text-sm text-zinc-500 dark:text-gray-400 pt-3">
              Select an appointment (approved/pending/completed from last 90 days), choose the message type, and send to customer or specialist.
            </p>
            {demands.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-gray-500">No appointments with phone numbers found. Create and approve demands first.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Appointment</label>
                    <select
                      value={manualDemandId}
                      onChange={(e) => setManualDemandId(e.target.value)}
                      className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                    >
                      <option value="">-- Select appointment --</option>
                      {demands.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Message type</label>
                    <select
                      value={manualMessageType}
                      onChange={(e) => {
                        const t = e.target.value as SMSTriggerType
                        setManualMessageType(t)
                      }}
                      className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                    >
                      {(Object.keys(TRIGGER_LABELS) as SMSTriggerType[]).map((t) => (
                        <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Send to</label>
                    <select
                      value={manualRecipient}
                      onChange={(e) => setManualRecipient(e.target.value as 'customer' | 'specialist')}
                      className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                    >
                      <option value="customer">Customer</option>
                      {canSendToSpecialist && <option value="specialist">Assigned Specialist</option>}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSendManualSms}
                  disabled={manualSending || !manualDemandId}
                  className="mt-4 bg-[#C27E00] hover:bg-[#a06900] text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {manualSending ? 'Sending...' : 'Send SMS'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Global settings */}
      <div className="bg-zinc-100/90 dark:bg-black/30 rounded-lg p-4 space-y-4">
        <h4 className="text-md font-semibold text-zinc-900 dark:text-white">Global Settings</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Contact Phone (for cancellation/rescheduling)</label>
            <input
              type="text"
              value={settings.contactPhone}
              onChange={(e) => setSettings((s) => ({ ...s, contactPhone: e.target.value }))}
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              placeholder="(604) 833-5801"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Signature (appended to messages)</label>
            <input
              type="text"
              value={settings.signature}
              onChange={(e) => setSettings((s) => ({ ...s, signature: e.target.value }))}
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              placeholder="Aurora Vehicles."
            />
          </div>
        </div>
      </div>

      {/* Placeholder help */}
      <div className="bg-[#C27E00]/10 border border-[#C27E00]/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#C27E00]" />
          Available placeholders
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-gray-300">
          {Object.entries(SMS_PLACEHOLDERS).map(([ph, desc]) => (
            <div key={ph} className="flex gap-2">
              <code className="text-[#C27E00] shrink-0">{ph}</code>
              <span className="text-zinc-500 dark:text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-trigger settings */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-md font-semibold text-zinc-900 dark:text-white">SMS Triggers & Templates</h4>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-xs text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white px-2 py-1 rounded border border-zinc-300 dark:border-gray-600 hover:border-gray-500 flex items-center gap-1"
            >
              <ChevronDown className="w-3 h-3" />
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="text-xs text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white px-2 py-1 rounded border border-zinc-300 dark:border-gray-600 hover:border-gray-500 flex items-center gap-1"
            >
              <ChevronUp className="w-3 h-3" />
              Collapse all
            </button>
          </div>
        </div>
        {triggerKeys.map((trigger) => {
          const s = settings[trigger]
          const isExpanded = expandedTriggers.includes(trigger)
          const previewText = previewSmsTemplate(trigger, s.template, {
            signature: settings.signature,
            contactPhone: settings.contactPhone,
            hoursBefore: trigger === 'twenty_four_hour_reminder' ? 24 : ((s as { hoursBefore?: number }).hoursBefore ?? 4),
          })
          const segmentInfo = getSmsSegmentCount(previewText)
          return (
            <div key={trigger} className="bg-zinc-100/90 dark:bg-black/30 rounded-lg border border-zinc-200 dark:border-gray-800 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleTrigger(trigger)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-200/50 dark:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-zinc-900 dark:text-white">{TRIGGER_LABELS[trigger]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.enabled ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-zinc-500 dark:text-gray-400'}`}>
                    {s.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <span className="text-zinc-500 dark:text-gray-500 text-sm">{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 space-y-4 border-t border-zinc-200 dark:border-gray-800">
                  {s.description && (
                    <p className="text-sm text-zinc-500 dark:text-gray-400 pt-3">{s.description}</p>
                  )}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => updateTrigger(trigger, { enabled: e.target.checked })}
                        className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                      />
                      <span className="text-sm text-zinc-600 dark:text-gray-300">Enable this SMS</span>
                    </label>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-gray-400 mb-2">Recipients</p>
                      <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.sendToCustomer}
                            onChange={(e) => updateTrigger(trigger, { sendToCustomer: e.target.checked })}
                            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                          />
                          <span className="text-sm text-zinc-600 dark:text-gray-300">Customer</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.sendToSpecialist ?? false}
                            onChange={(e) => updateTrigger(trigger, { sendToSpecialist: e.target.checked })}
                            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                          />
                          <span className="text-sm text-zinc-600 dark:text-gray-300">Assigned Specialist</span>
                        </label>
                        {trigger === 'appointment_created' && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={s.sendToAuroraManager ?? false}
                              onChange={(e) => updateTrigger(trigger, { sendToAuroraManager: e.target.checked })}
                              className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                            />
                            <span className="text-sm text-zinc-600 dark:text-gray-300">Aurora Manager(s)</span>
                          </label>
                        )}
                      </div>
                    </div>
                    {trigger === 'four_hour_reminder' && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Hours before appointment</label>
                        <select
                          value={String((s as { hoursBefore?: number }).hoursBefore ?? 4)}
                          onChange={(e) => updateTrigger(trigger, { hoursBefore: Number(e.target.value) })}
                          className="w-full max-w-xs border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
                        >
                          <option value={2}>2 hours before</option>
                          <option value={4}>4 hours before</option>
                          <option value={6}>6 hours before</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Message template</label>
                      <button
                        type="button"
                        onClick={() => resetTriggerToDefault(trigger)}
                        className="text-xs text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to default
                      </button>
                    </div>
                    <textarea
                      value={s.template}
                      onChange={(e) => updateTrigger(trigger, { template: e.target.value })}
                      rows={8}
                      className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                      placeholder="Enter customer message template..."
                    />
                    <div className="space-y-2 pt-2">
                      <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">
                        Specialist message template
                      </label>
                      <textarea
                        value={s.specialistTemplate ?? ''}
                        onChange={(e) => updateTrigger(trigger, { specialistTemplate: e.target.value })}
                        rows={6}
                        className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                        placeholder="Vehicle/VIN/stock/customer/dealer info for specialist..."
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-gray-400">
                      <span title="Character and segment count for preview">
                        {previewText.length} chars · {segmentInfo} segment{segmentInfo !== 1 ? 's' : ''}
                      </span>
                      <details className="group">
                        <summary className="cursor-pointer text-[#C27E00] hover:underline flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Preview
                        </summary>
                        <pre className="mt-2 p-3 bg-white dark:bg-black/50 rounded text-zinc-600 dark:text-gray-300 text-xs whitespace-pre-wrap break-words font-sans border border-zinc-300 dark:border-gray-700">
                          {previewText || '(Empty)'}
                        </pre>
                      </details>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lifecycle SMS triggers */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-zinc-900 dark:text-white">Lifecycle SMS (Automated Daily)</h4>
        <p className="text-sm text-zinc-500 dark:text-gray-400">
          Post-completion and warranty messages sent by the daily cron job. Use {'{{portal_link}}'} for customer portal URLs.
        </p>
        {lifecycleKeys.map((trigger) => {
          const s = settings[trigger] ?? DEFAULT_SMS_SETTINGS[trigger]
          return (
            <div key={trigger} className="bg-zinc-100/90 dark:bg-black/30 rounded-lg border border-zinc-200 dark:border-gray-800 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-zinc-900 dark:text-white">{SMS_LIFECYCLE_TRIGGER_LABELS[trigger]}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${s.enabled ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-zinc-500 dark:text-gray-400'}`}>
                  {s.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {s.description && <p className="text-sm text-zinc-500 dark:text-gray-400">{s.description}</p>}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => updateLifecycleTrigger(trigger, { enabled: e.target.checked })}
                  className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                />
                <span className="text-sm text-zinc-600 dark:text-gray-300">Enable this SMS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.sendToCustomer}
                  onChange={(e) => updateLifecycleTrigger(trigger, { sendToCustomer: e.target.checked })}
                  className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                />
                <span className="text-sm text-zinc-600 dark:text-gray-300">Send to customer</span>
              </label>
              <textarea
                value={s.template}
                onChange={(e) => updateLifecycleTrigger(trigger, { template: e.target.value })}
                rows={5}
                className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm font-mono"
              />
            </div>
          )
        })}
      </div>

      {/* SMS Tracking */}
      <div className="bg-zinc-100/90 dark:bg-black/30 rounded-lg border border-zinc-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[#C27E00]" />
            SMS Log / Tracking
          </h4>
          <a
            href="/dashboard/observability/logs?type=sms"
            className="text-sm text-[#C27E00] hover:text-[#a06900] hover:underline"
          >
            View all logs on Logs page →
          </a>
        </div>
        <p className="text-sm text-zinc-500 dark:text-gray-400">
          View sent SMS history. Filter by date range or customer name.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">From date</label>
            <input
              type="date"
              value={logFilters.dateFrom}
              onChange={(e) => setLogFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">To date</label>
            <input
              type="date"
              value={logFilters.dateTo}
              onChange={(e) => setLogFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Customer name</label>
            <input
              type="text"
              value={logFilters.customerName}
              onChange={(e) => setLogFilters((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="Search recipient..."
              className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm w-48"
            />
          </div>
          <button
            type="button"
            onClick={loadSmsLogs}
            disabled={logsLoading}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {logsLoading ? 'Loading...' : 'Apply filters'}
          </button>
        </div>
        <div className="overflow-x-auto border border-zinc-200 dark:border-gray-800 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white dark:bg-black/50 text-left">
                <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Time</th>
                <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Recipient</th>
                <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Phone</th>
                <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Message type</th>
                <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Status</th>
                <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Trigger</th>
                <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium w-24">Message</th>
              </tr>
            </thead>
            <tbody>
              {smsLogs.length === 0 && !logsLoading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-gray-500">No logs yet. Send an SMS or click &quot;Apply filters&quot; to load.</td></tr>
              ) : (
                smsLogs.map((log) => (
                  <tr key={log.id} className="border-t border-zinc-200 dark:border-gray-800 hover:bg-zinc-200/50 dark:bg-white/5">
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">
                      {formatInTimeZone(new Date(log.sent_at), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd, h:mm a')}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-zinc-900 dark:text-white">{log.recipient_name || '—'}</span>
                      <span className="text-zinc-500 dark:text-gray-500 ml-1">({log.recipient_type})</span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 font-mono text-xs">{log.phone_number}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{log.message_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2">
                      {log.delivery_status === 'failed' ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-300" title={log.error_message ?? undefined}>
                          Failed
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-300">Sent</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${log.triggered_by === 'manual' ? 'bg-[#C27E00]/30 text-[#C27E00]' : 'bg-gray-700 text-zinc-500 dark:text-gray-400'}`}>
                        {log.triggered_by}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setViewingLog(log)}
                        className="text-[#C27E00] hover:underline text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Message content modal */}
        {viewingLog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50 dark:bg-black/60 p-4"
            onClick={() => setViewingLog(null)}
          >
            <div
              className="bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-zinc-300 dark:border-gray-700 flex justify-between items-center">
                <h5 className="font-semibold text-zinc-900 dark:text-white">
                  Message — {viewingLog.recipient_name || '—'} ({viewingLog.message_type.replace(/_/g, ' ')})
                </h5>
                <button
                  type="button"
                  onClick={() => setViewingLog(null)}
                  className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <pre className="text-sm text-zinc-600 dark:text-gray-300 whitespace-pre-wrap break-words font-sans">
                  {viewingLog.message_content ?? 'Message content was not recorded for this log entry.'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4">
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="bg-[#C27E00] hover:bg-[#a06900] text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save SMS Settings'}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-md font-medium transition-colors"
        >
          Reset to Defaults
        </button>
        {hasUnsavedChanges && (
          <span className="text-xs text-amber-400 flex items-center">Unsaved changes</span>
        )}
      </div>

      {/* Sticky save bar when unsaved */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-200 dark:bg-gray-900/95 border-t border-zinc-300 dark:border-gray-700 py-3 px-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-sm text-amber-400">You have unsaved changes</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (initialSettings) setSettings(initialSettings)
                  setMessage({ type: 'success', text: 'Changes discarded' })
                }}
                className="text-sm text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white px-4 py-2 rounded border border-zinc-300 dark:border-gray-600 hover:border-gray-500"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="bg-[#C27E00] hover:bg-[#a06900] text-white px-6 py-2 rounded font-medium text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
