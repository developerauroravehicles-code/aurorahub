'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createComplianceDocument,
  updateComplianceDocument,
  deleteComplianceDocument,
  markDocumentVerified,
  createComplianceChecklist,
  updateComplianceChecklist,
  deleteComplianceChecklist,
} from './actions'
import { Pencil, Trash2, Plus, FileText, CheckSquare, Loader2, ExternalLink, Check } from 'lucide-react'

const DOCUMENT_TYPES: Record<string, string> = {
  work_permit: 'Work Permit',
  sin: 'SIN',
  driver_license: 'Driver\'s License',
  insurance: 'Insurance',
  safety_cert: 'Safety Certification',
  provincial_license: 'Provincial License',
  wsib: 'WSIB',
  other: 'Other',
}

const PROVINCES: Record<string, string> = {
  ontario: 'Ontario',
  british_columbia: 'British Columbia',
  alberta: 'Alberta',
  quebec: 'Quebec',
  manitoba: 'Manitoba',
  saskatchewan: 'Saskatchewan',
  nova_scotia: 'Nova Scotia',
  new_brunswick: 'New Brunswick',
  newfoundland: 'Newfoundland',
  pei: 'PEI',
  yukon: 'Yukon',
  nwt: 'NWT',
  nunavut: 'Nunavut',
  out_of_canada: 'Out of Canada',
}

export function ComplianceContent({
  documents,
  checklists,
  personnel,
}: {
  documents: {
    id: string
    personnel_id: string
    document_type: string | null
    title: string | null
    province: string | null
    document_url: string | null
    expiry_date: string | null
    verified_at: string | null
    personnel: { full_name: string } | null
  }[]
  checklists: {
    id: string
    personnel_id: string
    item_name: string
    completed: boolean
    completed_at: string | null
    notes: string | null
    personnel: { full_name: string } | null
  }[]
  personnel: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'documents' | 'checklists'>('documents')
  const [showDocForm, setShowDocForm] = useState(false)
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [showChecklistForm, setShowChecklistForm] = useState(false)
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const expiringSoon = documents.filter(
    (d) => d.expiry_date && d.expiry_date >= today && d.expiry_date <= in30Days
  )
  const expired = documents.filter((d) => d.expiry_date && d.expiry_date < today)
  const pendingChecklists = checklists.filter((c) => !c.completed)

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'bg-white/10 text-white border border-b-0 border-gray-800'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" /> Documents
        </button>
        <button
          onClick={() => setActiveTab('checklists')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'checklists'
              ? 'bg-white/10 text-white border border-b-0 border-gray-800'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> Checklists
        </button>
      </div>

      {activeTab === 'documents' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          {(expiringSoon.length > 0 || expired.length > 0) && (
            <div className="mb-4 space-y-2">
              {expiringSoon.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-2 rounded text-sm">
                  {expiringSoon.length} document(s) expiring within 30 days
                </div>
              )}
              {expired.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded text-sm">
                  {expired.length} document(s) expired
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Compliance Documents</h2>
            <button
              onClick={() => { setEditingDocId(null); setShowDocForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Document
            </button>
          </div>
          {showDocForm && (
            <DocumentForm
              personnel={personnel}
              doc={editingDocId ? documents.find((d) => d.id === editingDocId) : null}
              onClose={() => { setShowDocForm(false); setEditingDocId(null) }}
              onSuccess={() => { router.refresh(); setShowDocForm(false); setEditingDocId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left text-gray-400">Province</th>
                  <th className="px-4 py-2 text-left text-gray-400">Expiry</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {documents.map((d) => {
                  const isExpired = d.expiry_date && d.expiry_date < today
                  const isExpiringSoon = d.expiry_date && d.expiry_date >= today && d.expiry_date <= in30Days
                  return (
                    <tr key={d.id} className={isExpired ? 'bg-red-500/5' : isExpiringSoon ? 'bg-yellow-500/5' : ''}>
                      <td className="px-4 py-2 text-white">
                        <Link href={`/dashboard/hr/personnel/${d.personnel_id}`} className="text-[#C27E00] hover:underline">
                          {d.personnel?.full_name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-300">{DOCUMENT_TYPES[d.document_type ?? ''] ?? d.document_type ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-300">{d.title || '—'}</td>
                      <td className="px-4 py-2 text-gray-400">{d.province ? PROVINCES[d.province] ?? d.province : '—'}</td>
                      <td className="px-4 py-2">
                        <span className={isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : 'text-gray-400'}>
                          {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {d.verified_at ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">Verified</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {d.document_url && (
                          <a href={d.document_url} target="_blank" rel="noopener noreferrer" className="text-[#C27E00] hover:underline text-xs mr-2 inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Link
                          </a>
                        )}
                        {!d.verified_at && (
                          <form action={async () => { await markDocumentVerified(d.id); router.refresh() }} className="inline mr-1">
                            <button type="submit" className="p-1.5 text-gray-400 hover:text-green-400" title="Mark verified">
                              <Check className="w-4 h-4 inline" />
                            </button>
                          </form>
                        )}
                        <button onClick={() => { setEditingDocId(d.id); setShowDocForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                          <Pencil className="w-4 h-4 inline" />
                        </button>
                        <form action={async () => { if (confirm('Delete this document?')) { await deleteComplianceDocument(d.id); router.refresh() } }} className="inline">
                          <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {documents.length === 0 && !showDocForm && (
              <p className="text-gray-500 py-6 text-center">No compliance documents. Add work permits, SIN, driver licenses, insurance, etc.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'checklists' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          {pendingChecklists.length > 0 && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded text-sm">
              {pendingChecklists.length} pending checklist item(s)
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Compliance Checklists</h2>
            <button
              onClick={() => { setEditingChecklistId(null); setShowChecklistForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
          {showChecklistForm && (
            <ChecklistForm
              personnel={personnel}
              item={editingChecklistId ? checklists.find((c) => c.id === editingChecklistId) : null}
              onClose={() => { setShowChecklistForm(false); setEditingChecklistId(null) }}
              onSuccess={() => { router.refresh(); setShowChecklistForm(false); setEditingChecklistId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Item</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-gray-400">Completed</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {checklists.map((c) => (
                  <tr key={c.id} className={c.completed ? 'opacity-70' : ''}>
                    <td className="px-4 py-2 text-white">
                      <Link href={`/dashboard/hr/personnel/${c.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {c.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-300">{c.item_name}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${c.completed ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {c.completed ? 'Done' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400">{c.completed_at ? new Date(c.completed_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {!c.completed && (
                        <form action={async () => { await updateComplianceChecklist(c.id, { completed: true }); router.refresh() }} className="inline mr-1">
                          <button type="submit" className="p-1.5 text-gray-400 hover:text-green-400" title="Mark done">
                            <Check className="w-4 h-4 inline" />
                          </button>
                        </form>
                      )}
                      <button onClick={() => { setEditingChecklistId(c.id); setShowChecklistForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteComplianceChecklist(c.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {checklists.length === 0 && !showChecklistForm && (
              <p className="text-gray-500 py-6 text-center">No checklist items. Add onboarding, provincial, or policy compliance items.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DocumentForm({ personnel, doc, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  doc: { id: string; personnel_id: string; document_type: string | null; title: string | null; province: string | null; document_url: string | null; expiry_date: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!doc

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const data = {
      document_type: (form.elements.namedItem('document_type') as HTMLSelectElement).value || undefined,
      title: (form.elements.namedItem('title') as HTMLInputElement).value.trim() || undefined,
      province: (form.elements.namedItem('province') as HTMLSelectElement).value || undefined,
      document_url: (form.elements.namedItem('document_url') as HTMLInputElement).value.trim() || undefined,
      expiry_date: (form.elements.namedItem('expiry_date') as HTMLInputElement).value || undefined,
    }
    const result = doc
      ? await updateComplianceDocument(doc.id, data)
      : await createComplianceDocument({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          ...data,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Document' : 'Add Document'}</h3>
      {!isEdit && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            <option value="">Select...</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Document Type</label>
          <select name="document_type" defaultValue={doc?.document_type ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            <option value="">—</option>
            {Object.entries(DOCUMENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input name="title" defaultValue={doc?.title ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Province</label>
          <select name="province" defaultValue={doc?.province ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            <option value="">—</option>
            {Object.entries(PROVINCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Expiry Date</label>
          <input name="expiry_date" type="date" defaultValue={doc?.expiry_date ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Document URL</label>
        <input name="document_url" type="url" defaultValue={doc?.document_url ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="https://..." />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function ChecklistForm({ personnel, item, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  item: { id: string; personnel_id: string; item_name: string; completed: boolean; notes: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!item

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const itemName = (form.elements.namedItem('item_name') as HTMLInputElement).value.trim()
    const notes = (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined
    const result = item
      ? await updateComplianceChecklist(item.id, { item_name: itemName, notes })
      : await createComplianceChecklist({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          item_name: itemName,
          notes,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Item' : 'Add Checklist Item'}</h3>
      {!isEdit && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Personnel</label>
          <select name="personnel_id" required className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            <option value="">Select...</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Item Name</label>
        <input name="item_name" required defaultValue={item?.item_name ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. WSIB registration, Safety training" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={item?.notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}
