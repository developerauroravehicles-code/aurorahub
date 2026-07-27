'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import {
  applyDemandExtract,
  hasExistingDemandFieldValues,
  type DemandExtractApplySetters,
  type DemandExtractCurrentValues,
} from '@/lib/apply-demand-extract'
import { extractTextFromFile, DEMAND_DOCUMENT_ACCEPT } from '@/lib/demand-document-ocr'
import { parseDemandDocument } from '@/lib/demand-document-parser'
import {
  countFilledExtractFields,
  getFilledExtractFieldLabels,
  getLowConfidenceExtractFieldLabels,
  getMissingExtractFieldLabels,
  type DemandExtractResult,
} from '@/lib/demand-extract-types'

type DemandDocumentFillButtonProps = {
  disabled?: boolean
  currentValues: DemandExtractCurrentValues
  setters: DemandExtractApplySetters
  className?: string
}

type StatusMessage = {
  type: 'success' | 'warning' | 'error'
  text: string
  details?: string[]
}

export function DemandDocumentFillButton({
  disabled = false,
  currentValues,
  setters,
  className = '',
}: DemandDocumentFillButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [lastResult, setLastResult] = useState<DemandExtractResult | null>(null)

  const buildStatusMessage = (result: DemandExtractResult): StatusMessage => {
    const filledCount = countFilledExtractFields(result)
    const missing = getMissingExtractFieldLabels(result)
    const lowConfidence = getLowConfidenceExtractFieldLabels(result)

    if (filledCount === 0) {
      return {
        type: 'warning',
        text: 'No matching fields were found in this document.',
        details: [
          'Retake the photo flat, well-lit, and close enough to read the text clearly.',
          'Supported documents: Sales Manager Check List or credit application form.',
        ],
      }
    }

    const filled = getFilledExtractFieldLabels(result)
    const details: string[] = []
    if (filled.length > 0) {
      details.push(`Filled: ${filled.join(', ')}`)
    }
    if (result.documentType === 'sales_checklist') {
      details.push('Sales Manager Check List has last name only — enter first name manually if needed.')
    }
    if (result.documentType === 'credit_application') {
      details.push('Credit applications have no vehicle data — enter make, model, year, stock and VIN manually.')
    }
    if (missing.length > 0) {
      details.push(`Not found: ${missing.join(', ')}`)
    }
    if (lowConfidence.length > 0) {
      details.push(`Please double-check: ${lowConfidence.join(', ')}`)
    }
    details.push('Appointment and camera model must still be selected manually.')

    return {
      type: lowConfidence.length > 0 || missing.length > 0 ? 'warning' : 'success',
      text: `${filledCount} field${filledCount === 1 ? '' : 's'} filled. Please review before submitting.`,
      details,
    }
  }

  const handleApply = (result: DemandExtractResult) => {
    applyDemandExtract(result, setters)
    setLastResult(result)
    setStatus(buildStatusMessage(result))
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setStatus(null)
    setLastResult(null)
    setIsProcessing(true)

    try {
      const text = await extractTextFromFile(file)
      const result = parseDemandDocument(text)

      if (hasExistingDemandFieldValues(currentValues)) {
        const confirmed = window.confirm(
          'Some form fields already have values. Replace them with data from this document?'
        )
        if (!confirmed) {
          setStatus({
            type: 'warning',
            text: 'Document was read but existing form values were kept.',
          })
          return
        }
      }

      handleApply(result)
    } catch (error) {
      setStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to read document.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={DEMAND_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isProcessing}
        className="inline-flex items-center gap-2 rounded-md border border-[#C27E00]/40 bg-[#C27E00]/10 px-4 py-2.5 text-sm font-semibold text-[#C27E00] hover:bg-[#C27E00]/20 focus:outline-none focus:ring-2 focus:ring-[#C27E00] focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-black"
      >
        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {isProcessing ? 'Reading document…' : 'Fill with Photo / PDF'}
      </button>

      {status && (
        <div
          className={`rounded-md border p-3 text-sm ${
            status.type === 'success'
              ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-100'
              : status.type === 'warning'
                ? 'border-amber-700/50 bg-amber-900/20 text-amber-100'
                : 'border-red-800 bg-red-900/50 text-red-200'
          }`}
        >
          <p>{status.text}</p>
          {status.details && status.details.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-90">
              {status.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lastResult && status?.type !== 'error' && (
        <p className="text-xs text-zinc-500 dark:text-gray-500">
          Handwriting and low-quality photos may produce OCR errors. Always verify before submitting.
        </p>
      )}
    </div>
  )
}
