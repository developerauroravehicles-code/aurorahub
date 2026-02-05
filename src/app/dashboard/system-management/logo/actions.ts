'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function verifyAuroraManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'aurora_manager') {
    throw new Error('Unauthorized: Only Aurora Manager can access System Management')
  }
}

type ActionState = { error?: string; success?: string } | null

export async function uploadLogo(prevState: ActionState, formData: FormData) {
  await verifyAuroraManager()
  const supabaseAdmin = createAdminClient()
  const file = formData.get('logo') as File

  if (!file) {
    return { error: 'No file selected' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File size must be less than 5MB' }
  }

  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString('base64')
  const dataUrl = `data:${file.type};base64,${base64}`

  // Store in system_settings table
  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert({
      key: 'system_logo',
      value: dataUrl,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    })

  if (error) {
    return { error: 'Failed to save logo: ' + error.message }
  }

  revalidatePath('/dashboard/system-management')
  revalidatePath('/dashboard/system-management/logo')
  return { success: 'Logo uploaded successfully!' }
}

export async function getSystemLogo() {
  const supabaseAdmin = createAdminClient()
  
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'system_logo')
    .single()

  return data?.value || null
}

