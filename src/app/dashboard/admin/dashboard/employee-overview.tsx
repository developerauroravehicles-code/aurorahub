'use client'

import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { EmployeeRoleCounts } from './actions'

const ROLE_COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#8B5CF6']
const ROLE_LABELS: Record<keyof EmployeeRoleCounts, string> = {
  sales: 'Sales',
  finance: 'Finance',
  specialist: 'Specialist',
  aurora_manager: 'Aurora Manager'
}

export function EmployeeOverview({ counts }: { counts: EmployeeRoleCounts }) {
  const data = (
    ['sales', 'finance', 'specialist', 'aurora_manager'] as const
  )
    .map((key, i) => ({
      name: ROLE_LABELS[key],
      value: counts[key],
      color: ROLE_COLORS[i]
    }))
    .filter(d => d.value > 0)

  const total = counts.sales + counts.finance + counts.specialist + counts.aurora_manager

  return (
    <div className="bg-white/5 border border-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Employee Overview</h2>
        <Link
          href="/dashboard/admin/employees"
          className="text-sm text-[#C27E00] hover:text-[#a06900] transition-colors"
        >
          Manage →
        </Link>
      </div>

      {total === 0 ? (
        <p className="text-gray-500 text-sm">No employees yet.</p>
      ) : (
        <div className="min-h-[180px]">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | undefined) => [`${value ?? 0} (${total > 0 && value != null ? Math.round((value / total) * 100) : 0}%)`, '']}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => <span className="text-gray-300">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {(['sales', 'finance', 'specialist', 'aurora_manager'] as const).map((key, i) => (
              <span
                key={key}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: `${ROLE_COLORS[i]}20`, color: ROLE_COLORS[i] }}
              >
                {ROLE_LABELS[key]}: {counts[key]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
