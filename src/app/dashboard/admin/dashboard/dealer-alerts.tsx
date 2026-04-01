'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, FileCheck, Receipt } from 'lucide-react'
import { getDealerAlerts, type DealerAlert } from './actions'

const ALERT_CONFIG: Record<DealerAlert['type'], { label: string; href: string; icon: typeof Clock; color: string }> = {
  overdue: {
    label: 'Overdue appointment',
    href: '/dashboard/admin/demands',
    icon: Clock,
    color: 'text-red-400'
  },
  pending_finance: {
    label: 'Pending finance approval',
    href: '/dashboard/admin/demands?status=pending_finance',
    icon: FileCheck,
    color: 'text-yellow-400'
  },
  incomplete_invoice: {
    label: 'Incomplete invoice (Drive)',
    href: '/dashboard/admin/invoices',
    icon: Receipt,
    color: 'text-amber-400'
  }
}

export function DealerAlertsWidget() {
  const [alerts, setAlerts] = useState<DealerAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDealerAlerts().then(res => {
      setLoading(false)
      if (!res.error) setAlerts(res.alerts)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-zinc-200/50 dark:bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-zinc-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-900 dark:text-white mb-4">Dealer Alerts</h2>
        <p className="text-zinc-500 dark:text-zinc-500 dark:text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-200/50 dark:bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-zinc-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Dealer Alerts
        </h2>
        {alerts.length > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-500 dark:text-gray-500 text-sm">No alerts at this time.</p>
      ) : (
        <ul className="space-y-2 max-h-[240px] overflow-y-auto">
          {alerts.slice(0, 20).map((alert, i) => {
            const config = ALERT_CONFIG[alert.type]
            const Icon = config.icon
            return (
              <li key={`${alert.dealerId}-${alert.type}-${i}`}>
                <Link
                  href={config.href}
                  className="flex items-center gap-3 p-3 rounded-lg border border-zinc-300 dark:border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-black/20 hover:bg-zinc-100/90 dark:bg-black/30 transition-colors"
                >
                  <Icon className={`w-4 h-4 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-900 dark:text-white truncate">{alert.dealerName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 dark:text-gray-500">{config.label}</p>
                  </div>
                  {alert.count > 1 && (
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-500 dark:text-gray-400">{alert.count}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
