'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createCrmProspect } from './actions'

const inputClass =
  'w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm'

export function NewProspectForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(!compact)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await createCrmProspect({
      name: String(fd.get('name') ?? ''),
      primary_contact_name: String(fd.get('primary_contact_name') ?? '') || undefined,
      primary_contact_email: String(fd.get('primary_contact_email') ?? '') || undefined,
      phone: String(fd.get('phone') ?? '') || undefined,
      address: String(fd.get('address') ?? '') || undefined,
      initialNote: String(fd.get('initial_note') ?? '') || undefined,
      meetingAtLocal: String(fd.get('meeting_at') ?? '') || undefined,
    })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    if (res.prospectId) {
      router.push(`/dashboard/admin/crm/prospects/${res.prospectId}`)
      router.refresh()
    }
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06900]"
      >
        <Plus className="h-4 w-4" /> New prospect
      </button>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 space-y-3"
    >
      <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
        <Plus className="h-4 w-4 text-[#C27E00]" /> New potential dealer (prospect)
      </h3>
      <p className="text-xs text-zinc-500">
        No Configuration/Dealers step required. Add conversation history here; convert to a live dealer later when ready.
      </p>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <input name="name" required placeholder="Company / dealership name *" className={inputClass} />
      <div className="grid sm:grid-cols-2 gap-3">
        <input name="primary_contact_name" placeholder="Contact name" className={inputClass} />
        <input name="primary_contact_email" type="email" placeholder="Contact email" className={inputClass} />
        <input name="phone" placeholder="Phone" className={inputClass} />
        <input name="address" placeholder="Address (optional)" className={inputClass} />
      </div>
      <textarea name="initial_note" rows={2} placeholder="First conversation notes (optional)" className={inputClass} />
      <div>
        <label className="text-xs text-zinc-500 block mb-1">First meeting (PT, optional)</label>
        <input type="datetime-local" name="meeting_at" className={inputClass} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-[#C27E00] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Create & open
        </button>
        {compact ? (
          <button type="button" className="text-sm text-zinc-500" onClick={() => setOpen(false)}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}