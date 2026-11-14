import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadSpecialistExpenseReceiptToDrive } from '@/lib/google-drive'
import {
  getGoogleDriveSettingsFromDb,
  EXPENSE_CATEGORIES,
  isExtraDutyCategory,
  type SpecialistExpenseCategory,
  type SpecialistExpenseClaim,
} from '@/lib/specialist-expense-claims'
import { computeExtraDutyAmount, parseDurationFromForm } from '@/lib/extra-duty-compensation'
import { notifyAuroraManagersExpenseClaimPending } from '@/lib/notify-expense-claim-pending'

export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024
export const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

/** Profile fields the expense rules need (web: cookie session; field app: Bearer). */
export type ExpenseProfile = {
  id: string
  role: string
  full_name: string | null
  dealer_id: string | null
}

export function expenseAccessError(profile: ExpenseProfile | null): string | null {
  if (!profile || profile.dealer_id != null) return 'Expenses are only for platform specialists.'
  if (profile.role !== 'specialist') return 'Only Technical Support can submit expenses.'
  return null
}

export async function getMyExpenseClaimsCore(
  supabase: SupabaseClient,
  userId: string
): Promise<{ error: string } | { claims: SpecialistExpenseClaim[] }> {
  const { data, error } = await supabase
    .from('specialist_expense_claims')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }
  return { claims: (data ?? []) as SpecialistExpenseClaim[] }
}

async function extraDutyAmount(
  supabase: SupabaseClient,
  userId: string,
  hours: string,
  minutes: string
): Promise<{ error: string } | { amount: number; hourlyRateUsed: number; durationMinutes: number }> {
  const duration = parseDurationFromForm(hours, minutes)
  if (typeof duration === 'object' && 'error' in duration) return { error: duration.error }

  const { data: personnel } = await supabase
    .from('personnel')
    .select('salary_amount, salary_type')
    .eq('profile_id', userId)
    .maybeSingle()

  const computed = computeExtraDutyAmount({
    salaryAmount: personnel?.salary_amount != null ? Number(personnel.salary_amount) : null,
    salaryType: personnel?.salary_type as string | null,
    durationMinutes: duration,
  })
  if ('error' in computed) return { error: computed.error }
  return {
    amount: computed.amount,
    hourlyRateUsed: computed.hourlyRateUsed,
    durationMinutes: computed.durationMinutes,
  }
}

export async function previewExtraDutyCore(
  supabase: SupabaseClient,
  userId: string,
  hours: string,
  minutes: string
): Promise<{ error: string } | { amount: number; hourlyRate: number; durationMinutes: number }> {
  const result = await extraDutyAmount(supabase, userId, hours, minutes)
  if ('error' in result) return result
  return { amount: result.amount, hourlyRate: result.hourlyRateUsed, durationMinutes: result.durationMinutes }
}

export type ExpenseReceipt = { buffer: Buffer; mimeType: string; fileName: string; size: number }

export type SubmitExpenseInput = {
  description: string
  expenseDate: string
  category: string
  amount?: string
  dutyHours?: string
  dutyMinutes?: string
  receipt: ExpenseReceipt | null
}

/**
 * Validates and saves a specialist expense claim (receipt to Google Drive,
 * extra duty priced from salary) and notifies Aurora Managers.
 * Shared by the Self Portal server action and the field app API.
 */
export async function submitExpenseClaimCore(
  supabase: SupabaseClient,
  profile: ExpenseProfile,
  input: SubmitExpenseInput
): Promise<{ error: string } | { success: true }> {
  const accessError = expenseAccessError(profile)
  if (accessError) return { error: accessError }

  const description = input.description.trim().slice(0, 300)
  const expenseDate = input.expenseDate.trim()
  const categoryRaw = input.category.trim() as SpecialistExpenseCategory

  if (!description) return { error: 'Description is required.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return { error: 'Expense date is required.' }
  if (!EXPENSE_CATEGORIES.includes(categoryRaw)) return { error: 'Invalid category.' }

  let amount: number
  let durationMinutes: number | null = null
  let hourlyRateUsed: number | null = null
  let receiptDriveFileId = ''
  let receiptDriveUrl = ''
  let receiptFileName = ''

  if (isExtraDutyCategory(categoryRaw)) {
    const computed = await extraDutyAmount(supabase, profile.id, input.dutyHours ?? '0', input.dutyMinutes ?? '0')
    if ('error' in computed) return { error: computed.error }
    amount = computed.amount
    durationMinutes = computed.durationMinutes
    hourlyRateUsed = computed.hourlyRateUsed
  } else {
    amount = Math.round(parseFloat(input.amount ?? '') * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount.' }

    const receipt = input.receipt
    if (!receipt || receipt.size === 0) return { error: 'Receipt photo or PDF is required.' }
    if (receipt.size > RECEIPT_MAX_BYTES) return { error: 'Receipt must be 8 MB or smaller.' }
    if (!RECEIPT_MIME_TYPES.has(receipt.mimeType)) {
      return { error: 'Receipt must be JPEG, PNG, WebP, GIF, or PDF.' }
    }

    const admin = createAdminClient()
    const driveSettings = await getGoogleDriveSettingsFromDb(admin)
    if (!driveSettings) return { error: 'Google Drive is not configured. Contact Aurora Manager.' }

    const specialistName = profile.full_name?.trim() || profile.id.slice(0, 8)
    const upload = await uploadSpecialistExpenseReceiptToDrive(driveSettings, specialistName, expenseDate, {
      buffer: receipt.buffer,
      mimeType: receipt.mimeType,
      fileName: receipt.fileName || 'receipt.jpg',
    })
    if (!upload.success) return { error: upload.error }

    receiptDriveFileId = upload.fileId
    receiptDriveUrl = upload.webViewLink ?? ''
    receiptFileName = upload.name
  }

  const { data: inserted, error } = await supabase
    .from('specialist_expense_claims')
    .insert({
      profile_id: profile.id,
      description,
      amount,
      expense_date: expenseDate,
      category: categoryRaw,
      receipt_drive_file_id: receiptDriveFileId,
      receipt_drive_url: receiptDriveUrl,
      receipt_file_name: receiptFileName,
      status: 'pending',
      duration_minutes: durationMinutes,
      hourly_rate_used: hourlyRateUsed,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Failed to save claim.' }

  const admin = createAdminClient()
  await notifyAuroraManagersExpenseClaimPending(admin, {
    claimId: inserted.id,
    submitterProfileId: profile.id,
    submitterName: profile.full_name?.trim() || 'Specialist',
    category: categoryRaw,
    amount,
    expenseDate,
  })

  return { success: true }
}

export function expenseRevalidatePaths(userId: string): string[] {
  return ['/dashboard/self', '/dashboard/admin/approvals', `/dashboard/admin/employees/${userId}`]
}
