'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { uploadSpecialistExpenseReceiptToDrive } from '@/lib/google-drive'
import {
  getGoogleDriveSettingsFromDb,
  type SpecialistExpenseCategory,
  type SpecialistExpenseClaim,
} from '@/lib/specialist-expense-claims'

const RECEIPT_MAX_BYTES = 8 * 1024 * 1024
const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const VALID_CATEGORIES: SpecialistExpenseCategory[] = [
  'travel',
  'meals',
  'fuel',
  'supplies',
  'other',
]

async function verifySpecialistSelf() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, userId: null, supabase: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.dealer_id != null) {
    return { error: 'Expenses are only for platform specialists.' as const, userId: null, supabase: null, profile: null }
  }
  if (profile.role !== 'specialist') {
    return { error: 'Only Technical Support can submit expenses.' as const, userId: null, supabase: null, profile: null }
  }

  return { error: null, userId: user.id, supabase, profile }
}

export async function getMyExpenseClaims(): Promise<{
  error?: string
  claims?: SpecialistExpenseClaim[]
}> {
  const auth = await verifySpecialistSelf()
  if (auth.error || !auth.supabase || !auth.userId) return { error: auth.error ?? 'Unauthorized' }

  const { data, error } = await auth.supabase
    .from('specialist_expense_claims')
    .select('*')
    .eq('profile_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }
  return { claims: (data ?? []) as SpecialistExpenseClaim[] }
}

export async function submitSpecialistExpenseClaim(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const auth = await verifySpecialistSelf()
  if (auth.error || !auth.supabase || !auth.userId || !auth.profile) {
    return { error: auth.error ?? 'Unauthorized' }
  }

  const description = String(formData.get('description') ?? '').trim().slice(0, 300)
  const amountRaw = String(formData.get('amount') ?? '')
  const expenseDate = String(formData.get('expense_date') ?? '').trim()
  const categoryRaw = String(formData.get('category') ?? 'other').trim() as SpecialistExpenseCategory
  const receipt = formData.get('receipt')

  if (!description) return { error: 'Description is required.' }
  const amount = Math.round(parseFloat(amountRaw) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return { error: 'Expense date is required.' }
  if (!VALID_CATEGORIES.includes(categoryRaw)) return { error: 'Invalid category.' }
  if (!(receipt instanceof File) || receipt.size === 0) {
    return { error: 'Receipt photo or PDF is required.' }
  }
  if (receipt.size > RECEIPT_MAX_BYTES) {
    return { error: 'Receipt must be 8 MB or smaller.' }
  }
  if (!RECEIPT_MIME_TYPES.has(receipt.type)) {
    return { error: 'Receipt must be JPEG, PNG, WebP, GIF, or PDF.' }
  }

  const admin = createAdminClient()
  const driveSettings = await getGoogleDriveSettingsFromDb(admin)
  if (!driveSettings) {
    return { error: 'Google Drive is not configured. Contact Aurora Manager.' }
  }

  const buffer = Buffer.from(await receipt.arrayBuffer())
  const specialistName = auth.profile.full_name?.trim() || auth.userId.slice(0, 8)

  const upload = await uploadSpecialistExpenseReceiptToDrive(
    driveSettings,
    specialistName,
    expenseDate,
    {
      buffer,
      mimeType: receipt.type,
      fileName: receipt.name || 'receipt.jpg',
    }
  )

  if (!upload.success) return { error: upload.error }

  const { error } = await auth.supabase.from('specialist_expense_claims').insert({
    profile_id: auth.userId,
    description,
    amount,
    expense_date: expenseDate,
    category: categoryRaw,
    receipt_drive_file_id: upload.fileId,
    receipt_drive_url: upload.webViewLink ?? '',
    receipt_file_name: upload.name,
    status: 'pending',
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/self')
  revalidatePath(`/dashboard/admin/employees/${auth.userId}`)
  return { success: true }
}
