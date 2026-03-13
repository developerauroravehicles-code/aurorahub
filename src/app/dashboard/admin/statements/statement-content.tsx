'use client'

import { useState } from 'react'
import { Download, HardDrive, Eye } from 'lucide-react'
import {
  getStatementDataAction,
  uploadStatementToDriveAction,
  type StatementDemandRow,
  type DealerOption
} from './actions'
import { downloadStatementPdf, previewStatementPdf, type StatementPdfData } from '@/lib/generate-statement-pdf'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

interface StatementContentProps {
  dealers: DealerOption[]
  logoDataUrl?: string | null
  hideDealerFilter?: boolean
  defaultDealerId?: string
}

function getDealerName(d: StatementDemandRow): string {
  const dealers = d.dealers
  if (!dealers) return 'Unknown Dealer'
  const single = Array.isArray(dealers) ? dealers[0] : dealers
  return (single as { name: string })?.name ?? 'Unknown Dealer'
}

export function StatementContent({ dealers, logoDataUrl, hideDealerFilter, defaultDealerId }: StatementContentProps) {
  const [dealerId, setDealerId] = useState<string>(defaultDealerId ?? '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState<StatementDemandRow[]>([])
  const [loading, setLoading] = useState(false)
  const [driveUploading, setDriveUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleApply = async () => {
    setLoading(true)
    setMessage(null)
    const res = await getStatementDataAction(dealerId || null, dateFrom, dateTo)
    setLoading(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      setRows([])
    } else {
      setRows(res.rows ?? [])
      if (!res.rows?.length) {
        setMessage({ type: 'success', text: 'No completed demands match the selected filters.' })
      }
    }
  }

  const dealerName = dealerId
    ? (dealers.find((d) => d.id === dealerId)?.name ?? (rows.length > 0 ? getDealerName(rows[0]) : 'Unknown Dealer'))
    : 'All Dealers'

  // Period: use filter dates when set, otherwise derive from rows' completed_at
  const completedTimestamps = rows.filter((r) => r.completed_at).map((r) => new Date(r.completed_at!).getTime())
  const effectiveDateFrom = dateFrom || (completedTimestamps.length > 0
    ? formatInTimeZone(new Date(Math.min(...completedTimestamps)), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    : '')
  const effectiveDateTo = dateTo || (completedTimestamps.length > 0
    ? formatInTimeZone(new Date(Math.max(...completedTimestamps)), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd')
    : '')

  // invoice_total_amount is the grand total (subtotal + tax). Split into price (subtotal) and tax to avoid double-counting.
  const TAX_RATE = 0.05 // 5% GST
  const statementData: StatementPdfData = {
    dealerName,
    dateFrom: effectiveDateFrom,
    dateTo: effectiveDateTo,
    rows: rows.map((d) => {
      const total = d.invoice_total_amount ?? 0
      const price = total / (1 + TAX_RATE) // subtotal before tax
      const tax = total - price
      const vehicleModel = `${d.vehicle_year} ${d.vehicle_make} ${d.vehicle_model}`.trim() || '—'
      // Talebin gerçek tamamlanma tarihi (completed_at); yoksa updated_at fallback (eski veriler için)
      const dateValue = d.completed_at ?? d.updated_at
      return {
        demand_number: d.demand_number,
        date: formatInTimeZone(new Date(dateValue), SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy'),
        vehicleModel,
        stockNumber: d.stock_number ?? '—',
        price,
        tax
      }
    }),
    logoDataUrl: logoDataUrl ?? null
  }

  const handleDownload = () => {
    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'No data to download. Apply filters first.' })
      return
    }
    downloadStatementPdf(statementData)
    setMessage({ type: 'success', text: 'Statement downloaded.' })
  }

  const handlePreview = () => {
    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'No data to preview. Apply filters first.' })
      return
    }
    previewStatementPdf(statementData)
  }

  const handleDrive = async () => {
    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'No data to upload. Apply filters first.' })
      return
    }
    setDriveUploading(true)
    setMessage(null)
    const result = await uploadStatementToDriveAction(statementData)
    setDriveUploading(false)
    if (result.success) {
      setMessage({ type: 'success', text: result.webViewLink ? 'Uploaded! Open in Drive' : 'Uploaded to Drive successfully' })
      if (result.webViewLink) window.open(result.webViewLink, '_blank')
    } else {
      setMessage({ type: 'error', text: result.error })
    }
  }

  // invoice_total_amount is total (subtotal + tax). Extract subtotal and tax to avoid double-counting.
  const totalAmount = rows.reduce((sum, r) => sum + (r.invoice_total_amount ?? 0), 0)
  const totalPrice = totalAmount / (1 + TAX_RATE)
  const totalTax = totalAmount - totalPrice
  const grandTotal = totalAmount

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-black/30 rounded-lg border border-gray-800 p-4">
        <h3 className="text-md font-semibold text-white mb-4">Filters</h3>
        <div className={`grid grid-cols-1 gap-4 items-end ${hideDealerFilter ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {!hideDealerFilter && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Dealer (Bayi)</label>
              <select
                value={dealerId}
                onChange={(e) => setDealerId(e.target.value)}
                className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
              >
                <option value="">All dealers</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">From date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">To date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={handleApply}
              disabled={loading}
              className="w-full bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
        </div>
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

      {/* Table preview */}
      <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-md font-semibold text-white">Statement Preview</h3>
          {rows.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreview}
                className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              {!hideDealerFilter && (
                <button
                  type="button"
                  onClick={handleDrive}
                  disabled={driveUploading}
                  className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  <HardDrive className="w-4 h-4" />
                  {driveUploading ? 'Uploading...' : 'Save to Drive'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              Select dealer and date range, then click Apply to load statement data.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Invoice No</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Complete Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vehicle Model</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Stok No</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row) => {
                  const total = row.invoice_total_amount ?? 0
                  const price = total / (1 + TAX_RATE)
                  const tax = total - price
                  const vehicleModel = `${row.vehicle_year} ${row.vehicle_make} ${row.vehicle_model}`.trim()
                  return (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5 text-sm text-gray-300">
                        {row.demand_number ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                        {formatInTimeZone(new Date(row.completed_at ?? row.updated_at), SYSTEM_DEFAULT_TIMEZONE, 'd MMMM yyyy')}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-white">{vehicleModel || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-300">{row.stock_number ?? '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-300 text-right">
                        $ {(price).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-300 text-right">
                        $ {(tax).toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={4} className="px-3 py-2.5 text-sm text-white">
                    Total
                  </td>
                  <td colSpan={2} className="px-3 py-2.5 text-sm text-[#C27E00] text-right">
                    $ {grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
