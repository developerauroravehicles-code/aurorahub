'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  createTicket,
  addTicketScreenshots,
  updateTicket,
  deleteTicket,
  createIncident,
  updateIncident,
  deleteIncident,
  createChange,
  updateChange,
  deleteChange,
  createRelease,
  updateRelease,
  deleteRelease,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  deleteKnowledgeArticle,
} from './actions'
import {
  Pencil,
  Trash2,
  Plus,
  Ticket,
  AlertTriangle,
  GitBranch,
  Package,
  BookOpen,
  Loader2,
  Eye,
  X,
  Search,
  ExternalLink,
} from 'lucide-react'
import { formatInPT, ptDatetimeLocalToISO } from '@/lib/timezone-defaults'

/** Format duration in ms to "X Hour Y Minute" */
function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '—'
  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} Hour${hours !== 1 ? 's' : ''}`)
  parts.push(`${minutes} Minute${minutes !== 1 ? 's' : ''}`)
  return parts.join(' ')
}

/** Closing duration: created_at to resolved_at for closed tickets */
function getClosingDuration(createdAt: string, resolvedAt: string | null): number | null {
  if (!resolvedAt) return null
  const start = new Date(createdAt).getTime()
  const end = new Date(resolvedAt).getTime()
  return end - start
}

/** Open screenshot in Drive (fallback if webViewLink missing) */
function driveScreenshotHref(s: { fileId: string; webViewLink?: string | null }): string {
  if (s.webViewLink?.trim()) return s.webViewLink.trim()
  return `https://drive.google.com/file/d/${encodeURIComponent(s.fileId)}/view`
}

const TICKET_CATEGORIES: Record<string, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  system_issue: 'System Issue',
  access_request: 'Access Request',
  integration_request: 'Integration Request',
  security_incident: 'Security Incident',
  other: 'Other',
}

const TICKET_STATUSES: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
}

const PRIORITIES: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const INCIDENT_SEVERITIES: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const INCIDENT_STATUSES: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  identified: 'Identified',
  resolving: 'Resolving',
  resolved: 'Resolved',
  closed: 'Closed',
}

const CHANGE_TYPES: Record<string, string> = {
  feature_deployment: 'Feature Deployment',
  config_change: 'Config Change',
  database_migration: 'Database Migration',
  integration_update: 'Integration Update',
  hotfix: 'Hotfix',
  other: 'Other',
}

const CHANGE_STATUSES: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  deployed: 'Deployed',
  rolled_back: 'Rolled Back',
  cancelled: 'Cancelled',
}

const RELEASE_ENVS: Record<string, string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
}

const RELEASE_STATUSES: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  deployed: 'Deployed',
  rolled_back: 'Rolled Back',
  cancelled: 'Cancelled',
}

const KB_CATEGORIES: Record<string, string> = {
  api_docs: 'API Docs',
  architecture: 'Architecture',
  deployment: 'Deployment',
  troubleshooting: 'Troubleshooting',
  faq: 'FAQ',
  other: 'Other',
}

const TICKET_SCREENSHOT_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const TICKET_SCREENSHOT_INPUT_ACCEPT = TICKET_SCREENSHOT_ACCEPT.join(',')
const TICKET_SCREENSHOT_MAX_FILES = 3
const TICKET_SCREENSHOT_MAX_MB = 5

type Tab = 'tickets' | 'incidents' | 'changes' | 'releases' | 'knowledge'

export function ServiceDeskContent({
  tickets,
  incidents,
  changes,
  releases,
  knowledge,
  assignees,
  initialTab,
}: {
  tickets: Array<{
    id: string
    ticket_number: string | null
    title: string
    description: string | null
    category: string
    priority: string
    status: string
    assigned_to: string | null
    requested_by: string
    sla_due_at: string | null
    resolved_at: string | null
    resolution_notes: string | null
    created_at: string
    screenshots?: Array<{ fileId: string; webViewLink?: string | null; name: string }>
    assigned?: { id: string; full_name: string | null } | null
    requester?: { id: string; full_name: string | null } | null
  }>
  incidents: Array<{
    id: string
    incident_number: string | null
    title: string
    description: string | null
    severity: string
    impact_scope: string | null
    status: string
    root_cause: string | null
    resolution_notes: string | null
    post_mortem: string | null
    resolved_at: string | null
    created_at: string
  }>
  changes: Array<{
    id: string
    change_number: string | null
    title: string
    description: string | null
    change_type: string
    risk_level: string
    status: string
    scheduled_at: string | null
    deployed_at: string | null
    rollback_plan: string | null
    created_at: string
  }>
  releases: Array<{
    id: string
    version: string
    build_number: string | null
    release_notes: string | null
    environment: string
    status: string
    deployed_at: string | null
    created_at: string
  }>
  knowledge: Array<{
    id: string
    title: string
    content: string | null
    category: string | null
    tags: string[] | null
    created_at: string
  }>
  assignees: Array<{ id: string; full_name: string | null }>
  initialTab?: Tab
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'tickets')
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [viewingTicketId, setViewingTicketId] = useState<string | null>(null)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null)
  const [showChangeForm, setShowChangeForm] = useState(false)
  const [editingChangeId, setEditingChangeId] = useState<string | null>(null)
  const [showReleaseForm, setShowReleaseForm] = useState(false)
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null)
  const [showKbForm, setShowKbForm] = useState(false)
  const [editingKbId, setEditingKbId] = useState<string | null>(null)

  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketFilterCategory, setTicketFilterCategory] = useState('')
  const [ticketFilterPriority, setTicketFilterPriority] = useState('')
  const [ticketFilterStatus, setTicketFilterStatus] = useState('')
  const [ticketFilterAssigned, setTicketFilterAssigned] = useState('')
  const [ticketFilterRequester, setTicketFilterRequester] = useState('')

  const ticketRequesterOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const t of tickets) {
      if (t.requested_by && !byId.has(t.requested_by)) {
        byId.set(t.requested_by, t.requester?.full_name?.trim() || t.requested_by)
      }
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
  }, [tickets])

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase()
    return tickets.filter((t) => {
      if (ticketFilterCategory && t.category !== ticketFilterCategory) return false
      if (ticketFilterPriority && t.priority !== ticketFilterPriority) return false
      if (ticketFilterStatus && t.status !== ticketFilterStatus) return false
      if (ticketFilterAssigned === '__unassigned__') {
        if (t.assigned_to) return false
      } else if (ticketFilterAssigned && t.assigned_to !== ticketFilterAssigned) {
        return false
      }
      if (ticketFilterRequester && t.requested_by !== ticketFilterRequester) return false
      if (!q) return true
      const num = (t.ticket_number ?? '').toLowerCase()
      const title = t.title.toLowerCase()
      const desc = (t.description ?? '').toLowerCase()
      const catLabel = (TICKET_CATEGORIES[t.category] ?? t.category).toLowerCase()
      return num.includes(q) || title.includes(q) || desc.includes(q) || catLabel.includes(q)
    })
  }, [
    tickets,
    ticketSearch,
    ticketFilterCategory,
    ticketFilterPriority,
    ticketFilterStatus,
    ticketFilterAssigned,
    ticketFilterRequester,
  ])

  const selectClass =
    'rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-2 py-1.5 text-zinc-900 dark:text-white text-sm min-w-0'

  const tabs: { id: Tab; name: string; icon: typeof Ticket }[] = [
    { id: 'tickets', name: 'Tickets', icon: Ticket },
    { id: 'incidents', name: 'Incidents', icon: AlertTriangle },
    { id: 'changes', name: 'Changes', icon: GitBranch },
    { id: 'releases', name: 'Releases', icon: Package },
    { id: 'knowledge', name: 'Knowledge Base', icon: BookOpen },
  ]

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="-mx-1 flex gap-2 overflow-x-auto overflow-y-hidden border-b border-zinc-200 px-1 pb-2 dark:border-gray-800">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t px-3 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                activeTab === t.id
                  ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-b-0 border-zinc-200 dark:border-gray-800'
                  : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white hover:bg-zinc-200/50 dark:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.name}
            </button>
          )
        })}
      </div>

      {activeTab === 'tickets' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white sm:text-lg">Tickets</h2>
            <button
              type="button"
              onClick={() => { setEditingTicketId(null); setShowTicketForm(true) }}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded bg-[#C27E00] px-3 py-1.5 text-sm text-white hover:bg-[#a06900] sm:w-auto"
            >
              <Plus className="w-4 h-4" /> New Ticket
            </button>
          </div>
          <div className="mb-4 rounded-md border border-zinc-300 bg-zinc-100/90 p-3 dark:border-gray-700 dark:bg-black/30">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-gray-400">Filters</span>
              {(ticketSearch ||
                ticketFilterCategory ||
                ticketFilterPriority ||
                ticketFilterStatus ||
                ticketFilterAssigned ||
                ticketFilterRequester) && (
                <button
                  type="button"
                  onClick={() => {
                    setTicketSearch('')
                    setTicketFilterCategory('')
                    setTicketFilterPriority('')
                    setTicketFilterStatus('')
                    setTicketFilterAssigned('')
                    setTicketFilterRequester('')
                  }}
                  className="text-xs text-[#C27E00] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 sm:min-w-[180px] sm:max-w-xs">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-gray-500">Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="search"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="Number, title, description…"
                    className={`w-full pl-9 ${selectClass}`}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[130px]">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-gray-500">Category</label>
                <select
                  value={ticketFilterCategory}
                  onChange={(e) => setTicketFilterCategory(e.target.value)}
                  className={`w-full ${selectClass}`}
                >
                  <option value="">All</option>
                  {Object.entries(TICKET_CATEGORIES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[120px]">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-gray-500">Priority</label>
                <select
                  value={ticketFilterPriority}
                  onChange={(e) => setTicketFilterPriority(e.target.value)}
                  className={`w-full ${selectClass}`}
                >
                  <option value="">All</option>
                  {Object.entries(PRIORITIES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[130px]">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-gray-500">Status</label>
                <select
                  value={ticketFilterStatus}
                  onChange={(e) => setTicketFilterStatus(e.target.value)}
                  className={`w-full ${selectClass}`}
                >
                  <option value="">All</option>
                  {Object.entries(TICKET_STATUSES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-gray-500">Assigned</label>
                <select
                  value={ticketFilterAssigned}
                  onChange={(e) => setTicketFilterAssigned(e.target.value)}
                  className={`w-full ${selectClass}`}
                >
                  <option value="">All</option>
                  <option value="__unassigned__">Unassigned</option>
                  {assignees.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? p.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-gray-500">Requested by</label>
                <select
                  value={ticketFilterRequester}
                  onChange={(e) => setTicketFilterRequester(e.target.value)}
                  className={`w-full ${selectClass}`}
                >
                  <option value="">All</option>
                  {ticketRequesterOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-gray-500">
              Showing {filteredTickets.length} of {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
            </p>
          </div>
          {showTicketForm && (
            <TicketForm
              assignees={assignees}
              ticket={editingTicketId ? tickets.find((t) => t.id === editingTicketId) : null}
              onClose={() => { setShowTicketForm(false); setEditingTicketId(null) }}
              onSuccess={() => { router.refresh(); setShowTicketForm(false); setEditingTicketId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">#</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Category</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Priority</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Assigned</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Requested By</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">SLA</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Duration</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {filteredTickets.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 text-[#C27E00] font-mono">{t.ticket_number ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white max-w-[200px] truncate" title={t.title}>{t.title}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{TICKET_CATEGORIES[t.category] ?? t.category}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        t.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                        t.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        t.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-zinc-500 dark:text-gray-400'
                      }`}>{PRIORITIES[t.priority] ?? t.priority}</span>
                    </td>
                    <td className="px-4 py-2">{TICKET_STATUSES[t.status] ?? t.status}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{t.assigned?.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{t.requester?.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 whitespace-nowrap">{t.sla_due_at ? formatInPT(t.sla_due_at, 'MMM d, yyyy h:mm a') : '—'}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{t.resolved_at ? formatDuration(getClosingDuration(t.created_at, t.resolved_at) ?? 0) : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setViewingTicketId(t.id)} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-blue-400 mr-1" title="View details">
                        <Eye className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => { setEditingTicketId(t.id); setShowTicketForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete this ticket?')) { await deleteTicket(t.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewingTicketId && (() => {
              const t = tickets.find((x) => x.id === viewingTicketId)
              if (!t) return null
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 dark:bg-black/70" onClick={() => setViewingTicketId(null)}>
                  <div className="bg-zinc-200 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{t.ticket_number ?? 'Ticket'}: {t.title}</h3>
                      <button onClick={() => setViewingTicketId(null)} className="p-1 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-zinc-500 dark:text-gray-500">Description:</span>
                        <p className="text-zinc-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{t.description || '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-zinc-500 dark:text-gray-400">
                        <span>Category: {TICKET_CATEGORIES[t.category] ?? t.category}</span>
                        <span>Priority: {PRIORITIES[t.priority] ?? t.priority}</span>
                        <span>Status: {TICKET_STATUSES[t.status] ?? t.status}</span>
                        <span>SLA: {t.sla_due_at ? formatInPT(t.sla_due_at, 'MMM d, yyyy h:mm a') : '—'}</span>
                        <span>Duration: {t.resolved_at ? formatDuration(getClosingDuration(t.created_at, t.resolved_at) ?? 0) : '—'}</span>
                        <span>Assigned: {t.assigned?.full_name ?? '—'}</span>
                        <span>Requested by: {t.requester?.full_name ?? '—'}</span>
                      </div>
                      {t.resolution_notes && (
                        <div>
                          <span className="text-zinc-500 dark:text-gray-500">Resolution Notes:</span>
                          <p className="text-zinc-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{t.resolution_notes}</p>
                        </div>
                      )}
                      {t.screenshots && t.screenshots.length > 0 && (
                        <div>
                          <span className="text-zinc-500 dark:text-gray-500">Screenshots:</span>
                          <ul className="mt-1 list-inside list-disc space-y-1 text-zinc-600 dark:text-gray-300">
                            {t.screenshots.map((s) => (
                              <li key={s.fileId}>
                                <a
                                  href={driveScreenshotHref(s)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#C27E00] hover:underline"
                                >
                                  {s.name}
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => { setViewingTicketId(null); setEditingTicketId(t.id); setShowTicketForm(true) }} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
            {filteredTickets.length === 0 && tickets.length > 0 && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No tickets match these filters.</p>
            )}
            {tickets.length === 0 && !showTicketForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No tickets yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Incidents</h2>
            <button
              onClick={() => { setEditingIncidentId(null); setShowIncidentForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> New Incident
            </button>
          </div>
          {showIncidentForm && (
            <IncidentForm
              incident={editingIncidentId ? incidents.find((i) => i.id === editingIncidentId) : null}
              onClose={() => { setShowIncidentForm(false); setEditingIncidentId(null) }}
              onSuccess={() => { router.refresh(); setShowIncidentForm(false); setEditingIncidentId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">#</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Severity</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Impact</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 text-[#C27E00] font-mono">{i.incident_number ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white max-w-[220px] truncate" title={i.title}>{i.title}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        i.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        i.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-800 text-zinc-500 dark:text-gray-400'
                      }`}>{INCIDENT_SEVERITIES[i.severity] ?? i.severity}</span>
                    </td>
                    <td className="px-4 py-2">{INCIDENT_STATUSES[i.status] ?? i.status}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400 max-w-[150px] truncate">{i.impact_scope ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingIncidentId(i.id); setShowIncidentForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteIncident(i.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {incidents.length === 0 && !showIncidentForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No incidents yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'changes' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Changes</h2>
            <button
              onClick={() => { setEditingChangeId(null); setShowChangeForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> New Change
            </button>
          </div>
          {showChangeForm && (
            <ChangeForm
              change={editingChangeId ? changes.find((c) => c.id === editingChangeId) : null}
              onClose={() => { setShowChangeForm(false); setEditingChangeId(null) }}
              onSuccess={() => { router.refresh(); setShowChangeForm(false); setEditingChangeId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">#</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Risk</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Scheduled</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-[#C27E00] font-mono">{c.change_number ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white max-w-[200px] truncate" title={c.title}>{c.title}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{CHANGE_TYPES[c.change_type] ?? c.change_type}</td>
                    <td className="px-4 py-2">{c.risk_level}</td>
                    <td className="px-4 py-2">{CHANGE_STATUSES[c.status] ?? c.status}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{c.scheduled_at ? formatInPT(c.scheduled_at, 'MMM d, yyyy h:mm a') : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingChangeId(c.id); setShowChangeForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteChange(c.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {changes.length === 0 && !showChangeForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No changes yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'releases' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Releases</h2>
            <button
              onClick={() => { setEditingReleaseId(null); setShowReleaseForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> New Release
            </button>
          </div>
          {showReleaseForm && (
            <ReleaseForm
              release={editingReleaseId ? releases.find((r) => r.id === editingReleaseId) : null}
              onClose={() => { setShowReleaseForm(false); setEditingReleaseId(null) }}
              onSuccess={() => { router.refresh(); setShowReleaseForm(false); setEditingReleaseId(null) }}
            />
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Version</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Build</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Environment</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-zinc-500 dark:text-gray-400">Deployed</th>
                  <th className="px-4 py-2 text-right text-zinc-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                {releases.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-zinc-900 dark:text-white font-mono">{r.version}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{r.build_number ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-gray-300">{RELEASE_ENVS[r.environment] ?? r.environment}</td>
                    <td className="px-4 py-2">{RELEASE_STATUSES[r.status] ?? r.status}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-gray-400">{r.deployed_at ? formatInPT(r.deployed_at, 'MMM d, yyyy h:mm:ss a') : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingReleaseId(r.id); setShowReleaseForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteRelease(r.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {releases.length === 0 && !showReleaseForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No releases yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Knowledge Base</h2>
            <button
              onClick={() => { setEditingKbId(null); setShowKbForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> New Article
            </button>
          </div>
          {showKbForm && (
            <KnowledgeForm
              article={editingKbId ? knowledge.find((k) => k.id === editingKbId) : null}
              onClose={() => { setShowKbForm(false); setEditingKbId(null) }}
              onSuccess={() => { router.refresh(); setShowKbForm(false); setEditingKbId(null) }}
            />
          )}
          <div className="mt-4 space-y-2">
            {knowledge.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-200 dark:border-gray-800">
                <div>
                  <div className="text-zinc-900 dark:text-white font-medium">{k.title}</div>
                  {k.category && <span className="text-xs text-zinc-500 dark:text-gray-500">{KB_CATEGORIES[k.category] ?? k.category}</span>}
                </div>
                <div>
                  <button onClick={() => { setEditingKbId(k.id); setShowKbForm(true) }} className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                    <Pencil className="w-4 h-4 inline" />
                  </button>
                  <form action={async () => { if (confirm('Delete?')) { await deleteKnowledgeArticle(k.id); router.refresh() } }} className="inline">
                    <button type="submit" className="p-1.5 text-zinc-500 dark:text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                  </form>
                </div>
              </div>
            ))}
            {knowledge.length === 0 && !showKbForm && (
              <p className="text-zinc-500 dark:text-gray-500 py-6 text-center">No knowledge base articles yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TicketForm({
  assignees,
  ticket,
  onClose,
  onSuccess,
}: {
  assignees: Array<{ id: string; full_name: string | null }>
  ticket: NonNullable<Parameters<typeof ServiceDeskContent>[0]['tickets'][number]> | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!ticket
  const existingScreenshotCount = ticket?.screenshots?.length ?? 0
  const totalScreenshotLimit = isEdit
    ? Math.max(0, TICKET_SCREENSHOT_MAX_FILES - existingScreenshotCount)
    : TICKET_SCREENSHOT_MAX_FILES
  const fileInputRef = useRef<HTMLInputElement>(null)
  type DraftRow = { id: string; file: File; previewUrl: string }
  const [draftScreenshots, setDraftScreenshots] = useState<DraftRow[]>([])
  const draftScreenshotsRef = useRef<DraftRow[]>([])
  draftScreenshotsRef.current = draftScreenshots

  useEffect(() => {
    return () => {
      draftScreenshotsRef.current.forEach((row) => URL.revokeObjectURL(row.previewUrl))
    }
  }, [])

  function addScreenshotFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const candidates: File[] = []
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList.item(i)
      if (f) candidates.push(f)
    }
    for (const f of candidates) {
      if (!TICKET_SCREENSHOT_ACCEPT.includes(f.type as (typeof TICKET_SCREENSHOT_ACCEPT)[number])) {
        setError('Only JPG, PNG, WebP, or GIF images are allowed.')
        return
      }
      if (f.size > TICKET_SCREENSHOT_MAX_MB * 1024 * 1024) {
        setError(`Each file must be ${TICKET_SCREENSHOT_MAX_MB} MB or smaller.`)
        return
      }
    }

    setError('')
    let limitReachedMsg = ''

    setDraftScreenshots((prev) => {
      const room = Math.max(0, totalScreenshotLimit - prev.length)
      if (room <= 0) {
        limitReachedMsg = isEdit
          ? `This ticket already has ${existingScreenshotCount} screenshot(s). Max is ${TICKET_SCREENSHOT_MAX_FILES}.`
          : `You can attach at most ${TICKET_SCREENSHOT_MAX_FILES} screenshots.`
        return prev
      }
      const toTake = candidates.slice(0, room)
      if (candidates.length > room || toTake.length < candidates.length) {
        limitReachedMsg = isEdit
          ? `You can add ${room} more screenshot(s) (max ${TICKET_SCREENSHOT_MAX_FILES} total).`
          : `You can attach at most ${TICKET_SCREENSHOT_MAX_FILES} screenshots.`
      }
      const rows: DraftRow[] = toTake.map((f, idx) => ({
        id: `${Date.now()}_${idx}_${f.name}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
      }))
      return [...prev, ...rows]
    })

    if (limitReachedMsg) setError(limitReachedMsg)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeDraft(id: string) {
    setDraftScreenshots((prev) => {
      const row = prev.find((r) => r.id === id)
      if (row) URL.revokeObjectURL(row.previewUrl)
      return prev.filter((r) => r.id !== id)
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const get = (name: string) =>
      form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    const slaRaw = get('sla_due_at')?.value

    if (!ticket) {
      const fd = new FormData()
      fd.append('title', get('title')?.value.trim() ?? '')
      const descNew = get('description')?.value.trim()
      if (descNew) fd.append('description', descNew)
      fd.append('category', get('category')?.value ?? '')
      fd.append('priority', get('priority')?.value || 'medium')
      draftScreenshots.forEach((r) => fd.append('screenshots', r.file))
      const result = await createTicket(fd)
      setLoading(false)
      if (result.error) setError(result.error)
      else {
        setDraftScreenshots([])
        onSuccess()
      }
      return
    }

    if (draftScreenshots.length > 0) {
      const uploadFd = new FormData()
      draftScreenshots.forEach((r) => uploadFd.append('screenshots', r.file))
      const uploadResult = await addTicketScreenshots(ticket.id, uploadFd)
      if (uploadResult.error) {
        setLoading(false)
        setError(uploadResult.error)
        return
      }
      setDraftScreenshots([])
    }

    const data = {
      title: get('title')?.value.trim() ?? '',
      description: get('description')?.value.trim() || undefined,
      category: get('category')?.value ?? '',
      priority: get('priority')?.value || undefined,
      status: get('status')?.value || undefined,
      assigned_to: get('assigned_to')?.value || undefined,
      sla_due_at: slaRaw ? ptDatetimeLocalToISO(slaRaw) : undefined,
      resolution_notes: get('resolution_notes')?.value.trim() || undefined,
    }
    const result = await updateTicket(ticket.id, data)
    setLoading(false)
    if (result.error) setError(result.error)
    else onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Ticket' : 'New Ticket'}</h3>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Title *</label>
        <input
          name="title"
          required
          defaultValue={ticket?.title ?? ''}
          className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={ticket?.description ?? ''}
          className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Category</label>
          <select
            name="category"
            required
            defaultValue={ticket?.category ?? ''}
            className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
          >
            {Object.entries(TICKET_CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Priority</label>
          <select
            name="priority"
            defaultValue={ticket?.priority ?? 'medium'}
            className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
          >
            {Object.entries(PRIORITIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Status</label>
            <select
              name="status"
              defaultValue={ticket?.status ?? 'open'}
              className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
            >
              {Object.entries(TICKET_STATUSES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {(!isEdit || totalScreenshotLimit > 0) && (
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">
            Screenshots ({isEdit ? 'for closing / update' : 'optional'} · max {TICKET_SCREENSHOT_MAX_FILES} total · JPG/PNG/WebP/GIF · {TICKET_SCREENSHOT_MAX_MB} MB each · Google Drive required)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={TICKET_SCREENSHOT_INPUT_ACCEPT}
            multiple
            className="hidden"
            onChange={(ev) => addScreenshotFiles(ev.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={draftScreenshots.length >= totalScreenshotLimit}
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-zinc-200 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-300 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              Choose files
            </button>
            <span className="text-xs text-zinc-500 dark:text-gray-500">
              {draftScreenshots.length}/{totalScreenshotLimit} selected
            </span>
          </div>
          {draftScreenshots.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {draftScreenshots.map((row) => (
                <div key={row.id} className="relative rounded border border-zinc-300 dark:border-gray-600 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={row.previewUrl} alt="" className="h-20 w-auto max-w-[120px] object-contain rounded" />
                  <button
                    type="button"
                    onClick={() => removeDraft(row.id)}
                    className="absolute -right-2 -top-2 rounded-full bg-zinc-800 p-0.5 text-white hover:bg-red-600 dark:bg-black"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="max-w-[120px] truncate text-[10px] text-zinc-500 dark:text-gray-400" title={row.file.name}>
                    {row.file.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {isEdit && totalScreenshotLimit <= 0 && (
        <p className="text-xs text-zinc-500 dark:text-gray-500">
          Screenshot limit reached ({TICKET_SCREENSHOT_MAX_FILES}/{TICKET_SCREENSHOT_MAX_FILES}).
        </p>
      )}

      {isEdit && ticket?.screenshots && ticket.screenshots.length > 0 && (
        <div>
          <span className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Screenshots</span>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {ticket.screenshots.map((s) => (
              <li key={s.fileId}>
                <a
                  href={driveScreenshotHref(s)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#C27E00] hover:underline"
                >
                  {s.name}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEdit && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Assigned To</label>
              <select
                name="assigned_to"
                defaultValue={ticket?.assigned_to ?? ''}
                className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
              >
                <option value="">—</option>
                {assignees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">SLA Due (Pacific Time)</label>
              <input
                name="sla_due_at"
                type="datetime-local"
                defaultValue={ticket?.sla_due_at ? formatInPT(ticket.sla_due_at, "yyyy-MM-dd'T'HH:mm") : ''}
                className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Resolution Notes</label>
            <textarea
              name="resolution_notes"
              rows={2}
              defaultValue={ticket?.resolution_notes ?? ''}
              className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm"
            />
          </div>
        </>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : isEdit ? 'Save' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function IncidentForm({
  incident,
  onClose,
  onSuccess,
}: {
  incident: NonNullable<Parameters<typeof ServiceDeskContent>[0]['incidents'][number]> | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!incident

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const get = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    const data = {
      title: get('title')?.value.trim() ?? '',
      description: get('description')?.value.trim() || undefined,
      severity: get('severity')?.value ?? '',
      impact_scope: get('impact_scope')?.value.trim() || undefined,
      status: get('status')?.value || undefined,
      root_cause: get('root_cause')?.value.trim() || undefined,
      resolution_notes: get('resolution_notes')?.value.trim() || undefined,
      post_mortem: get('post_mortem')?.value.trim() || undefined,
    }
    const result = incident
      ? await updateIncident(incident.id, data)
      : await createIncident(data)
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Incident' : 'New Incident'}</h3>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Title *</label>
        <input name="title" required defaultValue={incident?.title ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Description</label>
        <textarea name="description" rows={2} defaultValue={incident?.description ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Severity</label>
          <select name="severity" required defaultValue={incident?.severity ?? 'medium'} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            {Object.entries(INCIDENT_SEVERITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Impact Scope</label>
          <input name="impact_scope" defaultValue={incident?.impact_scope ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="e.g. All users" />
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={incident?.status ?? 'open'} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
              {Object.entries(INCIDENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      {isEdit && (
        <>
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Root Cause</label>
            <textarea name="root_cause" rows={2} defaultValue={incident?.root_cause ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Resolution Notes</label>
            <textarea name="resolution_notes" rows={2} defaultValue={incident?.resolution_notes ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Post-Mortem</label>
            <textarea name="post_mortem" rows={3} defaultValue={incident?.post_mortem ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
          </div>
        </>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function ChangeForm({
  change,
  onClose,
  onSuccess,
}: {
  change: NonNullable<Parameters<typeof ServiceDeskContent>[0]['changes'][number]> | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!change

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const get = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    const data = {
      title: get('title')?.value.trim() ?? '',
      description: get('description')?.value.trim() || undefined,
      change_type: get('change_type')?.value ?? '',
      risk_level: get('risk_level')?.value || undefined,
      status: get('status')?.value || undefined,
      scheduled_at: get('scheduled_at')?.value || undefined,
      rollback_plan: get('rollback_plan')?.value.trim() || undefined,
    }
    const result = change
      ? await updateChange(change.id, data)
      : await createChange(data)
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Change' : 'New Change'}</h3>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Title *</label>
        <input name="title" required defaultValue={change?.title ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Description</label>
        <textarea name="description" rows={2} defaultValue={change?.description ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Change Type</label>
          <select name="change_type" required defaultValue={change?.change_type ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            {Object.entries(CHANGE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Risk Level</label>
          <select name="risk_level" defaultValue={change?.risk_level ?? 'medium'} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={change?.status ?? 'draft'} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
              {Object.entries(CHANGE_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Scheduled At</label>
        <input name="scheduled_at" type="datetime-local" defaultValue={change?.scheduled_at ? new Date(change.scheduled_at).toISOString().slice(0, 16) : ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Rollback Plan</label>
        <textarea name="rollback_plan" rows={2} defaultValue={change?.rollback_plan ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function ReleaseForm({
  release,
  onClose,
  onSuccess,
}: {
  release: NonNullable<Parameters<typeof ServiceDeskContent>[0]['releases'][number]> | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!release

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const get = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    const data = {
      version: get('version')?.value.trim() ?? '',
      build_number: get('build_number')?.value.trim() || undefined,
      release_notes: get('release_notes')?.value.trim() || undefined,
      environment: get('environment')?.value ?? '',
      status: get('status')?.value || undefined,
    }
    const result = release
      ? await updateRelease(release.id, data)
      : await createRelease(data)
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{isEdit ? 'Edit Release' : 'New Release'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Version *</label>
          <input name="version" required defaultValue={release?.version ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="e.g. 1.2.0" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Build Number</label>
          <input name="build_number" defaultValue={release?.build_number ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" placeholder="e.g. 20240306" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Release Notes</label>
        <textarea name="release_notes" rows={3} defaultValue={release?.release_notes ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Environment</label>
          <select name="environment" required defaultValue={release?.environment ?? 'staging'} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
            {Object.entries(RELEASE_ENVS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={release?.status ?? 'planned'} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
              {Object.entries(RELEASE_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function KnowledgeForm({
  article,
  onClose,
  onSuccess,
}: {
  article: NonNullable<Parameters<typeof ServiceDeskContent>[0]['knowledge'][number]> | null | undefined
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const get = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    const data = {
      title: get('title')?.value.trim() ?? '',
      content: get('content')?.value.trim() || undefined,
      category: get('category')?.value || undefined,
    }
    const result = article
      ? await updateKnowledgeArticle(article.id, data)
      : await createKnowledgeArticle(data)
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-zinc-100/90 dark:bg-black/30 border border-zinc-300 dark:border-gray-700 space-y-3">
      <h3 className="text-zinc-900 dark:text-white font-medium">{article ? 'Edit Article' : 'New Article'}</h3>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Title *</label>
        <input name="title" required defaultValue={article?.title ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Category</label>
        <select name="category" defaultValue={article?.category ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm">
          <option value="">—</option>
          {Object.entries(KB_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-gray-400 mb-1">Content</label>
        <textarea name="content" rows={6} defaultValue={article?.content ?? ''} className="w-full rounded bg-zinc-200 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (article ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}
