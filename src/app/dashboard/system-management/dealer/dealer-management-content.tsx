'use client'

import { useActionState } from 'react'
import { createDealer } from '../actions'

function DealerForm() {
  const [state, formAction, isPending] = useActionState(createDealer, null)

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

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Dealer Name</label>
        <input
          name="name"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="e.g. Aurora HQ"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Dealer Code</label>
        <input
          name="code"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="e.g. HQ"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Address</label>
        <input
          name="address"
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="e.g. Main Street, 123"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex w-full justify-center rounded-md bg-[#C27E00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#a06900] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C27E00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Creating Dealer...' : 'Create Dealer'}
      </button>
    </form>
  )
}

function DealerList({ dealers, errors }: { dealers: any[], errors: any }) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">Dealer List ({dealers.length})</h3>
      {errors.dealers && <p className="text-red-500 text-sm mb-2">{errors.dealers}</p>}
      <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
        <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {dealers.map((dealer: any) => (
              <tr key={dealer.id}>
                <td className="px-4 py-2 font-medium text-white">{dealer.name}</td>
                <td className="px-4 py-2 text-[#C27E00]">{dealer.code}</td>
                <td className="px-4 py-2 text-gray-500 text-xs font-mono">{dealer.id}</td>
              </tr>
            ))}
            {dealers.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No dealers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DealerManagementContent({ dealers, errors }: { dealers: any[], errors: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Create New Dealer</h3>
        <p className="text-sm text-gray-400 mb-4">Add a new dealer to the system</p>
        <DealerForm />
      </div>
      <DealerList dealers={dealers} errors={errors || {}} />
    </div>
  )
}

