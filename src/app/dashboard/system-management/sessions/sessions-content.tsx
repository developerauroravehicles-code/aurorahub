'use client'

import { LogIn, LogOut, XCircle, Key, Shield } from 'lucide-react'
import { formatInPT } from '@/lib/timezone-defaults'

const EVENT_LABELS: Record<string, { label: string; icon: typeof LogIn; color: string }> = {
  login_success: { label: 'Login Success', icon: LogIn, color: 'text-green-400' },
  login_failed: { label: 'Login Failed', icon: XCircle, color: 'text-red-400' },
  logout: { label: 'Logout', icon: LogOut, color: 'text-gray-400' },
  password_reset: { label: 'Password Reset', icon: Key, color: 'text-amber-400' },
  role_change: { label: 'Role Change', icon: Shield, color: 'text-blue-400' },
}

function formatDate(d: string) {
  return formatInPT(d, 'MMM d, yyyy h:mm:ss a')
}

export function SessionsContent({ logs }: { logs: Awaited<ReturnType<typeof import('./actions').getSessionLogs>> }) {
  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">User Agent</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No records yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const info = EVENT_LABELS[log.event_type] ?? { label: log.event_type, icon: LogIn, color: 'text-gray-400' }
                  const Icon = info.icon
                  return (
                    <tr key={log.id} className="border-b border-gray-800/50 hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-300">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 ${info.color}`}>
                          <Icon className="h-4 w-4" />
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{log.email ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.ip_address ?? '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-gray-400" title={log.user_agent ?? ''}>
                        {log.user_agent ?? '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
