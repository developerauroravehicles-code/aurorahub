'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { warrantyEndFromCompletion } from '@/lib/warranty-period'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { Download, Eye, X, Save, Plus, Trash2, HardDrive, ArrowUpDown, ChevronDown, ChevronsDown, ChevronsUp, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateInvoiceFields, uploadInvoiceToDriveAction, recordInvoiceDownloadAction, updateInvoiceStatusAction, sendInvoicePdfEmailAction, sendBulkInvoicePdfEmailAction } from './actions'
import { downloadInvoicePdf, getInvoicePdfBlobUrl, getInvoicePdfBase64 } from '@/lib/generate-invoice-pdf'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'
import { EmailComposeModal } from '@/components/email-compose-modal'
import type { EmailComposePayload } from '@/lib/email-compose'
import { SERVICE_TYPE_LABELS, DemandServiceType } from '@/lib/demand-pricing'

type DealerRow = { name: string; address?: string | null; phone?: string | null } | null

interface InvoiceRow {
  id: string
  demand_number: string | null
  dealer_id: string | null
  stock_number: string | null
  vin_last6: string | null
  customer_phone: string | null
  customer_firstname: string
  customer_lastname: string
  customer_address: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  camera_model: string
  updated_at: string
  completed_at: string | null
  service_type?: DemandServiceType | null
  invoice_total_amount: number | null
  invoice_comments: string | null
  invoice_extra_rows?: { col1: string; col2: string }[] | null
  invoice_saved_at?: string | null
  invoice_downloaded_at?: string | null
  invoice_drive_uploaded_at?: string | null
  invoice_financial_summary?: {
    gstEnabled: boolean
    gstPercent: number
    pstEnabled: boolean
    pstPercent: number
    salesTaxEnabled: boolean
    salesTaxPercent: number
    otherEnabled: boolean
    otherAmount: number
  } | null
  dealers: DealerRow | DealerRow[] | null
}

interface InvoiceTableProps {
  invoices: InvoiceRow[]
  logoDataUrl?: string | null
  canEdit?: boolean
}

function getDealer(d: InvoiceRow): DealerRow {
  if (!d.dealers) return null
  return Array.isArray(d.dealers) ? d.dealers[0] : d.dealers
}

export function InvoiceTable({ invoices, logoDataUrl, canEdit = true }: InvoiceTableProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ id: string; field: 'amount' | 'comments' } | null>(null)
  const [values, setValues] = useState<Record<string, { amount: string; comments: string }>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [previewRow, setPreviewRow] = useState<InvoiceRow | null>(null)
  const [previewComments, setPreviewComments] = useState('')
  const [previewExtraRows, setPreviewExtraRows] = useState<{ col1: string; col2: string }[]>([{ col1: '', col2: '' }])
  const [previewFinancialSummary, setPreviewFinancialSummary] = useState({
    gstEnabled: true,
    gstPercent: 5,
    pstEnabled: false,
    pstPercent: 7,
    salesTaxEnabled: false,
    salesTaxPercent: 0,
    otherEnabled: false,
    otherAmount: 0
  })
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [driveUploading, setDriveUploading] = useState(false)
  const [driveMessage, setDriveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [emailComposeOpen, setEmailComposeOpen] = useState(false)
  const [emailComposeMode, setEmailComposeMode] = useState<'preview' | 'bulk'>('preview')
  const [sortBy, setSortBy] = useState<'id' | 'completeDate'>('completeDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null)
  const [tableExpanded, setTableExpanded] = useState(false)
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, { invoice_saved_at?: string | null; invoice_downloaded_at?: string | null; invoice_drive_uploaded_at?: string | null }>>({})
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(() => new Set())
  const [bulkEmailMessage, setBulkEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  const BULK_EMAIL_MAX = 25

  const sortedInvoices = useMemo(() => {
    const arr = [...invoices]
    arr.sort((a, b) => {
      if (sortBy === 'id') {
        const idA = a.demand_number ?? ''
        const idB = b.demand_number ?? ''
        const cmp = idA.localeCompare(idB, undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      }
      const dateA = new Date(a.completed_at ?? a.updated_at).getTime()
      const dateB = new Date(b.completed_at ?? b.updated_at).getTime()
      return sortDir === 'asc' ? dateA - dateB : dateB - dateA
    })
    return arr
  }, [invoices, sortBy, sortDir])

  useEffect(() => {
    const el = selectAllCheckboxRef.current
    if (!el || !canEdit) return
    const n = sortedInvoices.length
    const selectedOnList = sortedInvoices.filter((r) => selectedInvoiceIds.has(r.id)).length
    el.indeterminate = selectedOnList > 0 && selectedOnList < n
  }, [canEdit, sortedInvoices, selectedInvoiceIds])

  useEffect(() => {
    setOptimisticStatus({})
  }, [invoices])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('invoice-demands-sync')
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
  }, [router])

  const getRowWithOptimisticStatus = useCallback((row: InvoiceRow) => {
    const opt = optimisticStatus[row.id]
    if (!opt) return row
    return { ...row, ...opt }
  }, [optimisticStatus])

  const INITIAL_ROW_COUNT = 15
  const displayInvoices = tableExpanded ? sortedInvoices : sortedInvoices.slice(0, INITIAL_ROW_COUNT)
  const hasMoreRows = sortedInvoices.length > INITIAL_ROW_COUNT

  const startEdit = (id: string, field: 'amount' | 'comments', row: InvoiceRow) => {
    setEditing({ id, field })
    if (!values[id]) {
      setValues(v => ({
        ...v,
        [id]: {
          amount: row.invoice_total_amount != null ? String(row.invoice_total_amount) : '',
          comments: row.invoice_comments ?? ''
        }
      }))
    }
  }

  const saveEdit = async (id: string) => {
    const v = values[id]
    if (!v) return
    setPending(p => new Set(p).add(id))
    await updateInvoiceFields(id, v.amount || null, v.comments || null)
    setPending(p => { const n = new Set(p); n.delete(id); return n })
    setEditing(null)
    router.refresh()
  }

  const getInvoiceData = (row: InvoiceRow) => {
    const v = values[row.id]
    const currentAmount = v?.amount ?? (row.invoice_total_amount != null ? String(row.invoice_total_amount) : '')
    const currentComments = v?.comments ?? (row.invoice_comments ?? '')
    const dealer = getDealer(row)
    const completionDate = new Date(row.completed_at ?? row.updated_at)
    const warrantyEnd = warrantyEndFromCompletion(completionDate, dealer?.name)
    const phone = dealer?.phone ?? row.customer_phone ?? ''
    return {
      data: {
        demand_number: row.demand_number,
        customerName: dealer?.name ?? '—',
        phone,
        stockNumber: row.stock_number ?? '—',
        customerAddress: dealer?.address ?? '—',
        vehicleInfo: `${row.vehicle_year} ${row.vehicle_make} ${row.vehicle_model} - Stock ${row.stock_number ?? '—'}`,
        vinNo: row.vin_last6?.trim() ? row.vin_last6.trim() : null,
        productModel: row.camera_model,
        completeDate: formatInTimeZone(completionDate, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
        warrantyEnd: formatInTimeZone(warrantyEnd, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
        totalAmount: currentAmount ? `$${(parseFloat(currentAmount.replace(/[^0-9.-]/g, '')) || 0).toFixed(2)}` : '$0.00',
        comments: currentComments,
        logoDataUrl: logoDataUrl ?? null
      },
      currentAmount,
      currentComments,
      hasChanges: v && (
        currentAmount !== (row.invoice_total_amount != null ? String(row.invoice_total_amount) : '') ||
        currentComments !== (row.invoice_comments ?? '')
      ),
      v
    }
  }

  const getCalculatedTotal = useCallback(() => {
    const subtotal = previewExtraRows.reduce((sum, r) => sum + (parseFloat((r.col2 || '0').replace(/[^0-9.-]/g, '')) || 0), 0)
    const fs = previewFinancialSummary
    const taxRate = (fs.gstEnabled ? fs.gstPercent : 0) + (fs.pstEnabled ? fs.pstPercent : 0) + (fs.salesTaxEnabled ? fs.salesTaxPercent : 0)
    const taxes = subtotal * (taxRate / 100)
    const other = fs.otherEnabled ? fs.otherAmount : 0
    return subtotal + taxes + other
  }, [previewExtraRows, previewFinancialSummary])

  const buildPreviewData = useCallback((): InvoiceRowData | null => {
    if (!previewRow) return null
    const dealer = getDealer(previewRow)
    const completionDate = new Date(previewRow.completed_at ?? previewRow.updated_at)
    const warrantyEnd = warrantyEndFromCompletion(completionDate, dealer?.name)
    const totalNum = getCalculatedTotal()
    const totalAmount = `$${totalNum.toFixed(2)}`
    return {
      demand_number: previewRow.demand_number,
      customerName: dealer?.name ?? '—',
      phone: dealer?.phone ?? previewRow.customer_phone ?? '—',
      stockNumber: previewRow.stock_number ?? '—',
      customerAddress: dealer?.address ?? '—',
      vehicleInfo: `${previewRow.vehicle_year} ${previewRow.vehicle_make} ${previewRow.vehicle_model} - Stock ${previewRow.stock_number ?? '—'}`,
      vinNo: previewRow.vin_last6?.trim() ? previewRow.vin_last6.trim() : null,
      productModel: previewRow.camera_model,
      completeDate: formatInTimeZone(completionDate, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
      warrantyEnd: formatInTimeZone(warrantyEnd, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
      totalAmount,
      comments: previewComments ?? '—',
      logoDataUrl: logoDataUrl ?? null,
      extraTableRows: previewExtraRows,
      financialSummary: previewFinancialSummary
    }
  }, [previewRow, previewComments, previewExtraRows, previewFinancialSummary, getCalculatedTotal, logoDataUrl])

  useEffect(() => {
    if (!previewRow) return
    const data = buildPreviewData()
    if (!data) return
    const url = getInvoicePdfBlobUrl(data)
    setPreviewPdfUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [previewRow, previewComments, previewExtraRows, previewFinancialSummary, buildPreviewData])

  const handlePreview = async (row: InvoiceRow) => {
    const { currentAmount, currentComments, hasChanges, v } = getInvoiceData(row)
    if (hasChanges && v) {
      setPending(p => new Set(p).add(row.id))
      await updateInvoiceFields(row.id, currentAmount || null, currentComments || null)
      setPending(p => { const n = new Set(p); n.delete(row.id); return n })
      setEditing(null)
      router.refresh()
    }
    const rowData = invoices.find(r => r.id === row.id) ?? row
    const savedExtraRows = rowData.invoice_extra_rows
    const savedFinancialSummary = rowData.invoice_financial_summary
    const defaultExtraRows = [{ col1: '', col2: '' }]
    const defaultFinancialSummary = { gstEnabled: true, gstPercent: 5, pstEnabled: false, pstPercent: 7, salesTaxEnabled: false, salesTaxPercent: 0, otherEnabled: false, otherAmount: 0 }
    const parsedExtraRows = Array.isArray(savedExtraRows) && savedExtraRows.length > 0
      ? savedExtraRows.map(r => ({ col1: String(r?.col1 ?? ''), col2: String(r?.col2 ?? '') }))
      : defaultExtraRows
    setPreviewRow(rowData)
    setPreviewComments(currentComments)
    setPreviewExtraRows(parsedExtraRows)
    setPreviewFinancialSummary(
      savedFinancialSummary && typeof savedFinancialSummary === 'object'
        ? { ...defaultFinancialSummary, ...savedFinancialSummary }
        : defaultFinancialSummary
    )
  }

  const closePreview = () => {
    setPreviewRow(null)
    setPreviewExtraRows([{ col1: '', col2: '' }])
    setPreviewFinancialSummary({ gstEnabled: true, gstPercent: 5, pstEnabled: false, pstPercent: 7, salesTaxEnabled: false, salesTaxPercent: 0, otherEnabled: false, otherAmount: 0 })
    setPreviewPdfUrl(null)
    setDriveMessage(null)
    setEmailComposeOpen(false)
    setEmailSending(false)
  }

  const handlePreviewSave = async () => {
    if (!previewRow) return
    const calculatedTotal = getCalculatedTotal()
    setPending(p => new Set(p).add(previewRow.id))
    await updateInvoiceFields(previewRow.id, String(calculatedTotal) || null, previewComments || null, previewExtraRows, previewFinancialSummary)
    setPending(p => { const n = new Set(p); n.delete(previewRow.id); return n })
    setValues(v => ({
      ...v,
      [previewRow.id]: { amount: String(calculatedTotal), comments: previewComments }
    }))
    setEditing(null)
    router.refresh()
  }

  const handlePreviewDownload = async () => {
    const data = buildPreviewData()
    if (!data || !previewRow) return
    downloadInvoicePdf(data)
    await recordInvoiceDownloadAction(previewRow.id)
    router.refresh()
  }

  const handlePreviewDrive = async () => {
    const data = buildPreviewData()
    if (!data || !previewRow) return
    const dealer = getDealer(previewRow)
    const dealerName = dealer?.name ?? 'Unknown Dealer'
    setDriveUploading(true)
    setDriveMessage(null)
    const result = await uploadInvoiceToDriveAction(data, dealerName, previewRow.id)
    setDriveUploading(false)
    if (result.success) {
      setDriveMessage({ type: 'success', text: result.webViewLink ? `Uploaded! Open in Drive` : 'Uploaded to Drive successfully' })
      if (result.webViewLink) window.open(result.webViewLink, '_blank')
    } else {
      setDriveMessage({ type: 'error', text: result.error })
    }
  }

  const handlePreviewEmail = () => {
    if (!buildPreviewData()) return
    setEmailComposeMode('preview')
    setEmailComposeOpen(true)
  }

  const toggleInvoiceSelected = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setBulkEmailMessage(null)
  }

  const toggleSelectAllInvoices = () => {
    const allSelected =
      sortedInvoices.length > 0 && sortedInvoices.every((r) => selectedInvoiceIds.has(r.id))
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        sortedInvoices.forEach((r) => next.delete(r.id))
      } else {
        sortedInvoices.forEach((r) => next.add(r.id))
      }
      return next
    })
    setBulkEmailMessage(null)
  }

  const handleBulkInvoiceEmail = () => {
    const ids = Array.from(selectedInvoiceIds)
    if (ids.length === 0) return
    if (ids.length > BULK_EMAIL_MAX) {
      setBulkEmailMessage({ type: 'error', text: `Select at most ${BULK_EMAIL_MAX} invoices per send.` })
      return
    }
    setEmailComposeMode('bulk')
    setEmailComposeOpen(true)
  }

  const emailComposeDefaults = useMemo(() => {
    if (emailComposeMode === 'preview') {
      const data = buildPreviewData()
      if (!data) {
        return {
          defaultSubject: 'Invoice — Aurora Vehicles',
          defaultBodyHtml: '<p>Please find the attached invoice.</p>',
          lockedAttachments: [] as { id: string; filename: string }[],
        }
      }
      const invLabel = data.demand_number ? `#${data.demand_number}` : 'Invoice'
      const { fileName } = getInvoicePdfBase64(data)
      return {
        defaultSubject: `Invoice ${invLabel} — Aurora Vehicles`,
        defaultBodyHtml: `<p>Please find attached the invoice for ${data.customerName} (${invLabel}).</p>`,
        lockedAttachments: [{ id: 'invoice-pdf', filename: fileName }],
      }
    }

    const ids = Array.from(selectedInvoiceIds)
    const n = ids.length
    const lockedAttachments: { id: string; filename: string }[] = []
    for (const id of ids) {
      const row = invoices.find((r) => r.id === id)
      if (!row) continue
      const { data: invData } = getInvoiceData(row)
      const { fileName } = getInvoicePdfBase64(invData)
      lockedAttachments.push({ id, filename: fileName })
    }

    return {
      defaultSubject: n === 1 ? `Invoice — Aurora Vehicles` : `${n} invoices — Aurora Vehicles`,
      defaultBodyHtml:
        n === 1
          ? '<p>Please find attached the invoice.</p>'
          : `<p>Please find attached ${n} invoice PDFs for the selected completed demands.</p>`,
      lockedAttachments,
    }
  }, [emailComposeMode, buildPreviewData, selectedInvoiceIds, invoices])

  const handleInvoiceEmailSend = async (payload: EmailComposePayload) => {
    if (emailComposeMode === 'preview') {
      const data = buildPreviewData()
      if (!data) return { error: 'Invoice preview is not ready' }
      setEmailSending(true)
      setDriveMessage(null)
      const res = await sendInvoicePdfEmailAction(data, payload)
      setEmailSending(false)
      if (res.error) return { error: res.error }
      setDriveMessage({ type: 'success', text: 'Email sent successfully.' })
      setEmailComposeOpen(false)
      return {}
    }

    const ids = Array.from(selectedInvoiceIds)
    if (ids.length === 0) {
      setEmailComposeOpen(false)
      return { error: 'No invoices selected' }
    }
    setEmailSending(true)
    setBulkEmailMessage(null)
    const res = await sendBulkInvoicePdfEmailAction(ids, payload)
    setEmailSending(false)
    if (res.error) return { error: res.error }
    setBulkEmailMessage({ type: 'success', text: `Sent ${ids.length} invoice PDFs in one email.` })
    setSelectedInvoiceIds(new Set())
    setEmailComposeOpen(false)
    return {}
  }

  const handleCreateAndDownload = async (row: InvoiceRow) => {
    const { data, currentAmount, currentComments, hasChanges, v } = getInvoiceData(row)
    if (hasChanges && v) {
      setPending(p => new Set(p).add(row.id))
      await updateInvoiceFields(row.id, currentAmount || null, currentComments || null)
      setPending(p => { const n = new Set(p); n.delete(row.id); return n })
      setEditing(null)
      router.refresh()
    }
    downloadInvoicePdf(data)
    await recordInvoiceDownloadAction(row.id)
    router.refresh()
  }

  const cancelEdit = () => setEditing(null)

  if (invoices.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 dark:text-gray-400">
        No completed demands yet. Invoices will appear here when demands are marked as completed.
      </div>
    )
  }

  return (
    <>
    <div className="flex flex-col min-h-[calc(100vh-12rem)]">
    <div className="flex items-center gap-4 px-4 pt-4 pb-2 flex-wrap flex-shrink-0">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-zinc-500 dark:text-gray-400" />
        <span className="text-sm text-zinc-500 dark:text-gray-400">Sort by:</span>
      </div>
      <select
        value={`${sortBy}-${sortDir}`}
        onChange={e => {
          const [by, dir] = e.target.value.split('-') as ['id' | 'completeDate', 'asc' | 'desc']
          setSortBy(by)
          setSortDir(dir)
        }}
        className="border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
      >
        <option value="id-asc" className="bg-zinc-200 dark:bg-gray-900">ID (A→Z)</option>
        <option value="id-desc" className="bg-zinc-200 dark:bg-gray-900">ID (Z→A)</option>
        <option value="completeDate-desc" className="bg-zinc-200 dark:bg-gray-900">Complete Date (New→Old)</option>
        <option value="completeDate-asc" className="bg-zinc-200 dark:bg-gray-900">Complete Date (Old→New)</option>
      </select>
    </div>
    {canEdit && selectedInvoiceIds.size > 0 && (
      <div className="mx-4 mb-2 flex flex-col gap-2 rounded-lg border border-[#C27E00]/35 bg-[#C27E00]/10 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="text-sm text-zinc-800 dark:text-gray-200 sm:self-center">
          <span className="font-medium text-zinc-900 dark:text-white">{selectedInvoiceIds.size}</span>
          {' '}
          selected
          <span className="text-zinc-500 dark:text-gray-400"> · max {BULK_EMAIL_MAX} per email</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBulkInvoiceEmail}
            disabled={emailSending || selectedInvoiceIds.size > BULK_EMAIL_MAX}
            className="inline-flex items-center gap-1.5 bg-[#C27E00] hover:bg-[#a06900] text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Mail className="w-4 h-4 shrink-0" />
            Send bulk email
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedInvoiceIds(new Set())
              setBulkEmailMessage(null)
            }}
            className="text-sm text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white px-2 py-1.5"
          >
            Clear selection
          </button>
        </div>
        {bulkEmailMessage && (
          <p
            className={`w-full text-sm sm:col-span-full ${
              bulkEmailMessage.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}
          >
            {bulkEmailMessage.text}
          </p>
        )}
      </div>
    )}
    <div className="flex-1 min-h-0 overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800">
        <thead className="bg-zinc-200/50 dark:bg-white/5">
          <tr>
            {canEdit && (
              <th className="w-10 px-2 py-2.5 text-left align-middle" scope="col">
                <span className="sr-only">Select row</span>
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  checked={
                    sortedInvoices.length > 0 &&
                    sortedInvoices.every((r) => selectedInvoiceIds.has(r.id))
                  }
                  onChange={toggleSelectAllInvoices}
                  className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] w-4 h-4"
                  title="Select all invoices in list"
                  aria-label="Select all invoices in list"
                />
              </th>
            )}
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Demand ID</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Customer Name</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Stock #</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Customer Address</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Vehicle & Stock</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Product Model</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Complete Date</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Warranty End</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Total Amount</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Comments</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Invoice Status</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
          {displayInvoices.map(row => {
            const displayRow = getRowWithOptimisticStatus(row)
            const dealer = getDealer(displayRow)
            const completionDate = new Date(row.completed_at ?? row.updated_at)
            const warrantyEnd = warrantyEndFromCompletion(completionDate, dealer?.name)
            const isEditingAmount = editing?.id === row.id && editing?.field === 'amount'
            const isEditingComments = editing?.id === row.id && editing?.field === 'comments'
            const v = values[row.id] ?? { amount: displayRow.invoice_total_amount != null ? String(displayRow.invoice_total_amount) : '', comments: displayRow.invoice_comments ?? '' }

            return (
              <tr key={row.id} className="hover:bg-zinc-200/50 dark:bg-white/5 transition-colors">
                {canEdit && (
                  <td className="w-10 px-2 py-2.5 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedInvoiceIds.has(row.id)}
                      onChange={() => toggleInvoiceSelected(row.id)}
                      className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] w-4 h-4"
                      aria-label={row.demand_number ? `Select invoice ${row.demand_number}` : 'Select invoice'}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300 whitespace-nowrap">
                  {row.demand_number ? `#${row.demand_number}` : '-'}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-900 dark:text-white">
                  {dealer?.name ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300">
                  {(getDealer(row)?.phone ?? row.customer_phone) ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300">
                  {row.stock_number ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-500 dark:text-gray-400 max-w-[200px] truncate" title={dealer?.address ?? ''}>
                  {dealer?.address ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300">
                  {row.vehicle_year} {row.vehicle_make} {row.vehicle_model} - Stock {row.stock_number ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300">
                  {row.camera_model}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300 whitespace-nowrap">
                  {row.service_type ? SERVICE_TYPE_LABELS[row.service_type] : '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300 whitespace-nowrap">
                  {formatInTimeZone(completionDate, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy')}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-600 dark:text-gray-300 whitespace-nowrap">
                  {formatInTimeZone(warrantyEnd, SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy')}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  {canEdit && isEditingAmount ? (
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 dark:text-gray-400">$</span>
                      <input
                        type="text"
                        value={v.amount}
                        onChange={e => setValues(x => ({ ...x, [row.id]: { ...v, amount: e.target.value } }))}
                        onBlur={() => saveEdit(row.id)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit(row.id)}
                        className="w-24 border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                        autoFocus
                      />
                    </div>
                  ) : canEdit ? (
                    <button
                      type="button"
                      onClick={() => startEdit(row.id, 'amount', row)}
                      className={`text-left hover:bg-zinc-200 dark:bg-white/10 rounded px-1 -mx-1 transition-colors ${row.invoice_total_amount != null ? 'text-[#C27E00] font-medium' : 'text-zinc-500 dark:text-gray-500'}`}
                    >
                      {row.invoice_total_amount != null ? `$${Number(row.invoice_total_amount).toFixed(2)}` : 'Add amount'}
                    </button>
                  ) : (
                    <span className={row.invoice_total_amount != null ? 'text-[#C27E00] font-medium' : 'text-zinc-500 dark:text-gray-500'}>
                      {row.invoice_total_amount != null ? `$${Number(row.invoice_total_amount).toFixed(2)}` : '—'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm max-w-[180px]">
                  {canEdit && isEditingComments ? (
                    <input
                      type="text"
                      value={v.comments}
                      onChange={e => setValues(x => ({ ...x, [row.id]: { ...v, comments: e.target.value } }))}
                      onBlur={() => saveEdit(row.id)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(row.id)}
                      placeholder="Add expenses / comments..."
                      className="w-full border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                      autoFocus
                    />
                  ) : canEdit ? (
                    <button
                      type="button"
                      onClick={() => startEdit(row.id, 'comments', row)}
                      className="text-left w-full hover:bg-zinc-200 dark:bg-white/10 rounded px-1 -mx-1 truncate block text-zinc-500 dark:text-gray-400 hover:text-zinc-600 dark:text-gray-300 transition-colors"
                    >
                      {row.invoice_comments || 'Add expenses / comments...'}
                    </button>
                  ) : (
                    <span className="text-zinc-500 dark:text-gray-400 truncate block">{row.invoice_comments || '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  {(() => {
                    const edited = !!displayRow.invoice_saved_at
                    const downloaded = !!displayRow.invoice_downloaded_at
                    const drive = !!displayRow.invoice_drive_uploaded_at
                    const labels: string[] = []
                    labels.push(edited ? 'Edited' : 'Waiting')
                    if (downloaded) labels.push('Downloaded locally')
                    if (drive) labels.push('Saved to Drive')
                    const isOpen = statusMenuOpen === row.id
                    if (canEdit) {
                      return (
                        <button
                          type="button"
                          onClick={() => setStatusMenuOpen(isOpen ? null : row.id)}
                          className={`flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded hover:bg-zinc-200 dark:bg-white/10 transition-colors text-left w-full ${[edited, downloaded, drive].filter(Boolean).length === 3 ? 'text-[#C27E00] font-medium' : 'text-zinc-500 dark:text-gray-400'}`}
                        >
                          <span>{labels.join(' / ')}</span>
                          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                        </button>
                      )
                    }
                    return (
                      <span className={`text-left ${[edited, downloaded, drive].filter(Boolean).length === 3 ? 'text-[#C27E00] font-medium' : 'text-zinc-500 dark:text-gray-400'}`}>
                        {labels.join(' / ')}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreview(row)}
                      disabled={pending.has(row.id)}
                      className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateAndDownload(row)}
                      disabled={pending.has(row.id)}
                      className="inline-flex items-center gap-1.5 bg-[#C27E00] hover:bg-[#a06900] text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {(editing?.id === row.id || (values[row.id] && (
                        values[row.id].amount !== (row.invoice_total_amount != null ? String(row.invoice_total_amount) : '') ||
                        values[row.id].comments !== (row.invoice_comments ?? '')
                      ))) ? 'Create & Download' : 'Download'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>

    {hasMoreRows && (
      <div className="flex justify-center py-4 border-t border-zinc-200 dark:border-gray-800 flex-shrink-0">
        <button
          type="button"
          onClick={() => setTableExpanded(!tableExpanded)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-gray-600 bg-zinc-100/90 dark:bg-black/30 text-zinc-600 dark:text-gray-300 hover:bg-gray-800 hover:text-zinc-900 dark:text-white transition-colors text-sm font-medium"
        >
          {tableExpanded ? (
            <>
              <ChevronsUp className="w-4 h-4" />
              Collapse
            </>
          ) : (
            <>
              <ChevronsDown className="w-4 h-4" />
              Expand ({sortedInvoices.length - INITIAL_ROW_COUNT} more)
            </>
          )}
        </button>
      </div>
    )}
    </div>

    {/* Edit Status - centered popup */}
    {statusMenuOpen && (() => {
      const row = sortedInvoices.find(r => r.id === statusMenuOpen)
      if (!row) return null
      const displayRow = getRowWithOptimisticStatus(row)
      const edited = !!displayRow.invoice_saved_at
      const downloaded = !!displayRow.invoice_downloaded_at
      const drive = !!displayRow.invoice_drive_uploaded_at
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={() => setStatusMenuOpen(null)}
        >
          <div
            className="bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-300 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase">Edit Status</h3>
              <p className="text-xs text-zinc-500 dark:text-gray-400 mt-0.5">
                {row.demand_number ? `#${row.demand_number}` : 'Invoice'}
              </p>
            </div>
            <div className="p-2">
              {[
                { key: 'waiting' as const, label: 'Waiting', checked: !edited },
                { key: 'invoice_saved_at' as const, label: 'Edited', checked: edited },
                { key: 'invoice_downloaded_at' as const, label: 'Downloaded locally', checked: downloaded },
                { key: 'invoice_drive_uploaded_at' as const, label: 'Saved to Drive', checked: drive }
              ].map(({ key, label, checked }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-zinc-200/50 dark:bg-white/5 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={async (e) => {
                      const prev = { invoice_saved_at: displayRow.invoice_saved_at, invoice_downloaded_at: displayRow.invoice_downloaded_at, invoice_drive_uploaded_at: displayRow.invoice_drive_uploaded_at }
                      const updates: { invoice_saved_at?: string | null; invoice_downloaded_at?: string | null; invoice_drive_uploaded_at?: string | null } = {}
                      if (key === 'waiting') updates.invoice_saved_at = e.target.checked ? null : new Date().toISOString()
                      else if (key === 'invoice_saved_at') updates.invoice_saved_at = e.target.checked ? new Date().toISOString() : null
                      else if (key === 'invoice_downloaded_at') updates.invoice_downloaded_at = e.target.checked ? new Date().toISOString() : null
                      else if (key === 'invoice_drive_uploaded_at') updates.invoice_drive_uploaded_at = e.target.checked ? new Date().toISOString() : null

                      setOptimisticStatus(s => ({ ...s, [row.id]: { ...s[row.id], ...updates } }))
                      setStatusMenuOpen(null)

                      const res = key === 'waiting'
                        ? await updateInvoiceStatusAction(row.id, { invoice_saved_at: !e.target.checked })
                        : await updateInvoiceStatusAction(row.id, { [key]: e.target.checked })
                      if (res.error) setOptimisticStatus(s => ({ ...s, [row.id]: prev }))
                      else router.refresh()
                    }}
                    className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] w-4 h-4"
                  />
                  <span className="text-sm text-zinc-800 dark:text-gray-200">{label}</span>
                </label>
              ))}
            </div>
            <div className="p-3 border-t border-zinc-300 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setStatusMenuOpen(null)}
                className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )
    })()}

    {/* Preview modal with editable fields */}
    {previewRow && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-900/50 dark:bg-black/70 backdrop-blur-sm overflow-y-auto">
        <div
          className="bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 rounded-lg shadow-xl flex flex-col my-auto"
          style={{
            width: 'clamp(320px, 95vw, 1100px)',
            height: 'clamp(400px, 85dvh, 92dvh)',
          }}
        >
          <div className="flex items-center justify-between p-2 sm:p-3 border-b border-zinc-300 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white truncate pr-2">
              Invoice Preview — {previewRow.demand_number ? `#${previewRow.demand_number}` : 'Invoice'}
            </h2>
            <button
              type="button"
              onClick={closePreview}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {canEdit && (
          <div className="lg:w-[clamp(200px,22vw,300px)] lg:min-w-[180px] lg:border-r lg:border-b-0 border-b border-zinc-300 dark:border-gray-700 p-3 space-y-3 overflow-y-auto flex-shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Calculated Total (Column 2 + taxes)</label>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-zinc-300 dark:border-gray-600 bg-zinc-100/90 dark:bg-black/30 text-[#C27E00] font-semibold text-sm">
                  $ {getCalculatedTotal().toFixed(2)} CAD
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1">Comments</label>
                <input
                  type="text"
                  value={previewComments}
                  onChange={e => setPreviewComments(e.target.value)}
                  className="w-full border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                  placeholder="Add expenses / comments..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400 mb-1.5">Financial summary (bottom right)</label>
              <div className="flex flex-col gap-3 p-3 rounded-lg border border-zinc-300 dark:border-gray-600 bg-zinc-100/90 dark:bg-black/30">
                <label className="flex items-center gap-3 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.gstEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, gstEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] shrink-0"
                  />
                  <span className="text-sm text-zinc-600 dark:text-gray-300 w-20 shrink-0">GST</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={previewFinancialSummary.gstPercent}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, gstPercent: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.gstEnabled}
                    className="w-16 px-2 py-1 text-sm border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                  <span className="text-xs text-zinc-500 dark:text-gray-500">%</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.pstEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, pstEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] shrink-0"
                  />
                  <span className="text-sm text-zinc-600 dark:text-gray-300 w-20 shrink-0">PST</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={previewFinancialSummary.pstPercent}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, pstPercent: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.pstEnabled}
                    className="w-16 px-2 py-1 text-sm border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                  <span className="text-xs text-zinc-500 dark:text-gray-500">%</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.salesTaxEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, salesTaxEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] shrink-0"
                  />
                  <span className="text-sm text-zinc-600 dark:text-gray-300 w-20 shrink-0">SALES TAX</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={previewFinancialSummary.salesTaxPercent}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, salesTaxPercent: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.salesTaxEnabled}
                    className="w-16 px-2 py-1 text-sm border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                  <span className="text-xs text-zinc-500 dark:text-gray-500">%</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.otherEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, otherEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] shrink-0"
                  />
                  <span className="text-sm text-zinc-600 dark:text-gray-300 w-20 shrink-0">OTHER $</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={previewFinancialSummary.otherAmount || ''}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, otherAmount: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.otherEnabled}
                    className="w-20 px-2 py-1 text-sm border border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-500 dark:text-gray-400">Additional table (optional)</label>
                <button
                  type="button"
                  onClick={() => setPreviewExtraRows(rows => [...rows, { col1: '', col2: '' }])}
                  className="inline-flex items-center gap-1.5 text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </button>
              </div>
              <div className="border border-zinc-300 dark:border-gray-600 rounded overflow-hidden">
                <div className="grid grid-cols-2 bg-[#C27E00]/20 border-b border-zinc-300 dark:border-gray-600">
                  <div className="px-2 py-1.5 text-xs font-bold text-zinc-600 dark:text-gray-300">Description</div>
                  <div className="px-2 py-1.5 text-xs font-bold text-zinc-600 dark:text-gray-300 border-l border-zinc-300 dark:border-gray-600">Amount (CAD)</div>
                </div>
                {previewExtraRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] border-b border-zinc-300 dark:border-gray-600 last:border-b-0">
                    <div className="grid grid-cols-2 divide-x divide-gray-600">
                      <input
                        type="text"
                        value={row.col1}
                        onChange={e => setPreviewExtraRows(rows => rows.map((r, j) => j === i ? { ...r, col1: e.target.value } : r))}
                        className="px-2 py-1.5 bg-zinc-100/90 dark:bg-black/30 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] min-w-0"
                        placeholder="..."
                      />
                      <input
                        type="text"
                        value={row.col2}
                        onChange={e => setPreviewExtraRows(rows => rows.map((r, j) => j === i ? { ...r, col2: e.target.value } : r))}
                        className="px-2 py-1.5 bg-zinc-100/90 dark:bg-black/30 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] min-w-0"
                        placeholder="..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewExtraRows(rows => rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ col1: '', col2: '' }])}
                      className="px-2 py-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400 hover:bg-zinc-200/50 dark:bg-white/5 transition-colors"
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
            {previewPdfUrl && (
              <iframe
                src={previewPdfUrl}
                title="Invoice PDF Preview"
                className="w-full flex-1 min-h-[260px] bg-white rounded xl:min-h-[400px]"
              />
            )}
          </div>
          </div>

          {driveMessage && (
            <div className={`px-4 py-2 mx-4 rounded-md text-sm flex-shrink-0 ${
              driveMessage.type === 'success'
                ? 'bg-green-900/50 border border-green-800 text-green-200'
                : 'bg-red-900/50 border border-red-800 text-red-200'
            }`}>
              {driveMessage.text}
            </div>
          )}
          <div className="flex flex-col gap-2 p-2 sm:p-3 border-t border-zinc-300 dark:border-gray-700 flex-shrink-0 bg-zinc-200 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handlePreviewEmail}
                disabled={emailSending}
                className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Mail className="w-4 h-4 shrink-0" />
                Send email
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={handlePreviewSave}
                  disabled={pending.has(previewRow.id)}
                  className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  Save
                </button>
              )}
              <button
                type="button"
                onClick={handlePreviewDownload}
                className="inline-flex items-center gap-1.5 bg-[#C27E00] hover:bg-[#a06900] text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="sm:hidden">PDF</span>
                <span className="hidden sm:inline">Download PDF</span>
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={handlePreviewDrive}
                  disabled={driveUploading}
                  className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <HardDrive className="w-4 h-4 shrink-0" />
                  {driveUploading ? 'Uploading...' : 'Drive'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    <EmailComposeModal
      isOpen={emailComposeOpen}
      onClose={() => setEmailComposeOpen(false)}
      onSend={handleInvoiceEmailSend}
      sending={emailSending}
      defaultSubject={emailComposeDefaults.defaultSubject}
      defaultBodyHtml={emailComposeDefaults.defaultBodyHtml}
      lockedAttachments={emailComposeDefaults.lockedAttachments}
      title={emailComposeMode === 'preview' ? 'Send invoice' : 'Send bulk invoices'}
    />
    </>
  )
}
