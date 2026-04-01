'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createTrainingProgram,
  updateTrainingProgram,
  deleteTrainingProgram,
  recordCompletion,
  deleteCompletion,
  createCertification,
  updateCertification,
  deleteCertification,
} from './actions'
import { Pencil, Trash2, Plus, KeyRound, Check, X, Loader2 } from 'lucide-react'

const CERT_TYPES: Record<string, string> = {
  dashcam_installation: 'Dashcam Installation',
  vehicle_electronics: 'Vehicle Electronics',
  safety_training: 'Safety Training',
  insurance_compliance: 'Insurance Compliance',
  customer_service: 'Customer Service',
  other: 'Other',
}

const CERT_STATUSES: Record<string, string> = {
  awaiting: 'Awaiting',
  sent: 'Sent',
  received: 'Received',
  approved: 'Approved',
  expired: 'Expired',
}

const PROGRAM_CATEGORIES = ['technical', 'safety', 'soft_skills', 'compliance', 'other']

export function TrainingContent({
  programs,
  completions,
  certifications,
  personnel,
}: {
  programs: { id: string; name: string; description: string | null; category: string | null }[]
  completions: { id: string; personnel_id: string; completed_at: string; personnel: { full_name: string } | null; training_programs: { name: string } | null }[]
  certifications: { id: string; personnel_id: string; certification_type: string; name: string | null; institution: string | null; issue_date: string; expiry_date: string | null; status: string; personnel: { full_name: string } | null }[]
  personnel: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'programs' | 'completions' | 'certifications'>('programs')
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null)
  const [showCompletionForm, setShowCompletionForm] = useState(false)
  const [showCertForm, setShowCertForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const expiringSoon = certifications.filter(
    (c) => c.expiry_date && c.expiry_date >= today && c.expiry_date <= in30Days
  )
  const expired = certifications.filter((c) => c.expiry_date && c.expiry_date < today)

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-zinc-200 dark:border-gray-800 pb-2">
        {(['programs', 'completions', 'certifications'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-b-0 border-zinc-200 dark:border-gray-800'
                : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white hover:bg-zinc-200/50 dark:bg-white/5'
            }`}
          >
            {tab === 'programs' && 'Training Programs'}
            {tab === 'completions' && 'Completions'}
            {tab === 'certifications' && 'Certifications'}
          </button>
        ))}
      </div>

      {activeTab === 'programs' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Training Programs</h2>
            <button
              onClick={() => {
                setEditingProgramId(null)
                setShowProgramForm(true)
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Program
            </button>
          </div>
          {showProgramForm && (
            <ProgramForm
              program={editingProgramId ? programs.find((p) => p.id === editingProgramId) : null}
              onClose={() => {
                setShowProgramForm(false)
                setEditingProgramId(null)
              }}
              onSuccess={() => {
                router.refresh()
                setShowProgramForm(false)
                setEditingProgramId(null)
              }}
            />
          )}
          <div className="mt-4 grid gap-2">
            {programs.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 rounded bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-gray-800"
              >
                <div>
                  <span className="text-zinc-900 dark:text-white font-medium">{p.name}</span>
                  <span className="text-zinc-500 dark:text-gray-500 text-sm ml-2">— {p.category || 'Uncategorized'}</span>
                  {p.description && <p className="text-zinc-500 dark:text-gray-400 text-xs mt-0.5">{p.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingProgramId(p.id)
                      setShowProgramForm(true)
                    }}
                    className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00]"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <form
                    action={async () => {
                      if (confirm('Delete this program?')) {
                        await deleteTrainingProgram(p.id)
                        router.refresh()
                      }
                    }}
                  >
                    <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {programs.length === 0 && !showProgramForm && <p className="text-zinc-500 dark:text-gray-500 py-4">No programs yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'completions' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Training Completions</h2>
            <button
              onClick={() => setShowCompletionForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Check className="w-4 h-4" /> Record Completion
            </button>
          </div>
          {showCompletionForm && (
            <CompletionForm
              programs={programs}
              personnel={personnel}
              onClose={() => setShowCompletionForm(false)}
              onSuccess={() => {
                router.refresh()
                setShowCompletionForm(false)
              }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Program</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Completed</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {completions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white">
                      <Link href={`/dashboard/hr/personnel/${c.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {c.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{c.training_programs?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">
                      {c.completed_at ? new Date(c.completed_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form
                        action={async () => {
                          if (confirm('Remove this completion?')) {
                            await deleteCompletion(c.id)
                            router.refresh()
                          }
                        }}
                      >
                        <button type="submit" className="text-zinc-500 dark:text-gray-400 hover:text-red-400 p-1" title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {completions.length === 0 && !showCompletionForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No completions recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'certifications' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          {(expiringSoon.length > 0 || expired.length > 0) && (
            <div className="mb-4 space-y-2">
              {expiringSoon.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-2 rounded text-sm">
                  {expiringSoon.length} certification(s) expiring within 30 days
                </div>
              )}
              {expired.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded text-sm">
                  {expired.length} certification(s) expired
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Certifications</h2>
            <button
              onClick={() => setShowCertForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <KeyRound className="w-4 h-4" /> Add Certification
            </button>
          </div>
          {showCertForm && (
            <CertificationForm
              personnel={personnel}
              onClose={() => setShowCertForm(false)}
              onSuccess={() => {
                router.refresh()
                setShowCertForm(false)
              }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Institution / Name</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Issue</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Expiry</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {certifications.map((c) => {
                  const isExpired = c.expiry_date && c.expiry_date < today
                  const isExpiringSoon = c.expiry_date && c.expiry_date >= today && c.expiry_date <= in30Days
                  return (
                    <tr key={c.id} className={isExpired ? 'bg-red-500/5' : isExpiringSoon ? 'bg-yellow-500/5' : ''}>
                      <td className="px-4 py-2 text-zinc-900 dark:text-white">
                        <Link
                          href={`/dashboard/hr/personnel/${c.personnel_id}`}
                          className="text-[#C27E00] hover:underline"
                        >
                          {c.personnel?.full_name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">
                        {CERT_TYPES[c.certification_type] ?? c.certification_type}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{c.institution || c.name || '—'}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{c.issue_date ? new Date(c.issue_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2">
                        <span className={isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : 'text-zinc-500 dark:text-gray-400'}>
                          {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-zinc-600 dark:text-gray-300">
                          {CERT_STATUSES[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/dashboard/hr/personnel/${c.personnel_id}`}
                          className="text-[#C27E00] hover:underline text-xs mr-2"
                        >
                          View
                        </Link>
                        <form
                          action={async () => {
                            if (confirm('Delete this certification?')) {
                              await deleteCertification(c.id)
                              router.refresh()
                            }
                          }}
                          className="inline"
                        >
                          <button type="submit" className="text-zinc-500 dark:text-gray-400 hover:text-red-400 p-1" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {certifications.length === 0 && !showCertForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No certifications yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProgramForm({
  program,
  onClose,
  onSuccess,
}: {
  program: { id: string; name: string; description: string | null; category: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!program

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim()
    const description = (form.elements.namedItem('description') as HTMLInputElement).value.trim()
    const category = (form.elements.namedItem('category') as HTMLSelectElement).value || undefined
    if (isEdit && program) {
      const result = await updateTrainingProgram(program.id, { name, description, category })
      if (result.error) setError(result.error)
      else onSuccess()
    } else {
      const result = await createTrainingProgram({ name, description, category })
      if (result.error) setError(result.error)
      else onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Program' : 'Add Program'}</h3>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Name</label>
        <input name="name" required defaultValue={program?.name} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Category</label>
        <select name="category" defaultValue={program?.category ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm [&>option]:bg-zinc-200 dark:bg-gray-900">
          <option value="">—</option>
          {PROGRAM_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Description</label>
        <textarea name="description" rows={2} defaultValue={program?.description ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}

function CompletionForm({
  programs,
  personnel,
  onClose,
  onSuccess,
}: {
  programs: { id: string; name: string }[]
  personnel: { id: string; full_name: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const personnelId = (form.elements.namedItem('personnel_id') as HTMLSelectElement).value
    const programId = (form.elements.namedItem('program_id') as HTMLSelectElement).value
    const result = await recordCompletion(personnelId, programId)
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">Record Completion</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm [&>option]:bg-zinc-200 dark:bg-gray-900" style={{ colorScheme: 'light' }}>
            <option value="">Select...</option>
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Program</label>
          <select name="program_id" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm [&>option]:bg-zinc-200 dark:bg-gray-900" style={{ colorScheme: 'light' }}>
            <option value="">Select...</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Record'}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}

function CertificationForm({
  personnel,
  onClose,
  onSuccess,
}: {
  personnel: { id: string; full_name: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const result = await createCertification({
      personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
      certification_type: (form.elements.namedItem('certification_type') as HTMLSelectElement).value,
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim() || undefined,
      institution: (form.elements.namedItem('institution') as HTMLInputElement).value.trim() || undefined,
      issue_date: (form.elements.namedItem('issue_date') as HTMLInputElement).value,
      expiry_date: (form.elements.namedItem('expiry_date') as HTMLInputElement).value || undefined,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value || undefined,
    })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">Add Certification</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm [&>option]:bg-zinc-200 dark:bg-gray-900" style={{ colorScheme: 'light' }}>
            <option value="">Select...</option>
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Type</label>
          <select name="certification_type" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm [&>option]:bg-zinc-200 dark:bg-gray-900" style={{ colorScheme: 'light' }}>
            {Object.entries(CERT_TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Institution</label>
          <input name="institution" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="Issuing organization" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Name</label>
          <input name="name" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="Certification name" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Issue Date</label>
          <input name="issue_date" type="date" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Expiry Date</label>
          <input name="expiry_date" type="date" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Status</label>
          <select name="status" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm [&>option]:bg-zinc-200 dark:bg-gray-900" style={{ colorScheme: 'light' }}>
            {Object.entries(CERT_STATUSES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Add'}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
