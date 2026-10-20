'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  SERVICE_RECORD_DIAGNOSIS_OPTIONS,
  DEFAULT_SERVICE_LOCATION,
} from '@/lib/customer-service-record-utils'
import type { ServiceRecordDiagnosisCode } from '@/types/customer-service-record'
import {
  createServiceRequestScheduled,
  getSpecialistsForDealer,
  lookupDemandForServiceRequest,
  type DemandLookupForServiceRequest,
} from './actions'
import { ServiceAppointmentScheduler } from './service-appointment-scheduler'

type Props = {
  onClose: () => void
  onSuccess: () => void
}

export function CreateServiceRequestModal({ onClose, onSuccess }: Props) {
  const [demandNumber, setDemandNumber] = useState('')
  const [vinLast6, setVinLast6] = useState('')
  const [lookup, setLookup] = useState<DemandLookupForServiceRequest | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupPending, setLookupPending] = useState(false)

  const [diagnosisCode, setDiagnosisCode] = useState<ServiceRecordDiagnosisCode | ''>('')
  const [diagnosisOther, setDiagnosisOther] = useState('')
  const [comment, setComment] = useState('')
  const [specialistId, setSpecialistId] = useState('')
  const [specialistOptions, setSpecialistOptions] = useState<{ id: string; full_name: string }[]>([])
  const [loadingSpecialists, setLoadingSpecialists] = useState(false)
  const [appointmentIso, setAppointmentIso] = useState('')
  const [serviceLocation, setServiceLocation] = useState(DEFAULT_SERVICE_LOCATION)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLookup() {
    setLookupError(null)
    setLookup(null)
    setLookupPending(true)
    const result = await lookupDemandForServiceRequest(demandNumber.trim(), vinLast6.trim())
    setLookupPending(false)
    if ('error' in result) {
      setLookupError(result.error)
      return
    }
    setLookup(result)
    setSpecialistId('')
    setLoadingSpecialists(true)
    const options = await getSpecialistsForDealer(result.dealer_id)
    setSpecialistOptions(options)
    if (options.length === 1) setSpecialistId(options[0].id)
    setLoadingSpecialists(false)
  }

  async function handleSubmit() {
    if (!lookup) {
      setError('Look up a completed installation first.')
      return
    }
    if (!diagnosisCode) {
      setError('Select an issue type.')
      return
    }
    if (diagnosisCode === 'other' && !diagnosisOther.trim() && !comment.trim()) {
      setError('Describe the issue when selecting Other.')
      return
    }
    if (!specialistId) {
      setError('Select a specialist.')
      return
    }
    if (!appointmentIso) {
      setError('Select an appointment slot on the dealer calendar.')
      return
    }

    setSubmitting(true)
    setError(null)
    const result = await createServiceRequestScheduled({
      demandId: lookup.demand_id,
      diagnosisCode,
      diagnosisOther: diagnosisOther.trim(),
      comment: comment.trim(),
      specialistId,
      appointmentIso,
      serviceLocation: serviceLocation.trim() || DEFAULT_SERVICE_LOCATION,
    })
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }
    if (result.smsWarning) {
      // still success
      console.warn(result.smsWarning)
    }
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl my-8">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 p-5">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">New service request</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Find the customer&apos;s completed installation, then schedule on that dealer&apos;s calendar.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Demand reference #
              </label>
              <input
                value={demandNumber}
                onChange={(e) => setDemandNumber(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                placeholder="e.g. 12345"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                VIN (last 6)
              </label>
              <input
                value={vinLast6}
                onChange={(e) =>
                  setVinLast6(e.target.value.replace(/\s/g, '').toUpperCase().slice(-6))
                }
                maxLength={6}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={lookupPending || !demandNumber.trim() || vinLast6.trim().length < 6}
            onClick={() => void handleLookup()}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {lookupPending ? 'Looking up…' : 'Look up installation'}
          </button>
          {lookupError ? <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p> : null}

          {lookup ? (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-black/20 p-3 text-sm space-y-1">
              <p>
                <span className="text-zinc-500">Customer:</span>{' '}
                <span className="font-medium">{lookup.customer_firstname || '—'}</span> ·{' '}
                {lookup.customer_phone}
              </p>
              <p>
                <span className="text-zinc-500">Vehicle:</span> {lookup.vehicle_summary}
              </p>
              <p>
                <span className="text-zinc-500">Dealer:</span>{' '}
                <span className="font-medium">{lookup.dealer_name}</span>
              </p>
            </div>
          ) : null}

          {lookup ? (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Issue type
                </label>
                <select
                  value={diagnosisCode}
                  onChange={(e) => setDiagnosisCode(e.target.value as ServiceRecordDiagnosisCode | '')}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {SERVICE_RECORD_DIAGNOSIS_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {diagnosisCode === 'other' ? (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Other details
                  </label>
                  <input
                    value={diagnosisOther}
                    onChange={(e) => setDiagnosisOther(e.target.value.slice(0, 200))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Assign specialist
                </label>
                <select
                  value={specialistId}
                  onChange={(e) => setSpecialistId(e.target.value)}
                  disabled={loadingSpecialists}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">
                    {loadingSpecialists ? 'Loading…' : 'Select specialist…'}
                  </option>
                  {specialistOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <ServiceAppointmentScheduler
                dealerId={lookup.dealer_id}
                dealerName={lookup.dealer_name}
                appointmentIso={appointmentIso}
                onAppointmentIsoChange={setAppointmentIso}
              />
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Service location
                </label>
                <input
                  value={serviceLocation}
                  onChange={(e) => setServiceLocation(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
            </>
          ) : null}

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 p-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !lookup}
            className="rounded-lg bg-[#C27E00] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create & schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
