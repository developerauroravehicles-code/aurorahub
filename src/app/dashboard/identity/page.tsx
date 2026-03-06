import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, UsersRound, UserCog, ShieldCheck, History } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function IdentityOverviewPage() {
  const supabase = await createClient()
  const [profilesRes, groupsRes, auditRes, permissionsRes] = await Promise.all([
    supabase.from('profiles').select('role'),
    supabase.from('user_groups').select('*', { count: 'exact', head: true }),
    supabase.from('identity_audit_log').select('*', { count: 'exact', head: true }),
    supabase.from('permissions').select('code', { count: 'exact', head: true }),
  ])
  const profiles = profilesRes.data ?? []
  const usersCount = profiles.length
  const rolesCount = new Set(profiles.map((p) => p.role).filter(Boolean)).size
  const groupsCount = groupsRes.error ? 0 : (groupsRes.count ?? 0)
  const sessionCount = auditRes.error ? 0 : (auditRes.count ?? 0)
  const permissionsCount = permissionsRes.error ? 0 : (permissionsRes.count ?? 0)

  const cards = [
    { title: 'Users', value: usersCount, subtitle: 'Platform users', href: '/dashboard/identity/users', icon: Users },
    { title: 'Groups', value: groupsCount, subtitle: 'User groups', href: '/dashboard/identity/groups', icon: UsersRound },
    { title: 'Roles', value: rolesCount, subtitle: 'Active role types', href: '/dashboard/identity/roles', icon: UserCog },
    { title: 'Permissions', value: permissionsCount, subtitle: 'Defined permissions', href: '/dashboard/identity/permissions', icon: ShieldCheck },
    { title: 'Session History', value: sessionCount, subtitle: 'Login events', href: '/dashboard/identity/sessions', icon: History },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Identity – Overview</h2>
        <p className="text-gray-400 text-sm">
          Platform identity management: users, groups, roles and permissions.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-center gap-4 rounded-lg border border-gray-800 bg-white/5 p-5 transition-colors hover:bg-white/10 hover:border-gray-700"
            >
              <div className="rounded-full bg-[#C27E00]/20 p-3">
                <Icon className="h-6 w-6 text-[#C27E00] group-hover:text-[#C27E00]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white group-hover:text-[#C27E00]">{card.title}</div>
                <div className="text-2xl font-semibold text-white">{card.value}</div>
                {card.subtitle && <div className="text-xs text-gray-500 mt-0.5">{card.subtitle}</div>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
