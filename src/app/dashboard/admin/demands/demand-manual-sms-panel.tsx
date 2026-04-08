'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SMSTriggerType } from '@/lib/sms-settings'
import { sendManualSms } from '@/app/dashboard/system-management/sms/actions'
import { MessageSquare, Send, Loader2 } from 'lucide-react'

const TRIGGER_LABELS: Record<SMSTriggerType, string> = {
  appointment_created: 'Appointment Created',
  cancellation_notice: 'Cancellation Notice',
  rescheduling_notice: 'Rescheduling Notice',
  four_hour_reminder: '4-Hour Reminder',
  twenty_four_hour_reminder: '24-Hour Reminder',
}

const TRIGGER_ORDER = Object.keys(TRIGGER_LABELS) as SMSTriggerType[]

type Props = {
  demandId: string
  assignedSpecialistId: string | null
  customerPhone: string | null
}

export function DemandManualSmsPanel({ demandId, assignedSpecialistId, customerPhone }: Props) {
  const [messageType, setMessageType] = useState<SMSTriggerType>('appointment_created')
  const [recipient, setRecipient] = useState<'customer' | 'specialist'>('customer')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canSendToSpecialist = useMemo(
    () =>
      !!assignedSpecialistId &&
      (messageType === 'appointment_created' ||
        messageType === 'four_hour_reminder' ||
        messageType === 'twenty_four_hour_reminder' ||
        messageType === 'cancellation_notice' ||
        messageType === 'rescheduling_notice'),
    [assignedSpecialistId, messageType]
  )

  useEffect(() => {
    if (recipient === 'specialist' && !canSendToSpecialist) setRecipient('customer')
  }, [recipient, canSendToSpecialist])

  const handleSend = async () => {
    setNotice(null)
    if (recipient === 'customer' && !customerPhone?.trim()) {
      setNotice({ type: 'error', text: 'Customer has no phone number on file.' })
      return
    }
    if (recipient === 'specialist' && !canSendToSpecialist) {
      setNotice({ type: 'error', text: 'Choose customer or assign a specialist for this message type.' })
      return
    }
    setSending(true)
    const res = await sendManualSms(demandId, messageType, recipient)
    setSending(false)
    if (res.success) setNotice({ type: 'success', text: 'SMS sent successfully.' })
    else setNotice({ type: 'error', text: res.error ?? 'Failed to send SMS.' })
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-6 rounded-lg flex flex-col h-full min-h-[200px]">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-[#C27E00]" />
        Send SMS
      </h2>
      <p className="text-xs text-zinc-500 dark:text-gray-500 mb-4">
        Uses the same templates as SMS Management. Message type must be enabled there.
      </p>

      {notice && (
        <div
          className={`mb-3 text-sm rounded-md px-3 py-2 ${
            notice.type === 'success'
              ? 'bg-green-900/40 border border-green-800 text-green-200'
              : 'bg-red-900/40 border border-red-800 text-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="space-y-3 flex-1">
        <div>
          <label htmlFor="demand-sms-type" className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
            Message template
          </label>
          <select
            id="demand-sms-type"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as SMSTriggerType)}
            className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-100 dark:bg-black/40 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
          >
            {TRIGGER_ORDER.map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="demand-sms-recipient" className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
            Send to
          </label>
          <select
            id="demand-sms-recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value as 'customer' | 'specialist')}
            className="w-full border border-zinc-300 dark:border-gray-700 bg-zinc-100 dark:bg-black/40 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
          >
            <option value="customer">Customer {customerPhone ? `(${customerPhone})` : '(no phone)'}</option>
            {canSendToSpecialist && <option value="specialist">Assigned specialist</option>}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={sending || (recipient === 'customer' && !customerPhone?.trim())}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? 'Sending…' : 'Send SMS'}
      </button>
    </div>
  )
}
