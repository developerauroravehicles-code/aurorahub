'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSMS } from '@/lib/twilio'
import { format } from 'date-fns'

export async function approveDemand(demandId: string) {
  const supabase = await createClient()
  
  // 1. Update status
  const { data: demand, error } = await supabase
    .from('demands')
    .update({ status: 'approved' })
    .eq('id', demandId)
    .select()
    .single()

  if (error) return { error: error.message }

  // 2. Fetch dealer info for message
  const { data: dealer } = await supabase
    .from('dealers')
    .select('name, address')
    .eq('id', demand.dealer_id)
    .single()
  
  const dateStr = format(new Date(demand.appointment_date), 'dd/MM/yyyy HH:mm')
  const location = dealer?.address || dealer?.name || 'Authorized Dealer'
  
  const message = `Randevunuz ${dateStr} tarih ve saatte, ${location} lokasyonu için oluşturulmuştur. İptal için Aurora Vehicles ile iletişime (05XX...) geçiniz.`
  
  // 3. Send SMS
  await sendSMS(demand.customer_phone, message)

  revalidatePath('/dashboard/finance/demands')
  return { success: true }
}

export async function cancelDemand(demandId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('demands').update({ status: 'cancelled' }).eq('id', demandId)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/finance/demands')
  return { success: true }
}

