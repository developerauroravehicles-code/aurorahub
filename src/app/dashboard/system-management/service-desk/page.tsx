import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ServiceDeskContent } from './service-desk-content'

const VALID_TABS = ['tickets', 'incidents', 'changes', 'releases', 'knowledge'] as const
type Tab = (typeof VALID_TABS)[number]

type TicketScreenshot = { fileId: string; webViewLink: string | null; name: string }

function parseTicketScreenshots(value: unknown): TicketScreenshot[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const r = raw as Record<string, unknown>
      const fileId =
        typeof r.fileId === 'string' ? r.fileId
          : typeof r.file_id === 'string' ? r.file_id : null
      if (!fileId?.trim()) return null
      const webViewLink =
        typeof r.webViewLink === 'string' ? r.webViewLink
          : typeof r.web_view_link === 'string' ? r.web_view_link : null
      const name =
        typeof r.name === 'string' && r.name.trim() ? r.name
          : `${fileId.slice(0, 8)}…`
      return { fileId, webViewLink, name }
    })
    .filter((x): x is TicketScreenshot => x !== null)
}

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

  const ticketsSelectBase = 'id, ticket_number, title, description, category, priority, status, sla_due_at, resolved_at, resolution_notes, created_at, assigned_to, requested_by'
  const ticketsWithScreenshotsRes = await db
    .from('it_tickets')
    .select(`${ticketsSelectBase}, screenshots`)
    .order('created_at', { ascending: false })

  let tickets = (ticketsWithScreenshotsRes.data ?? []) as Array<{
    id: string
    ticket_number: string | null
    title: string
    description: string | null
    category: string
    priority: string
    status: string
    sla_due_at: string | null
    resolved_at: string | null
    resolution_notes: string | null
    created_at: string
    assigned_to: string | null
    requested_by: string
    screenshots?: unknown
  }>

  // Backward compatibility while screenshots migration is not yet applied.
  if (ticketsWithScreenshotsRes.error && /screenshots/i.test(ticketsWithScreenshotsRes.error.message)) {
    const fallbackTicketsRes = await db
      .from('it_tickets')
      .select(ticketsSelectBase)
      .order('created_at', { ascending: false })
    tickets = (fallbackTicketsRes.data ?? []) as typeof tickets
  }

  const [incidentsRes, changesRes, releasesRes, knowledgeRes, assigneesRes] = await Promise.all([
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
      .eq('role', 'it')
      .order('full_name'),
  ])

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
    screenshots: parseTicketScreenshots(t.screenshots),
    assigned: t.assigned_to ? { id: t.assigned_to, full_name: profileMap[t.assigned_to] ?? '—' } : null,
    requester: t.requested_by ? { id: t.requested_by, full_name: profileMap[t.requested_by] ?? '—' } : null,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mt-4">Service Desk</h2>
        <p className="text-zinc-500 dark:text-gray-400 text-sm">Manage tickets, incidents, changes, releases and knowledge base.</p>
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

