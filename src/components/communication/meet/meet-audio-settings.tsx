'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, Mic, Volume2 } from 'lucide-react'
import { clsx } from 'clsx'
import { enumerateAudioDevices } from '@/lib/communication/webrtc'

type Props = {
  muted: boolean
  audioInputId: string | null
  audioOutputId: string | null
  onToggleMute: () => void
  onInputChange: (deviceId: string) => void
  onOutputChange: (deviceId: string) => void
}

export function MeetAudioSettings({
  muted,
  audioInputId,
  audioOutputId,
  onToggleMute,
  onInputChange,
  onOutputChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { inputs: ins, outputs: outs } = await enumerateAudioDevices()
      setInputs(ins)
      setOutputs(outs)
    }
    void load()

    const handler = () => void load()
    navigator.mediaDevices?.addEventListener('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', handler)
  }, [])

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

  const supportsSinkId = typeof (HTMLMediaElement.prototype as HTMLMediaElement & { setSinkId?: unknown }).setSinkId === 'function'

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        title={muted ? 'Unmute' : 'Mute'}
        onClick={onToggleMute}
        className={clsx(
          'flex h-12 w-12 items-center justify-center rounded-l-full text-white transition-colors',
          muted ? 'bg-[#ea4335]/90 hover:bg-[#ea4335]' : 'bg-white/20 hover:bg-white/30'
        )}
      >
        <Mic className="h-5 w-5" />
      </button>
      <button
        type="button"
        title="Audio settings"
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Microphone</p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {inputs.length === 0 && (
              <p className="text-xs text-zinc-500">No microphones found</p>
            )}
            {inputs.map((d) => (
              <button
                key={d.deviceId}
                type="button"
                onClick={() => onInputChange(d.deviceId)}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white hover:bg-white/10',
                  audioInputId === d.deviceId && 'bg-[#C27E00]/30 ring-1 ring-[#C27E00]'
                )}
              >
                <Mic className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</span>
              </button>
            ))}
          </div>

          {supportsSinkId && (
            <>
              <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Speaker</p>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {outputs.length === 0 && (
                  <p className="text-xs text-zinc-500">No speakers found</p>
                )}
                {outputs.map((d) => (
                  <button
                    key={d.deviceId}
                    type="button"
                    onClick={() => onOutputChange(d.deviceId)}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white hover:bg-white/10',
                      audioOutputId === d.deviceId && 'bg-[#C27E00]/30 ring-1 ring-[#C27E00]'
                    )}
                  >
                    <Volume2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{d.label || `Speaker ${d.deviceId.slice(0, 6)}`}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!supportsSinkId && (
            <p className="mt-3 text-[10px] text-zinc-500">Speaker selection is not supported in this browser.</p>
          )}
        </div>
      )}
    </div>
  )
}
