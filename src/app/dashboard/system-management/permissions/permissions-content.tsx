'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setRolePermission, grantRoleAllCategory, revokeRoleAllCategory } from './actions'

const ROLES = ['aurora_manager', 'it', 'hr', 'sales', 'finance', 'specialist', 'general_manager'] as const
import { Loader2, Check, Minus, CheckSquare, Square } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  aurora_manager: 'Aurora Manager',
  it: 'IT',
  hr: 'HR',
  sales: 'Sales',
  finance: 'Finance',
  specialist: 'Technical Support',
  general_manager: 'General Manager',
}

const CATEGORY_ORDER = ['Organization', 'System', 'Communication', 'Dealers', 'Service Desk', 'Logs', 'Permissions']

export function PermissionsContent({
  permissions,
  rolePermissions,
}: {
  permissions: Array<{ code: string; name: string; description: string | null; category: string }>
  rolePermissions: Record<string, Set<string>>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const byCategory = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  async function togglePerm(role: string, code: string, current: boolean) {
    setLoading(`${role}-${code}`)
    setError('')
    const result = await setRolePermission(role, code, !current)
    if (result.error) setError(result.error)
    else router.refresh()
    setLoading(null)
  }

  async function toggleCategory(role: string, category: string, grant: boolean) {
    setLoading(`${role}-${category}`)
    setError('')
    const result = grant
      ? await grantRoleAllCategory(role, category)
      : await revokeRoleAllCategory(role, category)
    if (result.error) setError(result.error)
    else router.refresh()
    setLoading(null)
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Permission Assignment</h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
          Define who can view and manage what across the system on a role basis.
        </p>
      </div>
      {error && (
        <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-zinc-500 dark:text-gray-400 font-medium">Permission / Role</th>
              {ROLES.map((r) => (
                <th key={r} className="px-3 py-3 text-center text-zinc-500 dark:text-gray-400 font-medium min-w-[100px]">
                  {ROLE_LABELS[r] ?? r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
            {CATEGORY_ORDER.filter((c) => byCategory[c]).map((category) => (
              <React.Fragment key={category}>
                <tr className="bg-zinc-200/80 dark:bg-gray-900/50">
                  <td colSpan={ROLES.length + 1} className="px-4 py-2 text-zinc-600 dark:text-gray-300 font-medium">
                    {category}
                    <span className="ml-2 text-xs text-zinc-500 dark:text-gray-500">
                      ({byCategory[category].length} yetki)
                    </span>
                  </td>
                </tr>
                {byCategory[category].map((p) => (
                  <tr key={p.code} className="hover:bg-zinc-200/50 dark:bg-white/5">
                    <td className="px-4 py-2">
                      <div className="text-zinc-900 dark:text-white">{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5">{p.description}</div>
                      )}
                      <code className="text-xs text-zinc-600 dark:text-gray-600">{p.code}</code>
                    </td>
                    {ROLES.map((role) => {
                      const has = rolePermissions[role]?.has(p.code) ?? false
                      const isAuroraManager = role === 'aurora_manager'
                      const key = `${role}-${p.code}`
                      const isLoading = loading === key
                      return (
                        <td key={role} className="px-3 py-2 text-center">
                          {isAuroraManager ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-green-500/20 text-green-400" title="Aurora Manager tüm yetkilere sahip">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => togglePerm(role, p.code, has)}
                              disabled={!!loading}
                              className={`
                                inline-flex items-center justify-center w-8 h-8 rounded transition-colors
                                ${has ? 'bg-[#C27E00]/30 text-[#C27E00] hover:bg-[#C27E00]/50' : 'bg-gray-800 text-zinc-500 dark:text-gray-500 hover:bg-gray-700'}
                                disabled:opacity-50
                              `}
                              title={has ? 'Kaldır' : 'Ver'}
                            >
                              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : has ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-zinc-50 dark:bg-black/20">
                  <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 text-xs">
                    Kategori toplu işlem
                  </td>
                  {ROLES.map((role) => {
                    const isAuroraManager = role === 'aurora_manager'
                    const count = byCategory[category].filter((p) => rolePermissions[role]?.has(p.code)).length
                    const allGranted = count === byCategory[category].length
                    const key = `${role}-${category}`
                    const isLoading = loading === key
                    return (
                      <td key={role} className="px-3 py-2 text-center">
                        {isAuroraManager ? (
                          <span className="text-zinc-500 dark:text-gray-500">—</span>
                        ) : (
                          <button
                            onClick={() => toggleCategory(role, category, !allGranted)}
                            disabled={!!loading}
                            className="text-xs px-2 py-1 rounded bg-zinc-200/50 dark:bg-white/5 hover:bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : allGranted ? 'Tümünü kaldır' : 'Tümünü ver'}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
