'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Loader2,
  FileText,
  PenLine,
  Upload,
  CheckCircle2,
  Clock,
  BadgeCheck,
  ExternalLink,
  Download,
} from 'lucide-react'
import { CompliancePdfViewer } from '@/components/compliance-pdf-viewer'
import {
  acknowledgeDocument,
  uploadAssignmentDocument,
} from '@/app/dashboard/self/document-actions'
import { getEmbeddedSigningUrl } from '@/app/dashboard/hr/compliance/document-pack-actions'
import {
  DOCUMENT_STATUS_LABELS,
  type PersonnelDocumentAssignment,
} from '@/lib/compliance-document-types'

type AssignmentRow = PersonnelDocumentAssignment & {
  template: {
    code: string
    name: string
    category: string
    interaction_type: string
    requires_scroll_ack: boolean
    description: string | null
  } | null
}

type DocSubTab = 'pending' | 'signed'
type PackCategory = 'onboarding' | 'offboarding'

const PENDING_STATUSES = ['assigned', 'generated', 'pending_ack', 'pending_signature', 'uploaded'] as const
const SIGNED_STATUSES = ['acknowledged', 'signed', 'verified'] as const

const INTERACTION_LABELS: Record<string, string> = {
  upload: 'Upload required',
  acknowledge: 'Acknowledgment required',
  docusign: 'Signature required',
  hr_generated: 'HR generated — view only',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'MMM d, yyyy h:mm a')
  } catch {
    return iso
  }
}

function sanitizeDownloadLabel(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'document'
}

export function SelfDocumentsPanel({ assignments }: { assignments: AssignmentRow[] }) {
  const router = useRouter()
  const [category, setCategory] = useState<PackCategory>('onboarding')
  const [subTab, setSubTab] = useState<DocSubTab>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [scrollReady, setScrollReady] = useState<Record<string, boolean>>({})

  const activeAssignments = assignments.filter(
    (a) => a.status !== 'cancelled' && a.template?.category === category
  )

  const pendingItems = activeAssignments.filter((a) =>
    (PENDING_STATUSES as readonly string[]).includes(a.status)
  )
  const signedItems = activeAssignments.filter((a) =>
    (SIGNED_STATUSES as readonly string[]).includes(a.status)
  )

  const activeItems = subTab === 'pending' ? pendingItems : signedItems

  async function handleAck(id: string) {
    setBusyId(id)
    setMessage(null)
    const res = await acknowledgeDocument(id)
    setBusyId(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Document acknowledged.' })
      setSubTab('signed')
      router.refresh()
    }
  }

  async function handleSign(id: string) {
    setBusyId(id)
    setMessage(null)
    const res = await getEmbeddedSigningUrl(id)
    setBusyId(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else if (res.url) window.location.href = res.url
  }

  async function handleUpload(id: string, file: File) {
    setBusyId(id)
    setMessage(null)
    const fd = new FormData()
    fd.set('assignmentId', id)
    fd.set('file', file)
    const res = await uploadAssignmentDocument(fd)
    setBusyId(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Document uploaded — awaiting HR verification.' })
      router.refresh()
    }
  }

  function completionMeta(a: AssignmentRow): string | null {
    if (a.status === 'acknowledged' && a.acknowledged_at) {
      return `Acknowledged ${formatDate(a.acknowledged_at)}`
    }
    if (a.status === 'signed' && a.signed_at) {
      return `Signed ${formatDate(a.signed_at)}`
    }
    if (a.status === 'verified' && a.verified_at) {
      return `Verified by HR ${formatDate(a.verified_at)}`
    }
    return null
  }

  function renderAssignment(a: AssignmentRow, mode: DocSubTab) {
    const t = a.template
    const isPending = mode === 'pending'

    const canAck =
      isPending &&
      t?.interaction_type === 'acknowledge' &&
      a.status === 'pending_ack' &&
      (!t.requires_scroll_ack || a.scroll_completed_at || scrollReady[a.id])
    const showAckDisabled =
      isPending &&
      t?.interaction_type === 'acknowledge' &&
      a.status === 'pending_ack' &&
      t.requires_scroll_ack &&
      !a.scroll_completed_at &&
      !scrollReady[a.id]
    const canSign = isPending && t?.interaction_type === 'docusign' && a.status === 'pending_signature'
    const canUpload =
      isPending && t?.interaction_type === 'upload' && ['assigned', 'generated'].includes(a.status)
    const waitingPrepare =
      isPending &&
      t?.interaction_type !== 'upload' &&
      a.status === 'assigned' &&
      !a.drive_file_id
    const showViewer =
      t?.interaction_type !== 'upload' &&
      !!(a.drive_file_id || a.signed_drive_file_id) &&
      (isPending
        ? ['pending_ack', 'pending_signature', 'generated'].includes(a.status)
        : ['acknowledged', 'signed', 'verified'].includes(a.status))

    const hasFile = !!(a.drive_file_id || a.signed_drive_file_id)
    const pdfViewUrl = `/api/compliance-documents/${a.id}/pdf`
    const pdfDownloadUrl = `/api/compliance-documents/${a.id}/pdf?download=1`
    const downloadLabel = sanitizeDownloadLabel(t?.name ?? 'document')

    const categoryLabel =
      t?.category === 'onboarding' ? 'Onboarding' : t?.category === 'offboarding' ? 'Offboarding' : ''

    return (
      <div
        key={a.id}
        className="rounded-lg border border-zinc-200 dark:border-gray-700 p-4 space-y-3 bg-white/50 dark:bg-white/5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-[#C27E00] shrink-0" />
              <h4 className="font-medium text-zinc-900 dark:text-white">{t?.name ?? 'Document'}</h4>
              {categoryLabel && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-gray-800 text-zinc-500">
                  {categoryLabel}
                </span>
              )}
            </div>
            {t?.description && (
              <p className="text-sm text-zinc-500 dark:text-gray-400">{t.description}</p>
            )}
          </div>
          <span
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              isPending
                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                : 'bg-green-500/15 text-green-400 border border-green-500/30'
            }`}
          >
            {DOCUMENT_STATUS_LABELS[a.status]}
          </span>
        </div>

        {t?.interaction_type && isPending && (
          <p className="text-xs text-zinc-500 dark:text-gray-500">
            {INTERACTION_LABELS[t.interaction_type] ?? t.interaction_type}
          </p>
        )}

        {!isPending && completionMeta(a) && (
          <p className="text-xs text-green-500/90 flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5" />
            {completionMeta(a)}
          </p>
        )}

        {showViewer && (
          <CompliancePdfViewer
            assignmentId={a.id}
            requiresScrollAck={isPending && !!t?.requires_scroll_ack}
            scrollCompleted={!!a.scroll_completed_at}
            onScrollGateMet={() => setScrollReady((s) => ({ ...s, [a.id]: true }))}
          />
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {waitingPrepare && (
            <p className="text-sm text-amber-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Preparing document…
            </p>
          )}

          {canUpload && (
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm cursor-pointer hover:bg-[#a86a00]">
              {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload file
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                disabled={busyId === a.id}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUpload(a.id, f)
                }}
              />
            </label>
          )}

          {showAckDisabled && (
            <button
              type="button"
              disabled
              title="Scroll through the entire document first"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-500 text-zinc-500 text-sm opacity-60 cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              I have read and understood
            </button>
          )}

          {canAck && (
            <button
              type="button"
              disabled={busyId === a.id}
              onClick={() => void handleAck(a.id)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-green-600 text-green-700 dark:text-green-400 text-sm hover:bg-green-500/10 disabled:opacity-50"
            >
              {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              I have read and understood
            </button>
          )}

          {canSign && (
            <button
              type="button"
              disabled={busyId === a.id}
              onClick={() => void handleSign(a.id)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
              Sign document
            </button>
          )}

          {!isPending && hasFile && (
            <>
              <a
                href={pdfViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-300 dark:border-gray-600 text-sm text-[#C27E00] hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
              <a
                href={pdfDownloadUrl}
                download={downloadLabel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-300 dark:border-gray-600 text-sm hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </>
          )}

          {isPending && hasFile && t?.interaction_type !== 'upload' && (
            <a
              href={pdfDownloadUrl}
              download={downloadLabel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-300 dark:border-gray-600 text-sm hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}

          {isPending && hasFile && t?.interaction_type === 'upload' && a.status === 'uploaded' && (
            <>
              <a
                href={pdfViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-300 dark:border-gray-600 text-sm text-[#C27E00] hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View upload
              </a>
              <a
                href={pdfDownloadUrl}
                download={downloadLabel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-300 dark:border-gray-600 text-sm hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
              <span className="text-sm text-amber-500 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Awaiting HR verification
              </span>
            </>
          )}

          {isPending && a.status === 'uploaded' && !hasFile && (
            <span className="text-sm text-amber-500 flex items-center gap-1">
              <Clock className="w-4 h-4" /> Awaiting HR verification
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-gray-700">
        {(['onboarding', 'offboarding'] as const).map((cat) => {
          const count = assignments.filter(
            (a) => a.status !== 'cancelled' && a.template?.category === cat
          ).length
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize flex items-center gap-2 ${
                category === cat
                  ? 'border-[#C27E00] text-[#C27E00]'
                  : 'border-transparent text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {cat}
              {count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-gray-800 text-zinc-600 dark:text-gray-300">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setSubTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            subTab === 'pending'
              ? 'border-[#C27E00] text-[#C27E00]'
              : 'border-transparent text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending
          {pendingItems.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
              {pendingItems.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('signed')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            subTab === 'signed'
              ? 'border-green-500 text-green-500'
              : 'border-transparent text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <BadgeCheck className="w-4 h-4" />
          Signed
          {signedItems.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
              {signedItems.length}
            </span>
          )}
        </button>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}

      {assignments.filter((a) => a.status !== 'cancelled').length === 0 ? (
        <p className="text-zinc-500 dark:text-gray-500 py-4">No assigned compliance documents yet.</p>
      ) : activeAssignments.length === 0 ? (
        <p className="text-zinc-500 dark:text-gray-500 py-6 text-center text-sm">
          No {category} documents assigned.
        </p>
      ) : activeItems.length === 0 ? (
        <p className="text-zinc-500 dark:text-gray-500 py-6 text-center text-sm">
          {subTab === 'pending'
            ? 'No pending documents — you are all caught up.'
            : 'No completed documents yet. Signed and acknowledged items will appear here.'}
        </p>
      ) : (
        <div className="space-y-3">{activeItems.map((a) => renderAssignment(a, subTab))}</div>
      )}
    </div>
  )
}
