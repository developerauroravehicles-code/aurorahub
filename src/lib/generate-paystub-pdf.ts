import { formatInTimeZone } from 'date-fns-tz'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const AURORA_COMPANY = {
  name: 'AURORA VEHICLES INC.',
  address1: '18439 68 Ave',
  address2: 'Surrey BC V3S 9H8',
  phone: '604 833 5801',
  email: 'support@auroravehicles.com',
} as const

export interface PayStubPdfData {
  employeeName: string
  periodLabel?: string | null
  paymentTypeLabel?: string | null
  gross: number
  /** Optional extra positive earnings (shown after base gross). */
  extraEarnings?: { label: string; amount: number }[]
  cpp: number
  ei: number
  federal_tax: number
  provincial_tax: number
  net: number
  /** 'record' = payment-linked stub; 'estimate' = calculator output */
  documentKind?: 'record' | 'estimate'
}

/** ASCII-only (comma thousands, dot decimals) so jsPDF standard fonts render amounts correctly. */
function fmtCad(n: number): string {
  const fixed = Math.abs(n).toFixed(2)
  const [intRaw, dec] = fixed.split('.')
  const intPart = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${intPart}.${dec}`
}

function safeFilePart(s: string): string {
  return s.replace(/[<>:"/\\|?*\s]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'PayStub'
}

export function buildPayStubPdf(data: PayStubPdfData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  let y = 18

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(194, 126, 0)
  doc.text('EARNINGS STATEMENT', pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(AURORA_COMPANY.name, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y += 5
  doc.text(`${AURORA_COMPANY.address1}, ${AURORA_COMPANY.address2}`, margin, y)
  y += 4
  doc.text(`${AURORA_COMPANY.phone}  |  ${AURORA_COMPANY.email}`, margin, y)
  y += 10

  const issued = formatInTimeZone(new Date(), 'America/Vancouver', 'MMMM d, yyyy')
  doc.setFontSize(9)
  doc.text(`Issued: ${issued}`, pageWidth - margin, 36, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Employee', margin, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text(data.employeeName.trim() || '-', margin, y)
  y += 6
  if (data.periodLabel) {
    doc.setFont('helvetica', 'bold')
    doc.text('Pay period', margin, y)
    doc.setFont('helvetica', 'normal')
    y += 5
    doc.text(data.periodLabel, margin, y)
    y += 6
  }
  if (data.paymentTypeLabel) {
    doc.setFont('helvetica', 'bold')
    doc.text('Payment type', margin, y)
    doc.setFont('helvetica', 'normal')
    y += 5
    doc.text(data.paymentTypeLabel, margin, y)
    y += 6
  }

  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  const kindNote =
    data.documentKind === 'estimate'
      ? 'Calculator estimate - not a payroll register entry.'
      : 'Payment record - amounts may have been adjusted by HR.'

  const tableWidth = pageWidth - 2 * margin
  const earningRows: (string | { content: string; styles?: Record<string, unknown> })[][] = [
    ['Base gross earnings', fmtCad(data.gross)],
  ]
  for (const ex of data.extraEarnings ?? []) {
    if (ex.amount > 0) earningRows.push([ex.label.trim() || 'Extra payment', fmtCad(ex.amount)])
  }
  const body: (string | { content: string; styles?: Record<string, unknown> })[][] = [
    ...earningRows,
    ['CPP (Canada Pension Plan)', `-${fmtCad(data.cpp)}`],
    ['EI (Employment Insurance)', `-${fmtCad(data.ei)}`],
    ['Federal income tax', `-${fmtCad(data.federal_tax)}`],
    ['Provincial income tax (BC)', `-${fmtCad(data.provincial_tax)}`],
    [
      { content: 'Net pay', styles: { fontStyle: 'bold' as const } },
      { content: fmtCad(data.net), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
    ],
  ]
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Amount (CAD)']],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [194, 126, 0],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    margin: { left: margin, right: margin },
    tableWidth,
    columnStyles: {
      0: { cellWidth: tableWidth * 0.62 },
      1: { cellWidth: tableWidth * 0.38, halign: 'right' },
    },
  })

  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 10

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  const disclaimer = [
    kindNote,
    'Bi-weekly pay assumptions; CPP, EI, federal tax, and simplified BC provincial tax (basic personal amount & lowest bracket rate).',
    'For information only - not tax, legal, or accounting advice. Verify with official deductions or a qualified advisor.',
  ]
  for (const line of disclaimer) {
    const lines = doc.splitTextToSize(line, pageWidth - 2 * margin)
    doc.text(lines, margin, y)
    y += lines.length * 3.2
  }

  doc.setTextColor(128, 128, 128)
  doc.setFontSize(8)
  doc.text(
    `AuroraHub - Earnings statement - ${data.documentKind === 'estimate' ? 'Estimate' : safeFilePart(data.employeeName)}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  )

  return doc
}

export function downloadPayStubPdf(data: PayStubPdfData): void {
  const doc = buildPayStubPdf(data)
  const stamp = formatInTimeZone(new Date(), 'America/Vancouver', 'yyyy-MM-dd')
  const base =
    data.documentKind === 'estimate'
      ? `PayStub_Estimate_${stamp}`
      : `PayStub_${safeFilePart(data.employeeName)}_${stamp}`
  doc.save(`${base}.pdf`)
}
