'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import {
  getSmsLogsForLogsPage,
  getDemandLogsForLogsPage,
  getMailLogsForLogsPage,
  type SmsLogEntry,
  type DemandLogEntry,
  type MailLogEntry,
} from './actions'

type LogType = 'sms' | 'mail' | 'demands'

const STORAGE_SMS = 'aurora_logs_filters_sms'
const STORAGE_MAIL = 'aurora_logs_filters_mail'
const STORAGE_DEMANDS = 'aurora_logs_filters_demands'

const defaultSmsFilters = { dateFrom: '', dateTo: '', customerName: '' }
const defaultMailFilters = { dateFrom: '', dateTo: '', mailType: '', recipientEmail: '' }
const defaultDemandFilters = { dateFrom: '', dateTo: '', demandId: '', actorId: '' }

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function LogsContent({ initialType }: { initialType: LogType }) {
  const logType = initialType
  const [smsLogs, setSmsLogs] = useState<SmsLogEntry[]>([])
  const [mailLogs, setMailLogs] = useState<MailLogEntry[]>([])
  const [demandLogs, setDemandLogs] = useState<DemandLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingSmsLog, setViewingSmsLog] = useState<SmsLogEntry | null>(null)

  const [smsFilters, setSmsFilters] = useState(defaultSmsFilters)
  const [mailFilters, setMailFilters] = useState(defaultMailFilters)
  const [demandFilters, setDemandFilters] = useState(defaultDemandFilters)

  const loadSmsLogs = useCallback(async (filters: typeof defaultSmsFilters) => {
    setLoading(true)
    setError(null)
    const res = await getSmsLogsForLogsPage({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      customerName: filters.customerName || undefined,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else setSmsLogs(res.logs ?? [])
  }, [])

  const loadMailLogs = useCallback(async (filters: typeof defaultMailFilters) => {
    setLoading(true)
    setError(null)
    const res = await getMailLogsForLogsPage({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      mailType: filters.mailType || undefined,
      recipientEmail: filters.recipientEmail || undefined,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else setMailLogs(res.logs ?? [])
  }, [])

  const loadDemandLogs = useCallback(async (filters: typeof defaultDemandFilters) => {
    setLoading(true)
    setError(null)
    const res = await getDemandLogsForLogsPage({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      demandId: filters.demandId || undefined,
      actorId: filters.actorId || undefined,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else setDemandLogs(res.logs ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (logType === 'sms') {
        const f = readStored(STORAGE_SMS, defaultSmsFilters)
        setSmsFilters(f)
        setLoading(true)
        setError(null)
        const res = await getSmsLogsForLogsPage({
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          customerName: f.customerName || undefined,
        })
        if (cancelled) return
        setLoading(false)
        if (res.error) setError(res.error)
        else setSmsLogs(res.logs ?? [])
      } else if (logType === 'mail') {
        const f = readStored(STORAGE_MAIL, defaultMailFilters)
        setMailFilters(f)
        setLoading(true)
        setError(null)
        const res = await getMailLogsForLogsPage({
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          mailType: f.mailType || undefined,
          recipientEmail: f.recipientEmail || undefined,
        })
        if (cancelled) return
        setLoading(false)
        if (res.error) setError(res.error)
        else setMailLogs(res.logs ?? [])
      } else {
        const f = readStored(STORAGE_DEMANDS, defaultDemandFilters)
        setDemandFilters(f)
        setLoading(true)
        setError(null)
        const res = await getDemandLogsForLogsPage({
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          demandId: f.demandId || undefined,
          actorId: f.actorId || undefined,
        })
        if (cancelled) return
        setLoading(false)
        if (res.error) setError(res.error)
        else setDemandLogs(res.logs ?? [])
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [logType])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Logs</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
          Central log view. Select a log type from the tabs above to view the relevant records.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-900/50 border border-red-800 text-red-200 text-sm">
          {error}
        </div>
      )}

      {logType === 'sms' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">From date</label>
              <input
                type="date"
                value={smsFilters.dateFrom}
                onChange={(e) => setSmsFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">To date</label>
              <input
                type="date"
                value={smsFilters.dateTo}
                onChange={(e) => setSmsFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Customer name</label>
              <input
                type="text"
                value={smsFilters.customerName}
                onChange={(e) => setSmsFilters((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Search recipient..."
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm w-48"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem(STORAGE_SMS, JSON.stringify(smsFilters))
                }
                loadSmsLogs(smsFilters)
              }}
              disabled={loading}
              className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined')                 sessionStorage.removeItem(STORAGE_SMS)
                const cleared = { ...defaultSmsFilters }
                setSmsFilters(cleared)
                loadSmsLogs(cleared)
              }}
              disabled={loading}
              className="border border-zinc-300 dark:border-gray-600 text-zinc-600 dark:text-gray-300 hover:bg-zinc-200 dark:bg-white/10 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
          <div className="overflow-x-auto border border-zinc-200 dark:border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white dark:bg-black/50 text-left">
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Time</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Recipient</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Phone</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Message type</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Trigger</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium w-24">Message</th>
                </tr>
              </thead>
              <tbody>
                {smsLogs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-500 dark:text-gray-500">
                      No SMS logs found.
                    </td>
                  </tr>
                ) : (
                  smsLogs.map((log) => (
                    <tr key={log.id} className="border-t border-zinc-200 dark:border-gray-800 hover:bg-zinc-200/50 dark:bg-white/5">
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">
                        {formatInTimeZone(new Date(log.sent_at), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd, h:mm a')}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-zinc-900 dark:text-white">{log.recipient_name || '—'}</span>
                        <span className="text-zinc-500 dark:text-gray-500 ml-1">({log.recipient_type})</span>
                      </td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 font-mono text-xs">{log.phone_number}</td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{log.message_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            log.triggered_by === 'manual' ? 'bg-[#C27E00]/30 text-[#C27E00]' : 'bg-gray-700 text-zinc-500 dark:text-gray-400'
                          }`}
                        >
                          {log.triggered_by}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setViewingSmsLog(log)}
                          className="text-[#C27E00] hover:underline text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {viewingSmsLog && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50 dark:bg-black/60 p-4"
              onClick={() => setViewingSmsLog(null)}
            >
              <div
                className="bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-3 border-b border-zinc-300 dark:border-gray-700 flex justify-between items-center">
                  <h5 className="font-semibold text-zinc-900 dark:text-white">
                    Message — {viewingSmsLog.recipient_name || '—'} ({viewingSmsLog.message_type.replace(/_/g, ' ')})
                  </h5>
                  <button
                    type="button"
                    onClick={() => setViewingSmsLog(null)}
                    className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  <pre className="text-sm text-zinc-600 dark:text-gray-300 whitespace-pre-wrap break-words font-sans">
                    {viewingSmsLog.message_content ?? 'Message content was not recorded.'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {logType === 'mail' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">From date</label>
              <input
                type="date"
                value={mailFilters.dateFrom}
                onChange={(e) => setMailFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">To date</label>
              <input
                type="date"
                value={mailFilters.dateTo}
                onChange={(e) => setMailFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={mailFilters.mailType}
                onChange={(e) => setMailFilters((f) => ({ ...f, mailType: e.target.value }))}
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="report">Report</option>
                <option value="scheduled_report">Scheduled Report</option>
                <option value="invoice_bulk">Invoice Bulk (Manual)</option>
                <option value="daily_dealer_invoices_auto">Daily Dealer Invoices (Auto)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Recipient</label>
              <input
                type="text"
                value={mailFilters.recipientEmail}
                onChange={(e) => setMailFilters((f) => ({ ...f, recipientEmail: e.target.value }))}
                placeholder="Search by email..."
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm w-48"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem(STORAGE_MAIL, JSON.stringify(mailFilters))
                }
                loadMailLogs(mailFilters)
              }}
              disabled={loading}
              className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined')                 sessionStorage.removeItem(STORAGE_MAIL)
                const cleared = { ...defaultMailFilters }
                setMailFilters(cleared)
                loadMailLogs(cleared)
              }}
              disabled={loading}
              className="border border-zinc-300 dark:border-gray-600 text-zinc-600 dark:text-gray-300 hover:bg-zinc-200 dark:bg-white/10 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
          <div className="overflow-x-auto border border-zinc-200 dark:border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white dark:bg-black/50 text-left">
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Time</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Recipients</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Subject</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Type</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Report</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Sender</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mailLogs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-gray-500">
                      No mail logs found.
                    </td>
                  </tr>
                ) : (
                  mailLogs.map((log) => (
                    <tr key={log.id} className="border-t border-zinc-200 dark:border-gray-800 hover:bg-zinc-200/50 dark:bg-white/5">
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">
                        {formatInTimeZone(new Date(log.sent_at), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd, h:mm a')}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300 text-xs max-w-[180px] truncate" title={log.recipient_emails.join(', ')}>
                        {log.recipient_emails.join(', ')}
                      </td>
                      <td className="px-4 py-2 text-zinc-900 dark:text-white max-w-[200px] truncate" title={log.subject}>
                        {log.subject}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{log.mail_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 max-w-[120px] truncate">{log.report_title || '—'}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{log.sender_name || '—'}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            log.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                          }`}
                        >
                          {log.success ? 'OK' : 'Failed'}
                        </span>
                        {!log.success && log.error_message && (
                          <span className="text-xs text-red-400 ml-1" title={log.error_message}>
                            ({log.error_message.slice(0, 30)}…)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {logType === 'demands' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">From date</label>
              <input
                type="date"
                value={demandFilters.dateFrom}
                onChange={(e) => setDemandFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">To date</label>
              <input
                type="date"
                value={demandFilters.dateTo}
                onChange={(e) => setDemandFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Demand ID</label>
              <input
                type="text"
                value={demandFilters.demandId}
                onChange={(e) => setDemandFilters((f) => ({ ...f, demandId: e.target.value }))}
                placeholder="UUID..."
                className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm w-48"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem(STORAGE_DEMANDS, JSON.stringify(demandFilters))
                }
                loadDemandLogs(demandFilters)
              }}
              disabled={loading}
              className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined')                 sessionStorage.removeItem(STORAGE_DEMANDS)
                const cleared = { ...defaultDemandFilters }
                setDemandFilters(cleared)
                loadDemandLogs(cleared)
              }}
              disabled={loading}
              className="border border-zinc-300 dark:border-gray-600 text-zinc-600 dark:text-gray-300 hover:bg-zinc-200 dark:bg-white/10 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
          <div className="overflow-x-auto border border-zinc-200 dark:border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white dark:bg-black/50 text-left">
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Time</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Demand</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Customer</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Updated by</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Previous</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-zinc-500 dark:text-gray-400 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {demandLogs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-gray-500">
                      No demand logs found.
                    </td>
                  </tr>
                ) : (
                  demandLogs.map((log) => (
                    <tr key={log.id} className="border-t border-zinc-200 dark:border-gray-800 hover:bg-zinc-200/50 dark:bg-white/5">
                      <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">
                        {formatInTimeZone(new Date(log.created_at), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd, h:mm a')}
                      </td>
                      <td className="px-4 py-2">
                        <a
                          href={`/dashboard/admin/demands/${log.demand_id}`}
                          className="text-[#C27E00] hover:underline font-mono text-xs"
                          title={log.demand_id}
                        >
                          {log.demand_number ? `#${log.demand_number}` : log.demand_id}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-zinc-900 dark:text-white">{log.customer_name || '—'}</td>
                      <td className="px-4 py-2 text-zinc-900 dark:text-white">{log.actor_name || '—'}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{log.previous_status || '—'}</td>
                      <td className="px-4 py-2 text-zinc-900 dark:text-white">{log.new_status}</td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 max-w-xs truncate">{log.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
