import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetListContent } from '@/components/communication/meet/meet-list-content'
import { getMeetRoomsAction } from '@/app/dashboard/communication/actions'

export default async function MeetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const res = await getMeetRoomsAction()
  const rooms = 'rooms' in res ? res.rooms ?? [] : []

  return <MeetListContent initialRooms={rooms} />
}
