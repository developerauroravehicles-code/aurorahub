import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InvoiceRowData {
  demand_number: string | null
  customerName: string
  phone: string
  stockNumber: string
  customerAddress: string
  vehicleInfo: string
  productModel: string
  orderDate: string
  warrantyEnd: string
  totalAmount: string
  comments: string
  /** System logo as data URL (data:image/...;base64,...) for PDF */
  logoDataUrl?: string | null
  /** Extra editable two-column rows: col1=label, col2=amount (CAD). Subtotal = sum of col2. */
  extraTableRows?: { col1: string; col2: string }[]
  /** Financial summary config - toggleable and editable percentages */
  financialSummary?: {
    gstEnabled: boolean
    gstPercent: number
    pstEnabled: boolean
    pstPercent: number
    salesTaxEnabled: boolean
    salesTaxPercent: number
    otherEnabled: boolean
    otherAmount: number
  }
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

export function buildInvoicePdf(data: InvoiceRowData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const colWidth = (pageWidth - 2 * margin) / 2
  const leftX = margin
  const rightX = margin + colWidth
  let yLeft = 20
  let yRight = 20

  // INVOICE title at top
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(194, 126, 0)
  doc.text('INVOICE', pageWidth / 2, 15, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  yLeft += 8
  yRight += 8

  // Top row: Company info (left) | LOGO on black circle (right)
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
  yLeft += 12

  // Logo on black circle (right) - enlarged
  const circleRadius = 18
  const circleCenterX = pageWidth - margin - circleRadius
  const circleCenterY = yRight + circleRadius
  doc.setFillColor(0, 0, 0)
  doc.circle(circleCenterX, circleCenterY, circleRadius, 'F')

  if (data.logoDataUrl) {
    try {
      const format = getImageFormatFromDataUrl(data.logoDataUrl)
      const logoSize = 32
      const logoX = circleCenterX - logoSize / 2
      const logoY = circleCenterY - logoSize / 2
      doc.addImage(data.logoDataUrl, format, logoX, logoY, logoSize, logoSize)
    } catch {
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('A', circleCenterX, circleCenterY + 1, { align: 'center' })
      doc.setTextColor(0, 0, 0)
    }
  } else {
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('A', circleCenterX, circleCenterY + 1, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }
  yRight += 10

  // Second row: BILL TO (left) | Invoice No, Issue Date aligned to address bottom (right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('BILL TO', leftX, yLeft)
  yLeft += 6
  doc.setFont('helvetica', 'normal')
  doc.text(data.customerName, leftX, yLeft)
  yLeft += 5
  if (data.phone) {
    doc.text(`Phone: ${data.phone}`, leftX, yLeft)
    yLeft += 5
  }
  if (data.customerAddress) {
    const lines = doc.splitTextToSize(data.customerAddress, colWidth - 4)
    lines.forEach((line: string) => {
      doc.text(line, leftX, yLeft)
      yLeft += 5
    })
    yLeft += 4
  } else {
    yLeft += 4
  }

  // Invoice No and Issue Date bottom-aligned with address (right-aligned)
  const invRightX = pageWidth - margin
  const addressBottomBaseline = yLeft - 9 // baseline of last address line
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Issue Date: ${data.orderDate}`, invRightX, addressBottomBaseline, { align: 'right' })
  doc.text(`Invoice No: ${data.demand_number ?? '—'}`, invRightX, addressBottomBaseline - 6, { align: 'right' })
  yRight = addressBottomBaseline + 8

  let y = Math.max(yLeft, yRight) + 6

  // Line
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 12

  // Items table
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Invoice Details', margin, y)
  y += 8

  const tableData = [
    ['Vehicle & Stock', data.vehicleInfo],
    ['Product Model', data.productModel],
    ['Warranty End', data.warrantyEnd]
  ]

  const invoiceTableWidth = pageWidth - 2 * margin
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [194, 126, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    tableWidth: invoiceTableWidth,
    columnStyles: {
      0: { cellWidth: invoiceTableWidth * 0.28, fontStyle: 'bold' },
      1: { cellWidth: invoiceTableWidth * 0.72 }
    },
    tableLineColor: [60, 60, 60],
    tableLineWidth: 0.2
  })

  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 10

  // Extra editable two-column table: col1=label, col2=amount (CAD)
  const extraRows = (data.extraTableRows ?? []).filter(r => (r.col1 ?? '').trim() || (r.col2 ?? '').trim())
  if (extraRows.length > 0) {
    const fmtCad = (s: string) => {
      const n = parseFloat((s || '0').replace(/[^0-9.-]/g, '')) || 0
      return `$ ${n.toFixed(2)} CAD`
    }
    const extraTableData = extraRows.map(r => [r.col1 || '—', fmtCad(r.col2 || '')])
    autoTable(doc, {
      startY: y,
      head: [['', '']],
      body: extraTableData,
      showHead: 'never' as const,
      theme: 'grid',
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - 2 * margin,
      columnStyles: {
        0: { cellWidth: (pageWidth - 2 * margin) / 2 },
        1: { cellWidth: (pageWidth - 2 * margin) / 2 }
      },
      tableLineColor: [60, 60, 60],
      tableLineWidth: 0.2
    })
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    y += 6
  } else {
    y += 2
  }

  // Comments (left)
  if (data.comments && data.comments !== '—') {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Comments: ${data.comments}`, margin, y)
    y += 6
  }

  // Push financial summary lower
  y += 20

  // Financial summary block (bottom right) - subtotal from extra table col2 sum, then + taxes = total
  const allExtraRows = data.extraTableRows ?? []
  const col2Sum = allExtraRows.reduce((sum, r) => sum + (parseFloat((r.col2 || '0').replace(/[^0-9.-]/g, '')) || 0), 0)
  const totalFromInput = parseFloat((data.totalAmount || '$0').replace(/[^0-9.-]/g, '')) || 0
  const fs = data.financialSummary ?? {
    gstEnabled: true,
    gstPercent: 5,
    pstEnabled: false,
    pstPercent: 7,
    salesTaxEnabled: false,
    salesTaxPercent: 0,
    otherEnabled: false,
    otherAmount: 0
  }
  const other = fs.otherEnabled ? fs.otherAmount : 0
  const taxRatePct = (fs.gstEnabled ? fs.gstPercent : 0) + (fs.pstEnabled ? fs.pstPercent : 0) + (fs.salesTaxEnabled ? fs.salesTaxPercent : 0)
  const subtotal = col2Sum > 0
    ? col2Sum
    : (totalFromInput > 0 && taxRatePct < 100 ? (totalFromInput - other) / (1 + taxRatePct / 100) : Math.max(0, totalFromInput - other))
  const gst = fs.gstEnabled ? subtotal * (fs.gstPercent / 100) : 0
  const pst = fs.pstEnabled ? subtotal * (fs.pstPercent / 100) : 0
  const salesTaxAmount = fs.salesTaxEnabled ? subtotal * (fs.salesTaxPercent / 100) : 0
  const fmt = (n: number) => '$' + n.toFixed(2)
  const summaryColWidth = 58
  const summaryX = pageWidth - margin - summaryColWidth * 2
  const summaryRows: [string, string][] = []
  summaryRows.push(['SUBTOTAL $', fmt(subtotal)])
  if (fs.gstEnabled) summaryRows.push([`GST (${fs.gstPercent}%) $`, fmt(gst)])
  if (fs.pstEnabled) summaryRows.push([`PST (${fs.pstPercent}%) $`, fmt(pst)])
  if (fs.salesTaxEnabled) summaryRows.push([`SALES TAX (${fs.salesTaxPercent}%) $`, fmt(salesTaxAmount)])
  if (fs.otherEnabled) summaryRows.push(['OTHER $', fmt(other)])
  const totalNum = subtotal + gst + pst + salesTaxAmount + other
  summaryRows.push(['TOTAL $', fmt(totalNum)])
  const totalRowIndex = summaryRows.length - 1
  autoTable(doc, {
    startY: y,
    head: [['', '']],
    body: summaryRows,
    showHead: 'never' as const,
    theme: 'plain',
    margin: { left: summaryX },
    columnStyles: {
      0: { cellWidth: summaryColWidth, fontStyle: 'normal' },
      1: { cellWidth: summaryColWidth, halign: 'right' }
    },
    bodyStyles: { fillColor: [248, 248, 248], textColor: [0, 0, 0], fontSize: 10 },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === totalRowIndex) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [220, 220, 220] as [number, number, number]
      }
    }
  })
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 12

  // Footer section - payment notice and thank you
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text('Make all checks payable to ONATCA AUTO', pageWidth / 2, pageHeight - 22, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.text('THANK YOU FOR YOUR BUSINESS!', pageWidth / 2, pageHeight - 14, { align: 'center' })

  // Technical footer
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text(
    `AuroraHub Invoice - Generated ${new Date().toLocaleDateString()} - ${data.demand_number ?? 'Invoice'}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  )

  return doc
}

export function downloadInvoicePdf(data: InvoiceRowData): void {
  const doc = buildInvoicePdf(data)
  const fileName = `Invoice_${data.demand_number ?? 'invoice'}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

/** Returns blob URL for PDF (use in iframe src). Call URL.revokeObjectURL when done. */
export function getInvoicePdfBlobUrl(data: InvoiceRowData): string {
  const doc = buildInvoicePdf(data)
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}

/** Opens PDF in new tab for preview. User can then download from browser's PDF viewer. */
export function previewInvoicePdf(data: InvoiceRowData): void {
  const url = getInvoicePdfBlobUrl(data)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
