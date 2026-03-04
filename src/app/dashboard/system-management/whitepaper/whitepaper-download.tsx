'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { downloadWhitepaperPdf } from '@/lib/generate-whitepaper-pdf'

export function WhitepaperDownload() {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      downloadWhitepaperPdf()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-50">
          <FileText className="h-6 w-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h2 className="font-medium text-gray-900">AuroraHub Operational Platform Whitepaper</h2>
          <p className="mt-1 text-sm text-gray-500">
            Technical and operational documentation covering platform architecture, roles, communication, and security.
          </p>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-70"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
