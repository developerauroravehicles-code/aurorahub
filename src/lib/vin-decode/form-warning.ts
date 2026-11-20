import { normalizeVinInput } from './nhtsa-vpic'

export function vinLast6FromFullVin(vin: string): string {
  return normalizeVinInput(vin).slice(-6).toUpperCase()
}

export function parseVinDecodeWarningFromForm(formData: FormData): boolean {
  const raw = formData.get('vinDecodeWarning')
  return raw === '1' || raw === 'true' || raw === 'on'
}