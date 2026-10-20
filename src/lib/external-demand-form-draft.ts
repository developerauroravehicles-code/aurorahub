import type { DemandServiceType } from '@/lib/demand-pricing'

export type ExternalDemandScannedBarcodeDraft = {
  code: string
  modelName: string
  cameraModelId: string
}

export type ExternalDemandFormDraft = {
  version: 1
  selectedDealerId: string
  assignedSpecialistId: string
  completeOnCreate: boolean
  serviceType: DemandServiceType
  firstName: string
  lastName: string
  phone: string
  address: string
  vehicleYear: string
  stockNumber: string
  vinLast6: string
  selectedMake: string
  selectedModel: string
  selectedTrim: string
  customModel: string
  selectedCameraId: string
  customCamera: string
  cameraNameForSubmit: string
  comment: string
  isFutureCustomer: boolean
  appointmentDate: string
  scannedBarcodes: ExternalDemandScannedBarcodeDraft[]
}

export const EXTERNAL_DEMAND_DRAFT_STORAGE_KEY = 'aurora_external_demand_draft_v1'
/** Set before submit; form restores from storage after remount when this flag is present. */
export const EXTERNAL_DEMAND_RESTORE_FLAG = 'aurora_external_demand_restore_pending'

let memoryDraft: ExternalDemandFormDraft | null = null

export function saveExternalDemandDraft(draft: ExternalDemandFormDraft): void {
  memoryDraft = draft
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(EXTERNAL_DEMAND_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* quota / private mode */
  }
}

export function loadExternalDemandDraft(): ExternalDemandFormDraft | null {
  if (memoryDraft?.version === 1) return memoryDraft
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(EXTERNAL_DEMAND_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ExternalDemandFormDraft
    if (parsed?.version !== 1) return null
    memoryDraft = parsed
    return parsed
  } catch {
    return null
  }
}

export function clearExternalDemandDraft(): void {
  memoryDraft = null
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(EXTERNAL_DEMAND_DRAFT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
