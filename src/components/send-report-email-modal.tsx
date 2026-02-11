'use client'

import { useState, useEffect } from 'react'
import { Mail } from 'lucide-react'
import { getReportRecipients, sendReportEmailAction, type ReportRecipient } from '@/app/dashboard/reports/actions'
import { generateReportPdfBase64, type ExportReportOptions } from '@/lib/export-report-pdf'

interface SendReportEmailModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  reportOptions: ExportReportOptions
}

export function SendReportEmailModal({
  isOpen,
  onClose,
  onSuccess,
  reportOptions,
}: SendReportEmailModalProps) {
  const [recipients, setRecipients] = useState<ReportRecipient[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [includeAuroraManager, setIncludeAuroraManager] = useState(true)
  const [optionalMessage, setOptionalMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setSuccess(false)
      setLoadingRecipients(true)
      getReportRecipients().then((res) => {
        if (res.recipients) {
          setRecipients(res.recipients)
          setSelectedIds(new Set())
        } else {
          setError(res.error ?? 'Failed to load recipients')
        }
        setLoadingRecipients(false)
      })
    }
  }, [isOpen])

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === recipients.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(recipients.map((r) => r.id)))
    }
  }

  const handleSend = async () => {
    if (selectedIds.size === 0 && !includeAuroraManager) {
      setError('Please select at least one recipient or include Aurora Manager')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const pdfBase64 = generateReportPdfBase64(reportOptions)
      const result = await sendReportEmailAction({
        recipientIds: Array.from(selectedIds),
        includeAuroraManager,
        reportTitle: reportOptions.reportTitle,
        dateRange: reportOptions.dateRange,
        exporterFullName: reportOptions.exporterFullName,
        pdfBase64,
        optionalMessage: optionalMessage.trim() || undefined,
      })

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 1500)
      } else {
        setError(result.error ?? 'Failed to send email')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-6 h-6 text-[#C27E00]" />
            <h2 className="text-xl font-semibold text-white">Send Report by E-mail</h2>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-900/50 border border-green-800 text-green-200 p-3 rounded-md mb-4 text-sm">
              Report sent successfully.
            </div>
          )}

          {loadingRecipients ? (
            <p className="text-gray-400 py-4">Loading recipients...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Recipients (same dealer)</label>
                  {recipients.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-[#C27E00] hover:underline"
                    >
                      {selectedIds.size === recipients.length ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md bg-black/30 p-2 space-y-2">
                  {recipients.length === 0 ? (
                    <p className="text-gray-500 text-sm py-2">No other users in your dealer(s).</p>
                  ) : (
                    recipients.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => handleToggle(r.id)}
                          className="w-4 h-4 rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                        />
                        <span className="text-white text-sm">
                          {r.full_name || 'Unknown'} <span className="text-gray-400">({r.role.replace('_', ' ')})</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="includeAuroraManager"
                  checked={includeAuroraManager}
                  onChange={(e) => setIncludeAuroraManager(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-700 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                />
                <label htmlFor="includeAuroraManager" className="text-white text-sm cursor-pointer">
                  Include Aurora Manager(s)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message (optional)</label>
                <textarea
                  value={optionalMessage}
                  onChange={(e) => setOptionalMessage(e.target.value)}
                  placeholder="Add a message to include in the email..."
                  rows={3}
                  className="w-full border border-gray-700 bg-black/30 rounded-md p-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 pt-0 border-t border-gray-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={
              loading ||
              loadingRecipients ||
              (selectedIds.size === 0 && !includeAuroraManager) ||
              success
            }
            className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {loading ? (
              'Sending...'
            ) : success ? (
              'Sent!'
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send E-mail
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
