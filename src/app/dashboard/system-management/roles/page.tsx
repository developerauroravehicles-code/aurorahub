import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RolesContent } from './roles-content'
import { ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

const ROLES = ['aurora_manager', 'it', 'hr', 'sales', 'finance', 'specialist', 'general_manager'] as const

export default async function RolesPage() {
  const supabase = await createClient()
  const [profilesRes, permsRes] = await Promise.all([
    supabase.from('profiles').select('role').not('role', 'is', null),
    supabase.from('role_permissions').select('role'),
  ])
  const counts = (profilesRes.data ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.role ?? ''] = (acc[p.role ?? ''] ?? 0) + 1
    return acc
  }, {})
  const permCounts = (permsRes.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.role] = (acc[row.role] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mt-4">Roles</h2>
        <p className="text-zinc-500 dark:text-gray-400 text-sm">
          View platform roles, user counts and permission distribution.
        </p>
        <Link
          href="/dashboard/identity/permissions"
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#C27E00]/50 bg-[#C27E00]/10 px-4 py-2 text-sm font-medium text-[#C27E00] hover:bg-[#C27E00]/20 transition-colors"
        >
          <ShieldCheck className="h-4 w-4" />
          Permission Assignment
        </Link>
      </div>
      <RolesContent roles={ROLES} counts={counts} permCounts={permCounts} />
    </div>
  )
}
