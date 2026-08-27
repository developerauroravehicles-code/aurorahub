import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BARCODE_SETTINGS_KEY,
  DEFAULT_BARCODE_SETTINGS,
  type BarcodeSettings,
} from './types'

export function parseBarcodeSettings(raw: string | null | undefined): BarcodeSettings {
  if (!raw) return { ...DEFAULT_BARCODE_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<BarcodeSettings>
    return {
      enabled: Boolean(parsed.enabled),
      codePrefix: String(parsed.codePrefix ?? DEFAULT_BARCODE_SETTINGS.codePrefix)
        .trim()
        .toUpperCase() || DEFAULT_BARCODE_SETTINGS.codePrefix,
    }
  } catch {
    return { ...DEFAULT_BARCODE_SETTINGS }
  }
}

export async function getBarcodeSettings(
  supabaseClient?: SupabaseClient
): Promise<BarcodeSettings> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = supabaseClient ?? (await createClient())
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', BARCODE_SETTINGS_KEY)
    .maybeSingle()

  return parseBarcodeSettings(data?.value)
}

export async function isBarcodeModeEnabled(supabaseClient?: SupabaseClient): Promise<boolean> {
  const settings = await getBarcodeSettings(supabaseClient)
  return settings.enabled
}

export async function saveBarcodeSettings(
  supabase: SupabaseClient,
  settings: BarcodeSettings
): Promise<{ error?: string }> {
  const payload: BarcodeSettings = {
    enabled: Boolean(settings.enabled),
    codePrefix:
      String(settings.codePrefix ?? DEFAULT_BARCODE_SETTINGS.codePrefix)
        .trim()
        .toUpperCase() || DEFAULT_BARCODE_SETTINGS.codePrefix,
  }

  const { error } = await supabase.from('system_settings').upsert(
    {
      key: BARCODE_SETTINGS_KEY,
      value: JSON.stringify(payload),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (error) return { error: error.message }
  return {}
}
