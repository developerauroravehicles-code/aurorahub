'use client'

import { Users, Shield } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  aurora_manager: 'Aurora Manager',
  it: 'IT',
  hr: 'HR',
  sales: 'Sales',
  finance: 'Finance',
  specialist: 'Technical Support',
  general_manager: 'General Manager',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  aurora_manager: 'Full system permissions, super admin',
  it: 'System management, infrastructure, integrations',
  hr: 'Human resources, personnel, leave, payroll',
  sales: 'Sales, demands and reports',
  finance: 'Finance, demands and reports',
  specialist: 'Technical support, work list',
  general_manager: 'General management, demand approvals',
}

export function RolesContent({
  roles,
  counts,
  permCounts = {},
}: {
  roles: readonly string[]
  counts: Record<string, number>
  permCounts?: Record<string, number>
}) {
  return (
    <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <div
            key={role}
            className="rounded-lg border border-gray-800 bg-black/30 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#C27E00]/20 p-2">
                  <Users className="h-5 w-5 text-[#C27E00]" />
                </div>
                <div>
                  <div className="font-medium text-white">{ROLE_LABELS[role] ?? role}</div>
                  <div className="text-xs text-gray-500">{role}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-white">{counts[role] ?? 0}</div>
                <div className="text-xs text-gray-500">users</div>
              </div>
            </div>
            {ROLE_DESCRIPTIONS[role] && (
              <p className="text-xs text-gray-400">{ROLE_DESCRIPTIONS[role]}</p>
            )}
            {permCounts[role] != null && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Shield className="h-3.5 w-3.5 text-[#C27E00]" />
                {permCounts[role]} permissions
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
