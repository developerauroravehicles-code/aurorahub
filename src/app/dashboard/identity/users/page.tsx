import { getSystemData } from '@/app/dashboard/system-management/actions'
import { UserManagementContent } from '@/app/dashboard/system-management/user/user-management-content'

export const dynamic = 'force-dynamic'

export default async function IdentityUsersPage() {
  const { profiles, errors, dealers } = await getSystemData()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Users</h2>
        <p className="text-gray-400 text-sm">Create and manage platform users.</p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <UserManagementContent profiles={profiles} errors={errors} dealers={dealers || []} />
      </div>
    </div>
  )
}
