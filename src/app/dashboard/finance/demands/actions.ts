'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSMS } from '@/lib/twilio'
import { getAppointmentCreatedMessage, getCancellationNoticeMessage, isWithin24Hours } from '@/lib/sms-messages'
import { validateAppointmentSlot } from '@/app/dashboard/system-management/calendar/actions'

export async function assignDemandToMe(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'finance') {
    return { error: 'Only finance users can assign demands' }
  }

  // Check if demand is already assigned
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }
  
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'This demand is already assigned to another finance user' }
  }

  if (demand.status !== 'pending_finance') {
    return { error: 'Only pending demands can be assigned' }
  }

  // Assign demand to current user
  const { error } = await supabase
    .from('demands')
    .update({ assigned_finance_id: user.id })
    .eq('id', demandId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function approveDemand(demandId: string, sendSMSToCustomer: boolean = false, sendSMSToSpecialist: boolean = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance and demand is assigned to them
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, assigned_specialist_id, status, dealer_id, customer_phone, appointment_date, customer_address')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  if (demand.status !== 'pending_finance') {
    return { error: 'Only pending demands can be approved' }
  }

  // Check if demand is assigned to current user
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only approve demands assigned to you' }
  }

  // If not assigned, assign it first
  if (!demand.assigned_finance_id) {
    await supabase
      .from('demands')
      .update({ assigned_finance_id: user.id })
      .eq('id', demandId)
  }
  
  // Auto-assign to dealer's specialist if not already assigned
  let assignedSpecialistId = demand.assigned_specialist_id
  
  if (!assignedSpecialistId) {
    // Find specialist assigned to this dealer
    const { data: dealerSpecialist } = await supabase
      .from('profiles')
      .select('id')
      .eq('dealer_id', demand.dealer_id)
      .eq('role', 'specialist')
      .limit(1)
      .single()
    
    if (dealerSpecialist) {
      assignedSpecialistId = dealerSpecialist.id
    }
  }

  // Update status and assign specialist if found
  const updateData: { status: string; assigned_specialist_id?: string } = { 
    status: 'approved' 
  }
  
  if (assignedSpecialistId) {
    updateData.assigned_specialist_id = assignedSpecialistId
  }

  const { error: updateError } = await supabase
    .from('demands')
    .update(updateData)
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  // Send SMS if requested
  if (sendSMSToCustomer) {
    try {
      // Fetch dealer info with timezone
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name, address, region_codes(timezone_id, timezones(name))')
        .eq('id', demand.dealer_id)
        .single()
      
      const appointmentDate = new Date(demand.appointment_date)
      const location = demand.customer_address || dealer?.address || dealer?.name || 'Authorized Dealer'
      
      // Get timezone name from dealer > region > timezone
      const timezoneName = (dealer?.region_codes as any)?.timezones?.name || undefined
      
      // Use new Appointment Created message format with timezone
      const message = getAppointmentCreatedMessage(appointmentDate, location, timezoneName)
      
      // Send SMS to customer
      if (demand.customer_phone) {
        await sendSMS(demand.customer_phone, message).catch((error) => {
          console.error('Failed to send SMS to customer:', error)
        })
      }
      
      // Send SMS to assigned specialist if requested and exists
      // Use the newly assigned specialist ID if auto-assigned
      const specialistIdToNotify = assignedSpecialistId || demand.assigned_specialist_id
      
      if (sendSMSToSpecialist && specialistIdToNotify) {
        const { data: specialist } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', specialistIdToNotify)
          .single()
        
        if (specialist?.phone) {
          await sendSMS(specialist.phone, message).catch((error) => {
            console.error('Failed to send SMS to specialist:', error)
          })
        }
      }
    } catch (smsError) {
      // Log SMS error but don't fail the approval
      console.error('Failed to send SMS notification:', smsError)
    }
  }

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function cancelDemand(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status, appointment_date, customer_phone')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  // Only assigned finance users can cancel
  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only cancel demands assigned to you' }
  }

  const { error } = await supabase
    .from('demands')
    .update({ status: 'cancelled' })
    .eq('id', demandId)
  
  if (error) return { error: error.message }
  
  // Send cancellation notice SMS if appointment is within 24 hours
  if (demand.appointment_date && demand.customer_phone) {
    const appointmentDate = new Date(demand.appointment_date)
    if (isWithin24Hours(appointmentDate)) {
      try {
        const message = getCancellationNoticeMessage()
        await sendSMS(demand.customer_phone, message).catch((error) => {
          console.error('Failed to send cancellation SMS:', error)
        })
      } catch (smsError) {
        console.error('Failed to send cancellation SMS:', smsError)
      }
    }
  }
  
  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateDemand(demandId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'finance') {
    return { error: 'Only finance users can update demands' }
  }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status, appointment_date, customer_phone, dealer_id')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only edit demands assigned to you' }
  }

  if (demand.status !== 'approved') {
    return { error: 'Only approved demands can be edited' }
  }

  // Get form data
  const customerFirstname = formData.get('customer_firstname') as string
  const customerLastname = formData.get('customer_lastname') as string
  const customerPhone = formData.get('customer_phone') as string
  const customerAddress = formData.get('customer_address') as string | null
  const vehicleMake = formData.get('vehicle_make') as string
  const vehicleModel = formData.get('vehicle_model') as string
  const vehicleYear = parseInt(formData.get('vehicle_year') as string)
  const stockNumber = formData.get('stock_number') as string | null
  const cameraModel = formData.get('camera_model') as string
  const appointmentDate = formData.get('appointment_date') as string
  
  // Check if appointment date changed and if old date was within 24 hours
  const oldAppointmentDate = demand.appointment_date ? new Date(demand.appointment_date) : null
  const newAppointmentDate = new Date(appointmentDate)
  const appointmentDateChanged = oldAppointmentDate && oldAppointmentDate.getTime() !== newAppointmentDate.getTime()

  // Validate required fields
  if (!customerFirstname || !customerLastname || !customerPhone || !vehicleMake || !vehicleModel || !cameraModel || !appointmentDate) {
    return { error: 'All required fields must be filled' }
  }

  if (isNaN(vehicleYear) || vehicleYear < 1900) {
    return { error: 'Invalid vehicle year' }
  }

  if (demand.dealer_id) {
    const validation = await validateAppointmentSlot(demand.dealer_id, appointmentDate)
    if (!validation.valid) {
      return { error: validation.error ?? 'Selected appointment time is not available for this dealer.' }
    }
  }

  // Update demand
  const { error: updateError } = await supabase
    .from('demands')
    .update({
      customer_firstname: customerFirstname,
      customer_lastname: customerLastname,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      vehicle_year: vehicleYear,
      stock_number: stockNumber,
      camera_model: cameraModel,
      appointment_date: appointmentDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  // Send cancellation/rescheduling notice SMS if appointment date changed and old date was within 24 hours
  if (appointmentDateChanged && oldAppointmentDate && demand.customer_phone && isWithin24Hours(oldAppointmentDate)) {
    try {
      const message = getCancellationNoticeMessage()
      await sendSMS(demand.customer_phone, message).catch((error) => {
        console.error('Failed to send rescheduling SMS:', error)
      })
    } catch (smsError) {
      console.error('Failed to send rescheduling SMS:', smsError)
    }
  }

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function revertDemandToPending(demandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }

  // Check if user is finance
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'finance') {
    return { error: 'Only finance users can revert demands' }
  }

  // Check if demand is assigned to current user
  const { data: demand } = await supabase
    .from('demands')
    .select('assigned_finance_id, status')
    .eq('id', demandId)
    .single()

  if (!demand) return { error: 'Demand not found' }

  if (demand.assigned_finance_id && demand.assigned_finance_id !== user.id) {
    return { error: 'You can only revert demands assigned to you' }
  }

  if (demand.status !== 'approved') {
    return { error: 'Only approved demands can be reverted to pending' }
  }

  // Revert status to pending_finance
  const { error: updateError } = await supabase
    .from('demands')
    .update({ 
      status: 'pending_finance',
      updated_at: new Date().toISOString()
    })
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard/finance/demands')
  revalidatePath('/dashboard')
  return { success: true }
}

