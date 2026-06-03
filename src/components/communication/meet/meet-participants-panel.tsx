'use client'

import { Hand, MicOff, MonitorUp, VideoOff } from 'lucide-react'
import type { CommMeetParticipant } from '@/lib/communication/types'
import type { MeetParticipantPresence } from '@/lib/communication/realtime'

type Props = {
  participants: CommMeetParticipant[]
  currentUserId: string
  presence: Record<string, MeetParticipantPresence>
  remoteSpeakingIds: string[]
  onClose?: () => void
}

export function MeetParticipantsPanel({
  participants,
  currentUserId,
  presence,
  remoteSpeakingIds,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-700 px-4 py-3">
        <h2 className="font-semibold text-white">Participants ({participants.length})</h2>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {participants.map((p) => {
          const prof = p.profile as { full_name?: string | null; avatar_url?: string | null } | undefined
          const state = presence[p.user_id] ?? {
            handRaised: false,
            cameraEnabled: false,
            screenSharing: false,
          }
          const isSelf = p.user_id === currentUserId
          const speaking = remoteSpeakingIds.includes(p.user_id)

          return (
            <li
              key={p.user_id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  speaking ? 'bg-[#C27E00] text-white' : 'bg-zinc-700 text-zinc-200'
                }`}
              >
                {(prof?.full_name ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {prof?.full_name ?? 'User'}
                  {isSelf && <span className="ml-1 text-xs text-zinc-400">(You)</span>}
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400">
                  {state.handRaised && (
                    <span className="inline-flex items-center gap-0.5 text-[#C27E00]">
                      <Hand className="h-3 w-3" /> Hand raised
                    </span>
                  )}
                  {state.screenSharing && (
                    <span className="inline-flex items-center gap-0.5 text-blue-400">
                      <MonitorUp className="h-3 w-3" /> Presenting
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-zinc-400">
                {!state.cameraEnabled && <VideoOff className="h-4 w-4" aria-label="Camera off" />}
                <MicOff className="h-4 w-4 opacity-0" aria-hidden />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
