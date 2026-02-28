import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface StatementRowData {
  demand_number: string | null
  date: string
  vehicleModel: string
  stockNumber: string
  price: number
  tax: number
}

export interface StatementPdfData {
  dealerName: string
  dateFrom: string
  dateTo: string
  rows: StatementRowData[]
  logoDataUrl?: string | null
}

const AURORA_COMPANY = {
  name: 'AURORA VEHICLES',
  address1: '18439 68 Ave',
  address2: 'Surrey V3S 9H8',
  phone: '604 833 5801',
  email: 'support@auroravehicles.com'
} as const

function getImageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
  return 'PNG'
}

function fmtPrice(n: number): string {
  return `$ ${n.toFixed(2)}`
}

export function buildStatementPdf(data: StatementPdfData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const leftX = margin
  let yLeft = 20

  // STATEMENT title at top
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(194, 126, 0)
  doc.text('STATEMENT', pageWidth / 2, 15, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  yLeft += 8

  // Company info (left) | Logo (right)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(AURORA_COMPANY.name, leftX, yLeft)
  yLeft += 6
  doc.text(AURORA_COMPANY.address1, leftX, yLeft)
  yLeft += 5
  doc.text(AURORA_COMPANY.address2, leftX, yLeft)
  yLeft += 5
  doc.text(AURORA_COMPANY.phone, leftX, yLeft)
  yLeft += 5
  doc.text(AURORA_COMPANY.email, leftX, yLeft)
  yLeft += 8

  // Logo on black circle (right, top) - drawn first so dealer/period sit below
  const circleRadius = 18
  const circleCenterX = pageWidth - margin - circleRadius
  const circleCenterY = 20 + circleRadius
  doc.setFillColor(0, 0, 0)
  doc.circle(circleCenterX, circleCenterY, circleRadius, 'F')

  if (data.logoDataUrl) {
    try {
      const imgFormat = getImageFormatFromDataUrl(data.logoDataUrl)
      const logoSize = 28
      const logoX = circleCenterX - logoSize / 2
      const logoY = circleCenterY - logoSize / 2
      doc.addImage(data.logoDataUrl, imgFormat, logoX, logoY, logoSize, logoSize)
    } catch {
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('A', circleCenterX, circleCenterY + 1, { align: 'center' })
      doc.setTextColor(0, 0, 0)
    }
  } else {
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('A', circleCenterX, circleCenterY + 1, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  // Dealer and date range (right-aligned, BELOW logo to avoid overlap)
  const invRightX = pageWidth - margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(data.dealerName, invRightX, circleCenterY + circleRadius + 8, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text(`Period: ${data.dateFrom} — ${data.dateTo}`, invRightX, circleCenterY + circleRadius + 14, { align: 'right' })

  let y = Math.max(yLeft, circleCenterY + circleRadius + 20) + 6

  // Line
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 12

  // Table: Invoice No | Date | Vehicle Model | Stok No | Price | Tax
  const tableData = data.rows.map((r) => [
    r.demand_number ?? '—',
    r.date,
    r.vehicleModel,
    r.stockNumber ?? '—',
    fmtPrice(r.price),
    fmtPrice(r.tax)
  ])

  const totalPrice = data.rows.reduce((sum, r) => sum + r.price, 0)
  const totalTax = data.rows.reduce((sum, r) => sum + r.tax, 0)
  const grandTotal = totalPrice + totalTax

  const tableBodyWithTotal = [
    ...tableData,
    ['', '', '', 'Total', { content: fmtPrice(grandTotal), colSpan: 2 }],
  ]

  const tableWidth = pageWidth - 2 * margin
  autoTable(doc, {
    startY: y,
    head: [['Invoice No', 'Date', 'Vehicle Model', 'Stok No', 'Price', 'Tax']],
    body: tableBodyWithTotal,
    theme: 'grid',
    headStyles: { fillColor: [194, 126, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    tableWidth,
    columnStyles: {
      0: { cellWidth: tableWidth * 0.155 },
      1: { cellWidth: tableWidth * 0.135 },
      2: { cellWidth: tableWidth * 0.24 },
      3: { cellWidth: tableWidth * 0.125 },
      4: { cellWidth: tableWidth * 0.17, halign: 'right' },
      5: { cellWidth: tableWidth * 0.18, halign: 'right' }
    },
    tableLineColor: [60, 60, 60],
    tableLineWidth: 0.2,
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === tableBodyWithTotal.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [230, 230, 230]
      }
    }
  })

  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 12

  // Footer
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text(
    `AuroraHub Statement - Generated ${new Date().toLocaleDateString()} - ${data.dealerName}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  )

  return doc
}

export function downloadStatementPdf(data: StatementPdfData): void {
  const doc = buildStatementPdf(data)
  const sanitizedDealer = data.dealerName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Statement'
  const fileName = `Statement_${sanitizedDealer}_${data.dateFrom}_${data.dateTo}.pdf`
  doc.save(fileName)
}

export function getStatementPdfBlobUrl(data: StatementPdfData): string {
  const doc = buildStatementPdf(data)
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}

/** Opens PDF in new tab for preview. User can then download from browser's PDF viewer. */
export function previewStatementPdf(data: StatementPdfData): void {
  const url = getStatementPdfBlobUrl(data)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
