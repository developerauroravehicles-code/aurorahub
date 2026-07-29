'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  UserCircle,
  CalendarDays,
  DollarSign,
  FileText,
  Award,
  Package,
  Clock,
  MessageSquare,
  ClipboardCheck,
  ExternalLink,
  Ticket,
  Plus,
  Receipt,
} from 'lucide-react'
import { requestLeave, createITRequest } from './actions'
import { SelfPayEstimatePanel } from './self-pay-estimate-panel'
import { SelfExpensesPanel } from './self-expenses-panel'
import type { SpecialistCompensationSnapshot } from '@/lib/specialist-compensation'
import type { SpecialistExpenseClaim } from '@/lib/specialist-expense-claims'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
  bereavement: 'Bereavement',
  parental: 'Parental',
  other: 'Other',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
}

const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

const CERT_TYPES: Record<string, string> = {
  dashcam_installation: 'Dashcam Installation',
  vehicle_electronics: 'Vehicle Electronics',
  safety_training: 'Safety Training',
  insurance_compliance: 'Insurance Compliance',
  customer_service: 'Customer Service',
  other: 'Other',
}

const DOC_TYPES: Record<string, string> = {
  work_permit: 'Work Permit',
  sin: 'SIN',
  driver_license: "Driver's License",
  insurance: 'Insurance',
  safety_cert: 'Safety Certification',
  provincial_license: 'Provincial License',
  wsib: 'WSIB',
  other: 'Other',
}

const PAYMENT_TYPES: Record<string, string> = {
  salary: 'Salary',
  hourly: 'Hourly',
  per_installation: 'Per Installation',
  per_completed_tiered: 'Per Completed (Tiered)',
  commission: 'Commission',
  bonus: 'Bonus',
  job_based: 'Job Based',
}

export function SelfPortalContent({
  profile,
  personnel,
  leaveRequests,
  payments,
  payEstimate,
  expenseClaims,
  equipment,
  certifications,
  complianceDocuments,
  complianceChecklists,
  availability,
  feedback,
  leaveBlocks,
  onboardingTasks,
}: {
  profile: { full_name?: string | null; phone?: string | null; role: string }
  personnel: { id: string; full_name?: string | null; phone?: string | null; email?: string | null; position?: string | null; status?: string | null; start_date?: string | null; province?: string | null } | null
  leaveRequests: { id: string; leave_type: string; start_date: string; end_date: string; status: string; notes?: string | null }[]
  payments: { id: string; amount: number; period_start: string | null; period_end: string | null; status: string; paid_at: string | null; payment_type: string | null; completed_count?: number | null }[]
  payEstimate: SpecialistCompensationSnapshot | null
  expenseClaims: SpecialistExpenseClaim[]
  equipment: { id: string; item_name?: string | null; serial_number?: string | null; assigned_at: string; condition?: string | null; equipment_types?: { name: string } | null }[]
  certifications: { id: string; certification_type: string; name?: string | null; institution?: string | null; issue_date: string; expiry_date: string | null; status?: string | null }[]
  complianceDocuments: { id: string; document_type: string | null; title: string | null; expiry_date: string | null; verified_at: string | null; document_url: string | null }[]
  complianceChecklists: { id: string; item_name: string; completed: boolean; completed_at: string | null; notes: string | null }[]
  availability: { id: string; day_of_week: number; start_time: string; end_time: string; is_available: boolean }[]
  feedback: { id: string; feedback_type: string | null; source: string | null; rating: number | null; comment: string | null; created_at: string }[]
  leaveBlocks: { id: string; start_date: string; end_date: string; reason?: string | null }[]
  onboardingTasks: { id: string; title: string; status: string; due_date: string | null; completed_at: string | null }[]
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'leave' | 'pay' | 'expenses' | 'documents' | 'certifications' | 'equipment' | 'schedule' | 'feedback' | 'onboarding' | 'it_request'>('profile')
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [leaveSuccess, setLeaveSuccess] = useState(false)
  const [itError, setItError] = useState<string | null>(null)
  const [itSuccess, setItSuccess] = useState(false)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [showItForm, setShowItForm] = useState(false)

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: UserCircle },
    { id: 'leave' as const, label: 'Leave', icon: CalendarDays },
    { id: 'pay' as const, label: 'Pay', icon: DollarSign },
    ...(profile.role === 'specialist'
      ? [{ id: 'expenses' as const, label: 'Expenses', icon: Receipt }]
      : []),
    { id: 'it_request' as const, label: 'IT Request', icon: Ticket },
    { id: 'documents' as const, label: 'Documents', icon: FileText },
    { id: 'certifications' as const, label: 'Certifications', icon: Award },
    { id: 'equipment' as const, label: 'Equipment', icon: Package },
    { id: 'schedule' as const, label: 'Schedule', icon: Clock },
    { id: 'feedback' as const, label: 'Feedback', icon: MessageSquare },
    { id: 'onboarding' as const, label: 'Onboarding', icon: ClipboardCheck },
  ]

  const today = new Date().toISOString().split('T')[0]
  const expiringCerts = certifications.filter((c) => c.expiry_date && c.expiry_date <= today)
  const expiringDocs = complianceDocuments.filter((d) => d.expiry_date && d.expiry_date <= today)
  const pendingChecklists = complianceChecklists.filter((c) => !c.completed)

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="-mx-1 flex gap-2 overflow-x-auto overflow-y-hidden border-b border-zinc-200 px-1 pb-2 dark:border-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t px-2.5 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${
                activeTab === tab.id
                  ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-b-0 border-zinc-200 dark:border-gray-800'
                  : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white hover:bg-zinc-200/50 dark:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'profile' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Full Name</p>
              <p className="text-zinc-900 dark:text-white">{profile.full_name ?? personnel?.full_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Phone</p>
              <p className="text-zinc-900 dark:text-white">{personnel?.phone ?? profile.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Email</p>
              <p className="text-zinc-900 dark:text-white">{personnel?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Position</p>
              <p className="text-zinc-900 dark:text-white">{personnel?.position ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Status</p>
              <p className="text-zinc-900 dark:text-white capitalize">{personnel?.status ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Start Date</p>
              <p className="text-zinc-900 dark:text-white">{personnel?.start_date ? new Date(personnel.start_date).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Province</p>
              <p className="text-zinc-900 dark:text-white capitalize">{personnel?.province?.replace('_', ' ') ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase">Role</p>
              <p className="text-zinc-900 dark:text-white capitalize">{profile.role?.replace('_', ' ')}</p>
            </div>
          </div>
          {personnel && (
            <div className="mt-6">
              <Link href={`/dashboard/hr/personnel/${personnel.id}`} className="text-sm text-[#C27E00] hover:underline flex items-center gap-1">
                View full HR record <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Leave Requests</h2>
            <div className="flex gap-2">
              {!showLeaveForm ? (
                <button
                  onClick={() => { setShowLeaveForm(true); setLeaveError(null); setLeaveSuccess(false) }}
                  className="inline-flex items-center gap-1 rounded bg-[#C27E00] px-3 py-1.5 text-sm text-black hover:bg-amber-500"
                >
                  <Plus className="w-4 h-4" /> Request Leave
                </button>
              ) : null}
              {['hr', 'aurora_manager'].includes(profile.role) && (
                <Link href="/dashboard/hr/leave" className="text-sm text-[#C27E00] hover:underline">Leave Management →</Link>
              )}
            </div>
          </div>

          {showLeaveForm && (
            <form
              action={async (fd: FormData) => {
                const res = await requestLeave({
                  leave_type: fd.get('leave_type') as string,
                  start_date: fd.get('start_date') as string,
                  end_date: fd.get('end_date') as string,
                  notes: (fd.get('notes') as string) || undefined,
                })
                setLeaveError(res.error ?? null)
                if (res.success) {
                  setLeaveSuccess(true)
                  setShowLeaveForm(false)
                  window.location.reload()
                }
              }}
              className="mb-6 p-4 rounded-lg bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-4"
            >
              <h3 className="text-md font-medium text-zinc-900 dark:text-white">New Leave Request</h3>
              {leaveError && <p className="text-red-400 text-sm">{leaveError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Leave Type</label>
                  <select name="leave_type" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
                    {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Start Date</label>
                  <input name="start_date" type="date" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">End Date</label>
                  <input name="end_date" type="date" required className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="Optional" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-[#C27E00] px-4 py-2 text-sm text-black hover:bg-amber-500">Submit</button>
                <button type="button" onClick={() => { setShowLeaveForm(false); setLeaveError(null) }} className="rounded bg-gray-700 px-4 py-2 text-sm text-zinc-600 dark:text-gray-300 hover:bg-gray-600">Cancel</button>
              </div>
            </form>
          )}
          {leaveSuccess && <p className="text-green-400 text-sm mb-4">Leave request submitted successfully.</p>}

          {leaveRequests.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No leave requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Period</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                  {leaveRequests.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{new Date(l.start_date).toLocaleDateString()} – {new Date(l.end_date).toLocaleDateString()}</td>
                      <td><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[l.status] ?? 'bg-gray-700 text-zinc-500 dark:text-gray-400'}`}>{l.status}</span></td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 max-w-[200px] truncate">{l.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'expenses' && profile.role === 'specialist' ? (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <SelfExpensesPanel initialClaims={expenseClaims} />
        </div>
      ) : null}

      {activeTab === 'pay' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          {profile.role === 'specialist' && payEstimate ? (
            <SelfPayEstimatePanel initialSnapshot={payEstimate} />
          ) : null}
          {(() => {
            const pendingPayments = payments.filter((p) => (p.status || '').toLowerCase() === 'pending')
            const paidPayments = payments.filter((p) => (p.status || '').toLowerCase() === 'paid')
            const pendingTotal = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0)
            const paidTotal = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0)
            const showLiveEstimate = profile.role === 'specialist' && payEstimate
            return (
              <>
                {!showLiveEstimate ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 p-4">
                      <p className="text-xs text-amber-400 uppercase mb-1">Amount to Receive</p>
                      <p className="text-2xl font-semibold text-zinc-900 dark:text-white">${pendingTotal.toLocaleString()}</p>
                      <p className="text-zinc-500 dark:text-gray-500 text-sm mt-1">{pendingPayments.length} pending payment(s)</p>
                    </div>
                    <div className="rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-100/90 dark:bg-black/30 p-4">
                      <p className="text-xs text-zinc-500 dark:text-gray-500 uppercase mb-1">Total Received</p>
                      <p className="text-2xl font-semibold text-zinc-900 dark:text-white">${paidTotal.toLocaleString()}</p>
                      <p className="text-zinc-500 dark:text-gray-500 text-sm mt-1">{paidPayments.length} paid payment(s)</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-gray-400 mb-6">
                    HR payroll: ${paidTotal.toLocaleString()} paid · ${pendingTotal.toLocaleString()} pending
                  </p>
                )}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {showLiveEstimate ? 'HR payment records' : 'Payment History'}
                  </h2>
                  {['hr', 'aurora_manager'].includes(profile.role) && (
                    <Link href="/dashboard/hr/payroll" className="text-sm text-[#C27E00] hover:underline">Payroll →</Link>
                  )}
                </div>
                {payments.length === 0 ? (
                  <p className="text-zinc-500 dark:text-gray-500">No payment records.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Period</th>
                          <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                          <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Amount</th>
                          <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                          <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Paid At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{p.period_start && p.period_end ? `${new Date(p.period_start).toLocaleDateString()} – ${new Date(p.period_end).toLocaleDateString()}` : '—'}</td>
                            <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{PAYMENT_TYPES[p.payment_type ?? ''] ?? p.payment_type ?? '—'}</td>
                            <td className="px-4 py-2 text-right text-zinc-900 dark:text-white">${Number(p.amount).toLocaleString()}</td>
                            <td><span className={`px-2 py-0.5 rounded text-xs ${(p.status || '').toLowerCase() === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.status ?? 'pending'}</span></td>
                            <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {activeTab === 'it_request' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">IT Support Request</h2>
          <p className="text-zinc-500 dark:text-gray-400 text-sm mb-4">Submit a support ticket for IT. You will be notified when your request is processed.</p>

          {!showItForm ? (
            <button
              onClick={() => { setShowItForm(true); setItError(null); setItSuccess(false) }}
              className="inline-flex items-center gap-1 rounded bg-[#C27E00] px-4 py-2 text-sm text-black hover:bg-amber-500"
            >
              <Plus className="w-4 h-4" /> New Request
            </button>
          ) : (
            <form
              action={async (fd: FormData) => {
                const res = await createITRequest({
                  title: fd.get('title') as string,
                  description: (fd.get('description') as string) || undefined,
                  category: fd.get('category') as string,
                  priority: (fd.get('priority') as string) || undefined,
                })
                setItError(res.error ?? null)
                if (res.success) {
                  setItSuccess(true)
                  setShowItForm(false)
                }
              }}
              className="space-y-4 max-w-xl"
            >
              {itError && <p className="text-red-400 text-sm">{itError}</p>}
              {itSuccess && <p className="text-green-400 text-sm">Request submitted. IT will review it shortly.</p>}
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Title *</label>
                <input name="title" type="text" required placeholder="Brief description" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Category</label>
                <select name="category" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
                  <option value="bug_report">Bug Report</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="system_issue">System Issue</option>
                  <option value="access_request">Access Request</option>
                  <option value="integration_request">Integration Request</option>
                  <option value="security_incident">Security Incident</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Priority</label>
                <select name="priority" className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 dark:text-gray-500 mb-1">Description</label>
                <textarea name="description" rows={4} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="Details of your request..." />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-[#C27E00] px-4 py-2 text-sm text-black hover:bg-amber-500">Submit</button>
                <button type="button" onClick={() => { setShowItForm(false); setItError(null) }} className="rounded bg-gray-700 px-4 py-2 text-sm text-zinc-600 dark:text-gray-300 hover:bg-gray-600">Cancel</button>
              </div>
            </form>
          )}

          {['aurora_manager', 'it'].includes(profile.role) && (
            <div className="mt-6">
              <Link href="/dashboard/operations/service-desk" className="text-sm text-[#C27E00] hover:underline flex items-center gap-1">
                View Service Desk <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          {(expiringDocs.length > 0 || pendingChecklists.length > 0) && (
            <div className="mb-4 space-y-2">
              {expiringDocs.length > 0 && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded text-sm">{expiringDocs.length} document(s) expired</div>}
              {pendingChecklists.length > 0 && <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded text-sm">{pendingChecklists.length} pending checklist item(s)</div>}
            </div>
          )}
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Compliance Documents</h2>
          {complianceDocuments.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No compliance documents.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Title</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Expiry</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                  {complianceDocuments.map((d) => {
                    const expired = d.expiry_date && d.expiry_date < today
                    return (
                      <tr key={d.id} className={expired ? 'bg-red-500/5' : ''}>
                        <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{DOC_TYPES[d.document_type ?? ''] ?? d.document_type ?? '—'}</td>
                        <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{d.title ?? '—'}</td>
                        <td className="px-4 py-2"><span className={expired ? 'text-red-400' : 'text-zinc-500 dark:text-gray-400'}>{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '—'}</span></td>
                        <td>{d.verified_at ? <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">Verified</span> : <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-zinc-500 dark:text-gray-400">Pending</span>}</td>
                        <td>{d.document_url ? <a href={d.document_url} target="_blank" rel="noopener noreferrer" className="text-[#C27E00] hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Link</a> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="text-md font-medium text-zinc-900 dark:text-white mt-6 mb-2">Compliance Checklists</h3>
          {complianceChecklists.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No checklist items.</p>
          ) : (
            <ul className="space-y-2">
              {complianceChecklists.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded ${c.completed ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <span className={c.completed ? 'text-zinc-500 dark:text-gray-500 line-through' : 'text-zinc-900 dark:text-white'}>{c.item_name}</span>
                  {c.completed_at && <span className="text-zinc-500 dark:text-gray-500 text-xs">({new Date(c.completed_at).toLocaleDateString()})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'certifications' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          {expiringCerts.length > 0 && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded text-sm">{expiringCerts.length} certification(s) expired</div>
          )}
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Certifications</h2>
          {certifications.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No certifications.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Name</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Issue</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Expiry</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                  {certifications.map((c) => {
                    const expired = c.expiry_date && c.expiry_date < today
                    return (
                      <tr key={c.id} className={expired ? 'bg-red-500/5' : ''}>
                        <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{CERT_TYPES[c.certification_type] ?? c.certification_type}</td>
                        <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{c.name ?? '—'}</td>
                        <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{new Date(c.issue_date).toLocaleDateString()}</td>
                        <td><span className={expired ? 'text-red-400' : 'text-zinc-500 dark:text-gray-400'}>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '—'}</span></td>
                        <td><span className={`px-2 py-0.5 rounded text-xs ${c.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-zinc-500 dark:text-gray-400'}`}>{c.status ?? '—'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Assigned Equipment</h2>
          {equipment.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No equipment assigned.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Item</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Serial</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Assigned</th>
                    <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                  {equipment.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2 text-zinc-900 dark:text-white">{(e.equipment_types as { name?: string } | null)?.name ?? e.item_name ?? '—'}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{e.serial_number ?? '—'}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{new Date(e.assigned_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{e.condition ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Availability</h2>
          {availability.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No availability set.</p>
          ) : (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const slot = availability.find((a) => a.day_of_week === day)
                return (
                  <div key={day} className="flex items-center gap-4">
                    <span className="w-12 text-zinc-500 dark:text-gray-400">{DAY_LABELS[day]}</span>
                    <span className={slot?.is_available ? 'text-green-400' : 'text-zinc-500 dark:text-gray-500'}>
                      {slot?.is_available ? `${slot.start_time} – ${slot.end_time}` : 'Not available'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {leaveBlocks.length > 0 && (
            <>
              <h3 className="text-md font-medium text-zinc-900 dark:text-white mt-6 mb-2">Leave Blocks</h3>
              <ul className="space-y-2">
                {leaveBlocks.map((b) => (
                  <li key={b.id} className="text-zinc-500 dark:text-gray-400">
                    {new Date(b.start_date).toLocaleDateString()} – {new Date(b.end_date).toLocaleDateString()}
                    {b.reason && ` (${b.reason})`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Performance Feedback</h2>
          {feedback.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No feedback yet.</p>
          ) : (
            <ul className="space-y-4">
              {feedback.map((f) => (
                <li key={f.id} className="p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-zinc-500 dark:text-gray-400 text-sm">{f.feedback_type ?? 'Feedback'} {f.source && `• ${f.source}`}</span>
                    <span className="text-zinc-500 dark:text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                  {f.rating != null && <p className="text-[#C27E00] font-medium">Rating: {Number(f.rating).toFixed(1)}/5</p>}
                  {f.comment && <p className="text-zinc-600 dark:text-gray-300 mt-2">{f.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Onboarding Tasks</h2>
          {onboardingTasks.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500">No onboarding tasks.</p>
          ) : (
            <ul className="space-y-3">
              {onboardingTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span className={`w-4 h-4 rounded ${t.status === 'completed' ? 'bg-green-500' : t.status === 'in_progress' ? 'bg-amber-500' : 'bg-gray-600'}`} />
                  <span className={t.status === 'completed' ? 'text-zinc-500 dark:text-gray-500 line-through' : 'text-zinc-900 dark:text-white'}>{t.title}</span>
                  {t.due_date && <span className="text-zinc-500 dark:text-gray-500 text-xs">Due: {new Date(t.due_date).toLocaleDateString()}</span>}
                  {t.completed_at && <span className="text-green-400 text-xs">Done: {new Date(t.completed_at).toLocaleDateString()}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
