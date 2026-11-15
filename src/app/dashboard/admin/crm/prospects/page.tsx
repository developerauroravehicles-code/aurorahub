import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listCrmProspectsAction } from '../actions'
import { NewProspectForm } from '../new-prospect-form'
import { formatInPT } from '@/lib/timezone-defaults'

export const dynamic = 'force-dynamic'

export default async function CrmProspectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const result = await listCrmProspectsAction()
  const prospects = result.prospects ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Prospects</h2>
        <p className="text-sm text-zinc-500">New customer conversations before they become live dealers.</p>
      </div>

      <NewProspectForm />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-white/5 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {prospects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No prospects yet — use <strong className="text-zinc-700 dark:text-gray-300">New prospect</strong> above.
                </td>
              </tr>
            ) : (
              prospects.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50/80 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/crm/prospects/${p.id}`}
                      className="font-medium text-[#C27E00] hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-gray-300">
                    {p.primary_contact_name ?? '—'}
                    {p.primary_contact_email ? (
                      <span className="block text-xs text-zinc-500">{p.primary_contact_email}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.status}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {p.last_note_at
                      ? formatInPT(p.last_note_at, 'MMM d, yyyy h:mm a')
                      : formatInPT(p.created_at, 'MMM d, yyyy')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}