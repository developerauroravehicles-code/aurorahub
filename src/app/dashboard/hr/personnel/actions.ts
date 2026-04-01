'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { normalizeEmail } from '@/lib/email-normalize'

export async function createPersonnel(formData: Record<string, string | undefined>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const workerId = formData.worker_id || `WRK-${Date.now().toString(36).toUpperCase()}`
  const { data: inserted, error } = await supabase.from('personnel').insert({
    worker_id: workerId,
    worker_type: formData.worker_type || 'employee',
    worker_classification: formData.worker_classification,
    status: formData.status || 'onboarding',
    full_name: formData.full_name!,
    avatar_url: formData.avatar_url,
    phone: formData.phone,
    email: formData.email != null && String(formData.email).trim() !== '' ? normalizeEmail(formData.email) : null,
    address: formData.address,
    emergency_contact_name: formData.emergency_contact_name,
    emergency_contact_phone: formData.emergency_contact_phone,
    government_id: formData.government_id,
    sin_verified: formData.sin_verified === 'true',
    work_permit_status: formData.work_permit_status,
    driver_license: formData.driver_license,
    background_check_status: formData.background_check_status,
    position: formData.position,
    department_id: formData.department_id || null,
    platform_role: formData.platform_role || null,
    region_id: formData.region_id || null,
    assigned_manager_id: formData.assigned_manager_id || null,
    start_date: formData.start_date || null,
    contract_type: formData.contract_type || null,
    work_arrangement: formData.work_arrangement || null,
    province: formData.province || null,
    dealer_id: formData.dealer_id || null,
    salary_amount: formData.salary_amount ? parseFloat(formData.salary_amount) : null,
    salary_currency: formData.salary_currency || null,
    salary_type: formData.salary_type || null,
  }).select('id').single()

  if (error) return { error: error.message }

  if (inserted) {
    await supabase.from('personnel_timeline').insert({
      personnel_id: inserted.id,
      event_type: 'hired',
      title: 'Personnel record created',
      created_by: user.id,
    })
    if (formData.worker_type === 'installer_technician') {
      await supabase.from('installer_profiles').insert({
        personnel_id: inserted.id,
        installer_status: 'active',
      })
    }
  }

  revalidatePath('/dashboard/hr/personnel')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updatePersonnel(id: string, formData: Record<string, string | undefined>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase.from('personnel').update({
    worker_type: formData.worker_type,
    worker_classification: formData.worker_classification,
    status: formData.status,
    full_name: formData.full_name,
    avatar_url: formData.avatar_url,
    phone: formData.phone,
    email: formData.email != null && String(formData.email).trim() !== '' ? normalizeEmail(formData.email) : null,
    address: formData.address,
    emergency_contact_name: formData.emergency_contact_name,
    emergency_contact_phone: formData.emergency_contact_phone,
    government_id: formData.government_id,
    sin_verified: formData.sin_verified === 'true',
    work_permit_status: formData.work_permit_status,
    driver_license: formData.driver_license,
    background_check_status: formData.background_check_status,
    position: formData.position,
    department_id: formData.department_id || null,
    platform_role: formData.platform_role || null,
    region_id: formData.region_id || null,
    assigned_manager_id: formData.assigned_manager_id || null,
    start_date: formData.start_date || null,
    contract_type: formData.contract_type || null,
    work_arrangement: formData.work_arrangement || null,
    province: formData.province || null,
    dealer_id: formData.dealer_id || null,
    salary_amount: formData.salary_amount ? parseFloat(formData.salary_amount) : null,
    salary_currency: formData.salary_currency || null,
    salary_type: formData.salary_type || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/hr/personnel')
  revalidatePath(`/dashboard/hr/personnel/${id}`)
  return { success: true }
}

export async function createCertification(
  personnelId: string,
  formData: { institution: string; name: string; issue_date: string; status: string; expiry_date?: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase.from('personnel_certifications').insert({
    personnel_id: personnelId,
    certification_type: 'other',
    name: formData.name || null,
    institution: formData.institution || null,
    issue_date: formData.issue_date,
    expiry_date: formData.expiry_date || null,
    status: formData.status || 'awaiting',
  })

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/hr/personnel/${personnelId}`, 'page')
  revalidatePath('/dashboard/hr/personnel')
  return { success: true }
}

export async function updateInstallerProfile(
  installerId: string,
  formData: {
    experience_level?: string
    customer_rating?: string
    quality_score?: string
    installer_status?: string
    installation_skills?: string
    device_compatibility?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const skills = formData.installation_skills?.split(',').map((s) => s.trim()).filter(Boolean)
  const devices = formData.device_compatibility?.split(',').map((s) => s.trim()).filter(Boolean)

  const { data: inst } = await supabase.from('installer_profiles').select('personnel_id').eq('id', installerId).single()
  if (!inst) return { error: 'Installer profile not found' }

  const { error } = await supabase
    .from('installer_profiles')
    .update({
      experience_level: formData.experience_level || null,
      customer_rating: formData.customer_rating ? parseFloat(formData.customer_rating) : null,
      quality_score: formData.quality_score ? parseFloat(formData.quality_score) : null,
      installer_status: formData.installer_status || null,
      installation_skills: skills?.length ? skills : null,
      device_compatibility: devices?.length ? devices : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', installerId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/hr/personnel/${inst.personnel_id}`)
  revalidatePath('/dashboard/hr/installers')
  return { success: true }
}

export async function updateCertificationStatus(certificationId: string, status: string, personnelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr' && profile?.role !== 'aurora_manager') {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('personnel_certifications')
    .update({ status })
    .eq('id', certificationId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/hr/personnel/${personnelId}`)
  return { success: true }
}
