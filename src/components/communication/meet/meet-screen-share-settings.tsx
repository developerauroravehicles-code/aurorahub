'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, MonitorUp, MousePointer2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { ScreenShareCursorMode } from '@/lib/communication/webrtc'

const CURSOR_STORAGE_KEY = 'aurora-meet-screen-cursor'

const CURSOR_OPTIONS: { value: ScreenShareCursorMode; label: string; hint: string }[] = [
  { value: 'always', label: 'Always show cursor', hint: 'Cursor visible at all times' },
  { value: 'motion', label: 'Show on movement', hint: 'Cursor appears when moving' },
  { value: 'never', label: 'Hide cursor', hint: 'Cursor not included in share' },
]

export function getStoredCursorMode(): ScreenShareCursorMode {
  if (typeof window === 'undefined') return 'always'
  const stored = localStorage.getItem(CURSOR_STORAGE_KEY)
  if (stored === 'always' || stored === 'motion' || stored === 'never') return stored
  return 'always'
}

type Props = {
  screenSharing: boolean
  cursorMode: ScreenShareCursorMode
  onCursorModeChange: (mode: ScreenShareCursorMode) => void
  onStartShare: () => void
  onStopShare: () => void
}

export function MeetScreenShareSettings({
  screenSharing,
  cursorMode,
  onCursorModeChange,
  onStartShare,
  onStopShare,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const selectMode = (mode: ScreenShareCursorMode) => {
    onCursorModeChange(mode)
    localStorage.setItem(CURSOR_STORAGE_KEY, mode)
  }

  const handleMainClick = () => {
    if (screenSharing) {
      onStopShare()
    } else {
      onStartShare()
    }
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        title={screenSharing ? 'Stop presenting' : 'Present now'}
        onClick={handleMainClick}
        className={clsx(
          'flex h-12 w-12 items-center justify-center rounded-l-full text-white transition-colors',
          screenSharing ? 'bg-white/30 ring-2 ring-[#1a73e8]' : 'bg-white/20 hover:bg-white/30'
        )}
      >
        <MonitorUp className="h-5 w-5" />
      </button>
      <button
        type="button"
        title="Screen share settings"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex h-12 w-7 items-center justify-center rounded-r-full border-l border-white/20 text-white transition-colors',
          open ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'
        )}
      >
        <ChevronUp className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-zinc-700 bg-[#3c4043] p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-2">
            <MousePointer2 className="h-4 w-4 text-zinc-400" />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Cursor capture</p>
          </div>
          <div className="space-y-1">
            {CURSOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectMode(opt.value)}
                className={clsx(
                  'flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-white/10',
                  cursorMode === opt.value && 'bg-[#C27E00]/30 ring-1 ring-[#C27E00]'
                )}
              >
                <span className="text-xs font-medium text-white">{opt.label}</span>
                <span className="text-[10px] text-zinc-400">{opt.hint}</span>
              </button>
            ))}
          </div>
          {screenSharing && (
            <p className="mt-2 text-[10px] text-zinc-500">
              Stop and restart sharing to apply a different cursor mode.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
