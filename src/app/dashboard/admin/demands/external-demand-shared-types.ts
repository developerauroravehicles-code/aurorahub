import type { DemandServiceType } from '@/lib/demand-pricing'

export type ExternalDemandMissingPrice = {
  dealerId: string
  dealerName: string
  cameraModelId: string
  cameraModelName: string
  serviceType: DemandServiceType
}
