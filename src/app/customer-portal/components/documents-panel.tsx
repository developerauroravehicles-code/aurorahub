'use client'

import { useState } from 'react'
import { ChevronDown, Download, FileText, Loader2 } from 'lucide-react'
import type { CustomerPortalRow } from '@/types/customer-portal'
import { downloadCustomerPortalSummaryPdf } from '@/lib/generate-customer-portal-summary-pdf'

type Props = {
  row: CustomerPortalRow
}

const CHECKLIST = [
  'Park your vehicle in an accessible location before the appointment.',
  'Clear the windshield and surrounding area for camera mounting.',
  'Have your keys and any dashcam accessories ready.',
  'Allow approximately 60–90 minutes for a standard installation.',
  'Contact your dealer if you need to reschedule.',
]

export function DocumentsPanel({ row }: Props) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadCustomerPortalSummaryPdf({ row })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#C27E00]" />
        Documents & guides
      </h3>

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-800 dark:text-gray-200 hover:border-[#C27E00] hover:text-[#C27E00] transition-colors disabled:opacity-50"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download installation summary (PDF)
      </button>

      <p className="text-xs text-zinc-500 dark:text-gray-500">
        For billing or invoice documents, please contact your dealer — invoices are not shared through this portal.
      </p>

      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium text-zinc-800 dark:text-gray-200"
          aria-expanded={open}
        >
          What to expect on installation day
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open ? (
          <ul className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-gray-400 list-disc pl-4">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
