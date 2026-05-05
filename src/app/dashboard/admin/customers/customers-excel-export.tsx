'use client'

import { useCallback, useState } from 'react'
import type { Borders, Fill, Font } from 'exceljs'
import { Download } from 'lucide-react'

export type CustomersListExcelRow = {
  firstName: string
  lastName: string
  phone: string
  demandCount: number
  /** ISO date (yyyy-mm-dd) or full ISO */
  lastActivity: string
  latestCamera: string
  latestDealer: string
  /** yyyy-mm-dd or null */
  latestWarrantyEnd: string | null
}

export type CustomerDemandsExcelRow = {
  demandNumber: string
  camera: string
  dealer: string
  warrantyEnds: string
  status: string
}

const PT_TIMEZONE = 'America/Vancouver'

const btnClass =
  'inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:border-[#C27E00]/50 hover:bg-zinc-50 hover:text-[#C27E00] disabled:pointer-events-none disabled:opacity-40 dark:border-gray-700 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:hover:text-[#C27E00]'

function excelColumnLetter(n: number): string {
  let s = ''
  let col = n
  while (col > 0) {
    const rem = (col - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    col = Math.floor((col - 1) / 26)
  }
  return s
}

function toTitleCaseWords(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function formatNorthAmericanPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith('1')) return `${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`
  return raw.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim()
}

function parseSheetDate(isoOrYmd: string): Date {
  if (isoOrYmd.includes('T') || isoOrYmd.endsWith('Z')) {
    return new Date(isoOrYmd)
  }
  return new Date(`${isoOrYmd}T12:00:00`)
}

function exportedNowPt(): string {
  return new Date().toLocaleString('en-CA', {
    timeZone: PT_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function downloadWorkbook(wb: import('exceljs').Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const thinBorder: Partial<Borders> = {
  top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
  bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
  left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
  right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
}

async function buildCustomersWorkbook(rows: CustomersListExcelRow[]): Promise<import('exceljs').Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Aurora Hub'
  wb.created = new Date()

  const HEADER_ROW = 3
  const headers = [
    'First name',
    'Last name',
    'Phone',
    'Demands',
    'Last activity',
    'Latest camera',
    'Latest dealer',
    'Warranty ends',
  ]
  const colCount = headers.length

  const ws = wb.addWorksheet('Customers', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  })

  ws.mergeCells(`A1:${excelColumnLetter(colCount)}1`)
  const t1 = ws.getCell(1, 1)
  t1.value = 'Aurora Hub — Customer directory'
  t1.font = { bold: true, size: 16, color: { argb: 'FF1A1A1A' } }
  t1.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 28

  ws.mergeCells(`A2:${excelColumnLetter(colCount)}2`)
  const t2 = ws.getCell(2, 1)
  t2.value = `Exported ${exportedNowPt()} PT`
  t2.font = { italic: true, size: 10, color: { argb: 'FF666666' } }
  t2.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 20

  const headerFill: Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF252525' },
  }
  const headerFont: Partial<Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

  headers.forEach((label, i) => {
    const cell = ws.getCell(HEADER_ROW, i + 1)
    cell.value = label
    cell.font = headerFont
    cell.fill = headerFill
    cell.border = {
      top: { style: 'medium', color: { argb: 'FFC27E00' } },
      bottom: { style: 'thin', color: { argb: 'FF444444' } },
      left: { style: 'thin', color: { argb: 'FF444444' } },
      right: { style: 'thin', color: { argb: 'FF444444' } },
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: i >= 3 && i <= 6 ? 'center' : 'left',
      wrapText: true,
    }
  })
  ws.getRow(HEADER_ROW).height = 22

  rows.forEach((r, idx) => {
    const rowNum = HEADER_ROW + 1 + idx
    const excelRow = ws.getRow(rowNum)
    const zebra: Fill | undefined =
      idx % 2 === 1
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
        : undefined

    const activityDate = parseSheetDate(r.lastActivity)
    const warranty =
      r.latestWarrantyEnd != null && String(r.latestWarrantyEnd).trim() !== ''
        ? parseSheetDate(String(r.latestWarrantyEnd))
        : null

    const specs: Array<{
      value: string | number | Date
      numFmt?: string
      hAlign: 'left' | 'center'
    }> = [
      { value: toTitleCaseWords(r.firstName), hAlign: 'left' },
      { value: toTitleCaseWords(r.lastName), hAlign: 'left' },
      { value: formatNorthAmericanPhone(r.phone), hAlign: 'left' },
      { value: r.demandCount, numFmt: '0', hAlign: 'center' },
      { value: activityDate, numFmt: 'yyyy-mm-dd', hAlign: 'center' },
      { value: r.latestCamera || '', hAlign: 'left' },
      { value: r.latestDealer || '', hAlign: 'left' },
      warranty
        ? { value: warranty, numFmt: 'yyyy-mm-dd', hAlign: 'center' }
        : { value: '—', hAlign: 'center' },
    ]

    specs.forEach((spec, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1)
      cell.value = spec.value
      if (spec.numFmt) cell.numFmt = spec.numFmt
      cell.font = { size: 11, color: { argb: 'FF222222' } }
      cell.border = thinBorder as Borders
      cell.alignment = { vertical: 'middle', horizontal: spec.hAlign, wrapText: colIdx >= 5 }
      if (zebra) cell.fill = zebra
    })
  })

  const lastRow = HEADER_ROW + rows.length
  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: lastRow, column: colCount },
  }

  ws.columns = [
    { width: 18 },
    { width: 20 },
    { width: 16 },
    { width: 10 },
    { width: 14 },
    { width: 38 },
    { width: 30 },
    { width: 14 },
  ]

  return wb
}

async function buildDemandsWorkbook(opts: {
  customerTitle: string
  customerPhone: string
  rows: CustomerDemandsExcelRow[]
}): Promise<import('exceljs').Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Aurora Hub'
  wb.created = new Date()

  const HEADER_ROW = 4
  const headers = ['Demand #', 'Camera', 'Dealer', 'Warranty ends', 'Status']
  const colCount = headers.length

  const ws = wb.addWorksheet('Demands', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  })

  ws.mergeCells(`A1:${excelColumnLetter(colCount)}1`)
  const title = ws.getCell(1, 1)
  title.value = `Demands — ${opts.customerTitle}`
  title.font = { bold: true, size: 15, color: { argb: 'FF1A1A1A' } }
  title.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 26

  ws.mergeCells(`A2:${excelColumnLetter(colCount)}2`)
  const phoneCell = ws.getCell(2, 1)
  phoneCell.value = `Phone: ${formatNorthAmericanPhone(opts.customerPhone)}`
  phoneCell.font = { size: 11, color: { argb: 'FF444444' } }
  phoneCell.alignment = { horizontal: 'center' }

  ws.mergeCells(`A3:${excelColumnLetter(colCount)}3`)
  const exp = ws.getCell(3, 1)
  exp.value = `Exported ${exportedNowPt()} PT`
  exp.font = { italic: true, size: 10, color: { argb: 'FF666666' } }
  exp.alignment = { horizontal: 'center' }
  ws.getRow(3).height = 18

  const headerFill: Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF252525' },
  }
  const headerFont: Partial<Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

  headers.forEach((label, i) => {
    const cell = ws.getCell(HEADER_ROW, i + 1)
    cell.value = label
    cell.font = headerFont
    cell.fill = headerFill
    cell.border = {
      top: { style: 'medium', color: { argb: 'FFC27E00' } },
      bottom: { style: 'thin', color: { argb: 'FF444444' } },
      left: { style: 'thin', color: { argb: 'FF444444' } },
      right: { style: 'thin', color: { argb: 'FF444444' } },
    }
    cell.alignment = { vertical: 'middle', horizontal: i >= 3 ? 'center' : 'left', wrapText: true }
  })
  ws.getRow(HEADER_ROW).height = 22

  opts.rows.forEach((r, idx) => {
    const rowNum = HEADER_ROW + 1 + idx
    const excelRow = ws.getRow(rowNum)
    const zebra: Fill | undefined =
      idx % 2 === 1
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
        : undefined

    const cells: Array<{ v: string | number; align: 'left' | 'center' }> = [
      { v: r.demandNumber, align: 'left' },
      { v: r.camera, align: 'left' },
      { v: r.dealer, align: 'left' },
      { v: r.warrantyEnds, align: 'center' },
      { v: toTitleCaseWords(r.status), align: 'center' },
    ]

    cells.forEach((c, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1)
      cell.value = c.v
      cell.font = { size: 11, color: { argb: 'FF222222' } }
      cell.border = thinBorder as Borders
      cell.alignment = { vertical: 'middle', horizontal: c.align, wrapText: colIdx <= 2 }
      if (zebra) cell.fill = zebra
    })
  })

  const lastRow = HEADER_ROW + opts.rows.length
  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: lastRow, column: colCount },
  }

  ws.columns = [{ width: 14 }, { width: 36 }, { width: 30 }, { width: 16 }, { width: 14 }]

  return wb
}

export function CustomersListExcelButton({ rows }: { rows: CustomersListExcelRow[] }) {
  const [busy, setBusy] = useState(false)

  const onExport = useCallback(async () => {
    if (rows.length === 0 || busy) return
    setBusy(true)
    try {
      const wb = await buildCustomersWorkbook(rows)
      const stamp = new Date().toISOString().slice(0, 10)
      await downloadWorkbook(wb, `customers-${stamp}.xlsx`)
    } finally {
      setBusy(false)
    }
  }, [rows, busy])

  return (
    <button
      type="button"
      onClick={() => void onExport()}
      disabled={rows.length === 0 || busy}
      className={btnClass}
    >
      <Download className="h-4 w-4 shrink-0" />
      {busy ? 'Building…' : 'Download Excel'}
    </button>
  )
}

export function CustomerDemandsExcelButton({
  filenamePrefix,
  customerTitle,
  customerPhone,
  rows,
}: {
  filenamePrefix: string
  customerTitle: string
  customerPhone: string
  rows: CustomerDemandsExcelRow[]
}) {
  const [busy, setBusy] = useState(false)

  const onExport = useCallback(async () => {
    if (rows.length === 0 || busy) return
    setBusy(true)
    try {
      const wb = await buildDemandsWorkbook({ customerTitle, customerPhone, rows })
      const stamp = new Date().toISOString().slice(0, 10)
      const safe = filenamePrefix.replace(/[^\w.-]+/g, '_').slice(0, 64) || 'customer-demands'
      await downloadWorkbook(wb, `${safe}-${stamp}.xlsx`)
    } finally {
      setBusy(false)
    }
  }, [rows, filenamePrefix, customerTitle, customerPhone, busy])

  return (
    <button
      type="button"
      onClick={() => void onExport()}
      disabled={rows.length === 0 || busy}
      className={btnClass}
    >
      <Download className="h-4 w-4 shrink-0" />
      {busy ? 'Building…' : 'Download Excel'}
    </button>
  )
}
