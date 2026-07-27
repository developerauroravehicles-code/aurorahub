import { describe, expect, it } from 'vitest'
import { parseDemandDocument } from '@/lib/demand-document-parser'
import { countFilledExtractFields, getApplicableFieldKeys } from '@/lib/demand-extract-types'
import { normalizeMake, normalizeModel } from '@/lib/normalize-vehicle-fields'

const SALES_CHECKLIST_TEXT = `
SALES MANAGER CHECK LIST
Applewood Nissan Surrey
Customer Last Name Only PANOPIO
Phone # 778-522-0913
Customer # 1029059
Email RUTH.RANES@YAHOO.COM
Deal # 53843
Stock # 6K1708
Vehicle Description 2024 NISSAN KICKS
VIN 3N8AP6CB4TL331708
`

const CREDIT_APPLICATION_TEXT = `
Use as Primary Applicant This co-applicant is active
Salutation: Ms. Suffix: Gender: Female
First Name: SKYLA SIN: Clear SIN Marital Status: Single
Middle Name: DIANE Phone: (778)512-5112 Email: skyfave01@gmail.com
Last Name: LOEPPKY Mobile Phone: (778)512-5112 Copy phone
Date of Birth 10 / 19 / 2001 Relation to Primary:
Language of Correspondence: English
Current Address
Postal Code: V3R 4H8 Address Lookup Add Manually
Address Type: Street Street Name: 153 City: SURREY
Suite No.: 25 Street Type: STREET Province: British Columbia
Address No.: 10575 Direction: Duration: 5 Years 5 Months
`

describe('parseDemandDocument', () => {
  it('parses Sales Manager Check List fields', () => {
    const result = parseDemandDocument(SALES_CHECKLIST_TEXT)

    expect(result.documentType).toBe('sales_checklist')
    expect(result.lastName.value).toBe('PANOPIO')
    expect(result.phone.value).toBe('778 - 522 - 0913')
    expect(result.stockNumber.value).toBe('6K1708')
    expect(result.vehicleYear.value).toBe('2024')
    expect(result.vehicleMake.value).toBe('Nissan')
    expect(result.vehicleModel.value).toBe('Kicks')
    expect(result.vinLast6.value).toBe('331708')
    expect(countFilledExtractFields(result)).toBeGreaterThanOrEqual(6)
  })

  it('parses credit application customer fields', () => {
    const result = parseDemandDocument(CREDIT_APPLICATION_TEXT)

    expect(result.documentType).toBe('credit_application')
    expect(result.firstName.value).toBe('SKYLA')
    expect(result.lastName.value).toBe('LOEPPKY')
    expect(result.phone.value).toBe('778 - 512 - 5112')
  })

  it('never takes vehicle or stock data from a credit application', () => {
    const result = parseDemandDocument(CREDIT_APPLICATION_TEXT)

    expect(result.vehicleYear.value).toBeNull()
    expect(result.vehicleMake.value).toBeNull()
    expect(result.vehicleModel.value).toBeNull()
    expect(result.stockNumber.value).toBeNull()
    expect(result.vinLast6.value).toBeNull()
  })

  it('does not mistake a form label for a name', () => {
    const garbled = `
      First Name: Middle Name: DIANE
      Last Name: Mobile Phone: (778)512-5112
    `
    const result = parseDemandDocument(garbled)

    expect(result.lastName.value).not.toBe('MOBILE')
    expect(result.firstName.value).not.toBe('MIDDLE')
  })

  it('does not stitch unrelated digits into a phone number', () => {
    const garbled = `
      Middle Name.  Phone: [FTEs T2812 |  emai: [igtavetiggmaicon |"
      Date of Birth [EEE  Relation to Primary: EE
      Address No. 10575  Duration: 5 Years 5 Months
    `
    const result = parseDemandDocument(garbled)

    expect(result.phone.value).toBeNull()
  })

  it('extracts VIN last 6 when VIN contains spaces', () => {
    const result = parseDemandDocument('VIN 3N8AP6CB4TL 331708')
    expect(result.vinLast6.value).toBe('331708')
    expect(result.vinLast6.confidence).toBe('high')
  })

  it('extracts vehicle info when the description has no leading year', () => {
    const text = `
      SALES MANAGER CHECK LIST
      Stock # 6K1708
      Vehicle Description NISSAN KICKS 2026
      VIN 3N8AP6CB4TL331708
    `
    const result = parseDemandDocument(text)

    expect(result.vehicleMake.value).toBe('Nissan')
    expect(result.vehicleModel.value).toBe('Kicks')
    expect(result.vehicleYear.value).toBe('2026')
  })

  it('selects the make even when OCR garbles it', () => {
    const text = `
      SALES MANAGER CHECK LIST
      Stock # 6K1708
      Vehicle Description 2026 N1SSAN KICKS
      VIN 3N8AP6CB4TL331708
    `
    const result = parseDemandDocument(text)

    expect(result.vehicleMake.value).toBe('Nissan')
    expect(result.vehicleModel.value).toBe('Kicks')
    expect(result.vehicleYear.value).toBe('2026')
  })

  it('ignores dealership name when locating vehicle make', () => {
    const text = `
      Applewood Nissan Surrey
      SALES MANAGER CHECK LIST
      Stock # 6K1708
      Vehicle Description
      2026 NISSAN KICKS
      VIN 3N8AP6CB4TL331708
    `
    const result = parseDemandDocument(text)

    expect(result.vehicleMake.value).toBe('Nissan')
    expect(result.vehicleModel.value).toBe('Kicks')
    expect(result.vehicleYear.value).toBe('2026')
  })

  it('parses a checklist read from a tilted photo after rotation rescue', () => {
    // Real OCR output from a rotated phone photo, deskewed by the sweep.
    const text = `
Applewood Nissan Surrey
TEAM    ER
CUSTOMER LAST NAME ONLY           PHONE #
BINNY MATHEW                   2026-05-14
PANOPIO                           778-522-0913
USTOMER #                        EMAIL                                             OR
1029058                       RUTH RANES@YAHOO.COM
STOCK #                                                     Vin                                Color
6K1708                                                           INSAPECBATLI31708                  2TONE BLK/
Vehicle Description                                                                     Sales N
2026          NISSAN KICKS                                                  NITISH DHINGRA
FOCATION: STORAGE TLOT/ LOCATE                  cred: Y/N
CASH / FINANCE /  LEASE
SALES MANAGER CHECK LIST
`
    const result = parseDemandDocument(text)

    expect(result.documentType).toBe('sales_checklist')
    expect(result.lastName.value).toBe('PANOPIO')
    expect(result.phone.value).toBe('778 - 522 - 0913')
    expect(result.stockNumber.value).toBe('6K1708')
    expect(result.vehicleYear.value).toBe('2026')
    expect(result.vehicleMake.value).toBe('Nissan')
    expect(result.vehicleModel.value).toBe('Kicks')
  })

  it('reports only the fields a document type can provide', () => {
    const checklist = parseDemandDocument(SALES_CHECKLIST_TEXT)
    expect(getApplicableFieldKeys(checklist.documentType)).not.toContain('firstName')

    const application = parseDemandDocument(CREDIT_APPLICATION_TEXT)
    expect(getApplicableFieldKeys(application.documentType)).toEqual([
      'firstName',
      'lastName',
      'phone',
    ])
  })
})

describe('normalizeVehicleFields', () => {
  it('normalizes make and model tokens', () => {
    expect(normalizeMake('NISSAN')).toBe('Nissan')
    expect(normalizeModel('Nissan', 'KICKS')).toEqual({ model: 'Kicks', useCustom: false })
  })

  it('tolerates OCR garbles in makes and models', () => {
    expect(normalizeMake('N1SSAN')).toBe('Nissan')
    expect(normalizeMake('NISSAM')).toBe('Nissan')
    expect(normalizeMake('T0YOTA')).toBe('Toyota')
    expect(normalizeModel('Nissan', 'K1CKS')).toEqual({ model: 'Kicks', useCustom: false })
    expect(normalizeModel('Nissan', 'KICKS')).toEqual({ model: 'Kicks', useCustom: false })
    expect(normalizeModel('Nissan', 'KICKS NITISH DHINGRA')).toEqual({ model: 'Kicks', useCustom: false })
  })

  it('does not fuzzy-match unrelated words to a make', () => {
    expect(normalizeMake('MOBILE')).toBeNull()
    expect(normalizeMake('STREET')).toBeNull()
    expect(normalizeMake('SURREY')).toBeNull()
  })
})
