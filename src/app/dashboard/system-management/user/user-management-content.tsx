'use client'

import { useActionState } from 'react'
import { createUser } from '../actions'
import { ResetPasswordButton } from '@/app/dashboard/admin/employees/reset-password-button'

function UserForm() {
  const [state, formAction, isPending] = useActionState(createUser, null)

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
          <label className="block text-sm font-medium text-gray-300">Full Name</label>
          <input
            name="fullName"
            required
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Phone</label>
          <input
            name="phone"
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="+1 555..."
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Email</label>
        <input
          name="email"
          type="email"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="user@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Password</label>
        <input
          name="password"
          type="password"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="••••••••"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Role</label>
          <select
            name="role"
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          >
            <option value="sales" className="bg-black text-white">Sales</option>
            <option value="finance" className="bg-black text-white">Finance</option>
            <option value="specialist" className="bg-black text-white">Specialist</option>
            <option value="aurora_manager" className="bg-black text-white">Aurora Manager</option>
            <option value="general_manager" className="bg-black text-white">General Manager</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Dealer Code</label>
          <input
            name="dealerCode"
            required
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="e.g. HQ"
          />
        </div>
      </div>

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

function UserList({ profiles, errors }: { profiles: any[], errors: any }) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">User List ({profiles.length})</h3>
      {errors.profiles && <p className="text-red-500 text-sm mb-2">{errors.profiles}</p>}
      <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
        <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Dealer</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {profiles.map((profile: any) => (
              <tr key={profile.id}>
                <td className="px-4 py-2 font-medium text-white">{profile.full_name}</td>
                <td className="px-4 py-2 capitalize">{profile.role?.replace('_', ' ')}</td>
                <td className="px-4 py-2">{profile.phone || '-'}</td>
                <td className="px-4 py-2">
                  {profile.dealers ? (
                    <span className="text-white">{profile.dealers.name}</span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <ResetPasswordButton userId={profile.id} userName={profile.full_name} />
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">No profiles found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function UserManagementContent({ profiles, errors }: { profiles: any[], errors: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Create New User</h3>
        <p className="text-sm text-gray-400 mb-4">Add a new user to the system</p>
        <UserForm />
      </div>
      <UserList profiles={profiles} errors={errors || {}} />
    </div>
  )
}

