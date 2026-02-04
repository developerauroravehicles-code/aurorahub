'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function uploadLogo(prevState: any, formData: FormData) {
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
  revalidatePath('/admin')
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

