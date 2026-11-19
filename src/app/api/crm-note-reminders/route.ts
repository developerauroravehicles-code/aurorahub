import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

const REMINDER_SELECT =
  'id, dealer_id, prospect_id, note_id, recipient_email, subject, remind_at, follow_up_kind, dealer_crm_notes(body, meeting_at), dealers(name), crm_prospects(name)'

function isCronAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) return true

  const authHeader = request.headers.get('authorization')
  const querySecret = new URL(request.url).searchParams.get('secret')
  return authHeader === `Bearer ${expectedSecret}` || querySecret === expectedSecret
}

async function fetchDueReminders(admin: ReturnType<typeof createAdminClient>, nowIso: string, today: string) {
  const [byAt, byDate] = await Promise.all([
    admin
      .from('dealer_crm_note_reminders')
      .select(REMINDER_SELECT)
      .eq('status', 'pending')
      .not('remind_at', 'is', null)
      .lte('remind_at', nowIso)
      .limit(50),
    admin
      .from('dealer_crm_note_reminders')
      .select(REMINDER_SELECT)
      .eq('status', 'pending')
      .is('remind_at', null)
      .lte('remind_on', today)
      .limit(50),
  ])

  if (byAt.error) return { error: byAt.error }
  if (byDate.error) return { error: byDate.error }

  const seen = new Set<string>()
  const rows = [...(byAt.data ?? []), ...(byDate.data ?? [])].filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })

  return { data: rows.slice(0, 50) }
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const today = nowIso.slice(0, 10)

  const dueResult = await fetchDueReminders(admin, nowIso, today)
  if (dueResult.error) {
    return NextResponse.json({ error: dueResult.error.message }, { status: 500 })
  }

  const due = dueResult.data ?? []
  if (!due.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const mailSettings = await getMailSettingsWithPassword()
  if (!mailSettings?.enabled) {
    return NextResponse.json({ ok: false, error: 'Mail disabled or not configured' }, { status: 503 })
  }

  let sent = 0
  let failed = 0

  for (const row of due) {
    const note = row.dealer_crm_notes as
      | { body?: string; meeting_at?: string }
      | { body?: string; meeting_at?: string }[]
      | null
    const noteObj = Array.isArray(note) ? note[0] : note
    const noteBody = noteObj?.body
    const meetingAt = noteObj?.meeting_at
    const dealer = row.dealers as { name?: string } | { name?: string }[] | null
    const prospect = row.crm_prospects as { name?: string } | { name?: string }[] | null
    const accountName =
      (Array.isArray(dealer) ? dealer[0]?.name : dealer?.name) ??
      (Array.isArray(prospect) ? prospect[0]?.name : prospect?.name) ??
      'Account'
    const detailUrl = row.dealer_id
      ? `${APP_BASE}/dashboard/admin/crm/dealers/${row.dealer_id}`
      : `${APP_BASE}/dashboard/admin/crm/prospects/${row.prospect_id}`

    const subject = (row.subject as string)?.trim() || `CRM reminder: ${accountName}`
    const meetingLine = meetingAt
      ? `<p><strong>Meeting:</strong> ${new Date(meetingAt).toLocaleString('en-CA', { timeZone: 'America/Vancouver' })} PT</p>`
      : ''
    const html = `
      <p>Follow-up for <strong>${accountName}</strong>.</p>
      ${meetingLine}
      <blockquote style="border-left:3px solid #C27E00;padding-left:12px;color:#444">
        ${String(noteBody ?? '').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}
      </blockquote>
      <p><a href="${detailUrl}">Open dealer in Aurora CRM</a></p>
    `

    const result = await sendEmailViaSMTP(mailSettings, {
      to: [row.recipient_email as string],
      subject,
      html,
    })

    const now = new Date().toISOString()
    if (result.success) {
      await admin
        .from('dealer_crm_note_reminders')
        .update({ status: 'sent', sent_at: now, last_error: null })
        .eq('id', row.id)
      sent += 1
    } else {
      await admin
        .from('dealer_crm_note_reminders')
        .update({ status: 'failed', last_error: result.error ?? 'Send failed' })
        .eq('id', row.id)
      failed += 1
    }
  }

  return NextResponse.json({ ok: true, sent, failed })
}