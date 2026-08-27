'use client'

import { format } from 'date-fns'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePersonnel, createCertification, updateCertificationStatus, updateInstallerProfile, terminateEmployment } from '../actions'
import { EmailInput } from '@/components/email-input'
import { normalizeEmail } from '@/lib/email-normalize'
import { OrgStructureFields } from '../org-structure-fields'
import { orgRoleLabel, type OrgDepartmentTree } from '@/lib/hr-org-structure'
import { formInputClassName, formLabelClassName, formSelectClassName } from '@/lib/form-field-styles'

const PLATFORM_ROLE_LABELS: Record<string, string> = {
  specialist: 'Technical Support',
  aurora_manager: 'Aurora Manager',
  hr: 'HR',
  it: 'IT',
}

const WORKER_TYPE_LABELS: Record<string, string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  installer_technician: 'Installer Technician',
  dealer_staff: 'Dealer Staff',
  regional_manager: 'Regional Manager',
  support_staff: 'Support Staff',
}

const WORKER_TYPES = [
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'installer_technician', label: 'Installer Technician' },
  { value: 'dealer_staff', label: 'Dealer Staff' },
  { value: 'regional_manager', label: 'Regional Manager' },
  { value: 'support_staff', label: 'Support Staff' },
]

const STATUSES = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]

const PLATFORM_ROLES = [
  { value: '', label: '—' },
  { value: 'specialist', label: 'Technical Support' },
  { value: 'aurora_manager', label: 'Aurora Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'it', label: 'IT' },
]

const CONTRACT_TYPES = [
  { value: '', label: '—' },
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_installation', label: 'Per Installation' },
  { value: 'commission', label: 'Commission' },
  { value: 'freelance', label: 'Freelance' },
]

const WORK_ARRANGEMENTS = [
  { value: '', label: '—' },
  { value: 'remote', label: 'Remote' },
  { value: 'on_site', label: 'On-site' },
  { value: 'field', label: 'Field' },
]

const PROVINCES = [
  { value: '', label: '—' },
  { value: 'ontario', label: 'Ontario' },
  { value: 'british_columbia', label: 'British Columbia' },
  { value: 'alberta', label: 'Alberta' },
  { value: 'quebec', label: 'Quebec' },
  { value: 'manitoba', label: 'Manitoba' },
  { value: 'saskatchewan', label: 'Saskatchewan' },
  { value: 'out_of_canada', label: 'Out Of Canada' },
]

const SALARY_TYPES = [
  { value: '', label: '—' },
  { value: 'salary', label: 'Salary (annual)' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_installation', label: 'Per Installation' },
  { value: 'commission', label: 'Commission' },
]

const STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'N/A', label: 'N/A' },
  { value: 'OK', label: 'OK' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Not Required', label: 'Not Required' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Valid', label: 'Valid' },
]

const CERTIFICATION_STATUSES = [
  { value: 'awaiting', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'received', label: 'Received' },
  { value: 'approved', label: 'Approved' },
  { value: 'expired', label: 'Expired' },
]

export function PersonnelDetail({
  person,
  certifications,
  timeline,
  regions,
  dealers,
  managers,
  installerProfile,
  orgTree,
}: {
  person: Record<string, unknown>
  certifications: Record<string, unknown>[]
  timeline: Record<string, unknown>[]
  regions: { id: string; name: string }[]
  dealers: { id: string; name: string }[]
  managers: { id: string; full_name: string | null }[]
  installerProfile?: Record<string, unknown> | null
  orgTree: OrgDepartmentTree
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dealerId, setDealerId] = useState(String(person.dealer_id ?? ''))
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [terminateLoading, setTerminateLoading] = useState(false)
  const [terminateError, setTerminateError] = useState<string | null>(null)
  const [terminateEndDate, setTerminateEndDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [terminateReason, setTerminateReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCertForm, setShowCertForm] = useState(false)
  const [certLoading, setCertLoading] = useState(false)
  const [certError, setCertError] = useState<string | null>(null)
  const [editingInstaller, setEditingInstaller] = useState(false)
  const [installerLoading, setInstallerLoading] = useState(false)

  const inputClass = formInputClassName
  const selectClass = formSelectClassName
  const labelClass = formLabelClassName

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const data: Record<string, string> = {}
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      const name = (el as HTMLInputElement).name
      if (name) data[name] = (el as HTMLInputElement).value
    })
    const result = await updatePersonnel(person.id as string, data)
    setLoading(false)
    if (result.error) setError(result.error)
    else setEditing(false)
  }

  const section = (title: string, children: React.ReactNode) => (
    <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{title}</h3>
      {children}
    </div>
  )

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Edit Personnel</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-md bg-zinc-200/50 dark:bg-white/5 text-zinc-900 dark:text-white border border-zinc-300 dark:border-gray-600 hover:bg-zinc-200 dark:bg-white/10"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900] disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {section('Contact & Address', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Full Name</label>
                <input name="full_name" required className={inputClass} defaultValue={String(person.full_name ?? '')} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input name="phone" type="tel" className={inputClass} defaultValue={String(person.phone ?? '')} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <EmailInput name="email" className={inputClass} defaultValue={normalizeEmail(String(person.email ?? ''))} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Address</label>
                <textarea name="address" rows={2} className={inputClass} defaultValue={String(person.address ?? '')} />
              </div>
              <div>
                <label className={labelClass}>Emergency Contact</label>
                <input name="emergency_contact_name" className={inputClass} defaultValue={String(person.emergency_contact_name ?? '')} />
              </div>
              <div>
                <label className={labelClass}>Emergency Phone</label>
                <input name="emergency_contact_phone" type="tel" className={inputClass} defaultValue={String(person.emergency_contact_phone ?? '')} />
              </div>
            </div>
          ))}

          {section('Professional', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Dealer</label>
                <select
                  name="dealer_id"
                  className={selectClass}
                  value={dealerId}
                  onChange={(e) => setDealerId(e.target.value)}
                >
                  <option value="">Platform</option>
                  {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {!dealerId ? (
                <div className="md:col-span-2">
                  <OrgStructureFields
                    key={`org-${String(person.department_id ?? '')}-${String(person.org_role_id ?? '')}`}
                    tree={orgTree}
                    isPlatform
                    layout="row"
                    initialDepartmentId={person.department_id as string | null}
                    initialOrgRoleId={person.org_role_id as string | null}
                    selectClass={selectClass}
                    labelClass={labelClass}
                  />
                </div>
              ) : null}
              <div>
                <label className={labelClass}>Platform access role</label>
                <select name="platform_role" className={selectClass} defaultValue={String(person.platform_role ?? '')}>
                  {PLATFORM_ROLES.map((r) => <option key={r.value || 'empty'} value={r.value}>{r.label}</option>)}
                </select>
                <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">System login permission (separate from job title).</p>
              </div>
              {!dealerId ? (
                <div>
                  <label className={labelClass}>Additional title note</label>
                  <input name="position" className={inputClass} defaultValue={String(person.position ?? '')} placeholder="Optional" />
                  <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Free-text note only; use Job Title above for org structure.</p>
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Position / title</label>
                  <input name="position" className={inputClass} defaultValue={String(person.position ?? '')} placeholder="e.g. Sales Representative" />
                </div>
              )}
              <div>
                <label className={labelClass}>Region</label>
                <select name="region_id" className={selectClass} defaultValue={String(person.region_id ?? '')}>
                  <option value="">—</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Assigned Manager</label>
                <select name="assigned_manager_id" className={selectClass} defaultValue={String(person.assigned_manager_id ?? '')}>
                  <option value="">—</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name ?? 'Unnamed'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Start Date</label>
                <input name="start_date" type="date" className={inputClass} defaultValue={String(person.start_date ?? '')} />
              </div>
              <div>
                <label className={labelClass}>Contract Type</label>
                <select name="contract_type" className={selectClass} defaultValue={String(person.contract_type ?? '')}>
                  {CONTRACT_TYPES.map((c) => <option key={c.value || 'empty'} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Work Arrangement</label>
                <select name="work_arrangement" className={selectClass} defaultValue={String(person.work_arrangement ?? '')}>
                  {WORK_ARRANGEMENTS.map((w) => <option key={w.value || 'empty'} value={w.value}>{w.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Province</label>
                <select name="province" className={selectClass} defaultValue={String(person.province ?? '')}>
                  {PROVINCES.map((p) => <option key={p.value || 'empty'} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Worker Type</label>
                <select name="worker_type" className={selectClass} defaultValue={String(person.worker_type ?? '')}>
                  {WORKER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select name="status" className={selectClass} defaultValue={String(person.status ?? '')}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          ))}

          {section('Identity & Verification (Canada)', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Government ID</label>
                <input name="government_id" className={inputClass} defaultValue={String(person.government_id ?? '')} />
              </div>
              <div>
                <label className={labelClass}>SIN Verified</label>
                <select name="sin_verified" className={selectClass} defaultValue={person.sin_verified === true ? 'true' : 'false'}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Work Permit / Visa Status</label>
                <select name="work_permit_status" className={selectClass} defaultValue={String(person.work_permit_status ?? '')}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Driver License</label>
                <select name="driver_license" className={selectClass} defaultValue={String(person.driver_license ?? '')}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Background Check Status</label>
                <select name="background_check_status" className={selectClass} defaultValue={String(person.background_check_status ?? '')}>
                  {STATUS_OPTIONS.filter(o => o.value !== 'Valid').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          ))}

          {section('Salary & Compensation', (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Amount</label>
                <input
                  name="salary_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  defaultValue={person.salary_amount != null ? String(person.salary_amount) : ''}
                  placeholder="e.g. 65000"
                />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select name="salary_type" className={selectClass} defaultValue={String(person.salary_type ?? '')}>
                  {SALARY_TYPES.map((s) => <option key={s.value || 'empty'} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select name="salary_currency" className={selectClass} defaultValue={String(person.salary_currency ?? 'CAD')}>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-400">{error}</p>}

        {section('Certifications', (
          <div className="space-y-4">
            {!showCertForm ? (
              <button
                type="button"
                onClick={() => setShowCertForm(true)}
                className="text-sm text-[#C27E00] hover:text-[#a06900]"
              >
                + Add Certification
              </button>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const data = {
                    institution: (form.elements.namedItem('institution') as HTMLInputElement).value,
                    name: (form.elements.namedItem('cert_name') as HTMLInputElement).value,
                    issue_date: (form.elements.namedItem('issue_date') as HTMLInputElement).value,
                    expiry_date: (form.elements.namedItem('expiry_date') as HTMLInputElement).value || undefined,
                    status: (form.elements.namedItem('cert_status') as HTMLSelectElement).value,
                  }
                  if (!data.issue_date) return
                  setCertLoading(true)
                  setCertError(null)
                  const result = await createCertification(person.id as string, data)
                  setCertLoading(false)
                  if (result.error) {
                    setCertError(result.error)
                  } else {
                    setShowCertForm(false)
                    router.refresh()
                  }
                }}
                className="space-y-3 p-4 rounded-lg bg-zinc-200/50 dark:bg-white/5 border border-zinc-300 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Institution</label>
                    <input name="institution" className={inputClass} placeholder="e.g. Transport Canada" />
                  </div>
                  <div>
                    <label className={labelClass}>Name</label>
                    <input name="cert_name" className={inputClass} placeholder="e.g. Safety Certificate" />
                  </div>
                  <div>
                    <label className={labelClass}>Date</label>
                    <input name="issue_date" type="date" required className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Expiry Date</label>
                    <input name="expiry_date" type="date" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select name="cert_status" className={selectClass} defaultValue="awaiting">
                      {CERTIFICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button type="submit" disabled={certLoading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
                    {certLoading ? 'Saving...' : 'Add'}
                  </button>
                  <button type="button" onClick={() => setShowCertForm(false)} className="px-3 py-1.5 rounded bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-sm hover:bg-zinc-200 dark:bg-white/10">
                    Cancel
                  </button>
                  {certError && <span className="text-red-400 text-sm">{certError}</span>}
                </div>
              </form>
            )}
            {certifications.length > 0 && (
              <ul className="space-y-2 mt-4">
                {certifications.map((c) => (
                  <li key={c.id as string} className="text-sm flex flex-wrap items-center gap-2">
                    <span className="text-zinc-900 dark:text-white">{(c.institution as string) || (c.certification_type as string) || '—'}</span>
                    <span className="text-zinc-500 dark:text-gray-500">•</span>
                    <span className="text-zinc-500 dark:text-gray-400">{c.issue_date ? format(new Date(c.issue_date as string), 'PPP') : '—'}</span>
                    <span className="text-zinc-500 dark:text-gray-500">•</span>
                    <span className="text-zinc-600 dark:text-gray-300">{(c.name as string) || '—'}</span>
                    <select
                      value={String(c.status || 'awaiting')}
                      onChange={async (e) => {
                        const newStatus = e.target.value
                        await updateCertificationStatus(c.id as string, newStatus, person.id as string)
                        router.refresh()
                      }}
                      className={`ml-2 text-xs rounded px-2 py-0.5 border border-zinc-300 dark:border-gray-600 focus:ring-1 focus:ring-[#C27E00] ${formSelectClassName}`}
                    >
                      {CERTIFICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            )}
            {certifications.length === 0 && !showCertForm && (
              <p className="text-zinc-500 dark:text-gray-500 text-sm mt-2">No certifications yet.</p>
            )}
          </div>
        ))}

        {installerProfile &&
          section('Installer Profile', (
            <div className="space-y-4">
              {!editingInstaller ? (
                <div className="space-y-2 text-sm">
                  <p><span className="text-zinc-500 dark:text-gray-500">Experience:</span> {String(installerProfile.experience_level ?? '—')}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Customer Rating:</span> {installerProfile.customer_rating != null ? Number(installerProfile.customer_rating).toFixed(1) : '—'}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Quality Score:</span> {installerProfile.quality_score != null ? Number(installerProfile.quality_score).toFixed(1) : '—'}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Completion Rate:</span> {installerProfile.completion_rate != null ? `${Number(installerProfile.completion_rate)}%` : '—'}<span className="text-zinc-500 dark:text-gray-500 text-xs ml-1">(from assigned demands)</span></p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Status:</span> <span className={`px-2 py-0.5 rounded text-xs ${installerProfile.installer_status === 'active' ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-zinc-600 dark:text-gray-300'}`}>{String(installerProfile.installer_status ?? '—')}</span></p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Skills:</span> {Array.isArray(installerProfile.installation_skills) ? (installerProfile.installation_skills as string[]).join(', ') || '—' : '—'}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Device Compatibility:</span> {Array.isArray(installerProfile.device_compatibility) ? (installerProfile.device_compatibility as string[]).join(', ') || '—' : '—'}</p>
                  <button type="button" onClick={() => setEditingInstaller(true)} className="text-sm text-[#C27E00] hover:text-[#a06900] mt-2">Edit</button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setInstallerLoading(true)
                    const form = e.currentTarget
                    const result = await updateInstallerProfile(installerProfile.id as string, {
                      experience_level: (form.elements.namedItem('exp_level') as HTMLSelectElement).value || undefined,
                      customer_rating: (form.elements.namedItem('customer_rating') as HTMLInputElement).value || undefined,
                      quality_score: (form.elements.namedItem('quality_score') as HTMLInputElement).value || undefined,
                      installer_status: (form.elements.namedItem('inst_status') as HTMLSelectElement).value || undefined,
                      installation_skills: (form.elements.namedItem('skills') as HTMLInputElement).value || undefined,
                      device_compatibility: (form.elements.namedItem('devices') as HTMLInputElement).value || undefined,
                    })
                    setInstallerLoading(false)
                    if (!result.error) {
                      setEditingInstaller(false)
                      router.refresh()
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Experience Level</label>
                      <select name="exp_level" className={selectClass} defaultValue={String(installerProfile.experience_level ?? '')}>
                        <option value="">—</option>
                        <option value="entry">Entry</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="senior">Senior</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <select name="inst_status" className={selectClass} defaultValue={String(installerProfile.installer_status ?? 'active')}>
                        <option value="active">Active</option>
                        <option value="onboarding">Onboarding</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Customer Rating (0-5)</label>
                      <input name="customer_rating" type="number" step="0.1" min="0" max="5" className={inputClass} defaultValue={installerProfile.customer_rating != null ? String(installerProfile.customer_rating) : ''} />
                      <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Averaged from customer portal ratings (1–5 per installation). HR can override manually.</p>
                    </div>
                    <div>
                      <label className={labelClass}>Quality Score (0-5)</label>
                      <input name="quality_score" type="number" step="0.1" min="0" max="5" className={inputClass} defaultValue={installerProfile.quality_score != null ? String(installerProfile.quality_score) : ''} />
                      <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Averaged from customer portal quality scores (1–5 per installation).</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-zinc-500 dark:text-gray-400">Completion Rate is auto-calculated from assigned demands (completed / total).</p>
                      <p className="text-zinc-900 dark:text-white font-medium mt-1">{installerProfile.completion_rate != null ? `${Number(installerProfile.completion_rate)}%` : '—'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Installation Skills (comma separated)</label>
                      <input name="skills" className={inputClass} defaultValue={Array.isArray(installerProfile.installation_skills) ? (installerProfile.installation_skills as string[]).join(', ') : ''} placeholder="e.g. dashcam, radar, backup camera" />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Device Compatibility (comma separated)</label>
                      <input name="devices" className={inputClass} defaultValue={Array.isArray(installerProfile.device_compatibility) ? (installerProfile.device_compatibility as string[]).join(', ') : ''} placeholder="e.g. Thinkware, BlackVue" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={installerLoading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">{installerLoading ? 'Saving...' : 'Save'}</button>
                    <button type="button" onClick={() => setEditingInstaller(false)} className="px-3 py-1.5 rounded bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          ))
        }

        {section('Timeline', (
          timeline.length === 0 ? (
            <p className="text-zinc-500 dark:text-gray-500 text-sm">No events yet.</p>
          ) : (
            <ul className="space-y-2">
              {timeline.map((t) => (
                <li key={t.id as string} className="text-sm flex gap-3">
                  <span className="text-zinc-500 dark:text-gray-500">{t.created_at ? format(new Date(t.created_at as string), 'MMM d, yyyy') : ''}</span>
                  <span className="text-zinc-900 dark:text-white">{(t.event_type as string)}</span>
                  {t.title ? <span className="text-zinc-500 dark:text-gray-400">— {String(t.title)}</span> : null}
                </li>
              ))}
            </ul>
          )
        ))}
      </form>
    )
  }

  const salaryDisplay = person.salary_amount != null
    ? `${person.salary_currency || 'CAD'} ${Number(person.salary_amount).toLocaleString()}${person.salary_type ? ` (${person.salary_type})` : ''}`
    : '—'

  const orgDisplay = orgRoleLabel(person, orgTree)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-6">
          {person.avatar_url ? (
            <img src={person.avatar_url as string} alt="" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-white/10 flex items-center justify-center text-3xl text-zinc-500 dark:text-gray-500">
              {(person.full_name as string)?.charAt(0) ?? '?'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">{person.full_name as string}</h1>
            <p className="text-zinc-500 dark:text-gray-400">{person.worker_id as string} • {WORKER_TYPE_LABELS[person.worker_type as string] ?? person.worker_type}</p>
            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
              person.status === 'active' ? 'bg-green-900/50 text-green-300' :
              person.status === 'onboarding' ? 'bg-yellow-900/50 text-yellow-300' :
              person.status === 'terminated' ? 'bg-red-900/50 text-red-300' :
              'bg-gray-800 text-zinc-600 dark:text-gray-300'
            }`}>
              {person.status as string}
            </span>
            {person.status === 'terminated' && person.end_date ? (
              <p className="text-sm text-red-400 mt-2">
                End date: {format(new Date(person.end_date as string), 'PPP')}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {person.status !== 'terminated' ? (
            <button
              type="button"
              onClick={() => setShowTerminateModal(true)}
              className="px-4 py-2 rounded-md border border-red-700/50 text-red-400 font-medium hover:bg-red-950/30"
            >
              End employment
            </button>
          ) : null}
          {person.status !== 'terminated' ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 rounded-md bg-[#C27E00] text-white font-medium hover:bg-[#a06900]"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {showTerminateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-zinc-200 dark:border-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">End employment</h3>
            <p className="text-sm text-zinc-500 dark:text-gray-400">
              This marks {String(person.full_name)} as terminated and disables their system login if they have an account.
            </p>
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Last day</label>
              <input
                type="date"
                value={terminateEndDate}
                onChange={(e) => setTerminateEndDate(e.target.value)}
                className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Reason (optional)</label>
              <textarea
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                rows={3}
                className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm"
                placeholder="e.g. Resignation, contract ended"
              />
            </div>
            {terminateError ? <p className="text-sm text-red-400">{terminateError}</p> : null}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={terminateLoading}
                onClick={async () => {
                  setTerminateLoading(true)
                  setTerminateError(null)
                  const result = await terminateEmployment(
                    String(person.id),
                    terminateEndDate,
                    terminateReason
                  )
                  setTerminateLoading(false)
                  if (result.error) {
                    setTerminateError(result.error)
                    return
                  }
                  setShowTerminateModal(false)
                  router.refresh()
                }}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {terminateLoading ? 'Saving...' : 'Confirm end employment'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTerminateModal(false)
                  setTerminateError(null)
                }}
                className="rounded-md border border-zinc-300 dark:border-gray-600 px-4 py-2 text-sm text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {section('Contact & Address', (
          <div className="space-y-2 text-sm">
            <p><span className="text-zinc-500 dark:text-gray-500">Phone:</span> {String(person.phone ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Email:</span> {String(person.email ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Address:</span> {String(person.address ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Emergency:</span> {String(person.emergency_contact_name ?? '—')} {String(person.emergency_contact_phone ?? '')}</p>
          </div>
        ))}

        {section('Professional', (
          <div className="space-y-2 text-sm">
            {!person.dealer_id ? (
              <>
                <p><span className="text-zinc-500 dark:text-gray-500">Main Department:</span> {orgDisplay.mainDepartment}</p>
                <p><span className="text-zinc-500 dark:text-gray-500">Sub-department:</span> {orgDisplay.subDepartment}</p>
                <p><span className="text-zinc-500 dark:text-gray-500">Job Title:</span> {orgDisplay.jobTitle}</p>
              </>
            ) : null}
            {person.position ? (
              <p><span className="text-zinc-500 dark:text-gray-500">Additional title note:</span> {String(person.position)}</p>
            ) : null}
            <p><span className="text-zinc-500 dark:text-gray-500">Platform access role:</span> {String(PLATFORM_ROLE_LABELS[person.platform_role as string] ?? person.platform_role ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Region:</span> {String((person.hr_regions as { name?: string })?.name ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Dealer:</span> {String((person.dealers as { name?: string })?.name ?? 'Platform')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Manager:</span> {String((person as { _managerName?: string })._managerName ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Start Date:</span> {person.start_date ? format(new Date(person.start_date as string), 'PPP') : '—'}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">End Date:</span> {person.end_date ? format(new Date(person.end_date as string), 'PPP') : '—'}</p>
            {person.termination_reason ? (
              <p><span className="text-zinc-500 dark:text-gray-500">Termination reason:</span> {String(person.termination_reason)}</p>
            ) : null}
            <p><span className="text-zinc-500 dark:text-gray-500">Work Arrangement:</span> {String(WORK_ARRANGEMENTS.find((w) => w.value === person.work_arrangement)?.label ?? person.work_arrangement ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Salary:</span> {salaryDisplay}</p>
          </div>
        ))}

        {section('Identity & Verification (Canada)', (
          <div className="space-y-2 text-sm">
            <p><span className="text-zinc-500 dark:text-gray-500">SIN Verified:</span> {person.sin_verified ? 'Yes' : 'No'}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Work Permit:</span> {String(person.work_permit_status ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Driver License:</span> {String(person.driver_license ?? '—')}</p>
            <p><span className="text-zinc-500 dark:text-gray-500">Background Check:</span> {String(person.background_check_status ?? '—')}</p>
          </div>
        ))}

        {section('Certifications', (
          <div className="space-y-4">
            {!showCertForm ? (
              <button
                type="button"
                onClick={() => setShowCertForm(true)}
                className="text-sm text-[#C27E00] hover:text-[#a06900]"
              >
                + Add Certification
              </button>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const data = {
                    institution: (form.elements.namedItem('institution') as HTMLInputElement).value,
                    name: (form.elements.namedItem('cert_name') as HTMLInputElement).value,
                    issue_date: (form.elements.namedItem('issue_date') as HTMLInputElement).value,
                    expiry_date: (form.elements.namedItem('expiry_date') as HTMLInputElement).value || undefined,
                    status: (form.elements.namedItem('cert_status') as HTMLSelectElement).value,
                  }
                  if (!data.issue_date) return
                  setCertLoading(true)
                  setCertError(null)
                  const result = await createCertification(person.id as string, data)
                  setCertLoading(false)
                  if (result.error) {
                    setCertError(result.error)
                  } else {
                    setShowCertForm(false)
                    router.refresh()
                  }
                }}
                className="space-y-3 p-4 rounded-lg bg-zinc-200/50 dark:bg-white/5 border border-zinc-300 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Institution</label>
                    <input name="institution" className={inputClass} placeholder="e.g. Transport Canada" />
                  </div>
                  <div>
                    <label className={labelClass}>Name</label>
                    <input name="cert_name" className={inputClass} placeholder="e.g. Safety Certificate" />
                  </div>
                  <div>
                    <label className={labelClass}>Date</label>
                    <input name="issue_date" type="date" required className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Expiry Date</label>
                    <input name="expiry_date" type="date" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select name="cert_status" className={selectClass} defaultValue="awaiting">
                      {CERTIFICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button type="submit" disabled={certLoading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
                    {certLoading ? 'Saving...' : 'Add'}
                  </button>
                  <button type="button" onClick={() => setShowCertForm(false)} className="px-3 py-1.5 rounded bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-sm hover:bg-zinc-200 dark:bg-white/10">
                    Cancel
                  </button>
                  {certError && <span className="text-red-400 text-sm">{certError}</span>}
                </div>
              </form>
            )}
            {certifications.length > 0 && (
              <ul className="space-y-2 mt-4">
                {certifications.map((c) => (
                  <li key={c.id as string} className="text-sm flex flex-wrap items-center gap-2">
                    <span className="text-zinc-900 dark:text-white">{(c.institution as string) || (c.certification_type as string) || '—'}</span>
                    <span className="text-zinc-500 dark:text-gray-500">•</span>
                    <span className="text-zinc-500 dark:text-gray-400">{c.issue_date ? format(new Date(c.issue_date as string), 'PPP') : '—'}</span>
                    <span className="text-zinc-500 dark:text-gray-500">•</span>
                    <span className="text-zinc-600 dark:text-gray-300">{(c.name as string) || '—'}</span>
                    <select
                      value={String(c.status || 'awaiting')}
                      onChange={async (e) => {
                        const newStatus = e.target.value
                        await updateCertificationStatus(c.id as string, newStatus, person.id as string)
                        router.refresh()
                      }}
                      className={`ml-2 text-xs rounded px-2 py-0.5 border border-zinc-300 dark:border-gray-600 focus:ring-1 focus:ring-[#C27E00] ${formSelectClassName}`}
                    >
                      {CERTIFICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            )}
            {certifications.length === 0 && !showCertForm && (
              <p className="text-zinc-500 dark:text-gray-500 text-sm mt-2">No certifications yet.</p>
            )}
          </div>
        ))}

        {installerProfile &&
          section('Installer Profile', (
            <div className="space-y-4">
              {!editingInstaller ? (
                <div className="space-y-2 text-sm">
                  <p><span className="text-zinc-500 dark:text-gray-500">Experience:</span> {String(installerProfile.experience_level ?? '—')}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Customer Rating:</span> {installerProfile.customer_rating != null ? Number(installerProfile.customer_rating).toFixed(1) : '—'}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Quality Score:</span> {installerProfile.quality_score != null ? Number(installerProfile.quality_score).toFixed(1) : '—'}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Completion Rate:</span> {installerProfile.completion_rate != null ? `${Number(installerProfile.completion_rate)}%` : '—'}<span className="text-zinc-500 dark:text-gray-500 text-xs ml-1">(from assigned demands)</span></p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Status:</span> <span className={`px-2 py-0.5 rounded text-xs ${installerProfile.installer_status === 'active' ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-zinc-600 dark:text-gray-300'}`}>{String(installerProfile.installer_status ?? '—')}</span></p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Skills:</span> {Array.isArray(installerProfile.installation_skills) ? (installerProfile.installation_skills as string[]).join(', ') || '—' : '—'}</p>
                  <p><span className="text-zinc-500 dark:text-gray-500">Device Compatibility:</span> {Array.isArray(installerProfile.device_compatibility) ? (installerProfile.device_compatibility as string[]).join(', ') || '—' : '—'}</p>
                  <button onClick={() => setEditingInstaller(true)} className="text-sm text-[#C27E00] hover:text-[#a06900] mt-2">Edit</button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setInstallerLoading(true)
                    const form = e.currentTarget
                    const result = await updateInstallerProfile(installerProfile.id as string, {
                      experience_level: (form.elements.namedItem('exp_level') as HTMLSelectElement).value || undefined,
                      customer_rating: (form.elements.namedItem('customer_rating') as HTMLInputElement).value || undefined,
                      quality_score: (form.elements.namedItem('quality_score') as HTMLInputElement).value || undefined,
                      installer_status: (form.elements.namedItem('inst_status') as HTMLSelectElement).value || undefined,
                      installation_skills: (form.elements.namedItem('skills') as HTMLInputElement).value || undefined,
                      device_compatibility: (form.elements.namedItem('devices') as HTMLInputElement).value || undefined,
                    })
                    setInstallerLoading(false)
                    if (!result.error) {
                      setEditingInstaller(false)
                      router.refresh()
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Experience Level</label>
                      <select name="exp_level" className={selectClass} defaultValue={String(installerProfile.experience_level ?? '')}>
                        <option value="">—</option>
                        <option value="entry">Entry</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="senior">Senior</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <select name="inst_status" className={selectClass} defaultValue={String(installerProfile.installer_status ?? 'active')}>
                        <option value="active">Active</option>
                        <option value="onboarding">Onboarding</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Customer Rating (0-5)</label>
                      <input name="customer_rating" type="number" step="0.1" min="0" max="5" className={inputClass} defaultValue={installerProfile.customer_rating != null ? String(installerProfile.customer_rating) : ''} />
                      <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Averaged from customer portal ratings (1–5 per installation). HR can override manually.</p>
                    </div>
                    <div>
                      <label className={labelClass}>Quality Score (0-5)</label>
                      <input name="quality_score" type="number" step="0.1" min="0" max="5" className={inputClass} defaultValue={installerProfile.quality_score != null ? String(installerProfile.quality_score) : ''} />
                      <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Averaged from customer portal quality scores (1–5 per installation).</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-zinc-500 dark:text-gray-400">Completion Rate is auto-calculated from assigned demands (completed / total).</p>
                      <p className="text-zinc-900 dark:text-white font-medium mt-1">{installerProfile.completion_rate != null ? `${Number(installerProfile.completion_rate)}%` : '—'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Installation Skills (comma separated)</label>
                      <input name="skills" className={inputClass} defaultValue={Array.isArray(installerProfile.installation_skills) ? (installerProfile.installation_skills as string[]).join(', ') : ''} placeholder="e.g. dashcam, radar, backup camera" />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Device Compatibility (comma separated)</label>
                      <input name="devices" className={inputClass} defaultValue={Array.isArray(installerProfile.device_compatibility) ? (installerProfile.device_compatibility as string[]).join(', ') : ''} placeholder="e.g. Thinkware, BlackVue" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={installerLoading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">{installerLoading ? 'Saving...' : 'Save'}</button>
                    <button type="button" onClick={() => setEditingInstaller(false)} className="px-3 py-1.5 rounded bg-zinc-200/50 dark:bg-white/5 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          ))
        }
      </div>

      {section('Timeline', (
        timeline.length === 0 ? (
          <p className="text-zinc-500 dark:text-gray-500 text-sm">No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((t) => (
              <li key={t.id as string} className="text-sm flex gap-3">
                <span className="text-zinc-500 dark:text-gray-500">{t.created_at ? format(new Date(t.created_at as string), 'MMM d, yyyy') : ''}</span>
                <span className="text-zinc-900 dark:text-white">{(t.event_type as string)}</span>
                {t.title ? <span className="text-zinc-500 dark:text-gray-400">— {String(t.title)}</span> : null}
              </li>
            ))}
          </ul>
        )
      ))}
    </div>
  )
}
