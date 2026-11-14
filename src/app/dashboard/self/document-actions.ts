'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  acknowledgeDocumentCore,
  recordDocumentViewCore,
  recordScrollCompletedCore,
  uploadAssignmentDocumentCore,
} from '@/lib/self/documents'

async function currentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function recordDocumentView(assignmentId: string) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Not authenticated' }
  return recordDocumentViewCore(supabase, user.id, assignmentId)
}

export async function recordScrollCompleted(assignmentId: string, scrollPercent: number) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Not authenticated' }

  const result = await recordScrollCompletedCore(supabase, user.id, assignmentId, scrollPercent)
  if ('error' in result) return { error: result.error }
  revalidatePath('/dashboard/self')
  return { success: true }
}

export async function acknowledgeDocument(assignmentId: string) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Not authenticated' }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null
  const userAgent = hdrs.get('user-agent') ?? null

  const result = await acknowledgeDocumentCore(supabase, user.id, assignmentId, { ip, userAgent })
  if ('error' in result) return { error: result.error }
  revalidatePath('/dashboard/self')
  return { success: true }
}

export async function uploadAssignmentDocument(formData: FormData) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Not authenticated' }

  const assignmentId = String(formData.get('assignmentId') ?? '')
  const file = formData.get('file')
  if (!assignmentId || !(file instanceof File)) return { error: 'File and assignment required' }

  const result = await uploadAssignmentDocumentCore(supabase, user.id, assignmentId, {
    buffer: Buffer.from(await file.arrayBuffer()),
    name: file.name,
    type: file.type,
  })
  if ('error' in result) return { error: result.error }

  revalidatePath('/dashboard/self')
  revalidatePath('/dashboard/hr/compliance')
  return { success: true }
}
