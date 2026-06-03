import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetRoomContent } from '@/components/communication/meet/meet-room-content'
import { getMeetRoomAction, getMeetMessagesAction, getMessageableProfilesAction } from '@/app/dashboard/communication/actions'

export default async function MeetRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [roomRes, msgRes, profilesRes] = await Promise.all([
    getMeetRoomAction(roomId),
    getMeetMessagesAction(roomId),
    getMessageableProfilesAction(),
  ])

  if ('error' in roomRes && roomRes.error) {
    redirect('/dashboard/communication/meet')
  }

  const room = roomRes.room!
  const participants = roomRes.participants ?? []
  const messages = 'messages' in msgRes ? msgRes.messages ?? [] : []
  const inviteProfiles = 'profiles' in profilesRes ? profilesRes.profiles ?? [] : []

  return (
    <MeetRoomContent
      room={room}
      participants={participants}
      initialMessages={messages}
      currentUserId={user.id}
      isHost={room.host_id === user.id}
      inviteProfiles={inviteProfiles}
    />
  )
}
