'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { Users, UserCheck, Clock, AlertTriangle, Shield, FileCheck, Package, ClipboardCheck, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react'

const PROVINCE_LABELS: Record<string, string> = {
  ontario: 'Ontario',
  british_columbia: 'BC',
  alberta: 'Alberta',
  quebec: 'Quebec',
  manitoba: 'Manitoba',
  saskatchewan: 'Sask.',
  nova_scotia: 'NS',
  new_brunswick: 'NB',
  newfoundland: 'NL',
  pei: 'PEI',
  yukon: 'YT',
  nwt: 'NWT',
  nunavut: 'NU',
  out_of_canada: 'Out of CA',
}

const PIE_COLORS = ['#22C55E', '#EAB308', '#EF4444', '#3B82F6', '#C27E00', '#8B5CF6']

export function AnalyticsContent({
  summary,
  chartData,
}: {
  summary: {
    totalPersonnel: number
    activePersonnel: number
    onboardingCount: number
    suspendedCount: number
    activeInstallers: number
    suspendedInstallers: number
    avgQuality: number
    avgCompletion: number
    certsExpiring: number
    certsExpired: number
    complianceExpiring: number
    complianceExpired: number
    pendingChecklists: number
    activeEquipment: number
    totalReviews: number
    completedReviews: number
    totalCompletedDemands: number
    certsExpiringList: { id: string; personnel_id: string; expiry_date: string; certification_type: string | null; personnel: { full_name: string } | null }[]
    complianceExpiringList: { id: string; personnel_id: string; expiry_date: string; document_type: string | null; personnel: { full_name: string } | null }[]
  }
  chartData: {
    statusPie: { name: string; value: number }[]
    provinceBar: { province: string; count: number }[]
    workerTypePie: { name: string; value: number }[]
    hiresByMonth: { month: string; count: number }[]
    completionsByMonth: { month: string; count: number }[]
  }
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'workforce' | 'compliance' | 'performance' | 'trends'>('overview')

  const s = summary
  const provinceChartData = chartData.provinceBar.map((p) => ({
    ...p,
    label: PROVINCE_LABELS[p.province] ?? p.province,
  }))

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-zinc-200 dark:border-gray-800 pb-2 flex-wrap">
        {(['overview', 'workforce', 'compliance', 'performance', 'trends'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-b-0 border-zinc-200 dark:border-gray-800'
                : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white hover:bg-zinc-200/50 dark:bg-white/5'
            }`}
          >
            {tab === 'overview' && <BarChart3 className="w-4 h-4" />}
            {tab === 'workforce' && <Users className="w-4 h-4" />}
            {tab === 'compliance' && <Shield className="w-4 h-4" />}
            {tab === 'performance' && <TrendingUp className="w-4 h-4" />}
            {tab === 'trends' && <PieChartIcon className="w-4 h-4" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <KpiCard title="Total Personnel" value={s.totalPersonnel} icon={<Users className="w-5 h-5" />} />
            <KpiCard title="Active" value={s.activePersonnel} icon={<UserCheck className="w-5 h-5" />} color="text-green-400" />
            <KpiCard title="Onboarding" value={s.onboardingCount} icon={<Clock className="w-5 h-5" />} color="text-yellow-400" />
            <KpiCard title="Active Installers" value={s.activeInstallers} icon={<Users className="w-5 h-5" />} color="text-[#C27E00]" />
            <KpiCard title="Certs Expiring (30d)" value={s.certsExpiring} icon={<AlertTriangle className="w-5 h-5" />} color={s.certsExpiring > 0 ? 'text-yellow-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Certs Expired" value={s.certsExpired} icon={<AlertTriangle className="w-5 h-5" />} color={s.certsExpired > 0 ? 'text-red-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Compliance Expiring" value={s.complianceExpiring} icon={<Shield className="w-5 h-5" />} color={s.complianceExpiring > 0 ? 'text-yellow-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Pending Checklists" value={s.pendingChecklists} icon={<ClipboardCheck className="w-5 h-5" />} color={s.pendingChecklists > 0 ? 'text-amber-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Active Equipment" value={s.activeEquipment} icon={<Package className="w-5 h-5" />} />
            <KpiCard title="Completed Demands (1y)" value={s.totalCompletedDemands} icon={<FileCheck className="w-5 h-5" />} color="text-green-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">Personnel by Status</h3>
              {chartData.statusPie.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500 py-8">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={chartData.statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {chartData.statusPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v) => [`${v ?? ''}`, '']} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">Top Provinces</h3>
              {provinceChartData.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500 py-8">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={provinceChartData} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={70} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v) => [v ?? '', '']} />
                    <Bar dataKey="count" fill="#C27E00" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workforce' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">Personnel by Worker Type</h3>
              {chartData.workerTypePie.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500 py-8">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData.workerTypePie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                      {chartData.workerTypePie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v) => [`${v ?? ''}`, '']} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} formatter={(v) => <span className="text-zinc-600 dark:text-gray-300">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">Personnel by Province</h3>
              {provinceChartData.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500 py-8">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={provinceChartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#3B82F6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Workforce Summary</h3>
              <Link href="/dashboard/hr/personnel" className="text-sm text-[#C27E00] hover:underline">View Personnel →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="p-3 rounded bg-zinc-100/90 dark:bg-black/30"><span className="text-zinc-500 dark:text-gray-400">Total</span> <span className="text-zinc-900 dark:text-white font-semibold block">{s.totalPersonnel}</span></div>
              <div className="p-3 rounded bg-zinc-100/90 dark:bg-black/30"><span className="text-zinc-500 dark:text-gray-400">Active</span> <span className="text-green-400 font-semibold block">{s.activePersonnel}</span></div>
              <div className="p-3 rounded bg-zinc-100/90 dark:bg-black/30"><span className="text-zinc-500 dark:text-gray-400">Onboarding</span> <span className="text-yellow-400 font-semibold block">{s.onboardingCount}</span></div>
              <div className="p-3 rounded bg-zinc-100/90 dark:bg-black/30"><span className="text-zinc-500 dark:text-gray-400">Suspended</span> <span className="text-red-400 font-semibold block">{s.suspendedCount}</span></div>
              <div className="p-3 rounded bg-zinc-100/90 dark:bg-black/30"><span className="text-zinc-500 dark:text-gray-400">Installers (Active)</span> <span className="text-[#C27E00] font-semibold block">{s.activeInstallers}</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compliance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Certs Expiring (30d)" value={s.certsExpiring} color={s.certsExpiring > 0 ? 'text-yellow-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Certs Expired" value={s.certsExpired} color={s.certsExpired > 0 ? 'text-red-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Compliance Docs Expiring" value={s.complianceExpiring} color={s.complianceExpiring > 0 ? 'text-yellow-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Compliance Docs Expired" value={s.complianceExpired} color={s.complianceExpired > 0 ? 'text-red-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Pending Checklists" value={s.pendingChecklists} color={s.pendingChecklists > 0 ? 'text-amber-400' : 'text-zinc-500 dark:text-gray-400'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Certifications Expiring Soon</h3>
                <Link href="/dashboard/hr/training" className="text-sm text-[#C27E00] hover:underline">Training →</Link>
              </div>
              {s.certsExpiringList.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500">None expiring in 30 days.</p>
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                  {s.certsExpiringList.map((c) => (
                    <li key={c.id} className="flex justify-between text-sm gap-2">
                      <Link href={`/dashboard/hr/personnel/${c.personnel_id}`} className="text-[#C27E00] hover:underline truncate">
                        {c.personnel?.full_name ?? '—'} — {c.certification_type ?? 'Cert'}
                      </Link>
                      <span className="text-yellow-400 shrink-0">{new Date(c.expiry_date).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Compliance Documents Expiring</h3>
                <Link href="/dashboard/hr/compliance" className="text-sm text-[#C27E00] hover:underline">Compliance →</Link>
              </div>
              {s.complianceExpiringList.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500">None expiring in 30 days.</p>
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                  {s.complianceExpiringList.map((d) => (
                    <li key={d.id} className="flex justify-between text-sm gap-2">
                      <Link href={`/dashboard/hr/personnel/${d.personnel_id}`} className="text-[#C27E00] hover:underline truncate">
                        {d.personnel?.full_name ?? '—'} — {d.document_type ?? 'Document'}
                      </Link>
                      <span className="text-yellow-400 shrink-0">{new Date(d.expiry_date).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard title="Active Installers" value={s.activeInstallers} color="text-[#C27E00]" />
            <KpiCard title="Suspended Installers" value={s.suspendedInstallers} color={s.suspendedInstallers > 0 ? 'text-red-400' : 'text-zinc-500 dark:text-gray-400'} />
            <KpiCard title="Avg Quality Score" value={s.avgQuality} subtitle="/5" />
            <KpiCard title="Avg Completion Rate" value={`${s.avgCompletion}%`} />
            <KpiCard title="Performance Reviews" value={s.totalReviews} subtitle={`${s.completedReviews} done`} />
            <KpiCard title="Completed Demands (1y)" value={s.totalCompletedDemands} color="text-green-400" />
          </div>

          <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Performance Overview</h3>
              <Link href="/dashboard/hr/performance" className="text-sm text-[#C27E00] hover:underline">Performance →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-zinc-500 dark:text-gray-400 mb-2">Installer Quality</p>
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#C27E00] rounded-full" style={{ width: `${Math.min(100, (s.avgQuality / 5) * 100)}%` }} />
                </div>
                <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">{s.avgQuality} / 5 average</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-gray-400 mb-2">Completion Rate</p>
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, s.avgCompletion)}%` }} />
                </div>
                <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">{s.avgCompletion}% average</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">New Hires by Month (Last 12 Months)</h3>
              {chartData.hiresByMonth.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500 py-8">No hires in the last 12 months.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData.hiresByMonth} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="count" name="New Hires" fill="#3B82F6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400 mb-3">Completed Demands by Month (Last 6 Months)</h3>
              {chartData.completionsByMonth.length === 0 ? (
                <p className="text-zinc-500 dark:text-gray-500 py-8">No completions in the last 6 months.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData.completionsByMonth} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="count" name="Completed" fill="#22C55E" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color = 'text-zinc-900 dark:text-white',
}: {
  title: string
  value: number | string
  subtitle?: string
  icon?: React.ReactNode
  color?: string
}) {
  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-gray-800 p-4 md:p-6 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-gray-400">{title}</h3>
        {icon && <span className="text-zinc-500 dark:text-gray-500">{icon}</span>}
      </div>
      <p className={`text-2xl md:text-3xl font-bold ${color}`}>
        {value}
        {subtitle && <span className="text-lg text-zinc-500 dark:text-gray-500 font-normal">{subtitle}</span>}
      </p>
    </div>
  )
}
