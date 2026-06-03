import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetListContent } from '@/components/communication/meet/meet-list-content'
import { getMeetRoomsAction, getMessageableProfilesAction } from '@/app/dashboard/communication/actions'

export default async function MeetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [roomsRes, profilesRes] = await Promise.all([
    getMeetRoomsAction(),
    getMessageableProfilesAction(),
  ])
  const rooms = 'rooms' in roomsRes ? roomsRes.rooms ?? [] : []
  const profiles = 'profiles' in profilesRes ? profilesRes.profiles ?? [] : []

  return <MeetListContent initialRooms={rooms} profiles={profiles} />
}
