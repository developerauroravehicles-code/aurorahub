'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createTicket,
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
} from 'lucide-react'
import { formatInPT } from '@/lib/timezone-defaults'

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

  const tabs: { id: Tab; name: string; icon: typeof Ticket }[] = [
    { id: 'tickets', name: 'Tickets', icon: Ticket },
    { id: 'incidents', name: 'Incidents', icon: AlertTriangle },
    { id: 'changes', name: 'Changes', icon: GitBranch },
    { id: 'releases', name: 'Releases', icon: Package },
    { id: 'knowledge', name: 'Knowledge Base', icon: BookOpen },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-t text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === t.id
                  ? 'bg-white/10 text-white border border-b-0 border-gray-800'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.name}
            </button>
          )
        })}
      </div>

      {activeTab === 'tickets' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Tickets</h2>
            <button
              onClick={() => { setEditingTicketId(null); setShowTicketForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900]"
            >
              <Plus className="w-4 h-4" /> New Ticket
            </button>
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
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">#</th>
                  <th className="px-4 py-2 text-left text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left text-gray-400">Category</th>
                  <th className="px-4 py-2 text-left text-gray-400">Priority</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-gray-400">Assigned</th>
                  <th className="px-4 py-2 text-left text-gray-400">Requested By</th>
                  <th className="px-4 py-2 text-left text-gray-400">SLA</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 text-[#C27E00] font-mono">{t.ticket_number ?? '—'}</td>
                    <td className="px-4 py-2 text-white max-w-[200px] truncate" title={t.title}>{t.title}</td>
                    <td className="px-4 py-2 text-gray-300">{TICKET_CATEGORIES[t.category] ?? t.category}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        t.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                        t.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        t.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-400'
                      }`}>{PRIORITIES[t.priority] ?? t.priority}</span>
                    </td>
                    <td className="px-4 py-2">{TICKET_STATUSES[t.status] ?? t.status}</td>
                    <td className="px-4 py-2 text-gray-400">{t.assigned?.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{t.requester?.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{t.sla_due_at ? formatInPT(t.sla_due_at, 'MMM d, yyyy h:mm a') : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setViewingTicketId(t.id)} className="p-1.5 text-gray-400 hover:text-blue-400 mr-1" title="View details">
                        <Eye className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => { setEditingTicketId(t.id); setShowTicketForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete this ticket?')) { await deleteTicket(t.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setViewingTicketId(null)}>
                  <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-white">{t.ticket_number ?? 'Ticket'}: {t.title}</h3>
                      <button onClick={() => setViewingTicketId(null)} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500">Description:</span>
                        <p className="text-gray-300 mt-1 whitespace-pre-wrap">{t.description || '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-gray-400">
                        <span>Category: {TICKET_CATEGORIES[t.category] ?? t.category}</span>
                        <span>Priority: {PRIORITIES[t.priority] ?? t.priority}</span>
                        <span>Status: {TICKET_STATUSES[t.status] ?? t.status}</span>
                        <span>SLA: {t.sla_due_at ? formatInPT(t.sla_due_at, 'MMM d, yyyy h:mm a') : '—'}</span>
                        <span>Assigned: {t.assigned?.full_name ?? '—'}</span>
                        <span>Requested by: {t.requester?.full_name ?? '—'}</span>
                      </div>
                      {t.resolution_notes && (
                        <div>
                          <span className="text-gray-500">Resolution Notes:</span>
                          <p className="text-gray-300 mt-1 whitespace-pre-wrap">{t.resolution_notes}</p>
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
            {tickets.length === 0 && !showTicketForm && (
              <p className="text-gray-500 py-6 text-center">No tickets yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Incidents</h2>
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
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">#</th>
                  <th className="px-4 py-2 text-left text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left text-gray-400">Severity</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-gray-400">Impact</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 text-[#C27E00] font-mono">{i.incident_number ?? '—'}</td>
                    <td className="px-4 py-2 text-white max-w-[220px] truncate" title={i.title}>{i.title}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        i.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        i.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-800 text-gray-400'
                      }`}>{INCIDENT_SEVERITIES[i.severity] ?? i.severity}</span>
                    </td>
                    <td className="px-4 py-2">{INCIDENT_STATUSES[i.status] ?? i.status}</td>
                    <td className="px-4 py-2 text-gray-400 max-w-[150px] truncate">{i.impact_scope ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingIncidentId(i.id); setShowIncidentForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteIncident(i.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {incidents.length === 0 && !showIncidentForm && (
              <p className="text-gray-500 py-6 text-center">No incidents yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'changes' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Changes</h2>
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
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">#</th>
                  <th className="px-4 py-2 text-left text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-gray-400">Risk</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-gray-400">Scheduled</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-[#C27E00] font-mono">{c.change_number ?? '—'}</td>
                    <td className="px-4 py-2 text-white max-w-[200px] truncate" title={c.title}>{c.title}</td>
                    <td className="px-4 py-2 text-gray-300">{CHANGE_TYPES[c.change_type] ?? c.change_type}</td>
                    <td className="px-4 py-2">{c.risk_level}</td>
                    <td className="px-4 py-2">{CHANGE_STATUSES[c.status] ?? c.status}</td>
                    <td className="px-4 py-2 text-gray-400">{c.scheduled_at ? formatInPT(c.scheduled_at, 'MMM d, yyyy h:mm a') : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingChangeId(c.id); setShowChangeForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteChange(c.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {changes.length === 0 && !showChangeForm && (
              <p className="text-gray-500 py-6 text-center">No changes yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'releases' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Releases</h2>
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
            <table className="min-w-full divide-y divide-gray-800 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400">Version</th>
                  <th className="px-4 py-2 text-left text-gray-400">Build</th>
                  <th className="px-4 py-2 text-left text-gray-400">Environment</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2 text-left text-gray-400">Deployed</th>
                  <th className="px-4 py-2 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {releases.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-white font-mono">{r.version}</td>
                    <td className="px-4 py-2 text-gray-400">{r.build_number ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-300">{RELEASE_ENVS[r.environment] ?? r.environment}</td>
                    <td className="px-4 py-2">{RELEASE_STATUSES[r.status] ?? r.status}</td>
                    <td className="px-4 py-2 text-gray-400">{r.deployed_at ? formatInPT(r.deployed_at, 'MMM d, yyyy h:mm:ss a') : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { setEditingReleaseId(r.id); setShowReleaseForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <form action={async () => { if (confirm('Delete?')) { await deleteRelease(r.id); router.refresh() } }} className="inline">
                        <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {releases.length === 0 && !showReleaseForm && (
              <p className="text-gray-500 py-6 text-center">No releases yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Knowledge Base</h2>
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
              <div key={k.id} className="flex items-center justify-between p-3 rounded bg-black/30 border border-gray-800">
                <div>
                  <div className="text-white font-medium">{k.title}</div>
                  {k.category && <span className="text-xs text-gray-500">{KB_CATEGORIES[k.category] ?? k.category}</span>}
                </div>
                <div>
                  <button onClick={() => { setEditingKbId(k.id); setShowKbForm(true) }} className="p-1.5 text-gray-400 hover:text-[#C27E00] mr-1" title="Edit">
                    <Pencil className="w-4 h-4 inline" />
                  </button>
                  <form action={async () => { if (confirm('Delete?')) { await deleteKnowledgeArticle(k.id); router.refresh() } }} className="inline">
                    <button type="submit" className="p-1.5 text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                  </form>
                </div>
              </div>
            ))}
            {knowledge.length === 0 && !showKbForm && (
              <p className="text-gray-500 py-6 text-center">No knowledge base articles yet.</p>
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const get = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    const data = {
      title: get('title')?.value.trim() ?? '',
      description: get('description')?.value.trim() || undefined,
      category: get('category')?.value ?? '',
      priority: get('priority')?.value || undefined,
      status: get('status')?.value || undefined,
      assigned_to: get('assigned_to')?.value || undefined,
      sla_due_at: get('sla_due_at')?.value || undefined,
      resolution_notes: get('resolution_notes')?.value.trim() || undefined,
    }
    const result = ticket
      ? await updateTicket(ticket.id, data)
      : await createTicket(data)
    if (result.error) setError(result.error)
    else onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Ticket' : 'New Ticket'}</h3>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Title *</label>
        <input name="title" required defaultValue={ticket?.title ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <textarea name="description" rows={2} defaultValue={ticket?.description ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <select name="category" required defaultValue={ticket?.category ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            {Object.entries(TICKET_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Priority</label>
          <select name="priority" defaultValue={ticket?.priority ?? 'medium'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={ticket?.status ?? 'open'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
              {Object.entries(TICKET_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      {isEdit && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Assigned To</label>
              <select name="assigned_to" defaultValue={ticket?.assigned_to ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
                <option value="">—</option>
                {assignees.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">SLA Due</label>
              <input name="sla_due_at" type="datetime-local" defaultValue={ticket?.sla_due_at ? new Date(ticket.sla_due_at).toISOString().slice(0, 16) : ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Resolution Notes</label>
            <textarea name="resolution_notes" rows={2} defaultValue={ticket?.resolution_notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
          </div>
        </>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
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
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Incident' : 'New Incident'}</h3>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Title *</label>
        <input name="title" required defaultValue={incident?.title ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <textarea name="description" rows={2} defaultValue={incident?.description ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Severity</label>
          <select name="severity" required defaultValue={incident?.severity ?? 'medium'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            {Object.entries(INCIDENT_SEVERITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Impact Scope</label>
          <input name="impact_scope" defaultValue={incident?.impact_scope ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. All users" />
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={incident?.status ?? 'open'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
              {Object.entries(INCIDENT_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      {isEdit && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Root Cause</label>
            <textarea name="root_cause" rows={2} defaultValue={incident?.root_cause ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Resolution Notes</label>
            <textarea name="resolution_notes" rows={2} defaultValue={incident?.resolution_notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Post-Mortem</label>
            <textarea name="post_mortem" rows={3} defaultValue={incident?.post_mortem ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
          </div>
        </>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
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
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Change' : 'New Change'}</h3>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Title *</label>
        <input name="title" required defaultValue={change?.title ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <textarea name="description" rows={2} defaultValue={change?.description ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Change Type</label>
          <select name="change_type" required defaultValue={change?.change_type ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            {Object.entries(CHANGE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Risk Level</label>
          <select name="risk_level" defaultValue={change?.risk_level ?? 'medium'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={change?.status ?? 'draft'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
              {Object.entries(CHANGE_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Scheduled At</label>
        <input name="scheduled_at" type="datetime-local" defaultValue={change?.scheduled_at ? new Date(change.scheduled_at).toISOString().slice(0, 16) : ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Rollback Plan</label>
        <textarea name="rollback_plan" rows={2} defaultValue={change?.rollback_plan ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (isEdit ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
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
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{isEdit ? 'Edit Release' : 'New Release'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Version *</label>
          <input name="version" required defaultValue={release?.version ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. 1.2.0" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Build Number</label>
          <input name="build_number" defaultValue={release?.build_number ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" placeholder="e.g. 20240306" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Release Notes</label>
        <textarea name="release_notes" rows={3} defaultValue={release?.release_notes ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Environment</label>
          <select name="environment" required defaultValue={release?.environment ?? 'staging'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
            {Object.entries(RELEASE_ENVS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select name="status" defaultValue={release?.status ?? 'planned'} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
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
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
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
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded bg-black/30 border border-gray-700 space-y-3">
      <h3 className="text-white font-medium">{article ? 'Edit Article' : 'New Article'}</h3>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Title *</label>
        <input name="title" required defaultValue={article?.title ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Category</label>
        <select name="category" defaultValue={article?.category ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm">
          <option value="">—</option>
          {Object.entries(KB_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Content</label>
        <textarea name="content" rows={6} defaultValue={article?.content ?? ''} className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1.5 rounded bg-[#C27E00] text-white text-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (article ? 'Save' : 'Create')}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 text-gray-400 text-sm">Cancel</button>
      </div>
    </form>
  )
}
