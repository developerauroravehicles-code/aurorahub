import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: due, error } = await admin
    .from('dealer_crm_note_reminders')
    .select(
      'id, dealer_id, note_id, recipient_email, subject, remind_at, follow_up_kind, dealer_crm_notes(body, meeting_at), dealers(name)'
    )
    .eq('status', 'pending')
    .or(`remind_at.lte.${nowIso},and(remind_at.is.null,remind_on.lte.${nowIso.slice(0, 10)})`)
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!due?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const mailSettings = await getMailSettingsWithPassword()
  if (!mailSettings?.enabled) {
    return NextResponse.json({ ok: false, error: 'Mail disabled' }, { status: 503 })
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
    const dealerName = (Array.isArray(dealer) ? dealer[0]?.name : dealer?.name) ?? 'Dealer'
    const detailUrl = `${APP_BASE}/dashboard/admin/crm/dealers/${row.dealer_id}`

    const subject = (row.subject as string)?.trim() || `CRM reminder: ${dealerName}`
    const meetingLine = meetingAt
      ? `<p><strong>Meeting:</strong> ${new Date(meetingAt).toLocaleString('en-CA', { timeZone: 'America/Vancouver' })} PT</p>`
      : ''
    const html = `
      <p>Follow-up for <strong>${dealerName}</strong>.</p>
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