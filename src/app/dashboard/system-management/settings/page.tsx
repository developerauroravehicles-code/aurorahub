import { SystemManagementTitle } from '../system-management-title'
import { createClient } from '@/lib/supabase/server'
import { SettingsContent } from './settings-content'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value, updated_at')
    .order('key')

  const keys = (settings ?? []).map((s) => s.key)

  return (
    <div className="space-y-8">
      <div>
        <SystemManagementTitle />
        <h2 className="text-lg font-semibold text-white mt-4">Platform Settings</h2>
        <p className="text-gray-400 text-sm">Sistem genelindeki ayarları görüntüleyin. Hassas değerler (API keys vb.) maske gösterilir.</p>
      </div>
      <SettingsContent keys={keys} />
    </div>
  )
}
