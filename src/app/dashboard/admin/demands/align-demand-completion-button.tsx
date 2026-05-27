'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alignDemandCompletedAtToAppointmentDate } from './actions'

export function AlignDemandCompletionDateButton({ demandId }: { demandId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (
            !confirm(
              'Set completion timestamp to match the appointment date?\nUsed for retro entries so statements reflect the selected job date.'
            )
          )
            return
          const r = await alignDemandCompletedAtToAppointmentDate(demandId)
          if (r.error) alert(r.error)
          else router.refresh()
        })
      }
      className="mt-2 text-sm rounded border border-[#C27E00]/40 bg-[#C27E00]/10 px-3 py-2 text-[#C27E00] hover:bg-[#C27E00]/20 disabled:opacity-50"
    >
      {pending ? 'Updating…' : 'Align completion date to appointment (statements / reports)'}
    </button>
  )
}
