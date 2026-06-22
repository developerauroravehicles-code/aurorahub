import type {
  ServiceRecordDiagnosisCode,
  ServiceRecordStatus,
} from '@/types/customer-service-record'

export const DEFAULT_SERVICE_LOCATION = '18439 68 Ave, Surrey V3S 9H8'

export const SERVICE_RECORD_DIAGNOSIS_OPTIONS: {
  code: ServiceRecordDiagnosisCode
  label: string
}[] = [
  { code: 'camera_not_recording', label: 'Camera not recording' },
  { code: 'sd_card_issue', label: 'SD card / storage issue' },
  { code: 'power_wiring_issue', label: 'Power or wiring issue' },
  { code: 'app_connectivity_issue', label: 'App / connectivity issue' },
  { code: 'display_monitor_issue', label: 'Display / monitor issue' },
  { code: 'other', label: 'Other' },
]

const DIAGNOSIS_LABELS: Record<ServiceRecordDiagnosisCode, string> = {
  camera_not_recording: 'Camera not recording',
  sd_card_issue: 'SD card / storage issue',
  power_wiring_issue: 'Power or wiring issue',
  app_connectivity_issue: 'App / connectivity issue',
  display_monitor_issue: 'Display / monitor issue',
  other: 'Other',
}

export function isServiceRecordDiagnosisCode(value: string): value is ServiceRecordDiagnosisCode {
  return value in DIAGNOSIS_LABELS
}

export function diagnosisLabel(code: string, other?: string | null): string {
  if (code === 'other') {
    const trimmed = other?.trim()
    return trimmed ? `Other — ${trimmed}` : 'Other'
  }
  if (isServiceRecordDiagnosisCode(code)) return DIAGNOSIS_LABELS[code]
  return code.replace(/_/g, ' ')
}

export function serviceRecordStatusLabel(status: string): string {
  const map: Record<ServiceRecordStatus, string> = {
    pending_approval: 'Pending approval',
    rejected: 'Rejected',
    scheduled: 'Scheduled',
  }
  const s = (status || '').toLowerCase() as ServiceRecordStatus
  return map[s] ?? status.replace(/_/g, ' ')
}

export function hasPendingServiceRecord(
  records: { status: string }[] | null | undefined
): boolean {
  return Boolean(records?.some((r) => r.status === 'pending_approval'))
}

type RpcErrorLike = {
  message?: string
  code?: string
  details?: string
}

/** User-facing message for portal service-record RPC failures. */
export function portalServiceRecordRpcErrorMessage(
  rpcError: RpcErrorLike | null | undefined,
  fallback = 'We could not complete this request right now. Please try again later.'
): string {
  if (!rpcError) return fallback
  const code = rpcError.code ?? ''
  const message = `${rpcError.message ?? ''} ${rpcError.details ?? ''}`.toLowerCase()

  if (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('could not find the function') ||
    (message.includes('customer_service_records') && message.includes('does not exist'))
  ) {
    return 'Service requests are not available yet. Please contact your dealer for assistance.'
  }

  if (rpcError.message?.trim()) return rpcError.message.trim()
  return fallback
}
