import { SystemManagementTabs } from '../system-management-tabs'
import { SystemManagementTitle } from '../system-management-title'
import { getPermissionsWithRoles } from './actions'
import { PermissionsContent } from './permissions-content'

export const dynamic = 'force-dynamic'

export default async function PermissionsPage() {
  const { permissions, rolePermissions } = await getPermissionsWithRoles()

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        <SystemManagementTabs activeTab="permissions" />
      </div>
      <PermissionsContent
        permissions={permissions}
        rolePermissions={rolePermissions}
      />
    </div>
  )
}
