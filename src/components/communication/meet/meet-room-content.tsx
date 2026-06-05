'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Paperclip, Send, Hand, MonitorUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  subscribeToMeetMessages,
  subscribeToMeetSignaling,
  subscribeToMeetPresence,
  type MeetParticipantPresence,
} from '@/lib/communication/realtime'
import { MeetMeshManager, type ScreenShareCursorMode } from '@/lib/communication/webrtc'
import type { CommAttachment, CommMeetMessage, CommMeetParticipant, CommMeetRoom, CommUserProfile } from '@/lib/communication/types'
import {
  endMeetAction,
  leaveMeetAction,
  sendMeetMessageAction,
  uploadMeetAttachmentAction,
} from '@/app/dashboard/communication/actions'
import { useRouter } from 'next/navigation'
import { MeetControlBar, type SidePanel } from '@/components/communication/meet/meet-control-bar'
import { MeetParticipantsPanel } from '@/components/communication/meet/meet-participants-panel'
import { getStoredCursorMode } from '@/components/communication/meet/meet-screen-share-settings'
import { clsx } from 'clsx'

type Props = {
  room: CommMeetRoom
  participants: CommMeetParticipant[]
  initialMessages: CommMeetMessage[]
  currentUserId: string
  isHost: boolean
  inviteProfiles: CommUserProfile[]
}

const defaultPresence = (): MeetParticipantPresence => ({
  handRaised: false,
  cameraEnabled: false,
  screenSharing: false,
})

function RemoteVideo({ stream, objectFit = 'contain' }: { stream: MediaStream; objectFit?: 'contain' | 'cover' }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.srcObject = stream
    void el.play().catch(() => {})

    const refresh = () => {
      el.srcObject = stream
      void el.play().catch(() => {})
    }

    stream.addEventListener('addtrack', refresh)
    stream.addEventListener('removetrack', refresh)
    return () => {
      stream.removeEventListener('addtrack', refresh)
      stream.removeEventListener('removetrack', refresh)
    }
  }, [stream])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className={clsx(
        'absolute inset-0 h-full w-full bg-black',
        objectFit === 'contain' ? 'object-contain' : 'object-cover'
      )}
    />
  )
}

type TileVariant = 'grid' | 'stage' | 'thumb'

export function MeetRoomContent({
  room,
  participants: initialParticipants,
  initialMessages,
  currentUserId,
  isHost,
  inviteProfiles,
}: Props) {
  const router = useRouter()
  const [participants, setParticipants] = useState(initialParticipants)
  const [messages, setMessages] = useState(initialMessages)
  const [sidePanel, setSidePanel] = useState<SidePanel>('none')
  const [muted, setMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [layoutGrid, setLayoutGrid] = useState(true)
  const [chatBody, setChatBody] = useState('')
  const [audioError, setAudioError] = useState<string | null>(null)
  const [remoteSpeakingIds, setRemoteSpeakingIds] = useState<string[]>([])
  const [presence, setPresence] = useState<Record<string, MeetParticipantPresence>>({})
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [audioInputId, setAudioInputId] = useState<string | null>(null)
  const [audioOutputId, setAudioOutputId] = useState<string | null>(null)
  const [cursorMode, setCursorMode] = useState<ScreenShareCursorMode>(() => getStoredCursorMode())

  const meshRef = useRef<MeetMeshManager | null>(null)
  const cameraTogglingRef = useRef(false)
  const hasLeftRef = useRef(false)
  const presenceRef = useRef<{ broadcast: (e: import('@/lib/communication/realtime').MeetPresenceEvent) => Promise<void> } | null>(null)
  const audioContainerRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const knownPeersRef = useRef<Set<string>>(new Set())

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/communication/meet/join/${room.join_token}`
      : ''

  const updateLocalPresence = useCallback(
    (patch: Partial<MeetParticipantPresence>) => {
      setPresence((prev) => ({
        ...prev,
        [currentUserId]: { ...(prev[currentUserId] ?? defaultPresence()), ...patch },
      }))
    },
    [currentUserId]
  )

  const attachRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }))
    setRemoteSpeakingIds((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]))
  }, [])

  useEffect(() => {
    if (room.status !== 'active') return

    const supabase = createClient()
    let signalingCleanup: (() => void) | null = null
    let presenceCleanup: (() => void) | null = null

    const setup = async () => {
      try {
        const { sendSignal, whenReady, cleanup } = subscribeToMeetSignaling(
          supabase,
          room.id,
          currentUserId,
          (event) => {
            void meshRef.current?.handleSignal(event)
            if (event.type === 'participant-left') {
              meshRef.current?.removePeer(event.from)
              setRemoteSpeakingIds((prev) => prev.filter((id) => id !== event.from))
              setRemoteStreams((prev) => {
                const next = { ...prev }
                delete next[event.from]
                return next
              })
            }
          }
        )
        signalingCleanup = cleanup

        await whenReady()

        const presenceSub = subscribeToMeetPresence(supabase, room.id, currentUserId, (userId, state) => {
          setPresence((prev) => ({
            ...prev,
            [userId]: { ...(prev[userId] ?? defaultPresence()), ...state },
          }))
        })
        presenceRef.current = presenceSub
        presenceCleanup = presenceSub.cleanup

        const mesh = new MeetMeshManager(
          currentUserId,
          sendSignal,
          {
            onRemoteStream: attachRemoteStream,
            onPeerDisconnected: (peerId) => {
              setRemoteSpeakingIds((prev) => prev.filter((id) => id !== peerId))
              setRemoteStreams((prev) => {
                const next = { ...prev }
                delete next[peerId]
                return next
              })
            },
            onRemoteAudioElement: (peerId, el) => {
              audioContainerRef.current?.appendChild(el)
            },
          },
          {
            onScreenShareEnd: () => {
              setScreenSharing(false)
              setCameraOn(false)
              updateLocalPresence({ screenSharing: false, cameraEnabled: false })
              void presenceRef.current?.broadcast({ type: 'screen', userId: currentUserId, active: false })
            },
            screenShareCursorMode: cursorMode,
          }
        )
        meshRef.current = mesh

        await mesh.startLocalAudio()
        setAudioInputId(mesh.getAudioInputDeviceId())

        for (const p of initialParticipants) {
          if (p.user_id !== currentUserId && !p.left_at) {
            knownPeersRef.current.add(p.user_id)
            await mesh.connectToPeer(p.user_id)
          }
        }
      } catch (err) {
        setAudioError(err instanceof Error ? err.message : 'Microphone access denied')
      }
    }

    void setup()

    const partChannel = supabase
      .channel(`meet-parts:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comm_meet_participants', filter: `room_id=eq.${room.id}` },
        async (payload) => {
          const row = payload.new as CommMeetParticipant
          if (!row?.user_id || row.user_id === currentUserId) return
          if (row.left_at) {
            meshRef.current?.removePeer(row.user_id)
            setParticipants((prev) => prev.filter((p) => p.user_id !== row.user_id))
            setRemoteStreams((prev) => {
              const next = { ...prev }
              delete next[row.user_id]
              return next
            })
            setRemoteSpeakingIds((prev) => prev.filter((id) => id !== row.user_id))
            return
          }
          if (!knownPeersRef.current.has(row.user_id)) {
            knownPeersRef.current.add(row.user_id)
            await meshRef.current?.connectToPeer(row.user_id)
          }
          setParticipants((prev) => {
            const exists = prev.some((p) => p.user_id === row.user_id)
            if (exists) return prev.map((p) => (p.user_id === row.user_id ? { ...p, ...row } : p))
            return [...prev, row]
          })
        }
      )
      .subscribe()

    const msgCleanup = subscribeToMeetMessages(supabase, room.id, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })

    return () => {
      if (!hasLeftRef.current) {
        hasLeftRef.current = true
        // Fire-and-forget DB leave on unmount (navigation away, not tab close)
        void fetch('/api/meet/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id }),
        })
      }
      void meshRef.current?.leave()
      meshRef.current = null
      signalingCleanup?.()
      presenceCleanup?.()
      msgCleanup()
      supabase.removeChannel(partChannel)
    }
  }, [room.id, room.status, currentUserId, attachRemoteStream, initialParticipants, updateLocalPresence])

  useEffect(() => {
    const stream = meshRef.current?.getLocalStream()
    if (localVideoRef.current && stream && (cameraOn || screenSharing)) {
      localVideoRef.current.srcObject = stream
    }
  }, [cameraOn, screenSharing])

  // Tab/browser close: keepalive fetch survives page unload
  useEffect(() => {
    if (room.status !== 'active') return
    const handleBeforeUnload = () => {
      if (hasLeftRef.current) return
      hasLeftRef.current = true
      fetch('/api/meet/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id }),
        keepalive: true,
      })
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [room.id, room.status])

  const toggleMute = () => {
    setMuted((m) => {
      meshRef.current?.setMuted(!m)
      return !m
    })
  }

  const handleAudioInputChange = async (deviceId: string) => {
    const ok = await meshRef.current?.setAudioInputDevice(deviceId)
    if (ok) setAudioInputId(deviceId)
  }

  const handleAudioOutputChange = (deviceId: string) => {
    meshRef.current?.setAudioOutputDevice(deviceId)
    setAudioOutputId(deviceId)
  }

  const toggleCamera = async () => {
    if (screenSharing) return
    if (cameraTogglingRef.current) return
    cameraTogglingRef.current = true
    try {
      if (cameraOn) {
        await meshRef.current?.removeCamera()
        setCameraOn(false)
        updateLocalPresence({ cameraEnabled: false })
        void presenceRef.current?.broadcast({ type: 'camera', userId: currentUserId, enabled: false })
        return
      }
      const ok = await meshRef.current?.enableCamera()
      if (ok) {
        setCameraOn(true)
        updateLocalPresence({ cameraEnabled: true })
        void presenceRef.current?.broadcast({ type: 'camera', userId: currentUserId, enabled: true })
      }
    } finally {
      cameraTogglingRef.current = false
    }
  }

  const toggleHand = () => {
    setHandRaised((h) => {
      const next = !h
      updateLocalPresence({ handRaised: next })
      void presenceRef.current?.broadcast({ type: 'hand', userId: currentUserId, raised: next })
      return next
    })
  }

  const handleCursorModeChange = (mode: ScreenShareCursorMode) => {
    setCursorMode(mode)
    meshRef.current?.setScreenShareCursorMode(mode)
    if (screenSharing) {
      void meshRef.current?.applyScreenShareCursorMode(mode)
    }
  }

  const startScreenShare = async () => {
    const stream = await meshRef.current?.startScreenShare(cursorMode)
    if (stream) {
      setScreenSharing(true)
      setCameraOn(true)
      updateLocalPresence({ screenSharing: true, cameraEnabled: true })
      void presenceRef.current?.broadcast({ type: 'screen', userId: currentUserId, active: true })
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
    }
  }

  const stopScreenShare = () => {
    void meshRef.current?.stopScreenShare()
    setScreenSharing(false)
    setCameraOn(false)
    updateLocalPresence({ screenSharing: false, cameraEnabled: false })
    void presenceRef.current?.broadcast({ type: 'screen', userId: currentUserId, active: false })
  }

  const handleLeave = async () => {
    if (hasLeftRef.current) return
    hasLeftRef.current = true
    await leaveMeetAction(room.id)
    await meshRef.current?.leave()
    // Close the meet tab; if blocked (tab not script-opened), navigate as fallback
    window.close()
    router.push('/dashboard/communication/meet')
  }

  const handleEnd = async () => {
    if (hasLeftRef.current) return
    hasLeftRef.current = true
    await endMeetAction(room.id)
    await meshRef.current?.leave()
    window.close()
    router.push('/dashboard/communication/meet')
  }

  const sendChat = async () => {
    if (!chatBody.trim()) return
    const res = await sendMeetMessageAction(room.id, chatBody)
    if ('message' in res && res.message) {
      setMessages((prev) => [...prev, res.message as CommMeetMessage])
      setChatBody('')
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    const uploadRes = await uploadMeetAttachmentAction(room.id, fd)
    if ('attachment' in uploadRes && uploadRes.attachment) {
      const res = await sendMeetMessageAction(room.id, file.name, [uploadRes.attachment as CommAttachment])
      if ('message' in res && res.message) {
        setMessages((prev) => [...prev, res.message as CommMeetMessage])
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const activeParticipants = participants.filter((p) => !p.left_at)
  const chatOpen = sidePanel === 'chat'

  const presenterId =
    screenSharing
      ? currentUserId
      : activeParticipants.find((p) => presence[p.user_id]?.screenSharing)?.user_id ??
        activeParticipants.find((p) =>
          remoteStreams[p.user_id]?.getVideoTracks().some((t) => t.readyState === 'live')
        )?.user_id ??
        null

  const inPresentation = presenterId !== null

  const spotlightUserId =
    !layoutGrid && !inPresentation
      ? activeParticipants.find((p) => remoteStreams[p.user_id]?.getVideoTracks().length)?.user_id
      : null

  if (room.status === 'ended') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-lg font-medium">This meet has ended</p>
        <button
          type="button"
          className="text-[#C27E00] underline"
          onClick={() => {
            window.close()
            router.push('/dashboard/communication/meet')
          }}
        >
          Back to meets
        </button>
      </div>
    )
  }

  const renderTile = (p: CommMeetParticipant, variant: TileVariant = 'grid') => {
    const prof = p.profile as { full_name?: string | null } | undefined
    const isSelf = p.user_id === currentUserId
    const pState = presence[p.user_id] ?? defaultPresence()
    const isSpeaking = !isSelf && remoteSpeakingIds.includes(p.user_id)
    const remoteStream = remoteStreams[p.user_id]
    const hasRemoteVideo = !isSelf && !!remoteStream?.getVideoTracks().some((t) => t.enabled && t.readyState === 'live')
    const showLocalVideo = isSelf && (cameraOn || screenSharing)
    const showVideo = showLocalVideo || hasRemoteVideo || (!isSelf && (pState.cameraEnabled || pState.screenSharing))
    const isScreenContent = (isSelf && screenSharing) || pState.screenSharing
    const videoObjectFit = isScreenContent || variant === 'stage' ? 'contain' : 'cover'

    return (
      <div
        key={p.user_id}
        className={clsx(
          'relative flex flex-col items-center justify-center overflow-hidden bg-[#3c4043]',
          variant === 'stage' && 'min-h-0 flex-1 rounded-xl bg-black',
          variant === 'thumb' && 'aspect-video w-28 shrink-0 rounded-lg sm:w-36',
          variant === 'grid' && 'aspect-video w-full max-w-[280px] rounded-xl sm:max-w-xs',
          layoutGrid && variant === 'grid' && 'flex-shrink-0',
          isSpeaking && variant !== 'stage' && 'ring-2 ring-[#C27E00]',
          pState.handRaised && variant !== 'stage' && 'ring-2 ring-yellow-500'
        )}
      >
        {showLocalVideo ? (
          <video
            ref={isSelf ? localVideoRef : undefined}
            autoPlay
            playsInline
            muted
            className={clsx(
              'absolute inset-0 h-full w-full bg-black',
              videoObjectFit === 'contain' ? 'object-contain' : 'object-cover'
            )}
          />
        ) : hasRemoteVideo && remoteStream ? (
          <RemoteVideo stream={remoteStream} objectFit={videoObjectFit} />
        ) : showVideo && !hasRemoteVideo && !isSelf ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-zinc-400">
            Connecting video…
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div
              className={clsx(
                'flex items-center justify-center rounded-full bg-[#5f6368] font-semibold text-white',
                variant === 'stage' ? 'h-24 w-24 text-3xl' : variant === 'thumb' ? 'h-10 w-10 text-sm' : 'h-20 w-20 text-2xl'
              )}
            >
              {(prof?.full_name ?? '?').slice(0, 1).toUpperCase()}
            </div>
          </div>
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            {prof?.full_name ?? 'User'}
            {isSelf && ' (You)'}
          </span>
          {pState.handRaised && (
            <span className="rounded bg-yellow-600/90 p-1" title="Hand raised">
              <Hand className="h-3 w-3 text-white" />
            </span>
          )}
          {pState.screenSharing && (
            <span className="rounded bg-blue-600/90 p-1" title="Presenting">
              <MonitorUp className="h-3 w-3 text-white" />
            </span>
          )}
          {isSelf && muted && (
            <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] text-white">Muted</span>
          )}
        </div>
      </div>
    )
  }

  const presenter = presenterId ? activeParticipants.find((p) => p.user_id === presenterId) : null
  const nonPresenters = presenterId
    ? activeParticipants.filter((p) => p.user_id !== presenterId)
    : activeParticipants

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-0 flex-col overflow-hidden rounded-xl bg-[#202124]">
      <div ref={audioContainerRef} className="hidden" aria-hidden />

      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div>
          <p className="text-sm font-medium text-white">{room.title}</p>
          <p className="text-xs text-zinc-400">{activeParticipants.length} in call</p>
        </div>
      </div>

      {audioError && (
        <p className="shrink-0 bg-red-900/30 px-4 py-2 text-sm text-red-300">{audioError}</p>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          {inPresentation && presenter ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              {renderTile(presenter, 'stage')}
              {nonPresenters.length > 0 && (
                <div className="flex shrink-0 justify-end gap-2">
                  {nonPresenters.map((p) => renderTile(p, 'thumb'))}
                </div>
              )}
            </div>
          ) : (
            <div
              className={clsx(
                'flex min-h-0 flex-1 gap-3 p-4',
                layoutGrid
                  ? 'flex-wrap content-center justify-center overflow-y-auto'
                  : 'flex-col'
              )}
            >
              {layoutGrid
                ? activeParticipants.map((p) => renderTile(p))
                : spotlightUserId
                  ? (() => {
                      const main = activeParticipants.find((p) => p.user_id === spotlightUserId)
                      const rest = activeParticipants.filter((p) => p.user_id !== spotlightUserId)
                      return main ? (
                        <>
                          {renderTile(main, 'stage')}
                          {rest.length > 0 && (
                            <div className="flex shrink-0 justify-center gap-2">
                              {rest.map((p) => renderTile(p, 'thumb'))}
                            </div>
                          )}
                        </>
                      ) : (
                        activeParticipants.map((p) => renderTile(p))
                      )
                    })()
                  : activeParticipants.map((p) => renderTile(p))}
            </div>
          )}

          <MeetControlBar
            muted={muted}
            cameraOn={cameraOn}
            handRaised={handRaised}
            screenSharing={screenSharing}
            chatOpen={chatOpen}
            participantCount={activeParticipants.length}
            layoutGrid={layoutGrid}
            joinUrl={joinUrl}
            roomId={room.id}
            inviteProfiles={inviteProfiles}
            participantIds={activeParticipants.map((p) => p.user_id)}
            isHost={isHost}
            audioInputId={audioInputId}
            audioOutputId={audioOutputId}
            cursorMode={cursorMode}
            onCursorModeChange={handleCursorModeChange}
            onStartScreenShare={() => void startScreenShare()}
            onStopScreenShare={stopScreenShare}
            onToggleMute={toggleMute}
            onAudioInputChange={(id) => void handleAudioInputChange(id)}
            onAudioOutputChange={handleAudioOutputChange}
            onToggleCamera={() => void toggleCamera()}
            onToggleHand={toggleHand}
            onToggleChat={() => setSidePanel((p) => (p === 'chat' ? 'none' : 'chat'))}
            onToggleParticipants={() => setSidePanel((p) => (p === 'participants' ? 'none' : 'participants'))}
            onToggleLayout={() => setLayoutGrid((g) => !g)}
            onLeave={() => void handleLeave()}
            onEndForAll={isHost ? () => void handleEnd() : undefined}
          />
        </div>

        {sidePanel !== 'none' && (
          <div className="flex w-full max-w-sm shrink-0 flex-col border-l border-zinc-800 bg-[#292a2d]">
            {sidePanel === 'participants' && (
              <MeetParticipantsPanel
                participants={activeParticipants}
                currentUserId={currentUserId}
                presence={presence}
                remoteSpeakingIds={remoteSpeakingIds}
              />
            )}
            {sidePanel === 'chat' && (
              <>
                <div className="border-b border-zinc-700 px-4 py-3 font-semibold text-white">In-call messages</div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-center text-xs text-zinc-500">No messages yet</p>
                  )}
                  {messages.map((msg) => {
                    const sender = msg.sender as { full_name?: string | null } | undefined
                    const attachments = (msg.attachments ?? []) as CommAttachment[]
                    return (
                      <div key={msg.id} className="text-sm">
                        <p className="text-xs font-medium text-zinc-400">{sender?.full_name ?? 'User'}</p>
                        {msg.body && <p className="break-words text-zinc-200">{msg.body}</p>}
                        {attachments.map((a) => (
                          <a
                            key={a.fileId}
                            href={a.webViewLink ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#C27E00] underline"
                          >
                            {a.name}
                          </a>
                        ))}
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 border-t border-zinc-700 p-3">
                  <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.doc,.docx" onChange={handleFile} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-zinc-400 hover:text-white">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    value={chatBody}
                    onChange={(e) => setChatBody(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void sendChat()}
                    placeholder="Send a message..."
                    className="flex-1 rounded-md border border-zinc-600 bg-[#202124] px-2 py-1.5 text-sm text-white placeholder:text-zinc-500"
                  />
                  <button type="button" onClick={() => void sendChat()} className="text-[#C27E00]">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
