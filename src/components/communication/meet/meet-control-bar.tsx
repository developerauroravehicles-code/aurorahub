'use client'

import { clsx } from 'clsx'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Hand,
  Users,
  LayoutGrid,
  UserPlus,
  MoreVertical,
  PhoneOff,
  Copy,
  Check,
  X,
} from 'lucide-react'
import { useState } from 'react'

type SidePanel = 'none' | 'chat' | 'participants'

type Props = {
  muted: boolean
  cameraOn: boolean
  handRaised: boolean
  screenSharing: boolean
  chatOpen: boolean
  participantCount: number
  layoutGrid: boolean
  joinUrl: string
  isHost: boolean
  onToggleMute: () => void
  onToggleCamera: () => void
  onToggleHand: () => void
  onToggleScreenShare: () => void
  onToggleChat: () => void
  onToggleParticipants: () => void
  onToggleLayout: () => void
  onLeave: () => void
  onEndForAll?: () => void
}

export function MeetControlBar({
  muted,
  cameraOn,
  handRaised,
  screenSharing,
  chatOpen,
  participantCount,
  layoutGrid,
  joinUrl,
  isHost,
  onToggleMute,
  onToggleCamera,
  onToggleHand,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleLayout,
  onLeave,
  onEndForAll,
}: Props) {
  const [showInvite, setShowInvite] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    void navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative flex shrink-0 items-center justify-center border-t border-zinc-800 bg-[#202124] px-2 py-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        <ControlButton
          label={muted ? 'Unmute' : 'Mute'}
          active={!muted}
          danger={muted}
          onClick={onToggleMute}
          icon={muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        />

        <ControlButton
          label={cameraOn ? 'Stop video' : 'Start video'}
          active={cameraOn}
          danger={!cameraOn}
          onClick={onToggleCamera}
          icon={cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        />

        <ControlButton
          label={screenSharing ? 'Stop presenting' : 'Present now'}
          active={screenSharing}
          onClick={onToggleScreenShare}
          icon={<MonitorUp className="h-5 w-5" />}
        />

        <ControlButton
          label="Chat"
          active={chatOpen}
          onClick={onToggleChat}
          icon={<MessageSquare className="h-5 w-5" />}
        />

        <ControlButton
          label="Raise hand"
          active={handRaised}
          highlight={handRaised}
          onClick={onToggleHand}
          icon={<Hand className="h-5 w-5" />}
        />

        <ControlButton
          label="Participants"
          active={false}
          onClick={onToggleParticipants}
          icon={<Users className="h-5 w-5" />}
          badge={participantCount}
        />

        <ControlButton
          label={layoutGrid ? 'Spotlight' : 'Grid view'}
          active={layoutGrid}
          onClick={onToggleLayout}
          icon={<LayoutGrid className="h-5 w-5" />}
        />

        <ControlButton
          label="Add people"
          active={showInvite}
          onClick={() => {
            setShowInvite((v) => !v)
            setShowMore(false)
          }}
          icon={<UserPlus className="h-5 w-5" />}
        />

        <div className="relative">
          <ControlButton
            label="More options"
            active={showMore}
            onClick={() => {
              setShowMore((v) => !v)
              setShowInvite(false)
            }}
            icon={<MoreVertical className="h-5 w-5" />}
          />
          {showMore && (
            <div className="absolute bottom-full right-0 z-50 mb-2 w-48 rounded-lg border border-zinc-700 bg-[#3c4043] py-1 shadow-xl">
              <button
                type="button"
                className="flex w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10"
                onClick={() => {
                  copyLink()
                  setShowMore(false)
                }}
              >
                Copy meeting link
              </button>
              {isHost && onEndForAll && (
                <button
                  type="button"
                  className="flex w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10"
                  onClick={() => {
                    onEndForAll()
                    setShowMore(false)
                  }}
                >
                  End meeting for all
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLeave}
          title="Leave call"
          className="ml-2 flex h-12 w-14 items-center justify-center rounded-full bg-[#ea4335] text-white hover:bg-[#d93025]"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>

      {showInvite && (
        <div className="absolute bottom-full left-1/2 z-50 mb-3 w-[min(90vw,360px)] -translate-x-1/2 rounded-xl border border-zinc-700 bg-[#3c4043] p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Add people</p>
            <button type="button" onClick={() => setShowInvite(false)} className="text-zinc-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-zinc-400">Share this link so others can join the meet.</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={joinUrl}
              className="min-w-0 flex-1 truncate rounded-md border border-zinc-600 bg-[#202124] px-2 py-1.5 text-xs text-zinc-200"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-md bg-[#C27E00] px-3 py-1.5 text-xs font-medium text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ControlButton({
  label,
  icon,
  onClick,
  active,
  danger,
  highlight,
  badge,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  danger?: boolean
  highlight?: boolean
  badge?: number
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={clsx(
        'group relative flex flex-col items-center gap-0.5 rounded-full px-3 py-2 text-white transition-colors',
        highlight && 'bg-[#C27E00]/30 ring-2 ring-[#C27E00]',
        !highlight && active && 'bg-white/20',
        !highlight && !active && 'hover:bg-white/10',
        danger && !active && 'bg-[#ea4335]/90 hover:bg-[#ea4335]'
      )}
    >
      <span className="relative">
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1a73e8] px-1 text-[10px] font-bold">
            {badge}
          </span>
        )}
      </span>
      <span className="hidden text-[10px] text-zinc-300 sm:block">{label}</span>
    </button>
  )
}

export type { SidePanel }
