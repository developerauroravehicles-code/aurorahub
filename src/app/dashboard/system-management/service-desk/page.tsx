import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ServiceDeskContent } from './service-desk-content'

const VALID_TABS = ['tickets', 'incidents', 'changes', 'releases', 'knowledge'] as const
type Tab = (typeof VALID_TABS)[number]

export default async function ServiceDeskPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams
  const tab = params?.tab
  const initialTab: Tab = tab && VALID_TABS.includes(tab as Tab) ? (tab as Tab) : 'tickets'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canAccess = ['aurora_manager', 'it'].includes(profile?.role ?? '')
  if (!canAccess) redirect('/dashboard')

  // Use admin client for IT and aurora_manager to bypass any RLS edge cases - ensures full ticket visibility and management
  const db = createAdminClient()

  const [ticketsRes, incidentsRes, changesRes, releasesRes, knowledgeRes, assigneesRes] = await Promise.all([
    db
      .from('it_tickets')
      .select('id, ticket_number, title, description, category, priority, status, sla_due_at, resolved_at, resolution_notes, created_at, assigned_to, requested_by')
      .order('created_at', { ascending: false }),
    db
      .from('it_incidents')
      .select('id, incident_number, title, description, severity, impact_scope, status, root_cause, resolution_notes, post_mortem, resolved_at, created_at')
      .order('created_at', { ascending: false }),
    db
      .from('it_changes')
      .select('id, change_number, title, description, change_type, risk_level, status, scheduled_at, deployed_at, rollback_plan, created_at')
      .order('created_at', { ascending: false }),
    db
      .from('it_releases')
      .select('id, version, build_number, release_notes, environment, status, deployed_at, created_at')
      .order('created_at', { ascending: false }),
    db
      .from('it_knowledge_base')
      .select('id, title, content, category, tags, created_at')
      .order('updated_at', { ascending: false }),
    db
      .from('profiles')
      .select('id, full_name')
      .in('role', ['it', 'aurora_manager', 'specialist'])
      .order('full_name'),
  ])

  const tickets = ticketsRes.data ?? []
  const incidents = incidentsRes.data ?? []
  const changes = changesRes.data ?? []
  const releases = releasesRes.data ?? []
  const knowledge = knowledgeRes.data ?? []
  const assignees = assigneesRes.data ?? []
  const ticketProfileIds = [...new Set(tickets.flatMap((t) => [t.assigned_to, t.requested_by].filter(Boolean) as string[]))]
  const { data: profileRows } = ticketProfileIds.length > 0
    ? await db.from('profiles').select('id, full_name').in('id', ticketProfileIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> }
  const profileMap = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p.full_name ?? '—']))
  const ticketsWithNames = tickets.map((t) => ({
    ...t,
    assigned: t.assigned_to ? { id: t.assigned_to, full_name: profileMap[t.assigned_to] ?? '—' } : null,
    requester: t.requested_by ? { id: t.requested_by, full_name: profileMap[t.requested_by] ?? '—' } : null,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Service Desk</h2>
        <p className="text-gray-400 text-sm">Manage tickets, incidents, changes, releases and knowledge base.</p>
      </div>
      <ServiceDeskContent
        tickets={ticketsWithNames}
        incidents={incidents}
        changes={changes}
        releases={releases}
        knowledge={knowledge}
        assignees={assignees}
        initialTab={initialTab ?? 'tickets'}
      />
    </div>
  )
}
