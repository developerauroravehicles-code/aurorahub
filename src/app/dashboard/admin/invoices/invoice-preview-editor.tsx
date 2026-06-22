'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { warrantyEndFromCompletion } from '@/lib/warranty-period'
import { formatInTimeZone } from 'date-fns-tz'
import { Download, CheckCircle2, Mail, MoreVertical, Plus, Trash2, X } from 'lucide-react'
import { EmailComposeModal } from '@/components/email-compose-modal'
import type { EmailComposePayload } from '@/lib/email-compose'
import { downloadInvoicePdf, getInvoicePdfBlobUrl, getInvoicePdfBase64 } from '@/lib/generate-invoice-pdf'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import {
  recordInvoiceDownloadAction,
  sendInvoicePdfEmailAction,
  approveInvoiceAction,
  updateInvoiceFields,
  uploadInvoiceToDriveAction,
} from './actions'
import {
  DEFAULT_INVOICE_FINANCIAL_SUMMARY,
  getInvoiceDealer,
  type InvoiceFinancialSummary,
  type InvoicePreviewRecord,
} from './invoice-types'
import {
  calculateInvoiceTotalFromExtras,
  resolveInvoiceExtraRows,
} from '@/lib/invoice-line-items'

type Props = {
  invoice: InvoicePreviewRecord
  logoDataUrl: string | null
  canEdit?: boolean
  onClose?: () => void
  returnHref?: string
}

function parseInitialExtraRows(invoice: InvoicePreviewRecord) {
  return resolveInvoiceExtraRows(invoice.invoice_extra_rows, {
    service_type: invoice.service_type,
    camera_model: invoice.camera_model,
    invoice_total_amount: invoice.invoice_total_amount,
  })
}

function parseInitialFinancialSummary(invoice: InvoicePreviewRecord): InvoiceFinancialSummary {
  const saved = invoice.invoice_financial_summary
  if (saved && typeof saved === 'object') {
    return { ...DEFAULT_INVOICE_FINANCIAL_SUMMARY, ...saved }
  }
  return { ...DEFAULT_INVOICE_FINANCIAL_SUMMARY }
}

export function InvoicePreviewEditor({
  invoice,
  logoDataUrl,
  canEdit = true,
  onClose,
  returnHref,
}: Props) {
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const [comments, setComments] = useState(invoice.invoice_comments ?? '')
  const [extraRows, setExtraRows] = useState(parseInitialExtraRows(invoice))
  const [financialSummary, setFinancialSummary] = useState<InvoiceFinancialSummary>(
    parseInitialFinancialSummary(invoice)
  )
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [driveUploading, setDriveUploading] = useState(false)
  const [driveMessage, setDriveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )
  const [emailSending, setEmailSending] = useState(false)
  const [emailComposeOpen, setEmailComposeOpen] = useState(false)
  const [approvedAt, setApprovedAt] = useState<string | null>(invoice.invoice_approved_at ?? null)
  const [approving, setApproving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setComments(invoice.invoice_comments ?? '')
    setExtraRows(parseInitialExtraRows(invoice))
    setFinancialSummary(parseInitialFinancialSummary(invoice))
    setDriveMessage(null)
    setApprovedAt(invoice.invoice_approved_at ?? null)
    setMenuOpen(false)
  }, [invoice])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const getCalculatedTotal = useCallback(() => {
    return calculateInvoiceTotalFromExtras(extraRows, financialSummary)
  }, [extraRows, financialSummary])

  const buildPreviewData = useCallback((): InvoiceRowData => {
    const dealer = getInvoiceDealer(invoice)
    const completionDate = new Date(invoice.completed_at ?? invoice.updated_at)
    const warrantyEnd = warrantyEndFromCompletion(completionDate, dealer?.name)
    const totalNum = getCalculatedTotal()
    return {
      demand_number: invoice.demand_number,
      customerName: dealer?.name ?? '—',
      phone: dealer?.phone ?? invoice.customer_phone ?? '—',
      stockNumber: invoice.stock_number ?? '—',
      customerAddress: dealer?.address ?? '—',
      vehicleInfo: `${invoice.vehicle_year} ${invoice.vehicle_make} ${invoice.vehicle_model} - Stock ${invoice.stock_number ?? '—'}`,
      vinNo: invoice.vin_last6?.trim() ? invoice.vin_last6.trim() : null,
      productModel: invoice.camera_model,
      completeDate: formatInTimeZone(completionDate, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
      warrantyEnd: formatInTimeZone(warrantyEnd, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
      totalAmount: `$${totalNum.toFixed(2)}`,
      comments: comments.trim() || '—',
      logoDataUrl: logoDataUrl ?? null,
      extraTableRows: extraRows,
      financialSummary,
    }
  }, [invoice, comments, extraRows, financialSummary, getCalculatedTotal, logoDataUrl])

  useEffect(() => {
    const data = buildPreviewData()
    const url = getInvoicePdfBlobUrl(data)
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [buildPreviewData])

  const saveInvoice = async () => {
    const calculatedTotal = getCalculatedTotal()
    setPending(true)
    const result = await updateInvoiceFields(
      invoice.id,
      String(calculatedTotal) || null,
      comments || null,
      extraRows,
      financialSummary
    )
    setPending(false)
    return result
  }

  const handleDownload = async () => {
    downloadInvoicePdf(buildPreviewData())
    await recordInvoiceDownloadAction(invoice.id)
    router.refresh()
  }

  const emailComposeDefaults = useMemo(() => {
    const data = buildPreviewData()
    const invLabel = data.demand_number ? `#${data.demand_number}` : 'Invoice'
    const { fileName } = getInvoicePdfBase64(data)
    return {
      defaultSubject: `Invoice ${invLabel} — Aurora Vehicles`,
      defaultBodyHtml: `<p>Please find attached the invoice for ${data.customerName} (${invLabel}).</p>`,
      lockedAttachments: [{ id: 'invoice-pdf', filename: fileName }],
    }
  }, [buildPreviewData])

  const handleEmailSend = async (payload: EmailComposePayload) => {
    setEmailSending(true)
    setDriveMessage(null)
    const res = await sendInvoicePdfEmailAction(buildPreviewData(), payload)
    setEmailSending(false)
    if (res.error) return { error: res.error }
    setDriveMessage({ type: 'success', text: 'Email sent successfully.' })
    setEmailComposeOpen(false)
    return {}
  }

  const handleApprove = async () => {
    if (approvedAt) {
      setApproving(true)
      setDriveMessage(null)
      const res = await approveInvoiceAction(invoice.id, false)
      setApproving(false)
      if (res.error) {
        setDriveMessage({ type: 'error', text: res.error })
        return
      }
      setApprovedAt(null)
      router.refresh()
      return
    }

    setApproving(true)
    setDriveMessage(null)

    const saveResult = await saveInvoice()
    if (saveResult.error) {
      setApproving(false)
      setDriveMessage({ type: 'error', text: saveResult.error })
      return
    }

    const approveResult = await approveInvoiceAction(invoice.id, true)
    if (approveResult.error) {
      setApproving(false)
      setDriveMessage({ type: 'error', text: approveResult.error })
      return
    }
    setApprovedAt(new Date().toISOString())

    const data = buildPreviewData()
    const dealerName = getInvoiceDealer(invoice)?.name ?? 'Unknown Dealer'
    setDriveUploading(true)
    const driveResult = await uploadInvoiceToDriveAction(data, dealerName, invoice.id)
    setDriveUploading(false)
    setApproving(false)

    if (!driveResult.success) {
      setDriveMessage({ type: 'error', text: driveResult.error ?? 'Upload failed' })
      router.refresh()
      return
    }

    if (returnHref) {
      router.push(returnHref)
      return
    }

    router.refresh()
  }

  const invLabel = invoice.demand_number ? `#${invoice.demand_number}` : 'Invoice'

  return (
    <>
      <div className="flex flex-col min-h-[calc(100vh-12rem)] rounded-lg border border-zinc-200 dark:border-gray-800 bg-zinc-200/30 dark:bg-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-gray-800 px-4 py-3 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
              {invLabel}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-gray-400 truncate">
              {getInvoiceDealer(invoice)?.name ?? '—'}
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 dark:text-gray-400"
              aria-label="Close invoice preview"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {canEdit && (
            <div className="lg:w-[clamp(200px,22vw,300px)] lg:min-w-[180px] lg:border-r lg:border-b-0 border-b border-zinc-200 dark:border-gray-800 p-3 space-y-3 overflow-y-auto flex-shrink-0">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
                  Calculated Total (Column 2 + taxes)
                </label>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-zinc-300 dark:border-gray-600 bg-zinc-100/90 dark:bg-black/30 text-[#C27E00] font-semibold text-sm">
                  $ {getCalculatedTotal().toFixed(2)} CAD
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">
                  Comments
                </label>
                <input
                  type="text"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                  placeholder="Add expenses / comments..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1.5">
                  Financial summary (bottom right)
                </label>
                <div className="flex flex-col gap-3 p-3 rounded-lg border border-zinc-300 dark:border-gray-600 bg-zinc-100/90 dark:bg-black/30">
                  {(
                    [
                      ['gstEnabled', 'gstPercent', 'GST'] as const,
                      ['pstEnabled', 'pstPercent', 'PST'] as const,
                      ['salesTaxEnabled', 'salesTaxPercent', 'SALES TAX'] as const,
                    ] as const
                  ).map(([enabledKey, percentKey, label]) => (
                    <label key={enabledKey} className="flex items-center gap-3 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={financialSummary[enabledKey]}
                        onChange={(e) =>
                          setFinancialSummary((f) => ({ ...f, [enabledKey]: e.target.checked }))
                        }
                        className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] shrink-0"
                      />
                      <span className="text-sm text-zinc-600 dark:text-gray-300 w-20 shrink-0">{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={financialSummary[percentKey]}
                        onChange={(e) =>
                          setFinancialSummary((f) => ({
                            ...f,
                            [percentKey]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        disabled={!financialSummary[enabledKey]}
                        className="w-16 px-2 py-1 text-sm border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                      />
                      <span className="text-xs text-zinc-500 dark:text-gray-500">%</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-3 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={financialSummary.otherEnabled}
                      onChange={(e) =>
                        setFinancialSummary((f) => ({ ...f, otherEnabled: e.target.checked }))
                      }
                      className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] shrink-0"
                    />
                    <span className="text-sm text-zinc-600 dark:text-gray-300 w-20 shrink-0">OTHER $</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={financialSummary.otherAmount || ''}
                      onChange={(e) =>
                        setFinancialSummary((f) => ({
                          ...f,
                          otherAmount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      disabled={!financialSummary.otherEnabled}
                      className="w-20 px-2 py-1 text-sm border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400">
                    Additional table (optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setExtraRows((rows) => [...rows, { col1: '', col2: '' }])}
                    className="inline-flex items-center gap-1.5 text-sm text-[#C27E00] hover:text-[#a06900]"
                  >
                    <Plus className="w-4 h-4" />
                    Add Row
                  </button>
                </div>
                <div className="border border-zinc-300 dark:border-gray-600 rounded overflow-hidden">
                  <div className="grid grid-cols-2 bg-[#C27E00]/20 border-b border-zinc-300 dark:border-gray-600">
                    <div className="px-2 py-1.5 text-xs font-bold text-zinc-600 dark:text-gray-300">
                      Description
                    </div>
                    <div className="px-2 py-1.5 text-xs font-bold text-zinc-600 dark:text-gray-300 border-l border-zinc-300 dark:border-gray-600">
                      Amount (CAD)
                    </div>
                  </div>
                  {extraRows.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto] border-b border-zinc-300 dark:border-gray-600 last:border-b-0"
                    >
                      <div className="grid grid-cols-2 divide-x divide-gray-600">
                        <input
                          type="text"
                          value={row.col1}
                          onChange={(e) =>
                            setExtraRows((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, col1: e.target.value } : r))
                            )
                          }
                          className="px-2 py-1.5 bg-zinc-100/90 dark:bg-black/30 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] min-w-0"
                          placeholder="..."
                        />
                        <input
                          type="text"
                          value={row.col2}
                          onChange={(e) =>
                            setExtraRows((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, col2: e.target.value } : r))
                            )
                          }
                          className="px-2 py-1.5 bg-zinc-100/90 dark:bg-black/30 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] min-w-0"
                          placeholder="..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExtraRows((rows) =>
                            rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ col1: '', col2: '' }]
                          )
                        }
                        className="px-2 py-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400"
                        title="Delete row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 p-2 sm:p-3 flex flex-col">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                title="Invoice PDF Preview"
                className="w-full flex-1 min-h-[400px] bg-white rounded"
              />
            )}
          </div>
        </div>

        {driveMessage && (
          <div
            className={`mx-4 mb-2 rounded-md border px-3 py-2 text-sm flex-shrink-0 ${
              driveMessage.type === 'success'
                ? 'border-green-800 bg-green-950/40 text-green-200'
                : 'border-red-800 bg-red-950/40 text-red-200'
            }`}
          >
            {driveMessage.text}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 dark:border-gray-800 p-3 flex-shrink-0">
          {canEdit && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving || pending || driveUploading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 ${
                approvedAt
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {approving
                ? driveUploading
                  ? 'Uploading…'
                  : pending
                    ? 'Saving…'
                    : 'Approving…'
                : approvedAt
                  ? 'Approved'
                  : 'Approve'}
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              disabled={emailSending}
              className="inline-flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white p-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-4 h-4 shrink-0" />
            </button>
            {menuOpen && (
              <div className="absolute bottom-full right-0 mb-1 z-10 min-w-[160px] rounded-lg border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 shadow-lg py-1 text-sm">
                <button
                  type="button"
                  className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-zinc-800 dark:text-gray-200 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50"
                  disabled={emailSending}
                  onClick={() => {
                    setMenuOpen(false)
                    setEmailComposeOpen(true)
                  }}
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  E-mail
                </button>
                <button
                  type="button"
                  className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-zinc-800 dark:text-gray-200 hover:bg-zinc-100 dark:hover:bg-white/5"
                  onClick={() => {
                    setMenuOpen(false)
                    void handleDownload()
                  }}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <EmailComposeModal
        isOpen={emailComposeOpen}
        onClose={() => setEmailComposeOpen(false)}
        onSend={handleEmailSend}
        sending={emailSending}
        defaultSubject={emailComposeDefaults.defaultSubject}
        defaultBodyHtml={emailComposeDefaults.defaultBodyHtml}
        lockedAttachments={emailComposeDefaults.lockedAttachments}
        title="Send invoice"
      />
    </>
  )
}
