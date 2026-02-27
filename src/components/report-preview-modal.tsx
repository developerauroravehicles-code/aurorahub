'use client'

import { useMemo } from 'react'
import { X, FileDown } from 'lucide-react'
import { generateReportPdfBase64, type ExportReportOptions } from '@/lib/export-report-pdf'

interface ReportPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reportOptions: ExportReportOptions | null
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  reportOptions,
}: ReportPreviewModalProps) {
  const pdfDataUrl = useMemo(() => {
    if (!isOpen || !reportOptions) return null
    try {
      const base64 = generateReportPdfBase64(reportOptions)
      return `data:application/pdf;base64,${base64}`
    } catch {
      return null
    }
  }, [isOpen, reportOptions])

  const handleDownload = () => {
    if (!reportOptions || !pdfDataUrl) return
    const link = document.createElement('a')
    link.href = pdfDataUrl
    link.download = `${reportOptions.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    link.click()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">Report Sample</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!pdfDataUrl}
              className="inline-flex items-center gap-2 px-3 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden p-4 pt-0">
          {pdfDataUrl ? (
            <iframe
              src={pdfDataUrl}
              title="Report preview"
              className="w-full h-full rounded-md border border-gray-700 bg-white"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-md border border-gray-700">
              <p className="text-gray-400">Report could not be loaded.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
