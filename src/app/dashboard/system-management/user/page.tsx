import { createClient } from '@/lib/supabase/server'
import { getSystemData } from '../actions'
import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { UserManagementContent } from './user-management-content'
import { fetchOrgDepartmentTree } from '@/lib/hr-org-structure'

export const dynamic = 'force-dynamic'

export default async function UserManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  const [{ profiles, errors, dealers }, orgTree] = await Promise.all([
    getSystemData(),
    fetchOrgDepartmentTree(supabase),
  ])

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        
        <SystemManagementTabs activeTab="user" />

        {/* Tab Content */}
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <UserManagementContent
            profiles={profiles}
            errors={errors}
            dealers={dealers || []}
            orgTree={orgTree}
            currentUserRole={profile?.role}
          />
        </div>
      </div>
    </div>
  )
}
