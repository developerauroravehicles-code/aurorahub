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
  let subscribed = false
  const pendingOutbound: MeetSignalEvent[] = []

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
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true
        const queue = [...pendingOutbound]
        pendingOutbound.length = 0
        for (const event of queue) {
          void channel.send({ type: 'broadcast', event: 'signal', payload: event })
        }
      }
    })

  const sendSignal = async (event: MeetSignalEvent) => {
    if (!subscribed) {
      pendingOutbound.push(event)
      return
    }
    await channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: event,
    })
  }

  const whenReady = () =>
    new Promise<void>((resolve) => {
      if (subscribed) {
        resolve()
        return
      }
      const interval = setInterval(() => {
        if (subscribed) {
          clearInterval(interval)
          resolve()
        }
      }, 50)
      setTimeout(() => {
        clearInterval(interval)
        resolve()
      }, 5000)
    })

  return { sendSignal, whenReady, cleanup: () => supabase.removeChannel(channel) }
}

export type MeetPresenceEvent =
  | { type: 'hand'; userId: string; raised: boolean }
  | { type: 'camera'; userId: string; enabled: boolean }
  | { type: 'screen'; userId: string; active: boolean }

export type MeetParticipantPresence = {
  handRaised: boolean
  cameraEnabled: boolean
  screenSharing: boolean
}

export function subscribeToMeetPresence(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  onUpdate: (userId: string, state: Partial<MeetParticipantPresence>) => void
) {
  const channel = supabase.channel(`meet-presence:${roomId}`, {
    config: { broadcast: { self: false } },
  })

  channel
    .on('broadcast', { event: 'presence' }, (payload) => {
      const event = payload.payload as MeetPresenceEvent
      if (!event?.userId) return
      switch (event.type) {
        case 'hand':
          onUpdate(event.userId, { handRaised: event.raised })
          break
        case 'camera':
          onUpdate(event.userId, { cameraEnabled: event.enabled })
          break
        case 'screen':
          onUpdate(event.userId, { screenSharing: event.active })
          break
      }
    })
    .subscribe()

  const broadcast = async (event: MeetPresenceEvent) => {
    await channel.send({ type: 'broadcast', event: 'presence', payload: event })
  }

  const announce = async (state: MeetParticipantPresence) => {
    await broadcast({ type: 'hand', userId, raised: state.handRaised })
    await broadcast({ type: 'camera', userId, enabled: state.cameraEnabled })
    await broadcast({ type: 'screen', userId, active: state.screenSharing })
  }

  return { broadcast, announce, cleanup: () => supabase.removeChannel(channel) }
}
