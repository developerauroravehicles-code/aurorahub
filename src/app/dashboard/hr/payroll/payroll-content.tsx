'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createCompensationStructure,
  updateCompensationStructure,
  deleteCompensationStructure,
  createPerCompletedTier,
  updatePerCompletedTier,
  deletePerCompletedTier,
  createPaymentRecord,
  createPaymentRecordFromPerCompleted,
  updatePaymentRecord,
  deletePaymentRecord,
  getCompletedDemandsForPeriod,
  calculatePayStub,
  calculatePayStubFromNet,
} from './actions'
import { calculatePerCompletedAmount, calculateGrossFromNet } from './payroll-utils'
import { Pencil, Trash2, Plus, DollarSign, Calculator, FileText, Loader2, Receipt } from 'lucide-react'

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  salary: 'Salary',
  hourly: 'Hourly',
  per_installation: 'Per Installation',
  per_completed_tiered: 'Per Completed (Tiered)',
  commission: 'Commission',
  bonus: 'Bonus',
  job_based: 'Job Based',
  dealer_commission: 'Dealer Commission',
  platform_commission: 'Platform Commission',
}

const PAY_STUB_STATUSES: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  processing: 'Processing',
  cancelled: 'Cancelled',
}

export function PayrollContent({
  structures,
  perCompletedTiers,
  payments,
  personnel,
}: {
  structures: {
    id: string
    personnel_id: string
    payment_type: string
    amount: number | null
    effective_from: string
    effective_to: string | null
    notes: string | null
    personnel: { full_name: string } | null
  }[]
  perCompletedTiers: {
    id: string
    personnel_id: string
    base_completed: number
    base_amount: number
    per_completed_amount: number
    currency: string | null
    effective_from: string
    effective_to: string | null
    notes: string | null
    personnel: { full_name: string } | null
  }[]
  payments: {
    id: string
    personnel_id: string
    amount: number
    currency: string | null
    payment_type: string | null
    period_start: string | null
    period_end: string | null
    completed_count: number | null
    deduction_metadata: Record<string, number> | null
    status: string
    paid_at: string | null
    notes: string | null
    personnel: { full_name: string } | null
  }[]
  personnel: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'structures' | 'per_completed' | 'payments' | 'paystub'>('structures')
  const [showStructureForm, setShowStructureForm] = useState(false)
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null)
  const [showTierForm, setShowTierForm] = useState(false)
  const [editingTierId, setEditingTierId] = useState<string | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showPerCompletedPaymentForm, setShowPerCompletedPaymentForm] = useState(false)
  const [viewingStubPayment, setViewingStubPayment] = useState<typeof payments[0] | null>(null)

  // Default period: current month
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('structures')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'structures' ? 'bg-white/10 text-white border border-b-0 border-gray-800' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Compensation
        </button>
        <button
          onClick={() => setActiveTab('per_completed')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'per_completed' ? 'bg-white/10 text-white border border-b-0 border-gray-800' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calculator className="w-4 h-4" /> Per-Completed Tiers
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'payments' ? 'bg-white/10 text-white border border-b-0 border-gray-800' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Receipt className="w-4 h-4" /> Payments
        </button>
        <button
          onClick={() => setActiveTab('paystub')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'paystub' ? 'bg-white/10 text-white border border-b-0 border-gray-800' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" /> Pay Stub
        </button>
      </div>

      {activeTab === 'structures' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Compensation Structures</h2>
            <button
              onClick={() => { setEditingStructureId(null); setShowStructureForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {showStructureForm && (
            <CompensationForm
              personnel={personnel}
              structure={editingStructureId ? structures.find((s) => s.id === editingStructureId) : null}
              onClose={() => { setShowStructureForm(false); setEditingStructureId(null) }}
              onSuccess={() => { router.refresh(); setShowStructureForm(false); setEditingStructureId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-gray-400">Amount</th>
                  <th className="px-4 py-2 text-left text-gray-400">Effective</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {structures.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-white">
                      <Link href={`/dashboard/hr/personnel/${s.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {s.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-300">{PAYMENT_TYPE_LABELS[s.payment_type] ?? s.payment_type}</td>
                    <td className="px-4 py-2 text-gray-300">{s.amount != null ? `${Number(s.amount).toLocaleString('en-CA')} CAD` : '—'}</td>
                    <td className="px-4 py-2 text-gray-400">
                      {new Date(s.effective_from).toLocaleDateString()}
                      {s.effective_to ? ` – ${new Date(s.effective_to).toLocaleDateString()}` : ' – ongoing'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingStructureId(s.id); setShowStructureForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteCompensationStructure(s.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {structures.length === 0 && !showStructureForm && <p className="text-gray-500 py-6 text-center">No compensation structures.</p>}
          </div>
        </div>
      )}

      {activeTab === 'per_completed' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Per-Completed Tiered Pay</h2>
            <button
              onClick={() => { setEditingTierId(null); setShowTierForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> Add Tier
            </button>
          </div>
          <p className="text-gray-400 text-sm mb-4">Tier amounts are NET (after deductions). E.g. First 15 completed = 2,000 CAD net, +50 CAD net for each additional. Gross is calculated automatically.</p>
          {showTierForm && (
            <PerCompletedTierForm
              personnel={personnel}
              tier={editingTierId ? perCompletedTiers.find((t) => t.id === editingTierId) : null}
              onClose={() => { setShowTierForm(false); setEditingTierId(null) }}
              onSuccess={() => { router.refresh(); setShowTierForm(false); setEditingTierId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Base</th>
                  <th className="px-4 py-2 text-left text-gray-400">Base Amount</th>
                  <th className="px-4 py-2 text-left text-gray-400">Per Additional</th>
                  <th className="px-4 py-2 text-left text-gray-400">Effective</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {perCompletedTiers.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 text-white">
                      <Link href={`/dashboard/hr/personnel/${t.personnel_id}`} className="text-[#C27E00] hover:underline">
                        {t.personnel?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-300">First {t.base_completed} completed</td>
                    <td className="px-4 py-2 text-gray-300">{Number(t.base_amount).toLocaleString('en-CA')} CAD net</td>
                    <td className="px-4 py-2 text-gray-300">+{Number(t.per_completed_amount).toLocaleString('en-CA')} CAD net each</td>
                    <td className="px-4 py-2 text-gray-400">
                      {new Date(t.effective_from).toLocaleDateString()}
                      {t.effective_to ? ` – ${new Date(t.effective_to).toLocaleDateString()}` : ' – ongoing'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingTierId(t.id); setShowTierForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deletePerCompletedTier(t.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {perCompletedTiers.length === 0 && !showTierForm && <p className="text-gray-500 py-6 text-center">No per-completed tiers. Add one for installer pay structure.</p>}
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Payment Records</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPerCompletedPaymentForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
              >
                <Calculator className="w-4 h-4" /> From Per-Completed
              </button>
              <button
                onClick={() => setShowPaymentForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 text-white text-sm hover:bg-white/20 border border-gray-700"
              >
                <Plus className="w-4 h-4" /> Manual Payment
              </button>
            </div>
          </div>
          {showPaymentForm && (
            <ManualPaymentForm
              personnel={personnel}
              onClose={() => setShowPaymentForm(false)}
              onSuccess={() => { router.refresh(); setShowPaymentForm(false) }}
            />
          )}
          {showPerCompletedPaymentForm && (
            <PerCompletedPaymentForm
              personnel={personnel}
              perCompletedTiers={perCompletedTiers}
              defaultPeriod={{ start: firstDay, end: lastDay }}
              onClose={() => setShowPerCompletedPaymentForm(false)}
              onSuccess={() => { router.refresh(); setShowPerCompletedPaymentForm(false) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Personnel</th>
                  <th className="px-4 py-2 text-left text-gray-400">Period</th>
                  <th className="px-4 py-2 text-left text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-gray-400">Net (CAD)</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payments.map((p) => {
                  const meta = p.deduction_metadata
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-white">
                        <Link href={`/dashboard/hr/personnel/${p.personnel_id}`} className="text-[#C27E00] hover:underline">
                          {p.personnel?.full_name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {p.period_start && p.period_end
                          ? `${new Date(p.period_start).toLocaleDateString()} – ${new Date(p.period_end).toLocaleDateString()}`
                          : '—'}
                        {p.completed_count != null && <span className="block text-xs text-gray-500">({p.completed_count} completed)</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-300">{PAYMENT_TYPE_LABELS[p.payment_type ?? ''] ?? p.payment_type ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-300">{Number(p.amount).toLocaleString('en-CA')}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                          {PAY_STUB_STATUSES[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {meta && (
                          <button type="button" onClick={() => { setViewingStubPayment(p); setActiveTab('paystub') }} className="text-[#C27E00] hover:underline text-xs mr-2">
                            Stub
                          </button>
                        )}
                        <form action={async () => { if (confirm('Delete?')) { await deletePaymentRecord(p.id); router.refresh() } }} className="inline">
                          <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {payments.length === 0 && !showPaymentForm && !showPerCompletedPaymentForm && <p className="text-gray-500 py-6 text-center">No payments yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'paystub' && (
        <div className="space-y-6">
          {viewingStubPayment?.deduction_metadata && (
            <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Pay Stub: {viewingStubPayment.personnel?.full_name}</h2>
              <p className="text-gray-400 text-sm mb-4">
                {viewingStubPayment.period_start && viewingStubPayment.period_end
                  ? `Period: ${new Date(viewingStubPayment.period_start).toLocaleDateString()} – ${new Date(viewingStubPayment.period_end).toLocaleDateString()}`
                  : ''}
                {viewingStubPayment.completed_count != null && ` • ${viewingStubPayment.completed_count} completed`}
              </p>
              <PayStubDisplay meta={viewingStubPayment.deduction_metadata} />
              <button type="button" onClick={() => setViewingStubPayment(null)} className="mt-4 text-gray-400 hover:text-white text-sm">
                Close
              </button>
            </div>
          )}
          <PayStubCalculator />
        </div>
      )}
    </div>
  )
}

function CompensationForm({ personnel, structure, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  structure: { id: string; personnel_id: string; payment_type: string; amount: number | null; effective_from: string; effective_to: string | null; notes: string | null } | null | undefined
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
    const result = structure
      ? await updateCompensationStructure(structure.id, {
          amount: parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value) || undefined,
          effective_to: (form.elements.namedItem('effective_to') as HTMLInputElement).value || undefined,
          notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined,
        })
      : await createCompensationStructure({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          payment_type: (form.elements.namedItem('payment_type') as HTMLSelectElement).value,
          amount: parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value) || undefined,
          effective_from: (form.elements.namedItem('effective_from') as HTMLInputElement).value,
          effective_to: (form.elements.namedItem('effective_to') as HTMLInputElement).value || undefined,
          notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{structure ? 'Edit Compensation' : 'Add Compensation'}</h3>
      {!structure && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Personnel</label>
            <select name="personnel_id" required className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
              <option value="">Select...</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Payment Type</label>
            <select name="payment_type" defaultValue={structure?.payment_type ?? 'salary'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
              {Object.entries(PAYMENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount (CAD)</label>
          <input name="amount" type="number" step="0.01" min="0" defaultValue={structure?.amount ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. 2000" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Effective From</label>
          <input name="effective_from" type="date" required defaultValue={structure?.effective_from ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Effective To (optional)</label>
          <input name="effective_to" type="date" defaultValue={structure?.effective_to ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={structure?.notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (structure ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function PerCompletedTierForm({ personnel, tier, onClose, onSuccess }: {
  personnel: { id: string; full_name: string }[]
  tier: { id: string; personnel_id: string; base_completed: number; base_amount: number; per_completed_amount: number; effective_from: string; effective_to: string | null; notes: string | null } | null | undefined
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
    const baseCompleted = parseInt((form.elements.namedItem('base_completed') as HTMLInputElement).value, 10) || 15
    const baseAmount = parseFloat((form.elements.namedItem('base_amount') as HTMLInputElement).value) || 2000
    const perCompletedAmount = parseFloat((form.elements.namedItem('per_completed_amount') as HTMLInputElement).value) || 50
    const result = tier
      ? await updatePerCompletedTier(tier.id, { base_completed: baseCompleted, base_amount: baseAmount, per_completed_amount: perCompletedAmount, effective_to: (form.elements.namedItem('effective_to') as HTMLInputElement).value || undefined, notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined })
      : await createPerCompletedTier({
          personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
          base_completed: baseCompleted,
          base_amount: baseAmount,
          per_completed_amount: perCompletedAmount,
          effective_from: (form.elements.namedItem('effective_from') as HTMLInputElement).value,
          effective_to: (form.elements.namedItem('effective_to') as HTMLInputElement).value || undefined,
          notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined,
        })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{tier ? 'Edit Tier' : 'Add Per-Completed Tier'}</h3>
      {!tier && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Personnel</label>
            <select name="personnel_id" required className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
              <option value="">Select...</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Base Completed (e.g. 15)</label>
          <input name="base_completed" type="number" min="1" defaultValue={tier?.base_completed ?? 15} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Base Amount NET (CAD) — for first N</label>
          <input name="base_amount" type="number" step="0.01" min="0" defaultValue={tier?.base_amount ?? 2000} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="2000" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Per Additional NET (CAD) — each</label>
          <input name="per_completed_amount" type="number" step="0.01" min="0" defaultValue={tier?.per_completed_amount ?? 50} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="50" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Effective From</label>
          <input name="effective_from" type="date" required defaultValue={tier?.effective_from ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Effective To (optional)</label>
          <input name="effective_to" type="date" defaultValue={tier?.effective_to ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={tier?.notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (tier ? 'Save' : 'Add')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function ManualPaymentForm({ personnel, onClose, onSuccess }: { personnel: { id: string; full_name: string }[]; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const targetNet = parseFloat((form.elements.namedItem('gross') as HTMLInputElement).value)
    if (!targetNet || targetNet <= 0) { setError('Enter a valid Net amount'); setLoading(false); return }
    const result = await createPaymentRecord({
      personnel_id: (form.elements.namedItem('personnel_id') as HTMLSelectElement).value,
      amount: targetNet,
      payment_type: (form.elements.namedItem('payment_type') as HTMLSelectElement).value || undefined,
      period_start: (form.elements.namedItem('period_start') as HTMLInputElement).value || undefined,
      period_end: (form.elements.namedItem('period_end') as HTMLInputElement).value || undefined,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value || 'pending',
      notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value.trim() || undefined,
    })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">Manual Payment (Target Net → Gross calculated)</h3>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Personnel</label>
        <select name="personnel_id" required className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
          <option value="">Select...</option>
          {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target Net (CAD) — after deductions</label>
          <input name="gross" type="number" step="0.01" min="0.01" required className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. 2000" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <select name="payment_type" className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            {Object.entries(PAYMENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Period Start</label>
          <input name="period_start" type="date" className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Period End</label>
          <input name="period_end" type="date" className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select name="status" defaultValue="pending" className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            {Object.entries(PAY_STUB_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div><label className="block text-xs text-gray-400 mb-1">Notes</label><textarea name="notes" rows={2} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" /></div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Create'}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function PerCompletedPaymentForm({
  personnel,
  perCompletedTiers,
  defaultPeriod,
  onClose,
  onSuccess,
}: {
  personnel: { id: string; full_name: string }[]
  perCompletedTiers: { id: string; personnel_id: string; base_completed: number; base_amount: number; per_completed_amount: number; personnel: { full_name: string } | null }[]
  defaultPeriod: { start: string; end: string }
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [personnelId, setPersonnelId] = useState('')
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start)
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end)
  const [tierId, setTierId] = useState('')
  const [completedCount, setCompletedCount] = useState<number | null>(null)
  const [completedDemands, setCompletedDemands] = useState<{ id: string; demand_number: string | null; customer: string; vehicle: string; date: string }[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchingCount, setFetchingCount] = useState(false)

  const availableTiers = perCompletedTiers.filter((t) => t.personnel_id === personnelId)

  async function fetchCompletedCount() {
    if (!personnelId || !periodStart || !periodEnd) return
    setFetchingCount(true)
    setFetchError(null)
    const { count, demands, error } = await getCompletedDemandsForPeriod(personnelId, periodStart, periodEnd)
    setCompletedCount(count)
    setCompletedDemands(demands)
    setFetchError(error ?? null)
    setFetchingCount(false)
  }

  // Auto-fetch completed demands when personnel and period are set
  useEffect(() => {
    if (personnelId && periodStart && periodEnd) {
      fetchCompletedCount()
    } else {
      setCompletedCount(null)
      setCompletedDemands([])
      setFetchError(null)
    }
  }, [personnelId, periodStart, periodEnd])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tierId) { setError('Select a tier'); return }
    setLoading(true)
    setError('')
    const result = await createPaymentRecordFromPerCompleted({
      personnel_id: personnelId,
      period_start: periodStart,
      period_end: periodEnd,
      tier_id: tierId,
    })
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">Create Payment from Per-Completed</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Personnel</label>
          <select
            name="personnel_id"
            value={personnelId}
            onChange={(e) => {
              const pid = e.target.value
              setPersonnelId(pid)
              const first = perCompletedTiers.find((t) => t.personnel_id === pid)
              setTierId(first?.id ?? '')
              setCompletedCount(null)
              setCompletedDemands([])
              setFetchError(null)
            }}
            required
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm"
          >
            <option value="">Select...</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tier</label>
          <select
            name="tier_id"
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            required
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm"
          >
            <option value="">Select...</option>
            {availableTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.personnel?.full_name} – {t.base_completed} @ {Number(t.base_amount).toLocaleString()} net + {Number(t.per_completed_amount).toLocaleString()} net/each
              </option>
            ))}
          </select>
          {availableTiers.length === 0 && personnelId && <p className="text-amber-400 text-xs mt-1">No tier for this personnel. Add one in Per-Completed Tiers.</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Period Start</label>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Period End</label>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div className="space-y-2">
        {fetchError && <p className="text-amber-400 text-sm">{fetchError}</p>}
        <div className="flex items-center gap-3">
          {fetchingCount ? (
            <span className="text-gray-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Fetching completed count from demands...</span>
          ) : completedCount !== null ? (
            <span className="text-gray-300 text-sm">
              <strong className="text-white">{completedCount}</strong> completed in this period
              <button type="button" onClick={fetchCompletedCount} className="ml-2 text-[#C27E00] hover:underline text-xs">Refresh</button>
            </span>
          ) : personnelId && periodStart && periodEnd ? (
            <span className="text-gray-500 text-sm">Loading...</span>
          ) : null}
        </div>
        {completedDemands.length > 0 && (
          <details className="mt-2">
            <summary className="text-gray-400 text-sm cursor-pointer hover:text-white">Show completed demands ({completedDemands.length})</summary>
            <div className="mt-2 max-h-48 overflow-y-auto rounded bg-black/30 border border-gray-700 p-2 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Customer</th>
                    <th className="py-1 pr-2">Vehicle</th>
                    <th className="py-1">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {completedDemands.map((d) => (
                    <tr key={d.id} className="text-gray-300 border-t border-gray-800">
                      <td className="py-1 pr-2">{d.demand_number || d.id.slice(0, 8)}</td>
                      <td className="py-1 pr-2">{d.customer}</td>
                      <td className="py-1 pr-2">{d.vehicle}</td>
                      <td className="py-1">{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
      {tierId && completedCount !== null && (() => {
        const tier = availableTiers.find((t) => t.id === tierId)
        if (!tier) return null
        const targetNet = calculatePerCompletedAmount(tier.base_completed, tier.base_amount, tier.per_completed_amount, completedCount)
        const gross = calculateGrossFromNet(targetNet)
        return (
          <p className="text-green-400 text-sm">
            Target Net: {targetNet.toLocaleString('en-CA')} CAD → Gross: {gross.toLocaleString('en-CA')} CAD
          </p>
        )
      })()}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !tierId} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Create Payment'}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function PayStubDisplay({ meta }: { meta: Record<string, number> }) {
  const gross = meta.gross ?? 0
  const cpp = meta.cpp ?? 0
  const ei = meta.ei ?? 0
  const federalTax = meta.federal_tax ?? 0
  const provincialTax = meta.provincial_tax ?? 0
  const net = meta.net ?? 0
  const totalDeductions = cpp + ei + federalTax + provincialTax
  return (
    <dl className="space-y-2 text-sm max-w-md">
      <div className="flex justify-between"><dt className="text-gray-400">Gross Earnings</dt><dd className="text-white">{gross.toLocaleString('en-CA')} CAD</dd></div>
      <div className="flex justify-between"><dt className="text-gray-400">CPP</dt><dd className="text-red-400">-{cpp.toLocaleString('en-CA')}</dd></div>
      <div className="flex justify-between"><dt className="text-gray-400">EI</dt><dd className="text-red-400">-{ei.toLocaleString('en-CA')}</dd></div>
      <div className="flex justify-between"><dt className="text-gray-400">Federal Tax</dt><dd className="text-red-400">-{federalTax.toLocaleString('en-CA')}</dd></div>
      <div className="flex justify-between"><dt className="text-gray-400">Provincial Tax (ON)</dt><dd className="text-red-400">-{provincialTax.toLocaleString('en-CA')}</dd></div>
      <div className="flex justify-between border-t border-gray-700 pt-2 mt-2"><dt className="text-gray-300 font-medium">Net Pay</dt><dd className="text-green-400 font-medium">{net.toLocaleString('en-CA')} CAD</dd></div>
    </dl>
  )
}

function PayStubCalculator() {
  const [inputValue, setInputValue] = useState<string>('')
  const [mode, setMode] = useState<'net' | 'gross'>('net')
  const [result, setResult] = useState<Awaited<ReturnType<typeof calculatePayStub>> | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCalculate() {
    const val = parseFloat(inputValue)
    if (!val || val <= 0) return
    setLoading(true)
    const r = mode === 'net' ? await calculatePayStubFromNet(val) : await calculatePayStub(val)
    setResult(r)
    setLoading(false)
  }

  return (
    <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Canadian Pay Stub (Bodro) Calculator</h2>
      <p className="text-gray-400 text-sm mb-4">Enter Net or Gross — CPP, EI, federal/provincial tax (Ontario). Bi-weekly.</p>
      <div className="flex gap-4 items-end mb-6 flex-wrap">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            {mode === 'net' ? 'Target Net (CAD)' : 'Gross (CAD)'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCalculate()}
            className="w-40 rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm"
            placeholder={mode === 'net' ? 'e.g. 2000' : 'e.g. 2500'}
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('net')} className={`px-3 py-2 rounded text-sm ${mode === 'net' ? 'bg-[#C27E00] text-white' : 'bg-white/10 text-gray-400'}`}>Net</button>
          <button type="button" onClick={() => setMode('gross')} className={`px-3 py-2 rounded text-sm ${mode === 'gross' ? 'bg-[#C27E00] text-white' : 'bg-white/10 text-gray-400'}`}>Gross</button>
        </div>
        <button onClick={handleCalculate} disabled={loading} className="px-4 py-2 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900] disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calculate'}
        </button>
      </div>
      {result && (
        <div className="rounded-lg border border-gray-700 bg-black/30 p-4 max-w-md">
          <h3 className="text-white font-medium mb-3">Pay Stub Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-400">Gross Earnings</dt><dd className="text-white">{result.gross.toLocaleString('en-CA')} CAD</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">CPP</dt><dd className="text-red-400">-{result.cpp.toLocaleString('en-CA')}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">EI</dt><dd className="text-red-400">-{result.ei.toLocaleString('en-CA')}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Federal Tax</dt><dd className="text-red-400">-{result.federal_tax.toLocaleString('en-CA')}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Provincial Tax (ON)</dt><dd className="text-red-400">-{result.provincial_tax.toLocaleString('en-CA')}</dd></div>
            <div className="flex justify-between border-t border-gray-700 pt-2 mt-2"><dt className="text-gray-300 font-medium">Net Pay</dt><dd className="text-green-400 font-medium">{result.net.toLocaleString('en-CA')} CAD</dd></div>
          </dl>
        </div>
      )}
    </div>
  )
}
