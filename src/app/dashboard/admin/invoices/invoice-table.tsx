'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { addYears } from 'date-fns'
import { Download, Eye, X, Save, Plus, Trash2, HardDrive } from 'lucide-react'
import { updateInvoiceFields, uploadInvoiceToDriveAction } from './actions'
import { downloadInvoicePdf, getInvoicePdfBlobUrl } from '@/lib/generate-invoice-pdf'
import type { InvoiceRowData } from '@/lib/generate-invoice-pdf'

type DealerRow = { name: string; address?: string | null; phone?: string | null } | null

interface InvoiceRow {
  id: string
  demand_number: string | null
  dealer_id: string | null
  stock_number: string | null
  customer_phone: string | null
  customer_firstname: string
  customer_lastname: string
  customer_address: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  camera_model: string
  updated_at: string
  invoice_total_amount: number | null
  invoice_comments: string | null
  dealers: DealerRow | DealerRow[] | null
}

interface InvoiceTableProps {
  invoices: InvoiceRow[]
  logoDataUrl?: string | null
}

function getDealer(d: InvoiceRow): DealerRow {
  if (!d.dealers) return null
  return Array.isArray(d.dealers) ? d.dealers[0] : d.dealers
}

export function InvoiceTable({ invoices, logoDataUrl }: InvoiceTableProps) {
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
    const completionDate = new Date(row.updated_at)
    const warrantyEnd = addYears(completionDate, 3)
    const phone = dealer?.phone ?? row.customer_phone ?? ''
    return {
      data: {
        demand_number: row.demand_number,
        customerName: dealer?.name ?? '—',
        phone,
        stockNumber: row.stock_number ?? '—',
        customerAddress: dealer?.address ?? '—',
        vehicleInfo: `${row.vehicle_year} ${row.vehicle_make} ${row.vehicle_model} - Stock ${row.stock_number ?? '—'}`,
        productModel: row.camera_model,
        orderDate: format(completionDate, 'yyyy-MM-dd'),
        warrantyEnd: format(warrantyEnd, 'yyyy-MM-dd'),
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
    const completionDate = new Date(previewRow.updated_at)
    const warrantyEnd = addYears(completionDate, 3)
    const totalNum = getCalculatedTotal()
    const totalAmount = `$${totalNum.toFixed(2)}`
    return {
      demand_number: previewRow.demand_number,
      customerName: dealer?.name ?? '—',
      phone: dealer?.phone ?? previewRow.customer_phone ?? '—',
      stockNumber: previewRow.stock_number ?? '—',
      customerAddress: dealer?.address ?? '—',
      vehicleInfo: `${previewRow.vehicle_year} ${previewRow.vehicle_make} ${previewRow.vehicle_model} - Stock ${previewRow.stock_number ?? '—'}`,
      productModel: previewRow.camera_model,
      orderDate: format(completionDate, 'yyyy-MM-dd'),
      warrantyEnd: format(warrantyEnd, 'yyyy-MM-dd'),
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
    setPreviewRow(rowData)
    setPreviewComments(currentComments)
    setPreviewExtraRows([{ col1: '', col2: '' }])
    setPreviewFinancialSummary({ gstEnabled: true, gstPercent: 5, pstEnabled: false, pstPercent: 7, salesTaxEnabled: false, salesTaxPercent: 0, otherEnabled: false, otherAmount: 0 })
  }

  const closePreview = () => {
    setPreviewRow(null)
    setPreviewExtraRows([{ col1: '', col2: '' }])
    setPreviewFinancialSummary({ gstEnabled: true, gstPercent: 5, pstEnabled: false, pstPercent: 7, salesTaxEnabled: false, salesTaxPercent: 0, otherEnabled: false, otherAmount: 0 })
    setPreviewPdfUrl(null)
    setDriveMessage(null)
  }

  const handlePreviewSave = async () => {
    if (!previewRow) return
    const calculatedTotal = getCalculatedTotal()
    setPending(p => new Set(p).add(previewRow.id))
    await updateInvoiceFields(previewRow.id, String(calculatedTotal) || null, previewComments || null)
    setPending(p => { const n = new Set(p); n.delete(previewRow.id); return n })
    setValues(v => ({
      ...v,
      [previewRow.id]: { amount: String(calculatedTotal), comments: previewComments }
    }))
    setEditing(null)
    router.refresh()
  }

  const handlePreviewDownload = () => {
    const data = buildPreviewData()
    if (data) downloadInvoicePdf(data)
  }

  const handlePreviewDrive = async () => {
    const data = buildPreviewData()
    if (!data || !previewRow) return
    const dealer = getDealer(previewRow)
    const dealerName = dealer?.name ?? 'Unknown Dealer'
    setDriveUploading(true)
    setDriveMessage(null)
    const result = await uploadInvoiceToDriveAction(data, dealerName)
    setDriveUploading(false)
    if (result.success) {
      setDriveMessage({ type: 'success', text: result.webViewLink ? `Uploaded! Open in Drive` : 'Uploaded to Drive successfully' })
      if (result.webViewLink) window.open(result.webViewLink, '_blank')
    } else {
      setDriveMessage({ type: 'error', text: result.error })
    }
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
  }

  const cancelEdit = () => setEditing(null)

  if (invoices.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        No completed demands yet. Invoices will appear here when demands are marked as completed.
      </div>
    )
  }

  return (
    <>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-800">
        <thead className="bg-white/5">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Demand ID</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer Name</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Phone</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Stock #</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer Address</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vehicle & Stock</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Product Model</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Order Date</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Warranty End</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Total Amount</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Comments</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {invoices.map(row => {
            const dealer = getDealer(row)
            const completionDate = new Date(row.updated_at)
            const warrantyEnd = addYears(completionDate, 3)
            const isEditingAmount = editing?.id === row.id && editing?.field === 'amount'
            const isEditingComments = editing?.id === row.id && editing?.field === 'comments'
            const v = values[row.id] ?? { amount: row.invoice_total_amount != null ? String(row.invoice_total_amount) : '', comments: row.invoice_comments ?? '' }

            return (
              <tr key={row.id} className="hover:bg-white/5 transition-colors">
                <td className="px-3 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                  {row.demand_number ? `#${row.demand_number}` : '-'}
                </td>
                <td className="px-3 py-2.5 text-sm text-white">
                  {dealer?.name ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-300">
                  {(getDealer(row)?.phone ?? row.customer_phone) ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-300">
                  {row.stock_number ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-400 max-w-[200px] truncate" title={dealer?.address ?? ''}>
                  {dealer?.address ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-300">
                  {row.vehicle_year} {row.vehicle_make} {row.vehicle_model} - Stock {row.stock_number ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-300">
                  {row.camera_model}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                  {format(completionDate, 'yyyy-MM-dd')}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                  {format(warrantyEnd, 'yyyy-MM-dd')}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  {isEditingAmount ? (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">$</span>
                      <input
                        type="text"
                        value={v.amount}
                        onChange={e => setValues(x => ({ ...x, [row.id]: { ...v, amount: e.target.value } }))}
                        onBlur={() => saveEdit(row.id)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit(row.id)}
                        className="w-24 border border-gray-600 bg-black/50 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(row.id, 'amount', row)}
                      className={`text-left hover:bg-white/10 rounded px-1 -mx-1 transition-colors ${row.invoice_total_amount != null ? 'text-[#C27E00] font-medium' : 'text-gray-500'}`}
                    >
                      {row.invoice_total_amount != null ? `$${Number(row.invoice_total_amount).toFixed(2)}` : 'Add amount'}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm max-w-[180px]">
                  {isEditingComments ? (
                    <input
                      type="text"
                      value={v.comments}
                      onChange={e => setValues(x => ({ ...x, [row.id]: { ...v, comments: e.target.value } }))}
                      onBlur={() => saveEdit(row.id)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(row.id)}
                      placeholder="Add expenses / comments..."
                      className="w-full border border-gray-600 bg-black/50 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(row.id, 'comments', row)}
                      className="text-left w-full hover:bg-white/10 rounded px-1 -mx-1 truncate block text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      {row.invoice_comments || 'Add expenses / comments...'}
                    </button>
                  )}
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

    {/* Preview modal with editable fields */}
    {previewRow && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-[98vw] max-w-7xl max-h-[98vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">
              Invoice Preview — {previewRow.demand_number ? `#${previewRow.demand_number}` : 'Invoice'}
            </h2>
            <button
              type="button"
              onClick={closePreview}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-700 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Calculated Total (Column 2 + taxes)</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded border border-gray-600 bg-black/30 text-[#C27E00] font-semibold">
                  $ {getCalculatedTotal().toFixed(2)} CAD
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Comments</label>
                <input
                  type="text"
                  value={previewComments}
                  onChange={e => setPreviewComments(e.target.value)}
                  className="w-full border border-gray-600 bg-black/50 text-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00]"
                  placeholder="Add expenses / comments..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Financial summary (bottom right)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-3 rounded-lg border border-gray-600 bg-black/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.gstEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, gstEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                  />
                  <span className="text-sm text-gray-300">GST</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={previewFinancialSummary.gstPercent}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, gstPercent: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.gstEnabled}
                    className="w-14 px-2 py-1 text-sm border border-gray-600 bg-black/50 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.pstEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, pstEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                  />
                  <span className="text-sm text-gray-300">PST</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={previewFinancialSummary.pstPercent}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, pstPercent: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.pstEnabled}
                    className="w-14 px-2 py-1 text-sm border border-gray-600 bg-black/50 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.salesTaxEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, salesTaxEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                  />
                  <span className="text-sm text-gray-300">SALES TAX</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={previewFinancialSummary.salesTaxPercent}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, salesTaxPercent: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.salesTaxEnabled}
                    className="w-14 px-2 py-1 text-sm border border-gray-600 bg-black/50 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewFinancialSummary.otherEnabled}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, otherEnabled: e.target.checked }))}
                    className="rounded border-gray-500 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                  />
                  <span className="text-sm text-gray-300">OTHER $</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={previewFinancialSummary.otherAmount || ''}
                    onChange={e => setPreviewFinancialSummary(f => ({ ...f, otherAmount: parseFloat(e.target.value) || 0 }))}
                    disabled={!previewFinancialSummary.otherEnabled}
                    className="w-20 px-2 py-1 text-sm border border-gray-600 bg-black/50 text-white rounded focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-400">Additional table (optional)</label>
                <button
                  type="button"
                  onClick={() => setPreviewExtraRows(rows => [...rows, { col1: '', col2: '' }])}
                  className="inline-flex items-center gap-1.5 text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </button>
              </div>
              <div className="border border-gray-600 rounded overflow-hidden">
                <div className="grid grid-cols-2 bg-[#C27E00]/20 border-b border-gray-600">
                  <div className="px-3 py-2 text-xs font-bold text-gray-300">Description</div>
                  <div className="px-3 py-2 text-xs font-bold text-gray-300 border-l border-gray-600">Amount (CAD)</div>
                </div>
                {previewExtraRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] border-b border-gray-600 last:border-b-0">
                    <div className="grid grid-cols-2 divide-x divide-gray-600">
                      <input
                        type="text"
                        value={row.col1}
                        onChange={e => setPreviewExtraRows(rows => rows.map((r, j) => j === i ? { ...r, col1: e.target.value } : r))}
                        className="px-3 py-2 bg-black/30 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] min-w-0"
                        placeholder="..."
                      />
                      <input
                        type="text"
                        value={row.col2}
                        onChange={e => setPreviewExtraRows(rows => rows.map((r, j) => j === i ? { ...r, col2: e.target.value } : r))}
                        className="px-3 py-2 bg-black/30 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] min-w-0"
                        placeholder="..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewExtraRows(rows => rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ col1: '', col2: '' }])}
                      className="px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-h-[520px]">
            {previewPdfUrl && (
              <iframe
                src={previewPdfUrl}
                title="Invoice PDF Preview"
                className="w-full h-full min-h-[520px] bg-white"
              />
            )}
          </div>

          {driveMessage && (
            <div className={`px-4 py-2 mx-4 rounded-md text-sm ${
              driveMessage.type === 'success'
                ? 'bg-green-900/50 border border-green-800 text-green-200'
                : 'bg-red-900/50 border border-red-800 text-red-200'
            }`}>
              {driveMessage.text}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
            <button
              type="button"
              onClick={handlePreviewSave}
              disabled={pending.has(previewRow.id)}
              className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <button
              type="button"
              onClick={handlePreviewDownload}
              className="inline-flex items-center gap-2 bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePreviewDrive}
              disabled={driveUploading}
              className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <HardDrive className="w-4 h-4" />
              {driveUploading ? 'Uploading...' : 'Drive'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
