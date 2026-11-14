'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setDealerAcquired, updateDealerCrmContact } from './actions'
import { formatInPT } from '@/lib/timezone-defaults'

function cad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function DealerDetailClient({
  dealerId,
  dealer,
  stats,
  acquirerCandidates,
}: {
  dealerId: string
  dealer: {
    primary_contact_name: string | null
    primary_contact_email: string | null
    acquired_by_profile_id: string | null
    acquired_at: string | null
    acquired_by_name: string | null
  }
  stats: { completedCount: number; salesTotal: number; sharePercent: number }
  acquirerCandidates: { id: string; full_name: string | null }[]
}) {
  const router = useRouter()
  const [contactName, setContactName] = useState(dealer.primary_contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(dealer.primary_contact_email ?? '')
  const [acquirerId, setAcquirerId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function saveContact(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    const r = await updateDealerCrmContact(dealerId, {
      primary_contact_name: contactName,
      primary_contact_email: contactEmail,
    })
    setPending(false)
    setMessage(r.error ?? 'Contact saved.')
    router.refresh()
  }

  async function saveAcquirer(e: React.FormEvent) {
    e.preventDefault()
    if (!acquirerId) return
    setPending(true)
    setMessage(null)
    const r = await setDealerAcquired(dealerId, acquirerId)
    setPending(false)
    setMessage(r.error ?? 'Account acquirer saved.')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs uppercase text-zinc-500">Period sales</p>
          <p className="text-xl font-semibold tabular-nums">{cad(stats.salesTotal)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs uppercase text-zinc-500">Installs</p>
          <p className="text-xl font-semibold tabular-nums">{stats.completedCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs uppercase text-zinc-500">Share of total sales</p>
          <p className="text-xl font-semibold tabular-nums">{stats.sharePercent.toFixed(1)}%</p>
        </div>
      </div>

      <form onSubmit={saveContact} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 max-w-lg">
        <h3 className="font-medium text-zinc-900 dark:text-white">CRM contact (optional)</h3>
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Contact name"
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Contact email"
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-800 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Save contact
        </button>
      </form>

      <p className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-sm text-zinc-600 dark:text-gray-300">
        Account acquirer:{' '}
        <strong>{dealer.acquired_by_name ?? 'Not set'}</strong>
        {dealer.acquired_at ? (
          <> · since {formatInPT(dealer.acquired_at, 'MMM d, yyyy')}</>
        ) : null}
      </p>

      {!dealer.acquired_by_profile_id ? (
        <form onSubmit={saveAcquirer} className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2 max-w-lg">
          <p className="text-sm text-amber-900 dark:text-amber-200">Set who linked this dealer (one time only).</p>
          <select
            value={acquirerId}
            onChange={(e) => setAcquirerId(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            required
          >
            <option value="">Select person…</option>
            {acquirerCandidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.id}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="rounded bg-[#C27E00] text-white px-3 py-1.5 text-sm">
            Save acquirer
          </button>
        </form>
      ) : null}

      {message ? <p className="text-sm text-zinc-600 dark:text-gray-400">{message}</p> : null}
    </div>
  )
}