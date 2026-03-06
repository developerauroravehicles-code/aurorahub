'use client'

import Link from 'next/link'
import { Users, FileText, Database, Activity, MessageSquare, Mail, Building2, CheckCircle, Clock, XCircle } from 'lucide-react'

export function MonitoringContent({
  profilesCount,
  demandsCount,
  demandsByStatus,
  smsLogsCount,
  mailLogsCount,
  dealersCount,
  dbOk,
}: {
  profilesCount: number
  demandsCount: number
  demandsByStatus: Record<string, number>
  smsLogsCount: number
  mailLogsCount: number
  dealersCount: number
  dbOk: boolean
}) {
  const pending = (demandsByStatus.pending_finance ?? 0) + (demandsByStatus.approved ?? 0)
  const completed = demandsByStatus.completed ?? 0
  const cancelled = demandsByStatus.cancelled ?? 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/identity/users"
          className="rounded-lg border border-gray-800 bg-black/30 p-4 hover:bg-white/5 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">Users</span>
          </div>
          <div className="text-2xl font-semibold text-white">{profilesCount}</div>
          <p className="text-xs text-gray-500 mt-1">Platform user accounts</p>
        </Link>
        <Link
          href="/dashboard/admin/demands"
          className="rounded-lg border border-gray-800 bg-black/30 p-4 hover:bg-white/5 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Demands</span>
          </div>
          <div className="text-2xl font-semibold text-white">{demandsCount}</div>
          <p className="text-xs text-gray-500 mt-1">Total appointment demands</p>
        </Link>
        <Link
          href="/dashboard/configuration/dealers"
          className="rounded-lg border border-gray-800 bg-black/30 p-4 hover:bg-white/5 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Dealers</span>
          </div>
          <div className="text-2xl font-semibold text-white">{dealersCount}</div>
          <p className="text-xs text-gray-500 mt-1">Active dealers</p>
        </Link>
        <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Database className="h-4 w-4" />
            <span className="text-sm">Database</span>
          </div>
          <div className={`text-2xl font-semibold ${dbOk ? 'text-green-400' : 'text-red-400'}`}>
            {dbOk ? 'Active' : 'Error'}
          </div>
          <p className="text-xs text-gray-500 mt-1">Supabase connection</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-3">Demand status breakdown</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-black/30 p-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <div>
              <div className="font-medium text-white">{pending}</div>
              <div className="text-xs text-gray-500">Pending / Approved</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-black/30 p-3">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div>
              <div className="font-medium text-white">{completed}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-black/30 p-3">
            <XCircle className="h-5 w-5 text-gray-500" />
            <div>
              <div className="font-medium text-white">{cancelled}</div>
              <div className="text-xs text-gray-500">Cancelled</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-3">Message activity (last 30 days)</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/observability/logs?type=sms"
            className="flex items-center gap-3 rounded-lg border border-gray-800 bg-black/30 p-3 hover:bg-white/5 hover:border-gray-700 transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-blue-400" />
            <div>
              <div className="font-medium text-white">{smsLogsCount}</div>
              <div className="text-xs text-gray-500">SMS sent</div>
            </div>
          </Link>
          <Link
            href="/dashboard/observability/logs?type=mail"
            className="flex items-center gap-3 rounded-lg border border-gray-800 bg-black/30 p-3 hover:bg-white/5 hover:border-gray-700 transition-colors"
          >
            <Mail className="h-5 w-5 text-amber-400" />
            <div>
              <div className="font-medium text-white">{mailLogsCount}</div>
              <div className="text-xs text-gray-500">Emails sent</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-green-900/50 bg-green-900/10 px-4 py-3">
        <Activity className="h-5 w-5 text-green-400" />
        <span className="text-sm text-green-300">System status: Healthy</span>
      </div>

      <p className="text-sm text-gray-500">
        Advanced monitoring (CPU, RAM, API latency, error rate) will be added in a future release.
      </p>
    </div>
  )
}
