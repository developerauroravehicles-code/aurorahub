'use client'

import { useMemo, useState } from 'react'
import type { SMSTriggerType } from '@/lib/sms-settings'
import { sendManualSms } from '@/app/dashboard/system-management/sms/actions'
import { MessageSquare, Send, Loader2, CheckCircle2, Circle } from 'lucide-react'

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
  initialSentTypes?: SMSTriggerType[]
}

export function DemandManualSmsPanel({
  demandId,
  assignedSpecialistId,
  customerPhone,
  initialSentTypes = [],
}: Props) {
  const [messageType, setMessageType] = useState<SMSTriggerType>('appointment_created')
  const [recipient, setRecipient] = useState<'customer' | 'specialist'>('customer')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sentTypes, setSentTypes] = useState<Set<SMSTriggerType>>(() => new Set(initialSentTypes))

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
    if (res.success) {
      setNotice({ type: 'success', text: `"${TRIGGER_LABELS[messageType]}" sent successfully.` })
      // Mark as sent in the checklist (only customer sends are tracked in checklist)
      if (recipient === 'customer') {
        setSentTypes((prev) => new Set([...prev, messageType]))
      }
    } else {
      setNotice({ type: 'error', text: res.error ?? 'Failed to send SMS.' })
    }
  }

  const unsentCount = TRIGGER_ORDER.filter((t) => !sentTypes.has(t)).length

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#C27E00]" />
          Send SMS
        </h2>
        {unsentCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {unsentCount} unsent
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
            All sent
          </span>
        )}
      </div>

      {/* Body: two columns */}
      <div className="flex flex-col gap-0 sm:flex-row sm:divide-x sm:divide-zinc-200 sm:dark:divide-gray-800">

        {/* LEFT: Send form */}
        <div className="flex flex-col gap-3 p-5 sm:w-1/2">
          <p className="text-xs text-zinc-500 dark:text-gray-500">
            Uses the same templates as SMS Management. Message type must be enabled there.
          </p>

          {notice && (
            <div
              className={`text-sm rounded-md px-3 py-2 ${
                notice.type === 'success'
                  ? 'bg-green-900/40 border border-green-800 text-green-200'
                  : 'bg-red-900/40 border border-red-800 text-red-200'
              }`}
            >
              {notice.text}
            </div>
          )}

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

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || (recipient === 'customer' && !customerPhone?.trim())}
            className="mt-auto w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send SMS'}
          </button>
        </div>

        {/* RIGHT: SMS checklist */}
        <div className="flex flex-col gap-2 p-5 sm:w-1/2">
          <p className="text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
            Sent to customer
          </p>
          <ul className="space-y-2">
            {TRIGGER_ORDER.map((t) => {
              const isSent = sentTypes.has(t)
              return (
                <li
                  key={t}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    isSent
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                      : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-gray-400'
                  }`}
                >
                  {isSent ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="w-4 h-4 shrink-0 text-zinc-400 dark:text-gray-600" />
                  )}
                  <span className={isSent ? 'font-medium' : ''}>{TRIGGER_LABELS[t]}</span>
                </li>
              )
            })}
          </ul>
        </div>

      </div>
    </div>
  )
}
