'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import type { CustomerPortalRow } from '@/types/customer-portal'
import { CustomerPortalProgress } from './customer-portal-progress'
import { CustomerPortalRating } from './customer-portal-rating'

function statusLabel(status: string): string {
  const s = (status || '').toLowerCase()
  const map: Record<string, string> = {
    pending_finance: 'Pending approval',
    approved: 'Approved',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return map[s] ?? status.replace(/_/g, ' ')
}

export function CustomerPortalForm() {
  const [vin, setVin] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CustomerPortalRow[] | null>(null)
  const [queried, setQueried] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = vin.trim()
    if (trimmed.length < 6) {
      setRows([])
      setQueried(true)
      return
    }

    setLoading(true)
    setQueried(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('customer_portal_lookup_by_vin', {
        p_vin_query: trimmed,
      })

      if (error) {
        console.error('customer_portal_lookup_by_vin', error)
        setRows([])
        return
      }

      setRows((data ?? []) as CustomerPortalRow[])
    } finally {
      setLoading(false)
    }
  }

  function handleRated(
    index: number,
    customerRating: number,
    qualityScore: number
  ) {
    setRows((prev) => {
      if (!prev) return prev
      return prev.map((row, i) =>
        i === index
          ? {
              ...row,
              rated_customer_rating: customerRating,
              rated_quality_score: qualityScore,
            }
          : row
      )
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="vin" className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-1">
            VIN number
          </label>
          <input
            id="vin"
            name="vin"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            autoComplete="off"
            maxLength={32}
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 sm:text-sm"
            placeholder="Full 17-digit VIN or last 6 characters"
          />
          <p className="mt-2 text-xs text-zinc-500 dark:text-gray-500">
            We match against the vehicle identifier on file (typically the last 6 digits of your VIN).
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Searching…' : 'Look up appointment'}
        </button>
      </form>

      {queried && !loading && rows !== null && rows.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-gray-400 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-3">
          No matching record was found for that VIN. Check the number you entered or contact your dealer.
        </p>
      )}

      {queried && rows && rows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Installation details</h3>
          <ul className="space-y-4">
            {rows.map((r, idx) => (
              <li
                key={`${r.demand_number ?? idx}-${r.appointment_date}`}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/30 p-4 text-sm text-zinc-800 dark:text-gray-200 space-y-4"
              >
                <CustomerPortalProgress status={r.status} />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {r.demand_number != null && String(r.demand_number).length > 0
                      ? `#${r.demand_number}`
                      : 'Reference pending'}
                  </span>
                  <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-gray-400">
                    {statusLabel(r.status)}
                  </span>
                </div>
                <p className="text-zinc-600 dark:text-gray-400">
                  {r.vehicle_year} {r.vehicle_make} {r.vehicle_model}
                </p>
                {r.dealer_name ? (
                  <p className="text-xs text-zinc-500 dark:text-gray-500">Dealer: {r.dealer_name}</p>
                ) : null}
                {r.camera_model ? (
                  <p className="text-xs text-zinc-500 dark:text-gray-500">Dashcam / camera: {r.camera_model}</p>
                ) : null}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                  <p>
                    <span className="text-zinc-500 dark:text-gray-500">Appointment: </span>
                    <span className="tabular-nums">
                      {r.appointment_date
                        ? formatInTimeZone(
                            new Date(r.appointment_date),
                            SYSTEM_DEFAULT_TIMEZONE,
                            'MMMM d, yyyy h:mm a zzz'
                          )
                        : '—'}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-500 dark:text-gray-500">Warranty (install): </span>
                    {r.warranty_end ? (
                      <span className="tabular-nums">
                        Ends {formatInTimeZone(new Date(r.warranty_end + 'T12:00:00Z'), SYSTEM_DEFAULT_TIMEZONE, 'MMMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-zinc-500 dark:text-gray-500">
                        {r.status?.toLowerCase() === 'completed'
                          ? 'Not available yet'
                          : 'Shown after installation is completed'}
                      </span>
                    )}
                  </p>
                </div>
                <CustomerPortalRating
                  vinQuery={vin.trim()}
                  demandNumber={r.demand_number}
                  specialistName={r.specialist_name || 'Your specialist'}
                  ratedCustomerRating={r.rated_customer_rating}
                  ratedQualityScore={r.rated_quality_score}
                  canRate={r.can_rate}
                  onRated={(cr, qs) => handleRated(idx, cr, qs)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
