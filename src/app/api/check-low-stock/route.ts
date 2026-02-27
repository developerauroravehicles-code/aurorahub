import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'automation_settings')
    .single()

  if (!settingsRow?.value) {
    return NextResponse.json({ ok: true, alerts: 0 })
  }

  let automations: Array<{ templateId: string; enabled: boolean; params: Record<string, unknown> }> = []
  try {
    const parsed = JSON.parse(settingsRow.value) as {
      automations?: Array<{ templateId: string; enabled: boolean; params?: Record<string, unknown> }>
    }
    automations = (parsed.automations ?? [])
      .filter((a) => a.templateId === 'camera_low_stock_alert' && a.enabled)
      .map((a) => ({ ...a, params: a.params ?? {} }))
  } catch {
    return NextResponse.json({ ok: true, alerts: 0 })
  }

  const mailSettings = await getMailSettingsWithPassword()
  if (!mailSettings) {
    return NextResponse.json({ ok: true, alerts: 0, message: 'Mail not configured' })
  }

  let alertsSent = 0
  const errors: string[] = []

  for (const auto of automations) {
    const dealerId = auto.params?.dealerId ? String(auto.params.dealerId) : undefined
    const cameraModelId = auto.params?.cameraModelId ? String(auto.params.cameraModelId) : undefined
    const threshold = Number(auto.params?.threshold ?? 5)

    let query = supabase
      .from('camera_models')
      .select('id, name, stock_quantity')
      .eq('is_active', true)

    if (cameraModelId) {
      query = query.eq('id', cameraModelId)
    }

    const { data: cameras, error } = await query
    if (error) {
      errors.push(`Query error: ${error.message}`)
      continue
    }

    const lowStock = (cameras ?? []).filter(
      (c) => c.stock_quantity != null && c.stock_quantity < threshold
    )

    if (lowStock.length === 0) continue

    const dealerFilter = dealerId ? ` (Dealer: ${dealerId})` : ''
    const subject = `AuroraHub: Low Stock Alert${dealerFilter}`
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #C27E00;">Low Stock Alert</h2>
        <p>The following camera models have fallen below the threshold (${threshold}):</p>
        <ul>
          ${lowStock.map((c) => `<li><strong>${c.name}</strong>: ${c.stock_quantity} units</li>`).join('')}
        </ul>
        <p style="margin-top: 16px; color: #666;">— AuroraHub System</p>
      </div>
    `

    const { data: amProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'aurora_manager')
    const emails: string[] = []
    if (amProfiles?.length) {
      for (const p of amProfiles) {
        const { data: authUser } = await supabase.auth.admin.getUserById(p.id)
        if (authUser?.user?.email) emails.push(authUser.user.email)
      }
    }

    if (emails.length === 0) {
      errors.push('No Aurora Manager emails found')
      continue
    }

    const result = await sendEmailViaSMTP(mailSettings, {
      to: emails,
      subject,
      html,
    })
    if (result.success) alertsSent++
    else errors.push(result.error ?? 'Send failed')
  }

  return NextResponse.json({
    ok: true,
    alerts: alertsSent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
