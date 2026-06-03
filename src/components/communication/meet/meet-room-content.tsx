'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Mic, MicOff, PhoneOff, Copy, Check, MessageSquare, Paperclip, Send, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToMeetMessages, subscribeToMeetSignaling } from '@/lib/communication/realtime'
import { MeetMeshManager } from '@/lib/communication/webrtc'
import type { CommAttachment, CommMeetMessage, CommMeetParticipant, CommMeetRoom } from '@/lib/communication/types'
import {
  endMeetAction,
  leaveMeetAction,
  sendMeetMessageAction,
  uploadMeetAttachmentAction,
} from '@/app/dashboard/communication/actions'
import { useRouter } from 'next/navigation'

type Props = {
  room: CommMeetRoom
  participants: CommMeetParticipant[]
  initialMessages: CommMeetMessage[]
  currentUserId: string
  isHost: boolean
}

export function MeetRoomContent({
  room,
  participants: initialParticipants,
  initialMessages,
  currentUserId,
  isHost,
}: Props) {
  const router = useRouter()
  const [participants, setParticipants] = useState(initialParticipants)
  const [messages, setMessages] = useState(initialMessages)
  const [chatOpen, setChatOpen] = useState(true)
  const [muted, setMuted] = useState(false)
  const [chatBody, setChatBody] = useState('')
  const [copied, setCopied] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [remoteAudioIds, setRemoteAudioIds] = useState<string[]>([])

  const meshRef = useRef<MeetMeshManager | null>(null)
  const audioContainerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const knownPeersRef = useRef<Set<string>>(new Set())

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/communication/meet/join/${room.join_token}`
      : ''

  const copyLink = () => {
    void navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const attachRemoteAudio = useCallback((peerId: string, stream: MediaStream) => {
    if (!audioContainerRef.current) return
    let el = document.getElementById(`audio-${peerId}`) as HTMLAudioElement | null
    if (!el) {
      el = document.createElement('audio')
      el.id = `audio-${peerId}`
      el.autoplay = true
      audioContainerRef.current.appendChild(el)
    }
    el.srcObject = stream
    setRemoteAudioIds((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]))
  }, [])

  useEffect(() => {
    if (room.status !== 'active') return

    const supabase = createClient()
    let signalingCleanup: (() => void) | null = null
    let mesh: MeetMeshManager | null = null

    const setup = async () => {
      try {
        const { sendSignal, cleanup } = subscribeToMeetSignaling(
          supabase,
          room.id,
          currentUserId,
          (event) => {
            void meshRef.current?.handleSignal(event)
            if (event.type === 'participant-left') {
              meshRef.current?.removePeer(event.from)
              setRemoteAudioIds((prev) => prev.filter((id) => id !== event.from))
            }
          }
        )
        signalingCleanup = cleanup

        mesh = new MeetMeshManager(currentUserId, sendSignal, {
          onRemoteStream: attachRemoteAudio,
          onPeerDisconnected: (peerId) => {
            setRemoteAudioIds((prev) => prev.filter((id) => id !== peerId))
            document.getElementById(`audio-${peerId}`)?.remove()
          },
        })
        meshRef.current = mesh

        await mesh.startLocalAudio()

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
      void meshRef.current?.leave()
      meshRef.current = null
      signalingCleanup?.()
      msgCleanup()
      supabase.removeChannel(partChannel)
    }
  }, [room.id, room.status, currentUserId, attachRemoteAudio, initialParticipants])

  const toggleMute = () => {
    setMuted((m) => {
      meshRef.current?.setMuted(!m)
      return !m
    })
  }

  const handleLeave = async () => {
    await leaveMeetAction(room.id)
    await meshRef.current?.leave()
    router.push('/dashboard/communication/meet')
  }

  const handleEnd = async () => {
    await endMeetAction(room.id)
    await meshRef.current?.leave()
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

  if (room.status === 'ended') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-lg font-medium">This meet has ended</p>
        <Link href="/dashboard/communication/meet" className="text-[#C27E00] underline">
          Back to meets
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={audioContainerRef} className="hidden" aria-hidden />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{room.title}</h1>
          <p className="text-sm text-zinc-500">{activeParticipants.length} in call</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-gray-600"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy link
          </button>
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            className="rounded-md border border-zinc-300 p-2 dark:border-gray-600"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </div>

      {audioError && (
        <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20">
          {audioError}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-zinc-200 bg-white dark:border-gray-700 dark:bg-zinc-950">
          <div className="flex flex-1 flex-wrap content-start gap-4 p-6">
            {activeParticipants.map((p) => {
              const prof = p.profile as { full_name?: string | null; avatar_url?: string | null } | undefined
              const isSpeaking = p.user_id !== currentUserId && remoteAudioIds.includes(p.user_id)
              return (
                <div
                  key={p.user_id}
                  className={`flex flex-col items-center rounded-xl border p-4 w-36 ${
                    isSpeaking ? 'border-[#C27E00] ring-2 ring-[#C27E00]/30' : 'border-zinc-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-semibold dark:bg-gray-700">
                    {(prof?.full_name ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">{prof?.full_name ?? 'User'}</p>
                  {p.user_id === currentUserId && muted && (
                    <span className="text-xs text-red-500">Muted</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4 border-t border-zinc-200 p-4 dark:border-gray-700">
            <button
              type="button"
              onClick={toggleMute}
              className={`rounded-full p-4 ${muted ? 'bg-red-600 text-white' : 'bg-zinc-200 dark:bg-gray-700'}`}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => void handleLeave()}
              className="rounded-full bg-red-600 p-4 text-white"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
            {isHost && (
              <button
                type="button"
                onClick={() => void handleEnd()}
                className="rounded-md border border-red-600 px-4 py-2 text-sm text-red-600"
              >
                End for all
              </button>
            )}
          </div>
        </div>

        {chatOpen && (
          <div className="flex w-full max-w-sm shrink-0 flex-col rounded-lg border border-zinc-200 bg-white dark:border-gray-700 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-4 py-3 font-semibold dark:border-gray-700">
              Meet chat
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg) => {
                const sender = msg.sender as { full_name?: string | null } | undefined
                const attachments = (msg.attachments ?? []) as CommAttachment[]
                return (
                  <div key={msg.id} className="text-sm">
                    <p className="font-medium text-xs text-zinc-500">{sender?.full_name ?? 'User'}</p>
                    {msg.body && <p className="break-words">{msg.body}</p>}
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
            <div className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-gray-700">
              <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.doc,.docx" onChange={handleFile} />
              <button type="button" onClick={() => fileRef.current?.click()} className="p-1 text-zinc-500">
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                value={chatBody}
                onChange={(e) => setChatBody(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void sendChat()}
                placeholder="Message..."
                className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-black"
              />
              <button type="button" onClick={() => void sendChat()} className="text-[#C27E00]">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
