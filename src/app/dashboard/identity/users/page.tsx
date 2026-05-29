import { createClient } from '@/lib/supabase/server'
import { getSystemData } from '@/app/dashboard/system-management/actions'
import { UserManagementContent } from '@/app/dashboard/system-management/user/user-management-content'

export const dynamic = 'force-dynamic'

export default async function IdentityUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  const { profiles, errors, dealers } = await getSystemData()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mt-4">Users</h2>
        <p className="text-zinc-500 dark:text-gray-400 text-sm">Create and manage platform users.</p>
      </div>
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <UserManagementContent
          profiles={profiles}
          errors={errors}
          dealers={dealers || []}
          currentUserRole={profile?.role}
        />
      </div>
    </div>
  )
}
