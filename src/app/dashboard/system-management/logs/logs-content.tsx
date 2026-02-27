'use client'

import { useState, useEffect } from 'react'
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

export function LogsContent({ initialType }: { initialType: LogType }) {
  const logType = initialType
  const [smsLogs, setSmsLogs] = useState<SmsLogEntry[]>([])
  const [mailLogs, setMailLogs] = useState<MailLogEntry[]>([])
  const [demandLogs, setDemandLogs] = useState<DemandLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingSmsLog, setViewingSmsLog] = useState<SmsLogEntry | null>(null)

  const [smsFilters, setSmsFilters] = useState({ dateFrom: '', dateTo: '', customerName: '' })
  const [mailFilters, setMailFilters] = useState({ dateFrom: '', dateTo: '', mailType: '', recipientEmail: '' })
  const [demandFilters, setDemandFilters] = useState({ dateFrom: '', dateTo: '', demandId: '', actorId: '' })

  const loadSmsLogs = async () => {
    setLoading(true)
    setError(null)
    const res = await getSmsLogsForLogsPage({
      dateFrom: smsFilters.dateFrom || undefined,
      dateTo: smsFilters.dateTo || undefined,
      customerName: smsFilters.customerName || undefined,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else setSmsLogs(res.logs ?? [])
  }

  const loadMailLogs = async () => {
    setLoading(true)
    setError(null)
    const res = await getMailLogsForLogsPage({
      dateFrom: mailFilters.dateFrom || undefined,
      dateTo: mailFilters.dateTo || undefined,
      mailType: mailFilters.mailType || undefined,
      recipientEmail: mailFilters.recipientEmail || undefined,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else setMailLogs(res.logs ?? [])
  }

  const loadDemandLogs = async () => {
    setLoading(true)
    setError(null)
    const res = await getDemandLogsForLogsPage({
      dateFrom: demandFilters.dateFrom || undefined,
      dateTo: demandFilters.dateTo || undefined,
      demandId: demandFilters.demandId || undefined,
      actorId: demandFilters.actorId || undefined,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else setDemandLogs(res.logs ?? [])
  }

  useEffect(() => {
    if (logType === 'sms') loadSmsLogs()
    else if (logType === 'mail') loadMailLogs()
    else loadDemandLogs()
  }, [logType])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Logs</h3>
        <p className="text-sm text-gray-400 mb-4">
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
              <label className="block text-xs text-gray-400 mb-1">From date</label>
              <input
                type="date"
                value={smsFilters.dateFrom}
                onChange={(e) => setSmsFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To date</label>
              <input
                type="date"
                value={smsFilters.dateTo}
                onChange={(e) => setSmsFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Customer name</label>
              <input
                type="text"
                value={smsFilters.customerName}
                onChange={(e) => setSmsFilters((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Search recipient..."
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm w-48"
              />
            </div>
            <button
              type="button"
              onClick={loadSmsLogs}
              disabled={loading}
              className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
          </div>
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/50 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">Time</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Recipient</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Phone</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Message type</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Trigger</th>
                  <th className="px-4 py-3 text-gray-400 font-medium w-24">Message</th>
                </tr>
              </thead>
              <tbody>
                {smsLogs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No SMS logs found.
                    </td>
                  </tr>
                ) : (
                  smsLogs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-800 hover:bg-white/5">
                      <td className="px-4 py-2 text-gray-300">
                        {formatInTimeZone(new Date(log.sent_at), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd, h:mm a')}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-white">{log.recipient_name || '—'}</span>
                        <span className="text-gray-500 ml-1">({log.recipient_type})</span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 font-mono text-xs">{log.phone_number}</td>
                      <td className="px-4 py-2 text-gray-300">{log.message_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            log.triggered_by === 'manual' ? 'bg-[#C27E00]/30 text-[#C27E00]' : 'bg-gray-700 text-gray-400'
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onClick={() => setViewingSmsLog(null)}
            >
              <div
                className="bg-gray-900 border border-gray-700 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                  <h5 className="font-semibold text-white">
                    Message — {viewingSmsLog.recipient_name || '—'} ({viewingSmsLog.message_type.replace(/_/g, ' ')})
                  </h5>
                  <button
                    type="button"
                    onClick={() => setViewingSmsLog(null)}
                    className="text-gray-400 hover:text-white text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-sans">
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
              <label className="block text-xs text-gray-400 mb-1">From date</label>
              <input
                type="date"
                value={mailFilters.dateFrom}
                onChange={(e) => setMailFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To date</label>
              <input
                type="date"
                value={mailFilters.dateTo}
                onChange={(e) => setMailFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select
                value={mailFilters.mailType}
                onChange={(e) => setMailFilters((f) => ({ ...f, mailType: e.target.value }))}
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="report">Report</option>
                <option value="scheduled_report">Scheduled Report</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Recipient</label>
              <input
                type="text"
                value={mailFilters.recipientEmail}
                onChange={(e) => setMailFilters((f) => ({ ...f, recipientEmail: e.target.value }))}
                placeholder="Search by email..."
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm w-48"
              />
            </div>
            <button
              type="button"
              onClick={loadMailLogs}
              disabled={loading}
              className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
          </div>
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/50 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">Time</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Recipients</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Subject</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Type</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Report</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Sender</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mailLogs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      No mail logs found.
                    </td>
                  </tr>
                ) : (
                  mailLogs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-800 hover:bg-white/5">
                      <td className="px-4 py-2 text-gray-300">
                        {formatInTimeZone(new Date(log.sent_at), SYSTEM_DEFAULT_TIMEZONE, 'yyyy-MM-dd, h:mm a')}
                      </td>
                      <td className="px-4 py-2 text-gray-300 text-xs max-w-[180px] truncate" title={log.recipient_emails.join(', ')}>
                        {log.recipient_emails.join(', ')}
                      </td>
                      <td className="px-4 py-2 text-white max-w-[200px] truncate" title={log.subject}>
                        {log.subject}
                      </td>
                      <td className="px-4 py-2 text-gray-300">{log.mail_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-gray-400 max-w-[120px] truncate">{log.report_title || '—'}</td>
                      <td className="px-4 py-2 text-gray-400">{log.sender_name || '—'}</td>
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
              <label className="block text-xs text-gray-400 mb-1">From date</label>
              <input
                type="date"
                value={demandFilters.dateFrom}
                onChange={(e) => setDemandFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To date</label>
              <input
                type="date"
                value={demandFilters.dateTo}
                onChange={(e) => setDemandFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Demand ID</label>
              <input
                type="text"
                value={demandFilters.demandId}
                onChange={(e) => setDemandFilters((f) => ({ ...f, demandId: e.target.value }))}
                placeholder="UUID..."
                className="border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm w-48"
              />
            </div>
            <button
              type="button"
              onClick={loadDemandLogs}
              disabled={loading}
              className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
          </div>
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/50 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">Time</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Demand</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Customer</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Updated by</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Previous</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {demandLogs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      No demand logs found.
                    </td>
                  </tr>
                ) : (
                  demandLogs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-800 hover:bg-white/5">
                      <td className="px-4 py-2 text-gray-300">
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
                      <td className="px-4 py-2 text-white">{log.customer_name || '—'}</td>
                      <td className="px-4 py-2 text-white">{log.actor_name || '—'}</td>
                      <td className="px-4 py-2 text-gray-400">{log.previous_status || '—'}</td>
                      <td className="px-4 py-2 text-white">{log.new_status}</td>
                      <td className="px-4 py-2 text-gray-400 max-w-xs truncate">{log.notes || '—'}</td>
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
