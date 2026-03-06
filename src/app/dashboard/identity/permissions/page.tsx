import { getPermissionsWithRoles } from '@/app/dashboard/system-management/permissions/actions'
import { PermissionsContent } from '@/app/dashboard/system-management/permissions/permissions-content'

export const dynamic = 'force-dynamic'

export default async function IdentityPermissionsPage() {
  const { permissions, rolePermissions } = await getPermissionsWithRoles()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Permission Assignment</h2>
        <p className="text-gray-400 text-sm">Assign permissions to roles and manage platform access.</p>
      </div>
      <PermissionsContent permissions={permissions} rolePermissions={rolePermissions} />
    </div>
  )
}
