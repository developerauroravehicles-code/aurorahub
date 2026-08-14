'use client'

import { useMemo, useState, useTransition, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { subDays, formatDistanceToNowStrict } from 'date-fns'
import { formatInPT } from '@/lib/timezone-defaults'
import { phoneKeyToCustomerRouteKey } from '@/lib/customer-key'
import { sendCustomerDirectorySms } from './sms-actions'
import { MessageSquare, X, Loader2 } from 'lucide-react'

export type CustomerDirectoryRow = {
  phone_key: string
  customer_phone: string
  customer_firstname: string
  customer_lastname: string
  demand_count: number
  last_activity: string
  latest_camera_model: string | null
  latest_dealer_name: string | null
  latest_warranty_end: string | null
  last_sms_at: string | null
  last_sms_body: string | null
  last_sms_status: string | null
  last_sms_error: string | null
}

const SMS_MAX_CHARS = 1600

function rowDisplayName(row: CustomerDirectoryRow): string {
  return `${row.customer_firstname ?? ''} ${row.customer_lastname ?? ''}`.trim() || 'Unknown'
}

export function CustomersDirectoryList({
  rows,
  signaturePreview,
  canSendSms = true,
}: {
  rows: CustomerDirectoryRow[]
  signaturePreview: string
  canSendSms?: boolean
}) {
  const [search, setSearch] = useState('')
  const [onlyLast90Days, setOnlyLast90Days] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [modalRecipients, setModalRecipients] = useState<CustomerDirectoryRow[]>([])
  const [modalBody, setModalBody] = useState('')
  const [appendSignature, setAppendSignature] = useState(!!signaturePreview.trim())
  const [sendResult, setSendResult] = useState<{
    sent: number
    failed?: { phone: string; error: string }[]
    error?: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()
  const headerSelectAllRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows
    if (onlyLast90Days) {
      const cutoff = subDays(new Date(), 90)
      list = list.filter((r) => {
        const t = new Date(r.last_activity).getTime()
        return Number.isFinite(t) && new Date(r.last_activity) >= cutoff
      })
    }
    if (q) {
      list = list.filter((r) => {
        const name = rowDisplayName(r).toLowerCase()
        const phone = (r.customer_phone ?? '').toLowerCase()
        const dealer = (r.latest_dealer_name ?? '').toLowerCase()
        const cam = (r.latest_camera_model ?? '').toLowerCase()
        return name.includes(q) || phone.includes(q) || dealer.includes(q) || cam.includes(q)
      })
    }
    return list
  }, [rows, search, onlyLast90Days])

  const filteredSelectedCount = useMemo(
    () => filtered.filter((r) => selectedKeys.has(r.phone_key)).length,
    [filtered, selectedKeys]
  )
  const allFilteredSelected = filtered.length > 0 && filteredSelectedCount === filtered.length
  const someFilteredSelected = filteredSelectedCount > 0 && !allFilteredSelected

  useEffect(() => {
    const el = headerSelectAllRef.current
    if (el) el.indeterminate = someFilteredSelected
  }, [someFilteredSelected])

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedKeys((prev) => {
      const filteredKeySet = new Set(filtered.map((r) => r.phone_key))
      const allOn = filtered.length > 0 && filtered.every((r) => prev.has(r.phone_key))
      const next = new Set(prev)
      if (allOn) {
        for (const k of filteredKeySet) next.delete(k)
      } else {
        for (const k of filteredKeySet) next.add(k)
      }
      return next
    })
  }, [filtered])

  const outboundPreviewLength = useMemo(() => {
    const t = modalBody.trim()
    if (!t.length) return 0
    if (!appendSignature || !signaturePreview.trim()) return t.length
    return t.length + 2 + signaturePreview.trim().length
  }, [modalBody, appendSignature, signaturePreview])

  const openModalWithRows = useCallback(
    (recipients: CustomerDirectoryRow[]) => {
      const dedupMap = new Map<string, CustomerDirectoryRow>()
      for (const r of recipients) dedupMap.set(r.phone_key, r)
      setModalRecipients(Array.from(dedupMap.values()))
      setModalBody('')
      setSendResult(null)
      setAppendSignature(!!signaturePreview.trim())
    },
    [signaturePreview]
  )

  const toggleKey = useCallback((phoneKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(phoneKey)) next.delete(phoneKey)
      else next.add(phoneKey)
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedKeys(() => new Set(filtered.map((r) => r.phone_key)))
  }, [filtered])

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), [])

  const selectedRows = useMemo(() => rows.filter((r) => selectedKeys.has(r.phone_key)), [rows, selectedKeys])

  const openBulkModal = () => {
    openModalWithRows(selectedRows.length ? selectedRows : [])
  }

  const closeModal = () => {
    setModalRecipients([])
    setSendResult(null)
  }

  const handleSubmitSms = () => {
    const body = modalBody.trim()
    if (!body.length) {
      setSendResult({ sent: 0, error: 'Enter a message.' })
      return
    }
    if (outboundPreviewLength > SMS_MAX_CHARS) {
      setSendResult({
        sent: 0,
        error: `Message must be at most ${SMS_MAX_CHARS} characters (including signature).`,
      })
      return
    }
    if (!modalRecipients.length) {
      setSendResult({ sent: 0, error: 'No recipients.' })
      return
    }

    startTransition(async () => {
      const recipients = modalRecipients.map((r) => ({
        phone: r.customer_phone,
        displayName: rowDisplayName(r),
      }))
      const res = await sendCustomerDirectorySms({
        recipients,
        body,
        appendSignature: appendSignature && !!signaturePreview.trim(),
      })

      if (!res.success) {
        setSendResult({
          sent: res.sentCount ?? 0,
          error: res.error,
          failed: res.failed,
        })
        return
      }

      setSendResult({
        sent: res.sentCount ?? 0,
        failed: res.failed,
      })
    })
  }

  const reallyOpen = modalRecipients.length > 0

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-gray-300">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, dealer, camera…"
              className="rounded-md border border-zinc-300 bg-zinc-200/50 px-3 py-2 text-zinc-900 dark:border-gray-700 dark:bg-white/5 dark:text-white"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={onlyLast90Days}
              onChange={(e) => setOnlyLast90Days(e.target.checked)}
              className="rounded border-zinc-400 text-[#C27E00]"
            />
            Last activity within 90 days
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-gray-400">
            Showing {filtered.length} of {rows.length} customers
          </span>
          {canSendSms && (
            <>
              <button
                type="button"
                onClick={selectAllFiltered}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Select filtered
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={openBulkModal}
                disabled={selectedKeys.size === 0}
                className="inline-flex items-center gap-2 rounded-md bg-[#C27E00]/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a06900] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquare className="h-4 w-4" />
                Send SMS to selected ({selectedKeys.size})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200/50 shadow dark:border-gray-800 dark:bg-white/5">
        {/* Header */}
        <div className="hidden border-b border-zinc-300 bg-zinc-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-gray-700 dark:bg-zinc-800/60 dark:text-gray-400 sm:block">
          <div className="flex items-center gap-3">
            {canSendSms && (
              <div className="flex w-7 shrink-0 items-center justify-center">
                <input
                  ref={headerSelectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  disabled={filtered.length === 0}
                  onChange={toggleSelectAllFiltered}
                  aria-label="Select all customers in this list"
                  title="Select all / clear filtered rows"
                  className="h-4 w-4 rounded border-zinc-400 text-[#C27E00] disabled:opacity-40"
                />
              </div>
            )}
            <span className="min-w-0 flex-1">Customer</span>
            <span className="hidden w-56 shrink-0 lg:block">Last SMS Activity</span>
            <span className="hidden w-32 shrink-0 text-right md:block">Activity</span>
            <span className="w-20 shrink-0 text-right">Demands</span>
            {canSendSms && <span className="w-24 shrink-0 text-right">Actions</span>}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-gray-400">
            No customers match your filters.
          </p>
        ) : (
          <ul>
            {filtered.map((row, idx) => {
              const name = rowDisplayName(row)
              const routeKey = phoneKeyToCustomerRouteKey(row.phone_key)
              const checked = selectedKeys.has(row.phone_key)
              const hasSms = !!row.last_sms_at
              const smsDate = hasSms ? formatInPT(row.last_sms_at!, 'd MMM yyyy') : null
              const smsRelative = hasSms
                ? formatDistanceToNowStrict(new Date(row.last_sms_at!), { addSuffix: true })
                : null
              const smsTruncated =
                row.last_sms_body && row.last_sms_body.trim().length > 0
                  ? row.last_sms_body.trim().slice(0, 72) + (row.last_sms_body.trim().length > 72 ? '…' : '')
                  : null

              return (
                <li
                  key={row.phone_key}
                  className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center${idx > 0 ? ' border-t border-zinc-200 dark:border-gray-800' : ''}`}
                >
                  {/* Customer column */}
                  <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                    {canSendSms && (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKey(row.phone_key)}
                        aria-label={`Select ${name}`}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-400 text-[#C27E00] sm:mt-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/admin/customers/${routeKey}`}
                        className="font-semibold text-zinc-900 hover:text-[#C27E00] dark:text-white dark:hover:text-[#C27E00]"
                      >
                        {name}
                      </Link>
                      <p className="truncate text-sm text-zinc-500 dark:text-gray-400">{row.customer_phone}</p>
                      {(row.latest_dealer_name || row.latest_camera_model) && (
                        <p className="truncate text-xs text-zinc-400 dark:text-gray-500">
                          {[row.latest_dealer_name, row.latest_camera_model].filter(Boolean).join(' / ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Last SMS Activity column — desktop */}
                  <div className="hidden w-56 shrink-0 lg:block">
                    {hasSms ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-zinc-700 dark:text-gray-300">
                            {smsDate}
                            <span className="ml-1 font-normal text-zinc-400 dark:text-gray-500">({smsRelative})</span>
                          </p>
                          {row.last_sms_status === 'failed' ? (
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400"
                              title={row.last_sms_error ?? undefined}
                            >
                              Failed
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                              Sent
                            </span>
                          )}
                        </div>
                        {row.last_sms_status === 'failed' && row.last_sms_error && (
                          <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400" title={row.last_sms_error}>
                            {row.last_sms_error.slice(0, 72)}
                            {row.last_sms_error.length > 72 ? '…' : ''}
                          </p>
                        )}
                        {smsTruncated && (
                          <p
                            className="mt-0.5 truncate text-xs text-zinc-500 dark:text-gray-400"
                            title={row.last_sms_body ?? undefined}
                          >
                            {smsTruncated}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-gray-600">—</span>
                    )}
                  </div>

                  {/* Right-side columns */}
                  <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:justify-end${canSendSms ? ' pl-7 sm:pl-0' : ''}`}>
                    {/* Mobile summary */}
                    <div className="text-right text-xs text-zinc-500 dark:text-gray-500 sm:hidden">
                      <span>Last {formatInPT(row.last_activity, 'd MMM yyyy')}</span>
                      <span className="mx-1 text-zinc-400">·</span>
                      <span className="text-[#C27E00]">{row.demand_count}</span>
                      {hasSms && (
                        <p className="mt-0.5 text-zinc-400">SMS: {smsDate}</p>
                      )}
                    </div>

                    {/* Activity */}
                    <p className="hidden w-32 shrink-0 text-right text-xs text-zinc-500 dark:text-gray-400 md:block">
                      {formatInPT(row.last_activity, 'd MMM yyyy')}
                    </p>

                    {/* Demand count */}
                    <p className="hidden w-20 shrink-0 text-right text-sm text-zinc-600 dark:text-gray-400 sm:block">
                      <span className="text-[#C27E00] font-semibold">{row.demand_count}</span>
                    </p>

                    {/* Actions */}
                    {canSendSms && (
                      <div className="flex w-24 shrink-0 justify-end">
                        <button
                          type="button"
                          onClick={() => openModalWithRows([row])}
                          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          SMS
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {canSendSms && reallyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close modal" onClick={closeModal} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-300 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Send SMS</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-2 text-sm text-zinc-600 dark:text-gray-400">
              Sending to <strong>{modalRecipients.length}</strong>{' '}
              {modalRecipients.length === 1 ? 'customer' : 'customers'}.
            </p>
            {modalRecipients.length > 30 && (
              <p className="mb-2 rounded-md border border-zinc-200 bg-zinc-100/80 px-2.5 py-1.5 text-xs text-zinc-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400">
                Many recipients: the same message is sent to everyone; this may take a little while. Keep this tab open until
                sending finishes.
              </p>
            )}

            {signaturePreview.trim() ? (
              <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={appendSignature}
                  onChange={(e) => setAppendSignature(e.target.checked)}
                  className="rounded border-zinc-400 text-[#C27E00]"
                />
                Append signature ({signaturePreview.trim().slice(0, 48)}
                {signaturePreview.trim().length > 48 ? '…' : ''})
              </label>
            ) : null}

            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-gray-300">Message</label>
            <textarea
              value={modalBody}
              onChange={(e) => setModalBody(e.target.value)}
              rows={8}
              className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-gray-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Type your SMS…"
            />
            <p
              className={`mb-4 text-xs ${
                outboundPreviewLength > SMS_MAX_CHARS ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-gray-500'
              }`}
            >
              {outboundPreviewLength} / {SMS_MAX_CHARS} characters (estimated total with signature)
            </p>

            {sendResult && (
              <div
                className={`mb-4 rounded-md border px-3 py-2 text-sm ${
                  sendResult.error || (sendResult.failed?.length ?? 0)
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                }`}
              >
                {sendResult.error ? <p className="mb-2 text-red-800 dark:text-red-200">{sendResult.error}</p> : null}
                <p className="text-zinc-800 dark:text-gray-200">
                  Sent successfully: <strong>{sendResult.sent}</strong>
                </p>
                {sendResult.failed?.length ? (
                  <ul className="mt-2 list-inside list-disc text-zinc-700 dark:text-gray-300">
                    {sendResult.failed.map((f) => (
                      <li key={`${f.phone}-${f.error}`}>
                        {f.phone}: {f.error}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                {sendResult && sendResult.sent > 0 && !sendResult.error ? 'Close' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isPending || outboundPreviewLength > SMS_MAX_CHARS || !modalBody.trim()}
                onClick={handleSubmitSms}
                className="inline-flex items-center gap-2 rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06900] disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
