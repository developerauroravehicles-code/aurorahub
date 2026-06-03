import type { SupabaseClient } from '@supabase/supabase-js'
import type { CommMeetMessage, CommMessage, CommNotification } from './types'

export function subscribeToConversation(
  supabase: SupabaseClient,
  conversationId: string,
  onMessage: (message: CommMessage) => void
) {
  const channel = supabase
    .channel(`conv:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comm_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new as CommMessage)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToMeetMessages(
  supabase: SupabaseClient,
  roomId: string,
  onMessage: (message: CommMeetMessage) => void
) {
  const channel = supabase
    .channel(`meet-msg:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comm_meet_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onMessage(payload.new as CommMeetMessage)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToNotifications(
  supabase: SupabaseClient,
  userId: string,
  onNotification: (notification: CommNotification) => void
) {
  const channel = supabase
    .channel(`notif:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comm_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as CommNotification)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export type MeetSignalEvent =
  | { type: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'participant-left'; from: string }

export function subscribeToMeetSignaling(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  onSignal: (event: MeetSignalEvent) => void
) {
  const channel = supabase
    .channel(`meet-signal:${roomId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'signal' }, (payload) => {
      const event = payload.payload as MeetSignalEvent
      if (!event || typeof event !== 'object') return
      if (event.type === 'participant-left') {
        if (event.from !== userId) onSignal(event)
        return
      }
      if (event.to !== userId) return
      if (event.from !== userId) onSignal(event)
    })
    .subscribe()

  const sendSignal = async (event: MeetSignalEvent) => {
    await channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: event,
    })
  }

  return { sendSignal, cleanup: () => supabase.removeChannel(channel) }
}
