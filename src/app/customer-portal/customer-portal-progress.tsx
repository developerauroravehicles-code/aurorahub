'use client'

import { BadgeCheck, Camera, CircleCheckBig } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const STEPS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: 'approved', label: 'Approved', Icon: BadgeCheck },
  { id: 'installation', label: 'Installation', Icon: Camera },
  { id: 'completed', label: 'Completed', Icon: CircleCheckBig },
]

function getActiveStepIndex(status: string): number {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return 2
  if (s === 'approved') return 1
  return 0
}

function stageMessage(activeIndex: number): string | null {
  if (activeIndex === 0) {
    return 'Your dashcam installation request is awaiting approval.'
  }
  if (activeIndex === 1) {
    return 'Please be at your vehicle on time for your scheduled installation.'
  }
  if (activeIndex === 2) {
    return 'Thank you for choosing us.'
  }
  return null
}

type Props = {
  status: string
}

export function CustomerPortalProgress({ status }: Props) {
  const activeIndex = getActiveStepIndex(status)
  const progressRatio = activeIndex / (STEPS.length - 1)
  const message = stageMessage(activeIndex)

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto pb-1">
        <div className="relative min-w-[280px] px-2 pt-1">
          {/* Track */}
          <div
            className="absolute left-[16%] right-[16%] top-[2.75rem] h-0.5 bg-zinc-200 dark:bg-zinc-700"
            aria-hidden
          />
          {/* Filled track */}
          <div
            className="absolute left-[16%] top-[2.75rem] h-0.5 bg-zinc-900 dark:bg-white transition-all duration-500 ease-out"
            style={{ width: `calc(68% * ${progressRatio})` }}
            aria-hidden
          />

          <div className="relative flex justify-between">
            {STEPS.map((step, index) => {
              const isDone = index < activeIndex
              const isCurrent = index === activeIndex
              const isFuture = index > activeIndex
              const { Icon } = step

              return (
                <div
                  key={step.id}
                  className="flex flex-1 flex-col items-center gap-2 min-w-0 px-1"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                      isDone || isCurrent
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-500'
                    } ${isCurrent ? 'ring-2 ring-zinc-900/20 dark:ring-white/25 scale-105' : ''}`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${isFuture ? 'opacity-50' : ''}`}
                      strokeWidth={isCurrent ? 2.25 : 1.75}
                      aria-hidden
                    />
                  </div>
                  <span
                    className={`text-center text-[10px] font-semibold uppercase tracking-wide leading-tight max-w-[5.5rem] ${
                      isDone || isCurrent
                        ? 'text-zinc-900 dark:text-white'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {step.label}
                  </span>
                  <div
                    className={`h-2.5 w-2.5 rounded-full border-2 transition-colors duration-300 ${
                      isDone || isCurrent
                        ? 'border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white'
                        : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950'
                    }`}
                    aria-hidden
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {message ? (
        <p
          className={`text-center text-sm leading-relaxed px-2 ${
            activeIndex === 2
              ? 'font-medium text-zinc-900 dark:text-white'
              : 'text-zinc-600 dark:text-gray-400'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
