'use client'

import { ResetPasswordButton } from '@/app/dashboard/admin/employees/reset-password-button'

export function DatabaseManagementContent({ dealers, profiles, errors }: { dealers: any[], profiles: any[], errors: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Database Contents (Debug)</h3>
        <p className="text-sm text-gray-400 mb-4">View all data in the database for debugging purposes</p>
      </div>

      {/* Dealers List */}
      <div>
        <h4 className="font-semibold text-gray-400 mb-2">Dealers ({dealers.length})</h4>
        {errors.dealers && <p className="text-red-500 text-sm">{errors.dealers}</p>}
        <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {dealers.map((dealer: any) => (
                <tr key={dealer.id}>
                  <td className="px-4 py-2 font-medium text-white">{dealer.name}</td>
                  <td className="px-4 py-2 text-[#C27E00]">{dealer.code}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs font-mono">{dealer.id}</td>
                </tr>
              ))}
              {dealers.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No dealers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profiles List */}
      <div>
        <h4 className="font-semibold text-gray-400 mb-2">User Profiles ({profiles.length})</h4>
        {errors.profiles && <p className="text-red-500 text-sm">{errors.profiles}</p>}
        <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Dealer</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {profiles.map((profile: any) => (
                <tr key={profile.id}>
                  <td className="px-4 py-2 font-medium text-white">{profile.full_name}</td>
                  <td className="px-4 py-2 capitalize">{profile.role?.replace('_', ' ')}</td>
                  <td className="px-4 py-2">{profile.phone || '-'}</td>
                  <td className="px-4 py-2">
                    {profile.dealers ? (
                      <span className="text-white">{profile.dealers.name}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ResetPasswordButton userId={profile.id} userName={profile.full_name} />
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">No profiles found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

