'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatInPT } from '@/lib/timezone-defaults'
import {
  DEFAULT_SERVICE_LOCATION,
  diagnosisLabel,
  serviceRecordStatusLabel,
} from '@/lib/customer-service-record-utils'
import { filterServiceRecords, parseServiceRecordFilters } from '@/lib/service-record-filters'
import type { CustomerServiceRecord, ServiceRecordExpense, ServiceRecordStatus } from '@/types/customer-service-record'
import { approveServiceRecord, rejectServiceRecord, getSpecialistsForDealer, approveServiceRecordExpense, rejectServiceRecordExpense } from './actions'
import { ServiceRecordsFilters } from './service-records-filters'
import { Building2, Car, Check, ChevronRight, Loader2, Phone, User, Wrench, X } from 'lucide-react'

type DealerOption = { id: string; name: string }

type Props = {
  records: CustomerServiceRecord[]
  dealers: DealerOption[]
  pendingExpenses: ServiceRecordExpense[]
  filterParams: {
    status?: string
    dealer?: string
    diagnosis?: string
    from?: string
    to?: string
    q?: string
  }
}

const STATUS_FILTERS: { value: 'all' | ServiceRecordStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'rejected', label: 'Rejected' },
]

function statusTone(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
    case 'assigned':
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-gray-500">
        {label}
      </dt>
      <dd className="text-sm text-zinc-900 dark:text-gray-100 break-words">{value}</dd>
    </div>
  )
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-[#C27E00]" />
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  )
}

export function ServiceRecordsContent({ records, dealers, pendingExpenses, filterParams }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filters = useMemo(() => parseServiceRecordFilters(filterParams), [filterParams])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null)
  const [appointmentLocal, setAppointmentLocal] = useState('')
  const [serviceLocation, setServiceLocation] = useState(DEFAULT_SERVICE_LOCATION)
  const [specialistId, setSpecialistId] = useState('')
  const [specialistOptions, setSpecialistOptions] = useState<{ id: string; full_name: string }[]>([])
  const [loadingSpecialists, setLoadingSpecialists] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [expenseRejectReason, setExpenseRejectReason] = useState('')
  const [activeExpenseId, setActiveExpenseId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dealerOptions = useMemo(() => {
    const known = new Set(dealers.map((d) => d.name))
    const extras = [...new Set(records.map((r) => r.dealer_name).filter((n) => n && !known.has(n)))]
    return [
      ...dealers,
      ...extras.map((name) => ({ id: `name:${name}`, name: name as string })),
    ]
  }, [dealers, records])

  const filtered = useMemo(
    () => filterServiceRecords(records, filters, dealerOptions),
    [records, filters, dealerOptions]
  )

  function setStatusFilter(value: 'all' | ServiceRecordStatus) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('status')
    else params.set('status', value)
    const q = params.toString()
    router.push(q ? `/dashboard/admin/service-records?${q}` : '/dashboard/admin/service-records')
  }

  const detailRecord = records.find((r) => r.id === detailId) ?? null
  const activeRecord = records.find((r) => r.id === activeId) ?? null

  function openDetail(record: CustomerServiceRecord) {
    setDetailId(record.id)
    setError(null)
  }

  function closeDetail() {
    setDetailId(null)
  }

  function openApprove(record: CustomerServiceRecord, fromDetail = false) {
    if (fromDetail) closeDetail()
    setActiveId(record.id)
    setModal('approve')
    setAppointmentLocal('')
    setServiceLocation(DEFAULT_SERVICE_LOCATION)
    setSpecialistId('')
    setSpecialistOptions([])
    setError(null)
    setMessage(null)
    setLoadingSpecialists(true)
    void getSpecialistsForDealer(record.dealer_name).then((options) => {
      setSpecialistOptions(options)
      if (options.length === 1) setSpecialistId(options[0].id)
      setLoadingSpecialists(false)
    })
  }

  function openReject(record: CustomerServiceRecord, fromDetail = false) {
    if (fromDetail) closeDetail()
    setActiveId(record.id)
    setModal('reject')
    setRejectionReason('')
    setError(null)
    setMessage(null)
  }

  function closeModal() {
    setModal(null)
    setActiveId(null)
    setSubmitting(false)
  }

  async function handleReject() {
    if (!activeId) return
    setSubmitting(true)
    setError(null)
    const result = await rejectServiceRecord(activeId, rejectionReason)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    closeModal()
    setMessage('Service record rejected.')
    router.refresh()
  }

  async function handleApprove() {
    if (!activeId) return
    setSubmitting(true)
    setError(null)
    const result = await approveServiceRecord(activeId, appointmentLocal, specialistId, serviceLocation)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    closeModal()
    if (result.smsWarning) {
      setMessage(`Record scheduled, but SMS failed: ${result.smsWarning}`)
    } else {
      setMessage('Service record approved, specialist assigned, and customer notified by SMS.')
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Service Records</h1>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">
          Review customer portal service requests. Click a row to view full details.
        </p>
      </div>

      {message ? (
        <p className="text-sm text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 p-3">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
              filters.status === f.value
                ? 'border-[#C27E00] bg-[#C27E00]/10 text-[#C27E00]'
                : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-gray-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ServiceRecordsFilters
        dealers={dealerOptions}
        filters={filters}
        totalCount={records.length}
        filteredCount={filtered.length}
      />

      {pendingExpenses.length > 0 ? (
        <section className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Pending expense approvals ({pendingExpenses.length})
          </h2>
          <ul className="space-y-2">
            {pendingExpenses.map((exp) => (
              <li
                key={exp.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{exp.description}</p>
                  <p className="text-xs text-zinc-500">
                    {exp.category} · record {exp.service_record_id.slice(0, 8)}…
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">${Number(exp.amount).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => void (async () => {
                      const result = await approveServiceRecordExpense(exp.id)
                      if (result.error) setError(result.error)
                      else {
                        setMessage('Expense approved and added to payroll.')
                        router.refresh()
                      }
                    })()}
                    className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveExpenseId(exp.id)}
                    className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Vehicle</th>
              <th className="px-4 py-3 font-semibold">Diagnosis</th>
              <th className="px-4 py-3 font-semibold">Comment</th>
              <th className="px-4 py-3 font-semibold">Dealer</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
              <th className="px-4 py-3 font-semibold w-10" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500 dark:text-gray-400">
                  {records.length === 0
                    ? 'No service records found.'
                    : 'No records match the current filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => openDetail(record)}
                  className="align-top cursor-pointer transition-colors hover:bg-[#C27E00]/5 dark:hover:bg-[#C27E00]/10"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openDetail(record)
                    }
                  }}
                >
                  <td className="px-4 py-3 font-medium tabular-nums">#{record.demand_number}</td>
                  <td className="px-4 py-3">{record.vehicle_summary || '—'}</td>
                  <td className="px-4 py-3 max-w-[180px]">
                    {diagnosisLabel(record.diagnosis_code, record.diagnosis_other)}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] text-zinc-600 dark:text-gray-400 truncate">
                    {record.comment?.trim() || '—'}
                  </td>
                  <td className="px-4 py-3">{record.dealer_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(record.status)}`}
                    >
                      {serviceRecordStatusLabel(record.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-500">
                    {formatInPT(record.created_at, 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailRecord ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={closeDetail}
          role="presentation"
        >
          <div
            className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-record-detail-title"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-5 py-4">
              <div>
                <p className="text-xs font-medium text-[#C27E00] uppercase tracking-wide">Service record</p>
                <h2 id="service-record-detail-title" className="text-lg font-semibold text-zinc-900 dark:text-white mt-0.5">
                  #{detailRecord.demand_number}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-gray-400 mt-0.5">
                  {detailRecord.vehicle_summary || 'Vehicle details pending'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusTone(detailRecord.status)}`}
                >
                  {serviceRecordStatusLabel(detailRecord.status)}
                </span>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <DetailSection title="Customer information" icon={User}>
                <DetailRow label="Name" value={detailRecord.customer_firstname?.trim() || '—'} />
                <DetailRow
                  label="Phone"
                  value={
                    detailRecord.customer_phone?.trim() ? (
                      <a
                        href={`tel:${detailRecord.customer_phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1.5 text-[#C27E00] hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {detailRecord.customer_phone}
                      </a>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow label="VIN (last 6)" value={detailRecord.vin_last6 || '—'} />
              </DetailSection>

              <DetailSection title="Installation" icon={Car}>
                <DetailRow label="Reference" value={`#${detailRecord.demand_number}`} />
                <DetailRow label="Vehicle" value={detailRecord.vehicle_summary || '—'} />
                <DetailRow label="Dealer" value={detailRecord.dealer_name || '—'} />
                <DetailRow
                  label="Submitted"
                  value={formatInPT(detailRecord.created_at, 'EEEE, MMMM d, yyyy · h:mm a') + ' PT'}
                />
              </DetailSection>

              <DetailSection title="Service request" icon={Wrench}>
                <DetailRow
                  label="Issue type"
                  value={diagnosisLabel(detailRecord.diagnosis_code, detailRecord.diagnosis_other)}
                />
                {detailRecord.diagnosis_code === 'other' && detailRecord.diagnosis_other?.trim() ? (
                  <DetailRow label="Other details" value={detailRecord.diagnosis_other.trim()} />
                ) : null}
                <DetailRow label="Customer comment" value={detailRecord.comment?.trim() || '—'} />
              </DetailSection>

              {(detailRecord.status === 'scheduled' ||
                detailRecord.status === 'rejected' ||
                detailRecord.reviewed_at) && (
                <DetailSection title="Review & scheduling" icon={Building2}>
                  {detailRecord.status === 'scheduled' && detailRecord.service_appointment_at ? (
                    <>
                      <DetailRow
                        label="Appointment"
                        value={
                          formatInPT(
                            detailRecord.service_appointment_at,
                            'EEEE, MMMM d, yyyy · h:mm a'
                          ) + ' PT'
                        }
                      />
                      <DetailRow label="Location" value={detailRecord.service_location || '—'} />
                      <DetailRow
                        label="SMS sent"
                        value={
                          detailRecord.sms_sent_at
                            ? formatInPT(detailRecord.sms_sent_at, 'MMM d, yyyy h:mm a') + ' PT'
                            : 'Not logged'
                        }
                      />
                    </>
                  ) : null}
                  {detailRecord.status === 'rejected' ? (
                    <DetailRow
                      label="Rejection reason"
                      value={detailRecord.rejection_reason?.trim() || 'No reason provided'}
                    />
                  ) : null}
                  {detailRecord.reviewed_at ? (
                    <DetailRow
                      label="Reviewed"
                      value={formatInPT(detailRecord.reviewed_at, 'MMM d, yyyy h:mm a') + ' PT'}
                    />
                  ) : null}
                </DetailSection>
              )}
            </div>

            {detailRecord.status === 'pending_approval' ? (
              <div className="sticky bottom-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openReject(detailRecord, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => openApprove(detailRecord, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Approve & schedule
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {modal && activeRecord ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {modal === 'approve' ? 'Approve service record' : 'Reject service record'}
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  #{activeRecord.demand_number} · {activeRecord.vehicle_summary}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            {modal === 'approve' ? (
              <div className="space-y-3">
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
                      {loadingSpecialists ? 'Loading specialists…' : 'Select specialist…'}
                    </option>
                    {specialistOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Appointment date & time (Pacific Time)
                  </label>
                  <input
                    type="datetime-local"
                    value={appointmentLocal}
                    onChange={(e) => setAppointmentLocal(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Service location
                  </label>
                  <input
                    type="text"
                    value={serviceLocation}
                    onChange={(e) => setServiceLocation(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  SMS will be sent to{' '}
                  <span className="font-medium text-zinc-700 dark:text-gray-300">
                    {activeRecord.customer_firstname || 'customer'} · {activeRecord.customer_phone}
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Rejection reason (optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value.slice(0, 500))}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
            )}

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void (modal === 'approve' ? handleApprove() : handleReject())}
                disabled={submitting || (modal === 'approve' && (!appointmentLocal || !specialistId))}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  modal === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {modal === 'approve' ? 'Approve & send SMS' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
