'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Loader2, Mail, Plus, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { SERVICE_TYPE_LABELS, DemandServiceType } from '@/lib/demand-pricing'
import {
  sendDailyDealerInvoices,
  setBatchItemIncluded,
} from './actions'

type BatchItem = {
  demandId: string
  included: boolean
  sortOrder: number
  demand: {
    id: string
    demand_number: string | null
    customer_firstname: string
    customer_lastname: string
    camera_model: string
    service_type: string | null
    invoice_total_amount: number | null
    invoice_comments: string | null
    invoice_approved_at: string | null
    completed_at: string | null
    stock_number: string | null
  }
}

export type DailyInvoiceDealerRow = {
  id: string | null
  dealerId: string
  batchDate: string
  status: string
  reviewNotifiedAt: string | null
  sentAt: string | null
  dealerName: string
  dealerCode: string
  items: BatchItem[]
  recipientEmails: { id: string; email: string; label: string | null }[]
}

type DealerBatch = DailyInvoiceDealerRow

type Props = {
  batchDate: string
  batches: DealerBatch[]
  totalDealers: number
  withInvoiceCount: number
  totalCompletedCount: number
}

type SendStep = 'confirm_extra' | 'extra_input' | 'sending'

function getBatchSendStatus(batch: DealerBatch, isEmpty: boolean): { label: string; tone: 'muted' | 'amber' | 'green' } {
  if (isEmpty) return { label: 'No activity', tone: 'muted' }
  if (batch.status === 'sent') return { label: 'Sent', tone: 'green' }

  const total = batch.items.length
  const approved = batch.items.filter((i) => i.demand.invoice_approved_at).length
  if (approved === total) return { label: 'Ready to send', tone: 'green' }
  if (approved > 0) return { label: `${approved}/${total} approved`, tone: 'amber' }
  return { label: 'Awaiting review', tone: 'amber' }
}

function batchStatusClass(tone: 'muted' | 'amber' | 'green'): string {
  if (tone === 'green') return 'text-green-600 dark:text-green-400'
  if (tone === 'amber') return 'text-amber-600 dark:text-amber-400'
  return 'text-zinc-500 dark:text-gray-500'
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function splitEmailTokens(text: string): string[] {
  return text
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean)
}

export function DailyInvoicesContent({
  batchDate,
  batches: initialBatches,
  totalDealers,
  withInvoiceCount,
  totalCompletedCount,
}: Props) {
  const router = useRouter()
  const [batches, setBatches] = useState(initialBatches)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pendingDemand, setPendingDemand] = useState<string | null>(null)
  const [sendBatch, setSendBatch] = useState<DealerBatch | null>(null)
  const [sendStep, setSendStep] = useState<SendStep>('confirm_extra')
  const [extraEmailList, setExtraEmailList] = useState<string[]>([])
  const [extraEmailDraft, setExtraEmailDraft] = useState('')
  const [extraEmailError, setExtraEmailError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    setBatches(initialBatches)
  }, [initialBatches])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`daily-invoice-items:${batchDate}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dealer_daily_invoice_batch_items' },
        () => {
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'demands' },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [batchDate, router])

  const dateLabel = formatInTimeZone(
    new Date(`${batchDate}T12:00:00`),
    SYSTEM_DEFAULT_TIMEZONE,
    'MMMM d, yyyy'
  )

  const onDateChange = (value: string) => {
    router.push(`/dashboard/admin/daily-invoices?date=${value}`)
  }

  const toggleIncluded = async (batchId: string, demandId: string, included: boolean) => {
    setPendingDemand(demandId)
    const r = await setBatchItemIncluded(batchId, demandId, included)
    setPendingDemand(null)
    if (r.error) setMsg({ type: 'err', text: r.error })
    else router.refresh()
  }

  const invoiceHref = (demandId: string) => {
    const returnTo = `/dashboard/admin/daily-invoices?date=${batchDate}`
    return `/dashboard/admin/invoices/${demandId}?return=${encodeURIComponent(returnTo)}`
  }

  const openSend = (batch: DealerBatch) => {
    setSendBatch(batch)
    setSendStep('confirm_extra')
    setExtraEmailList([])
    setExtraEmailDraft('')
    setExtraEmailError(null)
    setSendError(null)
  }

  const configuredRecipientSet = useCallback((batch: DealerBatch | null) => {
    return new Set((batch?.recipientEmails ?? []).map((e) => normalizeEmail(e.email)))
  }, [])

  const mergeExtraEmails = useCallback(
    (prev: string[], text: string, batch: DealerBatch | null) => {
      const configured = configuredRecipientSet(batch)
      const tokens = splitEmailTokens(text)
      const seen = new Set(prev.map(normalizeEmail))
      const next = [...prev]
      let addedCount = 0
      let invalidCount = 0

      for (const token of tokens) {
        if (!isValidEmail(token)) {
          invalidCount += 1
          continue
        }
        if (configured.has(token) || seen.has(token)) continue
        seen.add(token)
        next.push(token)
        addedCount += 1
      }

      return { next, addedCount, invalidCount, tokenCount: tokens.length }
    },
    [configuredRecipientSet]
  )

  const handleAddExtraEmail = () => {
    if (!extraEmailDraft.trim()) return
    const result = mergeExtraEmails(extraEmailList, extraEmailDraft, sendBatch)
    setExtraEmailList(result.next)
    setExtraEmailDraft('')
    if (result.addedCount === 0) {
      if (result.invalidCount > 0) {
        setExtraEmailError('Enter a valid email address.')
      } else if (result.tokenCount > 0) {
        setExtraEmailError('This email is already in the list or configured for the dealer.')
      }
      return
    }
    setExtraEmailError(null)
  }

  const removeExtraEmail = (email: string) => {
    setExtraEmailList((prev) => prev.filter((e) => e !== email))
    setExtraEmailError(null)
  }

  const buildExtraEmailsPayload = useCallback(
    (batch: DealerBatch) => {
      const merged = mergeExtraEmails(extraEmailList, extraEmailDraft, batch)
      return merged.next.join(',')
    },
    [extraEmailList, extraEmailDraft, mergeExtraEmails]
  )

  const closeSend = () => {
    if (sendStep === 'sending') return
    setSendBatch(null)
  }

  const executeSend = useCallback(async (withExtra: boolean) => {
    if (!sendBatch?.id) return
    setSendStep('sending')
    setSendError(null)
    setExtraEmailError(null)
    const extraPayload = withExtra ? buildExtraEmailsPayload(sendBatch) : undefined
    const r = await sendDailyDealerInvoices(sendBatch.id, extraPayload || undefined)
    if (r.error) {
      setSendError(r.error)
      setSendStep(withExtra ? 'extra_input' : 'confirm_extra')
      return
    }
    setMsg({
      type: 'ok',
      text: `Sent to ${r.sentTo?.join(', ') ?? 'recipients'}.`,
    })
    setSendBatch(null)
    router.refresh()
  }, [sendBatch, buildExtraEmailsPayload, router])

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.type === 'ok'
              ? 'border-green-800 bg-green-950/40 text-green-200'
              : 'border-red-800 bg-red-950/40 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 dark:border-gray-800 bg-white/[0.03] p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase mb-1">
            Date (Pacific Time)
          </label>
          <input
            type="date"
            value={batchDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
          />
        </div>
        <p className="text-sm text-zinc-500 dark:text-gray-400 pb-2">
          Showing <span className="text-zinc-800 dark:text-gray-200 font-medium">{dateLabel}</span>
          {' · '}
          {totalDealers} dealer{totalDealers !== 1 ? 's' : ''}
          {' · '}
          {totalCompletedCount} completed job{totalCompletedCount !== 1 ? 's' : ''}
          {' · '}
          {withInvoiceCount} dealer{withInvoiceCount !== 1 ? 's' : ''} with invoices
        </p>
      </div>

      {batches.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-500 py-8 text-center border border-dashed border-zinc-300 dark:border-gray-700 rounded-lg">
          No dealers configured.
        </p>
      ) : (
        batches.map((batch) => {
          const includedCount = batch.items.filter((i) => i.included).length
          const canSend = batch.recipientEmails.length > 0 && includedCount > 0 && batch.id != null
          const isEmpty = batch.items.length === 0
          const sendStatus = getBatchSendStatus(batch, isEmpty)
          return (
            <section
              key={batch.dealerId}
              className={`rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/30 dark:bg-white/[0.03] overflow-hidden ${
                isEmpty ? 'opacity-75' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-gray-800">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {batch.dealerName}
                    {batch.dealerCode ? (
                      <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-gray-500">
                        ({batch.dealerCode})
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-gray-500">
                    {batch.items.length} invoice{batch.items.length !== 1 ? 's' : ''}
                    {' · '}
                    Status:{' '}
                    <span className={batchStatusClass(sendStatus.tone)}>
                      {sendStatus.label}
                    </span>
                    {batch.sentAt && (
                      <>
                        {' '}
                        · Sent {formatInTimeZone(new Date(batch.sentAt), SYSTEM_DEFAULT_TIMEZONE, 'MMM d h:mm a')}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {batch.recipientEmails.length > 0
                      ? batch.recipientEmails.map((e) => e.email).join(', ')
                      : 'No invoice emails configured'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => openSend(batch)}
                  title={
                    !canSend
                      ? batch.recipientEmails.length === 0
                        ? 'Configure dealer invoice emails first'
                        : 'No included invoices'
                      : 'Send invoice PDFs to dealer'
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C27E00] hover:bg-[#a06900] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-left">
                    <tr>
                      <th className="px-3 py-2 w-10">Include</th>
                      <th className="px-3 py-2">Demand</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Camera</th>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2 text-right">Amount (CAD)</th>
                      <th className="px-3 py-2">Comments</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 w-[1%]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                    {isEmpty ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-zinc-500 dark:text-gray-500 text-sm">
                          No completed invoices for this date.
                        </td>
                      </tr>
                    ) : (
                    batch.items.map((item) => {
                      const d = item.demand
                      const busy = pendingDemand === d.id
                      return (
                        <tr
                          key={d.id}
                          className={!item.included ? 'opacity-50' : undefined}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={item.included}
                              disabled={busy}
                              onChange={(e) => batch.id && toggleIncluded(batch.id, d.id, e.target.checked)}
                              className="rounded border-zinc-300 dark:border-gray-600"
                              aria-label="Include in send"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {d.demand_number ? `#${d.demand_number}` : d.id.slice(0, 8)}
                          </td>
                          <td className="px-3 py-2">
                            {d.customer_firstname} {d.customer_lastname}
                          </td>
                          <td className="px-3 py-2">{d.camera_model}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {d.service_type
                              ? SERVICE_TYPE_LABELS[d.service_type as DemandServiceType]
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="tabular-nums text-[#C27E00] font-medium">
                              {d.invoice_total_amount != null
                                ? `$${Number(d.invoice_total_amount).toFixed(2)}`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-[200px]">
                            <span className="text-zinc-500 dark:text-gray-400 truncate block">
                              {d.invoice_comments || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {batch.status === 'sent' ? (
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                Sent
                              </span>
                            ) : d.invoice_approved_at ? (
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                Approved
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">Not approved</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Link
                              href={invoiceHref(d.id)}
                              className="text-xs text-[#C27E00] hover:underline"
                            >
                              Edit
                            </Link>
                          </td>
                        </tr>
                      )
                    })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 text-xs text-zinc-500 dark:text-gray-500 border-t border-zinc-200 dark:border-gray-800">
                {isEmpty
                  ? 'Nothing to send for this date.'
                  : `${includedCount} of ${batch.items.length} included in send`}
              </div>
            </section>
          )
        })
      )}

      {sendBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-lg border border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-900 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-gray-800 px-4 py-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Send — {sendBatch.dealerName}
              </h2>
              <button
                type="button"
                onClick={closeSend}
                disabled={sendStep === 'sending'}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-sm text-zinc-600 dark:text-gray-300">
                Recipients:{' '}
                <span className="font-medium text-zinc-900 dark:text-white">
                  {sendBatch.recipientEmails.map((e) => e.email).join(', ')}
                </span>
              </p>

              {sendStep === 'confirm_extra' && (
                <>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    Add additional email addresses?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => executeSend(false)}
                      className="flex-1 rounded-lg border border-zinc-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/5"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setSendStep('extra_input')}
                      className="flex-1 rounded-lg bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 text-sm font-medium"
                    >
                      Yes
                    </button>
                  </div>
                </>
              )}

              {sendStep === 'extra_input' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300">
                      Additional recipients
                    </label>
                    {extraEmailList.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {extraEmailList.map((email) => (
                          <li key={email}>
                            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-gray-600 bg-zinc-100 dark:bg-gray-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-gray-200">
                              {email}
                              <button
                                type="button"
                                onClick={() => removeExtraEmail(email)}
                                className="rounded-full p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                aria-label={`Remove ${email}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2 min-w-0">
                      <input
                        type="email"
                        value={extraEmailDraft}
                        onChange={(e) => {
                          setExtraEmailDraft(e.target.value)
                          setExtraEmailError(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddExtraEmail()
                          }
                        }}
                        placeholder="email@example.com"
                        className="box-border min-w-0 flex-1 rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-gray-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddExtraEmail}
                        disabled={!extraEmailDraft.trim()}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 dark:border-gray-600 bg-zinc-100 dark:bg-gray-800 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-gray-200 hover:bg-zinc-200 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-gray-500">
                      Press Enter or Add for each address. You can paste multiple comma-separated emails at once.
                    </p>
                    {extraEmailError && (
                      <p className="text-xs text-red-500" role="alert">
                        {extraEmailError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => executeSend(true)}
                    className="w-full rounded-lg bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 text-sm font-medium"
                  >
                    Send email
                  </button>
                </>
              )}

              {sendStep === 'sending' && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-600 dark:text-gray-300">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending…
                </div>
              )}

              {sendError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {sendError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
