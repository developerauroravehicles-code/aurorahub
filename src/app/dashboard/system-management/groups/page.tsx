import { getGroups, getGroupMembers, getProfilesForGroup } from './actions'
import { GroupsContent } from './groups-content'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const [groups, allProfiles] = await Promise.all([getGroups(), getProfilesForGroup(null)])
  const initialMembers: Record<string, Awaited<ReturnType<typeof getGroupMembers>>[number][]> = {}
  for (const g of groups) {
    initialMembers[g.id] = await getGroupMembers(g.id)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">User Groups</h2>
        <p className="text-gray-400 text-sm">
          Manage users in groups. Groups can be used for authorization or notification targets.
        </p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <GroupsContent groups={groups} initialMembers={initialMembers} allProfiles={allProfiles} />
      </div>
    </div>
  )
}
