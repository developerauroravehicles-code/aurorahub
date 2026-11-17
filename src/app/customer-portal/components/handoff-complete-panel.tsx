'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/client'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import {
  DEALER_HANDOFF_PLACEHOLDER_FIRST,
  DEALER_HANDOFF_PLACEHOLDER_LAST,
} from '@/lib/demand-dealer-handoff'

type HandoffData = {
  pending: boolean
  demand_number: number | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  customer_address: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  vin_last6: string | null
  stock_number: string | null
  camera_model: string | null
  appointment_date: string | null
}

type Props = {
  token: string
  onCompleted: () => void
}

export function HandoffCompletePanel({ token, onCompleted }: Props) {
  const [data, setData] = useState<HandoffData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: row, error: rpcError } = await supabase.rpc('customer_portal_get_handoff_demand', {
      p_token: token,
    })
    if (rpcError) {
      setError('Could not load your appointment.')
      setLoading(false)
      return
    }
    const parsed = row as { ok?: boolean; error?: string } & HandoffData
    if (!parsed?.ok) {
      setData(null)
      setLoading(false)
      return
    }
    setData(parsed)
    if (Boolean(parsed.pending)) {
      const fn =
        parsed.customer_firstname === DEALER_HANDOFF_PLACEHOLDER_FIRST ? '' : parsed.customer_firstname
      const ln =
        parsed.customer_lastname === DEALER_HANDOFF_PLACEHOLDER_LAST ? '' : parsed.customer_lastname
      setFirstName(fn)
      setLastName(ln)
      setPhone(parsed.customer_phone ?? '')
      setAddress(parsed.customer_address ?? '')
    }
    setLoading(false)
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: result, error: rpcError } = await supabase.rpc('customer_portal_complete_handoff', {
      p_token: token,
      p_firstname: firstName,
      p_lastname: lastName,
      p_phone: phone,
      p_address: address || null,
    })
    setSaving(false)
    if (rpcError) {
      setError('Save failed. Please try again.')
      return
    }
    const res = result as { ok?: boolean; error?: string }
    if (!res?.ok) {
      setError(res.error === 'already_completed' ? 'Details were already saved.' : res.error ?? 'Save failed.')
      if (res.error === 'already_completed') {
        onCompleted()
      }
      return
    }
    onCompleted()
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading your appointment…</p>
  }

  if (!data?.pending) {
    return null
  }

  const appt = data.appointment_date
    ? formatInTimeZone(new Date(data.appointment_date), SYSTEM_DEFAULT_TIMEZONE, 'EEEE, MMM d · h:mm a')
    : '—'

  return (
    <section className="rounded-2xl border-2 border-[#C27E00]/40 bg-white dark:bg-zinc-900 p-6 mb-8 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Confirm your installation appointment</h2>
      <p className="text-sm text-zinc-600 dark:text-gray-400 mt-1">
        Your dealer booked an appointment. Please confirm your name and phone. Vehicle details are already on file.
      </p>

      <HandoffVehicleSummary data={data} appt={appt} />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-w-md">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-gray-400 mb-1">First name</label>
            <input
              required
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-gray-700 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-gray-400 mb-1">Last name</label>
            <input
              required
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-gray-700 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-gray-400 mb-1">Phone</label>
          <input
            required
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full rounded-md border border-zinc-300 dark:border-gray-700 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-gray-400 mb-1">Address (optional)</label>
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full rounded-md border border-zinc-300 dark:border-gray-700 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-[#C27E00] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save my details'}
        </button>
      </form>
    </section>
  )
}

function HandoffVehicleSummary({ data, appt }: { data: HandoffData; appt: string }) {
  return (
    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 bg-zinc-50 dark:bg-black/30 rounded-lg p-4">
      <ServerField label="Appointment" value={appt} />
      <ServerField label="Stock" value={data.stock_number} />
      <ServerField label="VIN (last 6)" value={data.vin_last6} />
      <ServerField
        label="Vehicle"
        value={`${data.vehicle_year} ${data.vehicle_make} ${data.vehicle_model}`}
      />
      <ServerField label="Camera" value={data.camera_model} />
      {data.demand_number != null && <ServerField label="Reference" value={`#${data.demand_number}`} />}
    </dl>
  )
}

function ServerField({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900 dark:text-white">{value}</dd>
    </div>
  )
}