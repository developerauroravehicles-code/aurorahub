'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createUser, getProfileForEdit, updateUser, deleteUser, createLoginForPersonnel, setUserLoginAccess } from '../actions'
import { ResetPasswordButton } from '@/app/dashboard/admin/employees/reset-password-button'
import { Pencil, Trash2, X, Loader2, UserPlus, KeyRound, Eye, EyeOff, Check, Ban, ShieldCheck } from 'lucide-react'
import type { Dealer } from '@/types/system-management'
import { EmailInput } from '@/components/email-input'
import { normalizeEmail } from '@/lib/email-normalize'
import { OrgStructureFields } from '@/app/dashboard/hr/personnel/org-structure-fields'
import { orgRoleLabel, type OrgDepartmentTree } from '@/lib/hr-org-structure'
import { formLabelClassName, formSelectClassName } from '@/lib/form-field-styles'

const selectClass = formSelectClassName
const labelClass = formLabelClassName

function UserForm({
  dealers,
  orgTree,
  currentUserRole,
}: {
  dealers: Dealer[]
  orgTree: OrgDepartmentTree
  currentUserRole?: string
}) {
  const [state, formAction, isPending] = useActionState(createUser, null)
  const [dealerCode, setDealerCode] = useState('')

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm border border-green-100">
          {state.success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Full Name</label>
          <input
            name="fullName"
            required
            className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Phone</label>
          <input
            name="phone"
            className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="+1 555..."
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Email</label>
        <EmailInput
          name="email"
          required
          className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="user@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Password</label>
        <input
          name="password"
          type="password"
          required
          className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="••••••••"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass}>Platform access role</label>
          <select
            name="role"
            className={selectClass}
          >
            <option value="sales">Sales</option>
            <option value="finance">Finance</option>
            <option value="specialist">Technical Support</option>
            <option value="aurora_manager">Aurora Manager</option>
            <option value="general_manager">General Manager</option>
            <option value="hr">HR</option>
            <option value="it">IT</option>
            {currentUserRole === 'it' && (
              <option value="inventory_manager">Inventory Manager</option>
            )}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Dealer / Platform</label>
          <select
            name="dealerCode"
            required
            value={dealerCode}
            onChange={(e) => setDealerCode(e.target.value)}
            className={selectClass}
          >
            <option value="">— Select —</option>
            <option value="HQ">Platform (HQ)</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.code}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>
      </div>

      <OrgStructureFields
        tree={orgTree}
        isPlatform={dealerCode === 'HQ'}
        selectClass={selectClass}
        labelClass={labelClass}
        requireOrgFields
      />

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex w-full justify-center rounded-md bg-[#C27E00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#a06900] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C27E00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Creating User...' : 'Create User'}
      </button>
    </form>
  )
}

function EditUserModal({
  userId,
  dealers,
  orgTree,
  currentUserRole,
  onClose,
  onSuccess
}: {
  userId: string
  dealers: Dealer[]
  orgTree: OrgDepartmentTree
  currentUserRole?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [profile, setProfile] = useState<{
    id: string
    full_name: string | null
    phone: string | null
    email?: string
    role: string
    dealer_id: string | null
    department_id?: string | null
    org_role_id?: string | null
    dealers?: { code: string; name: string } | { code: string; name: string }[] | null
  } | null>(null)
  const [dealerCode, setDealerCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(updateUser, null)

  useEffect(() => {
    let cancelled = false
    getProfileForEdit(userId).then((res) => {
      if (cancelled) return
      if (res.error && !res.profile) setFetchError(res.error)
      else if (res.profile) {
        const p = res.profile as {
          id: string
          full_name: string | null
          phone: string | null
          email?: string
          role: string
          dealer_id: string | null
          department_id?: string | null
          org_role_id?: string | null
          dealers?: { code: string; name: string } | { code: string; name: string }[] | null
        }
        setProfile(p)
        const dealerRel = Array.isArray(p.dealers) ? p.dealers[0] : p.dealers
        setDealerCode(p.dealer_id ? (dealerRel?.code ?? '') : 'HQ')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [userId])

  if (state?.success) {
    onSuccess()
    onClose()
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-zinc-200 dark:border-gray-800 rounded-lg p-6 w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Edit User</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 text-zinc-500 dark:text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {fetchError && !loading && (
          <p className="text-red-400 text-sm mb-4">{fetchError}</p>
        )}

        {profile && !loading && (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="userId" value={profile.id} />
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Full Name</label>
              <input
                name="fullName"
                required
                defaultValue={profile.full_name ?? ''}
                className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm focus:border-[#C27E00] focus:ring-1 focus:ring-[#C27E00]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Phone</label>
              <input
                name="phone"
                defaultValue={profile.phone ?? ''}
                className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm focus:border-[#C27E00] focus:ring-1 focus:ring-[#C27E00]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Email</label>
              <EmailInput
                name="email"
                defaultValue={normalizeEmail(profile.email ?? '')}
                className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm focus:border-[#C27E00] focus:ring-1 focus:ring-[#C27E00]"
              />
            </div>
            <div>
              <label className={`${labelClass} mb-1`}>Platform access role</label>
              <select
                name="role"
                defaultValue={profile.role}
                className={selectClass}
              >
                <option value="sales">Sales</option>
                <option value="finance">Finance</option>
                <option value="specialist">Technical Support</option>
                <option value="aurora_manager">Aurora Manager</option>
                <option value="general_manager">General Manager</option>
                <option value="hr">HR</option>
                <option value="it">IT</option>
                {(currentUserRole === 'it' || profile.role === 'inventory_manager') && (
                  <option value="inventory_manager">Inventory Manager</option>
                )}
              </select>
            </div>
            <div>
              <label className={`${labelClass} mb-1`}>Dealer / Platform</label>
              <select
                name="dealerCode"
                value={dealerCode}
                onChange={(e) => setDealerCode(e.target.value)}
                className={selectClass}
              >
                <option value="">— None —</option>
                <option value="HQ">Platform (HQ)</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.code}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
            <OrgStructureFields
              tree={orgTree}
              isPlatform={dealerCode === 'HQ'}
              initialDepartmentId={profile.department_id}
              initialOrgRoleId={profile.org_role_id}
              selectClass={selectClass}
              labelClass={`${labelClass} mb-1`}
            />
            {state?.error && <p className="text-red-400 text-sm">{state.error}</p>}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06900] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-300 dark:border-gray-600 px-4 py-2 text-sm text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function CreateLoginButton({
  personnelId,
  userName,
  personnelEmail,
  onSuccess
}: {
  personnelId: string
  userName: string
  personnelEmail?: string | null
  onSuccess: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')
    const email = normalizeEmail(personnelEmail ?? '')
    if (!email) {
      setErrorMessage('Personnel record has no email. Add email in HR Personnel first.')
      setStatus('error')
      return
    }
    const result = await createLoginForPersonnel(personnelId, email, password)
    if (result.error) {
      setStatus('error')
      setErrorMessage(result.error)
    } else {
      setStatus('success')
      setTimeout(() => {
        onSuccess()
        setIsOpen(false)
        setStatus('idle')
        setPassword('')
      }, 1500)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] transition-colors p-1"
        title="Assign Password / Create Login"
      >
        <KeyRound className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-zinc-200 dark:border-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Assign Password</h3>
              <button onClick={() => { setIsOpen(false); setStatus('idle'); setErrorMessage('') }} className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
              Create login for <span className="text-[#C27E00]">{userName}</span>. Assign password only (email from HR record).
            </p>
            {!personnelEmail?.trim() ? (
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded text-sm">
                No email in HR record. Add email in Personnel detail first, then assign password.
              </div>
            ) : status === 'success' ? (
              <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded flex items-center justify-center">
                <Check className="w-5 h-5 mr-2" />
                Login created! User can now sign in.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Email (from HR)</label>
                  <EmailInput
                    value={normalizeEmail(personnelEmail || '')}
                    readOnly
                    className="w-full bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 rounded px-3 py-2 text-zinc-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Password (min 6 characters)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white dark:bg-black/50 border border-zinc-300 dark:border-gray-700 rounded px-3 py-2 pr-10 text-zinc-900 dark:text-white focus:outline-none focus:border-[#C27E00]"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {status === 'error' && <p className="text-red-400 text-sm">{errorMessage}</p>}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-[#C27E00] hover:bg-[#a06900] text-white font-medium py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Assign Password
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function ToggleLoginAccessButton({
  userId,
  userName,
  loginDisabled,
  currentUserRole,
  onSuccess,
}: {
  userId: string
  userName: string
  loginDisabled: boolean
  currentUserRole?: string
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (currentUserRole !== 'it') return null

  async function handleToggle() {
    const enabling = loginDisabled
    const confirmMsg = enabling
      ? `Enable login for ${userName}?`
      : `Disable login for ${userName}? They will be signed out and cannot sign in until re-enabled.`
    if (!confirm(confirmMsg)) return

    setLoading(true)
    setError(null)
    const result = await setUserLoginAccess(userId, enabling)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSuccess()
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading}
        className={`p-1 transition-colors disabled:opacity-50 ${
          loginDisabled
            ? 'text-amber-500 hover:text-green-400'
            : 'text-zinc-500 dark:text-gray-400 hover:text-amber-500'
        }`}
        title={loginDisabled ? 'Enable login' : 'Disable login'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : loginDisabled ? (
          <ShieldCheck className="w-4 h-4" />
        ) : (
          <Ban className="w-4 h-4" />
        )}
      </button>
      {error ? <span className="text-[10px] text-red-400 max-w-[120px] text-right">{error}</span> : null}
    </div>
  )
}

function DeleteUserButton({
  userId,
  userName,
  onSuccess
}: {
  userId: string
  userName: string
  onSuccess: () => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleDelete = async () => {
    setStatus('loading')
    setErrorMessage('')
    const result = await deleteUser(userId)
    if (result.error) {
      setStatus('error')
      setErrorMessage(result.error)
      return
    }
    onSuccess()
    setShowConfirm(false)
    setStatus('idle')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="text-zinc-500 dark:text-gray-400 hover:text-red-400 transition-colors p-1"
        title="Delete user"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-zinc-200 dark:border-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Delete User</h3>
            <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
              Are you sure you want to delete <span className="text-[#C27E00] font-medium">{userName}</span>? This cannot be undone.
            </p>
            {status === 'error' && <p className="text-red-400 text-sm mb-4">{errorMessage}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={status === 'loading'}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); setStatus('idle'); setErrorMessage('') }}
                className="rounded-md border border-zinc-300 dark:border-gray-600 px-4 py-2 text-sm text-zinc-600 dark:text-gray-300 hover:bg-zinc-200/50 dark:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UserList({
  profiles,
  errors,
  dealers,
  orgTree,
  currentUserRole,
  onRefresh
}: {
  profiles: any[]
  errors: any
  dealers: Dealer[]
  orgTree: OrgDepartmentTree
  currentUserRole?: string
  onRefresh: () => void
}) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">User List ({profiles.length})</h3>
      {errors.profiles && <p className="text-red-500 text-sm mb-2">{errors.profiles}</p>}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded shadow overflow-hidden border border-zinc-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm text-zinc-600 dark:text-gray-300">
          <thead className="bg-zinc-200/50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Access role</th>
              <th className="px-4 py-2 text-left">Sub-department</th>
              <th className="px-4 py-2 text-left">Job title</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Dealer</th>
              <th className="px-4 py-2 text-left">Login</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
            {profiles.map((profile: any) => {
              const isPersonnelOnly = profile.id?.startsWith?.('personnel-') || profile._source === 'personnel'
              const personnelId = profile._personnelId
              const isPlatform = !profile.dealers && !profile.dealer_id
              const org = isPlatform ? orgRoleLabel(profile, orgTree) : null
              return (
                <tr key={profile.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">
                    {isPersonnelOnly && personnelId ? (
                      <Link href={`/dashboard/hr/personnel/${personnelId}`} className="text-[#C27E00] hover:text-[#a06900] transition-colors">
                        {profile.full_name}
                      </Link>
                    ) : (
                      profile.full_name
                    )}
                    {isPersonnelOnly && (
                      <span className="ml-2 text-xs text-yellow-500">(No login)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 capitalize">{profile.role === 'specialist' ? 'Technical Support' : String(profile.role || '—').replace('_', ' ')}</td>
                  <td className="px-4 py-2">{org?.subDepartment ?? '—'}</td>
                  <td className="px-4 py-2">{org?.jobTitle ?? '—'}</td>
                  <td className="px-4 py-2">{profile.phone || '-'}</td>
                  <td className="px-4 py-2">
                    {profile.dealers ? (
                      <span className="text-zinc-900 dark:text-white">{profile.dealers.name}</span>
                    ) : (
                      <span className="text-zinc-500 dark:text-gray-500">Platform</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isPersonnelOnly ? (
                      <span className="text-zinc-500 dark:text-gray-500">—</span>
                    ) : profile._loginDisabled ? (
                      <span className="text-xs font-medium text-amber-500">Disabled</span>
                    ) : (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isPersonnelOnly ? (
                      <div className="flex items-center justify-end gap-1">
                        {personnelId && (
                          <>
                            <CreateLoginButton
                              personnelId={personnelId}
                              userName={profile.full_name ?? 'this user'}
                              personnelEmail={profile._personnelEmail ?? profile.email}
                              onSuccess={onRefresh}
                            />
                            <Link
                              href={`/dashboard/hr/personnel/${personnelId}`}
                              className="text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] transition-colors p-1 inline-flex items-center gap-1 text-xs"
                              title="View in HR Personnel"
                            >
                              <UserPlus className="w-4 h-4" /> HR
                            </Link>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingUserId(profile.id)}
                          className="text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] transition-colors p-1"
                          title="Edit user"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <ResetPasswordButton userId={profile.id} userName={profile.full_name} />
                        <ToggleLoginAccessButton
                          userId={profile.id}
                          userName={profile.full_name ?? 'this user'}
                          loginDisabled={Boolean(profile._loginDisabled)}
                          currentUserRole={currentUserRole}
                          onSuccess={onRefresh}
                        />
                        <DeleteUserButton
                          userId={profile.id}
                          userName={profile.full_name ?? 'this user'}
                          onSuccess={onRefresh}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {profiles.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-4 text-center text-zinc-500 dark:text-gray-500">No profiles found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editingUserId && (
        <EditUserModal
          userId={editingUserId}
          dealers={dealers}
          orgTree={orgTree}
          currentUserRole={currentUserRole}
          onClose={() => setEditingUserId(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}

export function UserManagementContent({
  profiles,
  errors,
  dealers,
  orgTree,
  currentUserRole
}: {
  profiles: any[]
  errors: any
  dealers: Dealer[]
  orgTree: OrgDepartmentTree
  currentUserRole?: string
}) {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Create New User</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">Add a new user to the system</p>
        <UserForm dealers={dealers} orgTree={orgTree} currentUserRole={currentUserRole} />
      </div>
      <UserList
        profiles={profiles}
        errors={errors || {}}
        dealers={dealers}
        orgTree={orgTree}
        currentUserRole={currentUserRole}
        onRefresh={() => router.refresh()}
      />
    </div>
  )
}

