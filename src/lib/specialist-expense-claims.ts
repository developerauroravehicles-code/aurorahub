import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoogleDriveSettings } from '@/lib/google-drive'

export type SpecialistExpenseClaimStatus = 'pending' | 'approved' | 'rejected'

export type SpecialistExpenseCategory = 'travel' | 'meals' | 'fuel' | 'supplies' | 'other'

export type SpecialistExpenseClaim = {
  id: string
  profile_id: string
  description: string
  amount: number
  expense_date: string
  category: SpecialistExpenseCategory
  receipt_drive_file_id: string
  receipt_drive_url: string
  receipt_file_name: string
  status: SpecialistExpenseClaimStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string
  created_at: string
}

export const EXPENSE_CATEGORY_LABELS: Record<SpecialistExpenseCategory, string> = {
  travel: 'Travel',
  meals: 'Meals',
  fuel: 'Fuel',
  supplies: 'Supplies',
  other: 'Other',
}

export async function getGoogleDriveSettingsFromDb(
  supabase: SupabaseClient
): Promise<GoogleDriveSettings | null> {
  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_settings')
    .single()

  if (!settingsRow?.value || typeof settingsRow.value !== 'string') return null

  try {
    const settings = JSON.parse(settingsRow.value) as GoogleDriveSettings
    const driveConfigured =
      !!settings?.enabled &&
      typeof settings?.defaultFolderId === 'string' &&
      settings.defaultFolderId.trim() !== ''

    const hasOAuth = !!(
      settings?.useOAuth &&
      settings.refreshToken?.trim() &&
      settings.clientId?.trim() &&
      settings.clientSecret?.trim()
    )
    const hasSa = !!(
      (settings?.serviceAccountEmail || settings?.clientEmail)?.trim() &&
      (settings?.serviceAccountPrivateKey || settings?.privateKey)?.trim()
    )

    if (!driveConfigured || (!hasOAuth && !hasSa)) return null
    return settings
  } catch {
    return null
  }
}
