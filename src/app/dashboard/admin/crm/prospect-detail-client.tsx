'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCrmProspect } from './actions'

const inputClass =
  'w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm'

export function ProspectDetailClient({
  prospectId,
  prospect,
}: {
  prospectId: string
  prospect: {
    name: string
    primary_contact_name: string | null
    primary_contact_email: string | null
    phone: string | null
    address: string | null
    status: string
  }
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    const fd = new FormData(e.currentTarget)
    const res = await updateCrmProspect(prospectId, {
      name: String(fd.get('name') ?? ''),
      primary_contact_name: String(fd.get('primary_contact_name') ?? '') || undefined,
      primary_contact_email: String(fd.get('primary_contact_email') ?? '') || undefined,
      phone: String(fd.get('phone') ?? '') || undefined,
      address: String(fd.get('address') ?? '') || undefined,
      status: String(fd.get('status') ?? 'prospect') as 'prospect' | 'qualified' | 'won' | 'lost',
    })
    setPending(false)
    setMessage(res.error ?? 'Saved.')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 max-w-xl">
      <h3 className="font-medium text-zinc-900 dark:text-white">Account details</h3>
      <input name="name" required defaultValue={prospect.name} className={inputClass} />
      <input name="primary_contact_name" defaultValue={prospect.primary_contact_name ?? ''} placeholder="Contact" className={inputClass} />
      <input name="primary_contact_email" type="email" defaultValue={prospect.primary_contact_email ?? ''} className={inputClass} />
      <input name="phone" defaultValue={prospect.phone ?? ''} className={inputClass} />
      <input name="address" defaultValue={prospect.address ?? ''} className={inputClass} />
      <select name="status" defaultValue={prospect.status} className={inputClass}>
        <option value="prospect">Prospect</option>
        <option value="qualified">Qualified</option>
        <option value="won">Won</option>
        <option value="lost">Lost</option>
      </select>
      <button type="submit" disabled={pending} className="rounded bg-zinc-800 text-white px-3 py-1.5 text-sm disabled:opacity-50">
        Save
      </button>
      {message ? <p className="text-sm text-zinc-500">{message}</p> : null}
      <p className="text-xs text-zinc-500">
        When they sign, create the dealer under Configuration → Dealers and link the ID here later (coming soon).
      </p>
    </form>
  )
}