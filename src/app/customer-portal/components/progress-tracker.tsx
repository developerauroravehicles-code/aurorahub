'use client'

import { BadgeCheck, Camera, CircleCheckBig, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { progressStepIndex } from '@/lib/customer-portal-utils'

const STEPS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: 'submitted', label: 'Submitted', Icon: FileText },
  { id: 'approved', label: 'Approved', Icon: BadgeCheck },
  { id: 'installation', label: 'Installation', Icon: Camera },
  { id: 'completed', label: 'Completed', Icon: CircleCheckBig },
]

function stageMessage(status: string, activeIndex: number): string | null {
  const s = (status || '').toLowerCase()
  if (activeIndex === 0) {
    return 'Your dashcam installation request is awaiting dealer approval.'
  }
  if (activeIndex === 1 && s === 'approved') {
    return 'Your installation is approved. Please be at your vehicle on time for your scheduled appointment.'
  }
  if (activeIndex === 2 && s === 'approved') {
    return 'Installation day — please arrive about 10 minutes early and keep your vehicle accessible.'
  }
  if (activeIndex === 3) {
    return 'Thank you for choosing Aurora Vehicles.'
  }
  return null
}

type Props = {
  status: string
  appointmentDate: string | null
}

export function ProgressTracker({ status, appointmentDate }: Props) {
  const activeIndex = progressStepIndex(status, appointmentDate)
  const progressRatio = activeIndex / (STEPS.length - 1)
  const message = stageMessage(status, activeIndex)

  return (
    <div className="space-y-4" aria-label="Installation progress">
      <div className="w-full overflow-x-auto pb-1">
        <div className="relative min-w-[320px] px-1 pt-1">
          <div
            className="absolute left-[12%] right-[12%] top-[2.75rem] h-0.5 bg-zinc-200 dark:bg-zinc-700"
            aria-hidden
          />
          <div
            className="absolute left-[12%] top-[2.75rem] h-0.5 bg-[#C27E00] transition-all duration-500 ease-out"
            style={{ width: `calc(76% * ${progressRatio})` }}
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
                  className="flex flex-1 flex-col items-center gap-2 min-w-0 px-0.5"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                      isDone || isCurrent
                        ? 'border-[#C27E00] bg-[#C27E00] text-white'
                        : 'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-500'
                    } ${isCurrent ? 'ring-2 ring-[#C27E00]/30 scale-105' : ''}`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${isFuture ? 'opacity-50' : ''}`}
                      strokeWidth={isCurrent ? 2.25 : 1.75}
                      aria-hidden
                    />
                  </div>
                  <span
                    className={`text-center text-[9px] font-semibold uppercase tracking-wide leading-tight max-w-[4.5rem] ${
                      isDone || isCurrent
                        ? 'text-zinc-900 dark:text-white'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {message ? (
        <p
          className={`text-center text-sm leading-relaxed px-2 ${
            activeIndex === 3
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
