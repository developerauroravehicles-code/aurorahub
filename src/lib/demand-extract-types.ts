export type FieldConfidence = 'high' | 'low' | 'missing'

export type ExtractedField = {
  value: string | null
  confidence: FieldConfidence
}

export type DemandDocumentType = 'sales_checklist' | 'credit_application' | 'unknown'

export type DemandExtractResult = {
  firstName: ExtractedField
  lastName: ExtractedField
  phone: ExtractedField
  vehicleMake: ExtractedField
  vehicleModel: ExtractedField
  vehicleYear: ExtractedField
  stockNumber: ExtractedField
  vinLast6: ExtractedField
  documentType: DemandDocumentType
}

export const DEMAND_EXTRACT_FIELD_LABELS: Record<
  keyof Omit<DemandExtractResult, 'documentType'>,
  string
> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone',
  vehicleMake: 'Make',
  vehicleModel: 'Model',
  vehicleYear: 'Year',
  stockNumber: 'Stock Number',
  vinLast6: 'VIN Last 6',
}

export function createEmptyExtractResult(): DemandExtractResult {
  const missing = (): ExtractedField => ({ value: null, confidence: 'missing' })
  return {
    firstName: missing(),
    lastName: missing(),
    phone: missing(),
    vehicleMake: missing(),
    vehicleModel: missing(),
    vehicleYear: missing(),
    stockNumber: missing(),
    vinLast6: missing(),
    documentType: 'unknown',
  }
}

export function countFilledExtractFields(result: DemandExtractResult): number {
  return getApplicableFieldKeys(result.documentType).filter(
    (key) => result[key].value !== null && result[key].value !== ''
  ).length
}

/** Fields expected for each document type (used for missing-field messaging). */
export function getApplicableFieldKeys(
  documentType: DemandDocumentType
): Array<keyof typeof DEMAND_EXTRACT_FIELD_LABELS> {
  const all = Object.keys(DEMAND_EXTRACT_FIELD_LABELS) as Array<keyof typeof DEMAND_EXTRACT_FIELD_LABELS>
  if (documentType === 'sales_checklist') {
    // The checklist only carries the customer's last name.
    return all.filter((key) => key !== 'firstName')
  }
  if (documentType === 'credit_application') {
    return ['firstName', 'lastName', 'phone']
  }
  return all
}

export function getFilledExtractFieldLabels(result: DemandExtractResult): string[] {
  return getApplicableFieldKeys(result.documentType)
    .filter((key) => result[key].value)
    .map((key) => DEMAND_EXTRACT_FIELD_LABELS[key])
}

export function getMissingExtractFieldLabels(result: DemandExtractResult): string[] {
  return getApplicableFieldKeys(result.documentType)
    .filter((key) => result[key].confidence === 'missing' || !result[key].value)
    .map((key) => DEMAND_EXTRACT_FIELD_LABELS[key])
}

export function getLowConfidenceExtractFieldLabels(result: DemandExtractResult): string[] {
  return (
    Object.keys(DEMAND_EXTRACT_FIELD_LABELS) as Array<keyof typeof DEMAND_EXTRACT_FIELD_LABELS>
  )
    .filter((key) => result[key].confidence === 'low' && result[key].value)
    .map((key) => DEMAND_EXTRACT_FIELD_LABELS[key])
}
