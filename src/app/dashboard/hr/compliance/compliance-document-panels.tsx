'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Play, Send, CheckCircle2, Package, XCircle, Trash2, Download, ExternalLink } from 'lucide-react'
import {
  assignDocumentPack,
  generateAllAssignments,
  generateAssignment,
  sendDocuSign,
  verifyUploadedDocument,
  toggleTemplateActive,
  cancelAssignment,
  cancelDocumentPack,
} from './document-pack-actions'
import {
  DOCUMENT_STATUS_LABELS,
  type ComplianceDocumentTemplate,
} from '@/lib/compliance-document-types'
import { formSelectClassName } from '@/lib/form-field-styles'

type AssignmentRow = {
  id: string
  personnel_id: string
  status: string
  drive_file_id?: string | null
  signed_drive_file_id?: string | null
  drive_web_view_link: string | null
  docusign_envelope_id: string | null
  docusign_status: string | null
  template: {
    code: string
    name: string
    category: string
    interaction_type: string
  } | null
  personnel: { full_name: string } | null
}

const FILE_READY_STATUSES = [
  'generated',
  'pending_ack',
  'acknowledged',
  'pending_signature',
  'signed',
  'uploaded',
  'verified',
] as const

function assignmentHasDownloadableFile(a: AssignmentRow): boolean {
  if (a.drive_file_id || a.signed_drive_file_id || a.drive_web_view_link) return true
  return (FILE_READY_STATUSES as readonly string[]).includes(a.status)
}

function DocumentFileLinks({ assignmentId, templateName }: { assignmentId: string; templateName?: string }) {
  const label = (templateName ?? 'document').replace(/[<>:"/\\|?*]/g, '_').trim() || 'document'
  return (
    <>
      <a
        href={`/api/compliance-documents/${assignmentId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-2 py-1 rounded text-xs border border-zinc-300 dark:border-gray-600 hover:bg-zinc-100 dark:hover:bg-white/5 inline-flex items-center gap-1"
      >
        <ExternalLink className="w-3 h-3" /> Open
      </a>
      <a
        href={`/api/compliance-documents/${assignmentId}/pdf?download=1`}
        download={label}
        className="px-2 py-1 rounded text-xs border border-zinc-300 dark:border-gray-600 hover:bg-zinc-100 dark:hover:bg-white/5 inline-flex items-center gap-1"
      >
        <Download className="w-3 h-3" /> Download
      </a>
    </>
  )
}

type PackCategory = 'onboarding' | 'offboarding'

const INTERACTION_LABELS: Record<string, string> = {
  upload: 'Upload',
  acknowledge: 'Acknowledge',
  docusign: 'DocuSign',
  hr_generated: 'HR Generated',
}

const CANCELLABLE_STATUSES = ['assigned', 'generated', 'pending_ack', 'pending_signature', 'uploaded']

function normalizeTemplate<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function ComplianceTemplatesPanel({
  templates,
}: {
  templates: ComplianceDocumentTemplate[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleToggle(id: string, active: boolean) {
    setBusyId(id)
    await toggleTemplateActive(id, active)
    setBusyId(null)
    router.refresh()
  }

  const onboarding = templates.filter((t) => t.category === 'onboarding')
  const offboarding = templates.filter((t) => t.category === 'offboarding')

  function renderTable(items: ComplianceDocumentTemplate[]) {
    return (
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-zinc-500">Name</th>
            <th className="px-3 py-2 text-left text-zinc-500">Type</th>
            <th className="px-3 py-2 text-left text-zinc-500">Version</th>
            <th className="px-3 py-2 text-left text-zinc-500">Scroll ack</th>
            <th className="px-3 py-2 text-left text-zinc-500">Active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
          {items.map((t) => (
            <tr key={t.id}>
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900 dark:text-white">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.code}</div>
              </td>
              <td className="px-3 py-2 text-zinc-600 dark:text-gray-300">
                {INTERACTION_LABELS[t.interaction_type] ?? t.interaction_type}
              </td>
              <td className="px-3 py-2">{t.template_version}</td>
              <td className="px-3 py-2">{t.requires_scroll_ack ? 'Yes' : 'No'}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => void handleToggle(t.id, !t.is_active)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    t.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {busyId === t.id ? '…' : t.is_active ? 'Active' : 'Inactive'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-md font-medium text-zinc-900 dark:text-white mb-2">Onboarding templates</h3>
        {renderTable(onboarding)}
      </div>
      <div>
        <h3 className="text-md font-medium text-zinc-900 dark:text-white mb-2">Offboarding templates</h3>
        {renderTable(offboarding)}
      </div>
      <p className="text-xs text-zinc-500 dark:text-gray-500">
        Legal text in templates requires counsel review before production use.
      </p>
    </div>
  )
}

export function ComplianceAssignmentsPanel({
  assignments,
  personnel,
}: {
  assignments: AssignmentRow[]
  personnel: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [selectedPersonnel, setSelectedPersonnel] = useState(personnel[0]?.id ?? '')
  const [category, setCategory] = useState<PackCategory>('onboarding')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const filtered = assignments.filter((a) => {
    if (a.personnel_id !== selectedPersonnel) return false
    const t = normalizeTemplate(a.template)
    if (t?.category !== category) return false
    return a.status !== 'cancelled'
  })

  const cancellableCount = filtered.filter((a) => CANCELLABLE_STATUSES.includes(a.status)).length

  async function runAction(
    key: string,
    fn: () => Promise<{ error?: string; success?: boolean; generated?: number; count?: number }>
  ) {
    setBusy(key)
    setMessage(null)
    const res = await fn()
    setBusy(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      let extra = ''
      if (res.generated != null) extra = ` (${res.generated} generated)`
      if (res.count != null) extra = ` (${res.count} cancelled)`
      setMessage({ type: 'success', text: `Done${extra}` })
      router.refresh()
    }
  }

  async function handleCancelOne(id: string) {
    if (!confirm('Cancel this document assignment? The employee will no longer see it.')) return
    setBusy(`cancel-${id}`)
    setMessage(null)
    const res = await cancelAssignment(id)
    setBusy(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Assignment cancelled.' })
      router.refresh()
    }
  }

  async function handleCancelPack() {
    if (!confirm(`Cancel all pending ${category} assignments for this employee?`)) return
    void runAction('cancel-pack', () => cancelDocumentPack(selectedPersonnel, category))
  }

  return (
    <div className="space-y-4">
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

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Personnel</label>
          <select
            value={selectedPersonnel}
            onChange={(e) => setSelectedPersonnel(e.target.value)}
            className={`rounded border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm min-w-[180px] ${formSelectClassName}`}
          >
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-gray-700">
        {(['onboarding', 'offboarding'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              category === cat
                ? 'border-[#C27E00] text-[#C27E00]'
                : 'border-transparent text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!selectedPersonnel || busy === 'assign'}
          onClick={() =>
            void runAction('assign', () => assignDocumentPack(selectedPersonnel, category))
          }
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a86a00] disabled:opacity-50"
        >
          {busy === 'assign' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
          Assign {category} pack
        </button>
        <button
          type="button"
          disabled={!selectedPersonnel || busy === 'generate-all'}
          onClick={() =>
            void runAction('generate-all', () => generateAllAssignments(selectedPersonnel, category))
          }
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-300 dark:border-gray-600 text-sm hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-50"
        >
          {busy === 'generate-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Generate all
        </button>
        <button
          type="button"
          disabled={!selectedPersonnel || cancellableCount === 0 || busy === 'cancel-pack'}
          onClick={() => void handleCancelPack()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-red-500/50 text-red-500 text-sm hover:bg-red-500/10 disabled:opacity-50"
        >
          {busy === 'cancel-pack' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Cancel pack
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-gray-500">
        Showing {category} documents for selected personnel only ({filtered.length} assignment{filtered.length !== 1 ? 's' : ''}).
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-zinc-500">Document</th>
              <th className="px-3 py-2 text-left text-zinc-500">Type</th>
              <th className="px-3 py-2 text-left text-zinc-500">Status</th>
              <th className="px-3 py-2 text-left text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-zinc-500 text-center">
                  No {category} assignments for this employee. Click &quot;Assign {category} pack&quot; to add documents.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const t = normalizeTemplate(a.template)
                const statusKey = a.status as keyof typeof DOCUMENT_STATUS_LABELS
                const canCancel = CANCELLABLE_STATUSES.includes(a.status)
                return (
                  <tr key={a.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900 dark:text-white">{t?.name ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-gray-300">
                      {INTERACTION_LABELS[t?.interaction_type ?? ''] ?? t?.interaction_type ?? '—'}
                    </td>
                    <td className="px-3 py-2">{DOCUMENT_STATUS_LABELS[statusKey] ?? a.status}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {t?.interaction_type !== 'upload' && (
                          <button
                            type="button"
                            disabled={busy === a.id}
                            onClick={() => void runAction(a.id, () => generateAssignment(a.id))}
                            className="px-2 py-1 rounded text-xs border border-zinc-300 dark:border-gray-600 hover:bg-zinc-100 dark:hover:bg-white/5"
                          >
                            Generate
                          </button>
                        )}
                        {t?.interaction_type === 'docusign' && (
                          <button
                            type="button"
                            disabled={busy === `ds-${a.id}`}
                            onClick={() => {
                              setBusy(`ds-${a.id}`)
                              void sendDocuSign(a.id).then((res) => {
                                setBusy(null)
                                if (res.error) setMessage({ type: 'error', text: res.error })
                                else {
                                  setMessage({ type: 'success', text: 'DocuSign envelope sent.' })
                                  router.refresh()
                                }
                              })
                            }}
                            className="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> DocuSign
                          </button>
                        )}
                        {t?.interaction_type === 'upload' && a.status === 'uploaded' && (
                          <button
                            type="button"
                            disabled={busy === `v-${a.id}`}
                            onClick={() => {
                              setBusy(`v-${a.id}`)
                              void verifyUploadedDocument(a.id).then((res) => {
                                setBusy(null)
                                if (res.error) setMessage({ type: 'error', text: res.error })
                                else {
                                  setMessage({ type: 'success', text: 'Document verified.' })
                                  router.refresh()
                                }
                              })
                            }}
                            className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Verify
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            disabled={busy === `cancel-${a.id}`}
                            onClick={() => void handleCancelOne(a.id)}
                            className="px-2 py-1 rounded text-xs border border-red-500/40 text-red-500 hover:bg-red-500/10 inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        )}
                        {assignmentHasDownloadableFile(a) && (
                          <DocumentFileLinks assignmentId={a.id} templateName={t?.name} />
                        )}
                        {a.drive_web_view_link && (
                          <a
                            href={a.drive_web_view_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded text-xs text-[#C27E00] hover:underline"
                          >
                            Drive
                          </a>
                        )}
                      </div>
                      {a.docusign_envelope_id && (
                        <div className="text-xs text-zinc-500 mt-1">
                          Envelope: {a.docusign_envelope_id.slice(0, 12)}… ({a.docusign_status ?? 'sent'})
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PersonnelDocumentsSection({
  assignments,
  personnelId,
}: {
  assignments: AssignmentRow[]
  personnelId: string
}) {
  const router = useRouter()
  const [category, setCategory] = useState<PackCategory>('onboarding')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const filtered = assignments.filter((a) => {
    const t = normalizeTemplate(a.template)
    return t?.category === category && a.status !== 'cancelled'
  })

  const cancellableCount = filtered.filter((a) => CANCELLABLE_STATUSES.includes(a.status)).length

  async function handleCancelOne(id: string) {
    if (!confirm('Cancel this document assignment? The employee will no longer see it.')) return
    setBusy(`cancel-${id}`)
    setMessage(null)
    const res = await cancelAssignment(id)
    setBusy(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: 'Assignment cancelled.' })
      router.refresh()
    }
  }

  async function handleCancelPack() {
    if (!confirm(`Cancel all pending ${category} assignments for this employee?`)) return
    setBusy('cancel-pack')
    setMessage(null)
    const res = await cancelDocumentPack(personnelId, category)
    setBusy(null)
    if (res.error) setMessage({ type: 'error', text: res.error })
    else {
      setMessage({ type: 'success', text: `Cancelled ${res.count ?? 0} assignment(s).` })
      router.refresh()
    }
  }

  if (assignments.filter((a) => a.status !== 'cancelled').length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-gray-500">
        No document pack assigned. Use Compliance → Assignments to assign onboarding or offboarding packs.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {message && (
        <div
          className={`px-3 py-2 rounded text-xs ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 border-b border-zinc-200 dark:border-gray-700">
          {(['onboarding', 'offboarding'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px capitalize ${
                category === cat
                  ? 'border-[#C27E00] text-[#C27E00]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {cancellableCount > 0 && (
          <button
            type="button"
            disabled={busy === 'cancel-pack'}
            onClick={() => void handleCancelPack()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-red-500/50 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
          >
            {busy === 'cancel-pack' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Cancel {category} pack
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-500 py-2">
          No {category} documents assigned.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-zinc-500">Document</th>
                <th className="px-3 py-2 text-left text-zinc-500">Status</th>
                <th className="px-3 py-2 text-left text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {filtered.map((a) => {
                const t = normalizeTemplate(a.template)
                const statusKey = a.status as keyof typeof DOCUMENT_STATUS_LABELS
                const canCancel = CANCELLABLE_STATUSES.includes(a.status)
                return (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-zinc-900 dark:text-white">{t?.name ?? '—'}</td>
                    <td className="px-3 py-2">{DOCUMENT_STATUS_LABELS[statusKey] ?? a.status}</td>
                    <td className="px-3 py-2 flex flex-wrap gap-1">
                      {t?.interaction_type !== 'upload' && (
                        <button
                          type="button"
                          disabled={busy === a.id}
                          onClick={async () => {
                            setBusy(a.id)
                            await generateAssignment(a.id)
                            setBusy(null)
                            router.refresh()
                          }}
                          className="px-2 py-0.5 rounded text-xs border border-zinc-300 dark:border-gray-600"
                        >
                          Generate
                        </button>
                      )}
                      {t?.interaction_type === 'docusign' && (
                        <button
                          type="button"
                          disabled={busy === `ds-${a.id}`}
                          onClick={async () => {
                            setBusy(`ds-${a.id}`)
                            await sendDocuSign(a.id)
                            setBusy(null)
                            router.refresh()
                          }}
                          className="px-2 py-0.5 rounded text-xs bg-blue-600 text-white"
                        >
                          DocuSign
                        </button>
                      )}
                      {t?.interaction_type === 'upload' && a.status === 'uploaded' && (
                        <button
                          type="button"
                          disabled={busy === `v-${a.id}`}
                          onClick={async () => {
                            setBusy(`v-${a.id}`)
                            await verifyUploadedDocument(a.id)
                            setBusy(null)
                            router.refresh()
                          }}
                          className="px-2 py-0.5 rounded text-xs bg-green-600 text-white"
                        >
                          Verify
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          disabled={busy === `cancel-${a.id}`}
                          onClick={() => void handleCancelOne(a.id)}
                          className="px-2 py-0.5 rounded text-xs border border-red-500/40 text-red-500 hover:bg-red-500/10 inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {assignmentHasDownloadableFile(a) && (
                        <DocumentFileLinks assignmentId={a.id} templateName={t?.name} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
