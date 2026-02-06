'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSMS } from '@/lib/twilio'
import { format } from 'date-fns'

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
  
  // Update status
  const { error: updateError } = await supabase
    .from('demands')
    .update({ status: 'approved' })
    .eq('id', demandId)

  if (updateError) return { error: updateError.message }

  // Send SMS if requested
  if (sendSMSToCustomer) {
    try {
      // Fetch dealer info for message
      const { data: dealer } = await supabase
        .from('dealers')
        .select('name, address')
        .eq('id', demand.dealer_id)
        .single()
      
      const dateStr = format(new Date(demand.appointment_date), 'MMMM dd, yyyy \'at\' HH:mm')
      const location = demand.customer_address || dealer?.address || dealer?.name || 'Authorized Dealer'
      
      const message = `An appointment has been created for ${dateStr} at ${location}. Aurora Vehicles.`
      
      // Send SMS to customer
      if (demand.customer_phone) {
        await sendSMS(demand.customer_phone, message).catch((error) => {
          console.error('Failed to send SMS to customer:', error)
        })
      }
      
      // Send SMS to assigned specialist if requested and exists
      if (sendSMSToSpecialist && demand.assigned_specialist_id) {
        const { data: specialist } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', demand.assigned_specialist_id)
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
    .select('assigned_finance_id, status')
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
    .select('assigned_finance_id, status')
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

  // Validate required fields
  if (!customerFirstname || !customerLastname || !customerPhone || !vehicleMake || !vehicleModel || !cameraModel || !appointmentDate) {
    return { error: 'All required fields must be filled' }
  }

  if (isNaN(vehicleYear) || vehicleYear < 1900) {
    return { error: 'Invalid vehicle year' }
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

