'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createEquipmentType,
  updateEquipmentType,
  deleteEquipmentType,
  createEquipmentAssignment,
  updateEquipmentAssignment,
  returnEquipment,
  deleteEquipmentAssignment,
} from './actions'
import { Pencil, Trash2, Plus, Package, ClipboardList, Loader2, RotateCcw } from 'lucide-react'

const EQUIPMENT_CATEGORIES: Record<string, string> = {
  tools: 'Installation Tools',
  dashcam_demo: 'Dashcam Demo',
  testing: 'Testing Equipment',
  vehicle_equipment: 'Vehicle Equipment',
  safety: 'Safety Gear',
  other: 'Other',
}

export function EquipmentContent({
  types,
  assignments,
  personnel,
}: {
  types: { id: string; name: string; category: string | null }[]
  assignments: {
    id: string
    personnel_id: string
    equipment_type_id: string | null
    item_name: string | null
    serial_number: string | null
    assigned_at: string
    returned_at: string | null
    condition: string | null
    notes: string | null
    personnel: { full_name: string } | null
    equipment_types: { name: string } | null
  }[]
  personnel: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'types' | 'assignments'>('types')
  const [assignFilter, setAssignFilter] = useState<'all' | 'active' | 'returned'>('active')
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [editingAssignId, setEditingAssignId] = useState<string | null>(null)

  const filteredAssignments =
    assignFilter === 'active'
      ? assignments.filter((a) => !a.returned_at)
      : assignFilter === 'returned'
        ? assignments.filter((a) => a.returned_at)
        : assignments
  const activeCount = assignments.filter((a) => !a.returned_at).length

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'types'
              ? 'bg-white/10 text-white border border-b-0 border-gray-800'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Package className="w-4 h-4" /> Equipment Types
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'assignments'
              ? 'bg-white/10 text-white border border-b-0 border-gray-800'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Assignments
        </button>
      </div>

      {activeTab === 'types' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Equipment Types</h2>
            <button
              onClick={() => { setEditingTypeId(null); setShowTypeForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Type
            </button>
          </div>
          {showTypeForm && (
            <TypeForm
              type={editingTypeId ? types.find((t) => t.id === editingTypeId) : null}
              onClose={() => { setShowTypeForm(false); setEditingTypeId(null) }}
              onSuccess={() => { router.refresh(); setShowTypeForm(false); setEditingTypeId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Name</th>
                  <th className="px-4 py-2 text-left text-gray-400">Category</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {types.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 text-white">{t.name}</td>
                    <td className="px-4 py-2 text-gray-400">{EQUIPMENT_CATEGORIES[t.category ?? ''] ?? t.category ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingTypeId(t.id); setShowTypeForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete this type? Assignments will keep item_name if set.')) { await deleteEquipmentType(t.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {types.length === 0 && !showTypeForm && (
              <p className="text-gray-500 py-6 text-center">No equipment types. Add dashcam demo, tools, testing equipment, etc.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          {activeCount > 0 && (
            <div className="mb-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-2 rounded text-sm">
              {activeCount} active assignment(s)
            </div>
          )}
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex gap-2">
              {(['active', 'returned', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAssignFilter(f)}
                  className={`px-3 py-1.5 rounded text-sm ${assignFilter === f ? 'bg-[#C27E00] text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                >
                  {f === 'active' && 'Active'}
                  {f === 'returned' && 'Returned'}
                  {f === 'all' && 'All'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setEditingAssignId(null); setShowAssignForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Assign Equipment
            </button>
          </div>
          {showAssignForm && (
            <AssignmentForm
              personnel={personnel}
              types={types}
              assignment={editingAssignId ? assignments.find((a) => a.id === editingAssignId) : null}
              onClose={() => { setShowAssignForm(false); setEditingAssignId(null) }}
              onSuccess={() => { router.refresh(); setShowAssignForm(false); setEditingAssignId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Equipment</th>
                  <th className="px-4 py-2 text-left text-gray-400">Serial</th>
                  <th className="px-4 py-2 text-left text-gray-400">Assigned</th>
                  <th className="px-4 py-2 text-left text-gray-400">Returned</th>
                  <th className="px-4 py-2 text-left text-gray-400">Condition</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredAssignments.map((a) => (
                  <tr key={a.id} className={a.returned_at ? 'opacity-70' : ''}>
                    <td className="px-4 py-2 text-white">
                      <Link href={`/dashboard/hr/personnel/${a.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {a.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-300">{a.equipment_types?.name ?? a.item_name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{a.serial_number ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{new Date(a.assigned_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-400">{a.returned_at ? new Date(a.returned_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{a.condition ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {!a.returned_at && (
                        <form action={async () => { await returnEquipment(a.id); router.refresh() }} className="inline mr-1">
                          <button type="submit" className="p-1.5 text-gray-400 hover:text-green-400" title="Mark returned">
                            <RotateCcw className="w-4 h-4 inline" />
                          </button>
                        </form>
                      )}
                      <button onClick={() => { setEditingAssignId(a.id); setShowAssignForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete this assignment?')) { await deleteEquipmentAssignment(a.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAssignments.length === 0 && !showAssignForm && (
              <p className="text-gray-500 py-6 text-center">
                {assignFilter === 'active' ? 'No active assignments.' : assignFilter === 'returned' ? 'No returned items.' : 'No assignments yet.'} Assign equipment to personnel.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TypeForm({ type, onClose, onSuccess }: {
  type: { id: string; name: string; category: string | null } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!type

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
      category: (form.elements.namedItem('category') as HTMLSelectElement).value || undefined,
    }
    const result = type
      ? await updateEquipmentType(type.id, data)
      : await createEquipmentType(data)
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Type' : 'Add Equipment Type'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input name="name" required defaultValue={type?.name ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. Dashcam Demo Unit" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <select name="category" defaultValue={type?.category ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            <option value="">—</option>
            {Object.entries(EQUIPMENT_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
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

function AssignmentForm({ personnel, types, assignment, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  types: { id: string; name: string }[]
  assignment: {
    id: string
    personnel_id: string
    equipment_type_id: string | null
    item_name: string | null
    serial_number: string | null
    assigned_at: string
    condition: string | null
    notes: string | null
  } | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!assignment

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const baseData = {
      equipment_type_id: (form.elements.namedItem('equipment_type_id') as HTMLSelectElement).value || undefined,
      item_name: (form.elements.namedItem('item_name') as HTMLInputElement).value.trim() || undefined,
      serial_number: (form.elements.namedItem('serial_number') as HTMLInputElement).value.trim() || undefined,
      assigned_at: (form.elements.namedItem('assigned_at') as HTMLInputElement).value,
      condition: (form.elements.namedItem('condition') as HTMLInputElement).value.trim() || undefined,
      notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined,
    }
    const result = assignment
      ? await updateEquipmentAssignment(assignment.id, baseData)
      : await createEquipmentAssignment({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          ...baseData,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Assignment' : 'Assign Equipment'}</h3>
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
          <label className="block text-xs text-gray-400 mb-1">Equipment Type</label>
          <select name="equipment_type_id" defaultValue={assignment?.equipment_type_id ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            <option value="">— Or use custom name below</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Item Name (if no type)</label>
          <input name="item_name" defaultValue={assignment?.item_name ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="Custom equipment name" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Serial Number</label>
          <input name="serial_number" defaultValue={assignment?.serial_number ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Assigned Date</label>
          <input name="assigned_at" type="date" required defaultValue={assignment?.assigned_at ?? new Date().toISOString().split('T')[0]} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Condition</label>
          <input name="condition" defaultValue={assignment?.condition ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. Good, New" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={assignment?.notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Assign')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}
