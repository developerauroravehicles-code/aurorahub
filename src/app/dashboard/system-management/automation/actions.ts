'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  getTemplateById,
  getDefaultParams,
  type TemplateId,
  type AutomationCategory,
} from '@/lib/automation-templates'
import { resolveReportData, type ReportScope, type ReportPeriod } from '@/lib/report-data-resolver'
import type { ExportReportOptions } from '@/lib/export-report-pdf'

export interface AutomationItem {
  id: string
  type: 'scheduled' | 'event'
  category: AutomationCategory
  templateId: TemplateId
  enabled: boolean
  name: string
  description?: string
  params: Record<string, unknown>
  lastRunAt?: string
  nextRunAt?: string
  /** Event types link to SMS Management */
  smsSettingKey?: string
  /** Whether this is a built-in (cannot be deleted) */
  builtIn?: boolean
}

export interface AutomationSettings {
  automations: AutomationItem[]
}

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  automations: [],
}

async function verifyAuroraManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['aurora_manager', 'it'].includes(profile?.role ?? '')) {
    throw new Error('Only Aurora Managers or IT can manage automations')
  }
}

const REPORTING_TEMPLATE_MAP: Record<string, { scope: ReportScope; period: ReportPeriod }> = {
  daily_report_sales: { scope: 'sales', period: 'daily' },
  daily_report_finance: { scope: 'finance', period: 'daily' },
  daily_report_admin: { scope: 'admin', period: 'daily' },
  daily_report_specialist: { scope: 'specialist', period: 'daily' },
  daily_report_email: { scope: 'admin', period: 'daily' },
  weekly_report_sales: { scope: 'sales', period: 'weekly' },
  weekly_report_finance: { scope: 'finance', period: 'weekly' },
  weekly_report_admin: { scope: 'admin', period: 'weekly' },
  weekly_report_specialist: { scope: 'specialist', period: 'weekly' },
  weekly_summary: { scope: 'admin', period: 'weekly' },
  monthly_report_admin: { scope: 'admin', period: 'monthly' },
}

export async function getReportPreviewData(
  templateId: string,
  params?: Record<string, unknown>
): Promise<{ options: ExportReportOptions | null; error?: string }> {
  try {
    await verifyAuroraManager()
    const mapping = REPORTING_TEMPLATE_MAP[templateId]
    if (!mapping) return { options: null, error: 'Invalid report template' }
    const dealerId = (params?.dealerId as string)?.trim() || undefined
    const { options, error } = await resolveReportData(
      mapping.scope,
      mapping.period,
      dealerId
    )
    if (error) return { options: null, error }
    if (!options.reportTitle) return { options: null, error: 'Report data could not be loaded' }
    return { options }
  } catch (err) {
    return {
      options: null,
      error: err instanceof Error ? err.message : 'Preview could not be loaded',
    }
  }
}

export async function getDealersAndCameras(): Promise<{
  dealers: { id: string; name: string; code: string }[]
  cameras: { id: string; name: string }[]
  error?: string
}> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    const [dealersRes, camerasRes] = await Promise.all([
      supabase.from('dealers').select('id, name, code').order('name'),
      supabase.from('camera_models').select('id, name').eq('is_active', true).order('name'),
    ])
    return {
      dealers: dealersRes.data ?? [],
      cameras: camerasRes.data ?? [],
    }
  } catch (err) {
    return {
      dealers: [],
      cameras: [],
      error: err instanceof Error ? err.message : 'Failed to load',
    }
  }
}

export async function getAutomationSettings(): Promise<{
  automations: AutomationItem[]
  error?: string
}> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()

    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'automation_settings')
      .single()

    let scheduled: AutomationItem[] = []
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as { automations?: Array<Partial<AutomationItem> & { category?: AutomationCategory }> }
        const raw = parsed.automations ?? []
        scheduled = raw.map((a) => {
          const template = a.templateId ? getTemplateById(a.templateId) : undefined
          const category = a.category ?? template?.category ?? 'reporting'
          return { ...a, category } as AutomationItem
        }).filter((a): a is AutomationItem => !!a.id && !!a.templateId && !!a.type)
      } catch {
        scheduled = DEFAULT_AUTOMATION_SETTINGS.automations
      }
    }
    if (scheduled.length === 0) {
      scheduled = DEFAULT_AUTOMATION_SETTINGS.automations
    }

    const cameraNotifyEnabled =
      scheduled.find((a) => a.templateId === 'camera_dealer_assignment_notify')?.enabled ?? false

    const eventAutomations: AutomationItem[] = [
      {
        id: 'camera_dealer_assignment_notify',
        type: 'event',
        category: 'camera_dealer',
        templateId: 'camera_dealer_assignment_notify',
        enabled: cameraNotifyEnabled,
        name: 'Dealer–Camera Assignment Notification',
        description: 'Email notification when camera model is assigned to or removed from dealer.',
        params: {},
        builtIn: true,
      },
    ]

    return { automations: [...scheduled, ...eventAutomations] }
  } catch (err) {
    return {
      automations: [],
      error: err instanceof Error ? err.message : 'Failed to load automations',
    }
  }
}

export async function saveAutomation(
  id: string,
  updates: { enabled?: boolean; params?: Record<string, unknown> }
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()

    if (id === 'camera_dealer_assignment_notify') {
      if (typeof updates.enabled === 'boolean') {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'automation_settings')
          .single()
        const parsed = data?.value ? JSON.parse(data.value) as { automations?: AutomationItem[] } : { automations: [] }
        const automations = parsed.automations ?? []
        const idx = automations.findIndex((a) => a.templateId === 'camera_dealer_assignment_notify')
        let updatedList: AutomationItem[]
        if (idx >= 0) {
          updatedList = automations.map((a, i) =>
            i === idx ? { ...a, enabled: updates.enabled ?? false } : a
          )
        } else {
          updatedList = [
            ...automations,
            {
              id: 'camera_dealer_assignment_notify',
              type: 'event' as const,
              category: 'camera_dealer' as const,
              templateId: 'camera_dealer_assignment_notify' as const,
              enabled: updates.enabled ?? false,
              name: 'Dealer–Camera Assignment Notification',
              params: {},
              builtIn: true,
            } as AutomationItem,
          ]
        }
        const { error } = await supabase
          .from('system_settings')
          .upsert(
            { key: 'automation_settings', value: JSON.stringify({ automations: updatedList }), updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
        if (error) return { success: false, error: error.message }
        revalidatePath('/dashboard/infrastructure/automation')
        return { success: true }
      }
    }

    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'automation_settings')
      .single()

    let automations: AutomationItem[] = DEFAULT_AUTOMATION_SETTINGS.automations
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as AutomationSettings
        automations = parsed.automations ?? automations
      } catch {}
    }

    const idx = automations.findIndex((a) => a.id === id)
    if (idx === -1) return { success: false, error: 'Automation not found' }

    if (typeof updates.enabled === 'boolean') {
      automations[idx].enabled = updates.enabled
    }
    if (updates.params) {
      automations[idx].params = { ...automations[idx].params, ...updates.params }
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'automation_settings',
          value: JSON.stringify({ automations }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/infrastructure/automation')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function addAutomation(
  templateId: TemplateId,
  params?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const template = getTemplateById(templateId)
    if (!template) return { success: false, error: 'Invalid template' }

    if (template.type === 'event') {
      return { success: false, error: 'Event automations are built-in.' }
    }

    const supabase = await createClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'automation_settings')
      .single()

    let automations: AutomationItem[] = DEFAULT_AUTOMATION_SETTINGS.automations
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as AutomationSettings
        automations = parsed.automations ?? automations
      } catch {}
    }

    const exists = automations.some((a) => a.templateId === templateId)
    if (exists) {
      return { success: false, error: 'This automation type is already added' }
    }

    const mergedParams = { ...getDefaultParams(templateId), ...params }
    const newId = `automation_${Date.now()}_${templateId}`
    const newAutomation: AutomationItem = {
      id: newId,
      type: template.type,
      category: template.category,
      templateId,
      enabled: true,
      name: template.name,
      description: template.description,
      params: mergedParams,
      builtIn: false,
    }
    automations.push(newAutomation)

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'automation_settings',
          value: JSON.stringify({ automations }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/infrastructure/automation')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add automation',
    }
  }
}

export async function removeAutomation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAuroraManager()
    const supabase = await createClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'automation_settings')
      .single()

    let automations: AutomationItem[] = DEFAULT_AUTOMATION_SETTINGS.automations
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as AutomationSettings
        automations = parsed.automations ?? automations
      } catch {}
    }

    const item = automations.find((a) => a.id === id)
    if (!item) return { success: false, error: 'Automation not found' }
    if (item.builtIn) return { success: false, error: 'Built-in automations cannot be removed' }

    automations = automations.filter((a) => a.id !== id)
    if (automations.length === 0) {
      automations = DEFAULT_AUTOMATION_SETTINGS.automations
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'automation_settings',
          value: JSON.stringify({ automations }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/infrastructure/automation')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove',
    }
  }
}

