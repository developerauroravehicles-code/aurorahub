'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Loader2, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  diagnosisLabel,
  hasPendingServiceRecord,
  portalServiceRecordRpcErrorMessage,
  SERVICE_RECORD_DIAGNOSIS_OPTIONS,
  serviceRecordStatusLabel,
} from '@/lib/customer-service-record-utils'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import type { PortalServiceRecordRow } from '@/types/customer-service-record'
import type { ServiceRecordDiagnosisCode } from '@/types/customer-service-record'

const MAX_COMMENT = 500
const MAX_OTHER = 200

type Props = {
  vinQuery: string
  demandNumber: string | null
  status: string
  refreshToken?: number
}

function statusTone(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border-green-200 dark:border-green-900'
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-900'
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900'
  }
}

export function ServiceRecordPanel({ vinQuery, demandNumber, status, refreshToken = 0 }: Props) {
  const completed = (status || '').toLowerCase() === 'completed'
  const [records, setRecords] = useState<PortalServiceRecordRow[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [diagnosisCode, setDiagnosisCode] = useState<ServiceRecordDiagnosisCode | ''>('')
  const [diagnosisOther, setDiagnosisOther] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadRecords = useCallback(async () => {
    if (!vinQuery.trim() || !demandNumber?.trim()) return
    setLoadingRecords(true)
    setLoadError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('customer_portal_service_records_by_vin', {
        p_vin_query: vinQuery.trim(),
        p_demand_number: demandNumber.trim(),
      })
      if (rpcError) {
        setLoadError(
          portalServiceRecordRpcErrorMessage(
            rpcError,
            'We could not load your service requests right now. Please try again later.'
          )
        )
        setRecords([])
        return
      }
      setRecords((data ?? []) as PortalServiceRecordRow[])
    } finally {
      setLoadingRecords(false)
    }
  }, [vinQuery, demandNumber])

  useEffect(() => {
    if (completed) void loadRecords()
  }, [completed, loadRecords, refreshToken])

  if (!completed || !demandNumber?.trim()) return null

  const pending = hasPendingServiceRecord(records)

  async function handleSubmit() {
    if (!diagnosisCode) {
      setError('Please select an issue type.')
      return
    }
    if (
      diagnosisCode === 'other' &&
      !diagnosisOther.trim() &&
      !comment.trim()
    ) {
      setError('Please describe your issue when selecting Other.')
      return
    }

    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('customer_portal_create_service_record', {
        p_vin_query: vinQuery.trim(),
        p_demand_number: demandNumber,
        p_diagnosis_code: diagnosisCode,
        p_comment: comment.trim() || null,
        p_diagnosis_other: diagnosisOther.trim() || null,
      })

      if (rpcError) {
        setError(
          portalServiceRecordRpcErrorMessage(
            rpcError,
            'Could not submit your service request. Please try again.'
          )
        )
        return
      }

      const result = data as { ok?: boolean; error?: string } | null
      if (!result?.ok) {
        setError(result?.error ?? 'Could not submit your service request.')
        return
      }

      setSuccess('Your service request was submitted. We will review it and contact you by SMS once scheduled.')
      setDiagnosisCode('')
      setDiagnosisOther('')
      setComment('')
      await loadRecords()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Wrench className="h-4 w-4 text-[#C27E00]" />
          Service request
        </h3>
        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5">
          Report a dashcam issue for this completed installation. Our team will review and schedule service if approved.
        </p>
      </div>

      {loadingRecords ? (
        <p className="text-xs text-zinc-500 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your service requests…
        </p>
      ) : null}

      {records.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Your requests</p>
          <ul className="space-y-2">
            {records.map((record) => (
              <li
                key={record.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-3 text-xs space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-800 dark:text-gray-200">
                    {diagnosisLabel(record.diagnosis_code, record.diagnosis_other)}
                  </span>
                  <span
                    className={`uppercase tracking-wide px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusTone(record.status)}`}
                  >
                    {serviceRecordStatusLabel(record.status)}
                  </span>
                </div>
                {record.comment?.trim() ? (
                  <p className="text-zinc-600 dark:text-gray-400">{record.comment.trim()}</p>
                ) : null}
                {record.status === 'rejected' && record.rejection_reason?.trim() ? (
                  <p className="text-red-600 dark:text-red-400">
                    Reason: {record.rejection_reason.trim()}
                  </p>
                ) : null}
                {record.status === 'scheduled' && record.service_appointment_at ? (
                  <p className="text-zinc-700 dark:text-gray-300">
                    Scheduled:{' '}
                    {formatInTimeZone(
                      new Date(record.service_appointment_at),
                      SYSTEM_DEFAULT_TIMEZONE,
                      'EEEE, MMMM d, yyyy · h:mm a zzz'
                    )}
                    {record.service_location?.trim() ? ` · ${record.service_location.trim()}` : ''}
                  </p>
                ) : null}
                <p className="text-zinc-400 dark:text-zinc-500 tabular-nums">
                  Submitted{' '}
                  {formatInTimeZone(
                    new Date(record.created_at),
                    SYSTEM_DEFAULT_TIMEZONE,
                    'MMM d, yyyy'
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loadError ? (
        <p className="text-xs text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3" role="alert">
          {loadError}
        </p>
      ) : null}

      {pending ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
          You already have a service request awaiting review for this installation.
        </p>
      ) : loadError ? null : (
        <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <div className="space-y-1.5">
            <label htmlFor={`diagnosis-${demandNumber}`} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Issue type
            </label>
            <select
              id={`diagnosis-${demandNumber}`}
              value={diagnosisCode}
              onChange={(e) => setDiagnosisCode(e.target.value as ServiceRecordDiagnosisCode | '')}
              disabled={submitting}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C27E00]/40"
            >
              <option value="">Select an issue…</option>
              {SERVICE_RECORD_DIAGNOSIS_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {diagnosisCode === 'other' ? (
            <div className="space-y-1.5">
              <label htmlFor={`other-${demandNumber}`} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Describe the issue
              </label>
              <input
                id={`other-${demandNumber}`}
                value={diagnosisOther}
                onChange={(e) => setDiagnosisOther(e.target.value.slice(0, MAX_OTHER))}
                disabled={submitting}
                placeholder="Brief description of the problem"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#C27E00]/40"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor={`service-comment-${demandNumber}`} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Additional comments (optional)
            </label>
            <textarea
              id={`service-comment-${demandNumber}`}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
              disabled={submitting}
              rows={2}
              placeholder="Any extra details that may help our technician…"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#C27E00]/40"
            />
            <p className="text-[11px] text-zinc-400 text-right">{comment.length}/{MAX_COMMENT}</p>
          </div>

          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-xs text-green-700 dark:text-green-400" role="status">
              {success}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !diagnosisCode}
            className="w-full rounded-lg bg-[#C27E00] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#a06900] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit service request'}
          </button>
        </div>
      )}
    </section>
  )
}
