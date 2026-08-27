'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Download } from 'lucide-react'
import { recordDocumentView, recordScrollCompleted } from '@/app/dashboard/self/document-actions'

type Props = {
  assignmentId: string
  requiresScrollAck: boolean
  scrollCompleted: boolean
  onScrollGateMet?: () => void
}

export function CompliancePdfViewer({
  assignmentId,
  requiresScrollAck,
  scrollCompleted,
  onScrollGateMet,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scrollPercent, setScrollPercent] = useState(0)
  const viewLogged = useRef(false)
  const scrollLogged = useRef(scrollCompleted)

  const pdfUrl = `/api/compliance-documents/${assignmentId}/pdf`

  useEffect(() => {
    let cancelled = false

    async function renderPdf() {
      setLoading(true)
      setError(null)
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()

        const loadingTask = pdfjs.getDocument({ url: pdfUrl })
        const pdf = await loadingTask.promise
        if (cancelled) return

        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.2 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'mx-auto mb-4 shadow-sm'
          container.appendChild(canvas)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
        }

        if (!viewLogged.current) {
          viewLogged.current = true
          void recordDocumentView(assignmentId)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void renderPdf()
    return () => {
      cancelled = true
    }
  }, [assignmentId, pdfUrl])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const maxScroll = scrollHeight - clientHeight
    const pct = maxScroll <= 0 ? 100 : Math.min(100, Math.round((scrollTop / maxScroll) * 100))
    setScrollPercent(pct)

    if (requiresScrollAck && pct >= 95 && !scrollLogged.current) {
      scrollLogged.current = true
      void recordScrollCompleted(assignmentId, pct).then((res) => {
        if (!res.error) onScrollGateMet?.()
      })
    }
  }, [assignmentId, requiresScrollAck, onScrollGateMet])

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <a
          href={`${pdfUrl}?download=1`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-gray-400 hover:text-[#C27E00] dark:hover:text-[#C27E00]"
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </a>
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-gray-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading document…
        </div>
      )}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[480px] overflow-y-auto rounded border border-zinc-200 dark:border-gray-700 bg-white dark:bg-zinc-900 p-2"
      />
      {requiresScrollAck && !scrollCompleted && (
        <p className="text-xs text-zinc-500 dark:text-gray-400">
          Scroll progress: {scrollPercent}% (95% required to acknowledge)
        </p>
      )}
    </div>
  )
}
