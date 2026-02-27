'use server'

import { createClient } from '@/lib/supabase/server'
import { getMailSettingsWithPassword } from '@/lib/mail-settings'
import { sendEmailViaSMTP } from '@/lib/mail-sender'

export async function notifyCameraDealerAssignment(
  action: 'assigned' | 'removed',
  dealerId: string,
  cameraModelId: string
): Promise<void> {
  const supabase = await createClient()
  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'automation_settings')
    .single()

  if (!settingsRow?.value) return
  try {
    const parsed = JSON.parse(settingsRow.value) as {
      automations?: Array<{ templateId: string; enabled: boolean }>
    }
    const enabled = parsed.automations?.some(
      (a) => a.templateId === 'camera_dealer_assignment_notify' && a.enabled
    )
    if (!enabled) return
  } catch {
    return
  }

  const mailSettings = await getMailSettingsWithPassword()
  if (!mailSettings) return

  const [{ data: dealer }, { data: camera }] = await Promise.all([
    supabase.from('dealers').select('name').eq('id', dealerId).single(),
    supabase.from('camera_models').select('name').eq('id', cameraModelId).single(),
  ])

  const dealerName = dealer?.name ?? dealerId
  const cameraName = camera?.name ?? cameraModelId
  const actionText = action === 'assigned' ? 'assigned' : 'removed'
  const subject = `AuroraHub: Camera ${actionText} - ${dealerName}`
  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #C27E00;">Dealer-Camera ${action === 'assigned' ? 'Assignment' : 'Removal'} Notification</h2>
      <p>Camera model <strong>${cameraName}</strong> was ${actionText} to dealer <strong>${dealerName}</strong>.</p>
      <p style="margin-top: 16px; color: #666;">— AuroraHub System</p>
    </div>
  `

  const { data: amProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'aurora_manager')

  const emails: string[] = []
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  for (const p of amProfiles ?? []) {
    const { data: authUser } = await admin.auth.admin.getUserById(p.id)
    if (authUser?.user?.email) emails.push(authUser.user.email)
  }
  if (emails.length > 0) {
    await sendEmailViaSMTP(mailSettings, { to: emails, subject, html })
  }
}
