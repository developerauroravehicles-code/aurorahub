'use client'

import { useActionState } from 'react'
import { createEmployee } from './actions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { EmailInput } from '@/components/email-input'

interface CreateEmployeeFormProps {
  dealers: Array<{ id: string; name: string }>
  currentUserRole?: string
  defaultDealerId?: string
}

export function CreateEmployeeForm({ dealers, currentUserRole, defaultDealerId }: CreateEmployeeFormProps) {
  const [state, formAction, isPending] = useActionState(createEmployee, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success) {
      router.refresh()
    }
  }, [state?.success, router])

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 p-6 rounded-lg border border-zinc-200 dark:border-gray-800 shadow max-w-2xl">
      <h2 className="text-lg font-medium mb-4 text-zinc-900 dark:text-white">Add New Employee</h2>
      <form action={formAction} className="space-y-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {state?.error && (
          <div className="col-span-2 bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md text-sm">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="col-span-2 bg-green-900/50 border border-green-800 text-green-200 p-3 rounded-md text-sm">
            Employee created successfully!
          </div>
        )}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Full Name</label>
          <input name="fullName" required className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 w-full rounded text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Phone</label>
          <input name="phone" className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 w-full rounded text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
        </div>
        
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Email</label>
          <EmailInput name="email" required className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 w-full rounded text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Password</label>
          <input name="password" type="password" required className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 w-full rounded text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Role</label>
          <select name="role" required className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 w-full rounded text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]">
            <option value="sales" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">Sales</option>
            <option value="finance" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">Finance</option>
            {currentUserRole !== 'general_manager' && (
              <>
                <option value="specialist" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">Technical Support</option>
                <option value="aurora_manager" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">Aurora Manager</option>
                <option value="general_manager" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">General Manager</option>
                <option value="hr" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">HR</option>
                <option value="it" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">IT</option>
              </>
            )}
          </select>
        </div>

        <div className="col-span-2 sm:col-span-1">
          {currentUserRole === 'general_manager' && defaultDealerId ? (
            <>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Dealer</label>
              <p className="text-zinc-900 dark:text-white py-2">{dealers?.find(d => d.id === defaultDealerId)?.name ?? 'Your dealer'}</p>
              <input type="hidden" name="dealerId" value={defaultDealerId} />
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Dealer</label>
              <select name="dealerId" className="border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 p-2 w-full rounded text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]">
                <option value="" className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">Platform (Aurora)</option>
                {dealers?.map(d => (
                  <option key={d.id} value={d.id} className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">{d.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="col-span-2">
          <button 
            type="submit"
            disabled={isPending}
            className="bg-[#C27E00] text-white px-4 py-2 rounded w-full sm:w-auto hover:bg-[#a06900] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Creating...' : 'Create Employee'}
          </button>
        </div>
      </form>
    </div>
  )
}

