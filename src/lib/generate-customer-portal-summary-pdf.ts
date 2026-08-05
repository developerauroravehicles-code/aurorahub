import { formatInTimeZone } from 'date-fns-tz'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CustomerPortalRow } from '@/types/customer-portal'
import {
  dealerTimezone,
  resolveAppointmentAddress,
  serviceTypeLabel,
  statusLabel,
} from '@/lib/customer-portal-utils'
import {
  warrantyBadgeLabel,
  warrantyPeriodDescription,
} from '@/lib/warranty-period'
import {
  CUSTOMER_PORTAL_QR_PATH,
  resolveDashcamAppLinks,
} from '@/lib/dashcam-app-links'
import { generateQrDataUrl, loadImageAsDataUrl } from '@/lib/generate-qr-data-url'

export type CustomerPortalSummaryPdfData = {
  row: CustomerPortalRow
  watermarkDataUrl?: string | null
}

const AURORA_GOLD: [number, number, number] = [194, 126, 0]
const AURORA_GOLD_LIGHT: [number, number, number] = [255, 247, 230]
const INK: [number, number, number] = [24, 24, 27]
const MUTED: [number, number, number] = [113, 113, 122]
const BORDER: [number, number, number] = [228, 228, 231]
const WHITE: [number, number, number] = [255, 255, 255]

const COMPANY_NAME = 'Aurora Vehicles Incorporation'

function drawPageWatermark(
  doc: jsPDF,
  watermarkDataUrl: string,
  pageWidth: number,
  pageHeight: number
) {
  const wmSize = Math.min(pageWidth, pageHeight) * 0.72
  const x = (pageWidth - wmSize) / 2
  const y = (pageHeight - wmSize) / 2

  try {
    doc.addImage(watermarkDataUrl, 'PNG', x, y, wmSize, wmSize, undefined, 'FAST')
  } catch {
    /* optional watermark */
  }
}

function statusColors(status: string): { fill: [number, number, number]; text: [number, number, number] } {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return { fill: [220, 252, 231], text: [22, 101, 52] }
  if (s === 'approved') return { fill: [219, 234, 254], text: [29, 78, 216] }
  if (s === 'pending_finance') return { fill: [254, 243, 199], text: [180, 83, 9] }
  return { fill: [244, 244, 245], text: [63, 63, 70] }
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setFillColor(...AURORA_GOLD)
  doc.rect(margin, y, 3, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(title, margin + 6, y + 5)
  return y + 12
}

function drawStatusBadge(
  doc: jsPDF,
  status: string,
  x: number,
  y: number,
  align: 'left' | 'right' = 'right'
) {
  const label = statusLabel(status).toUpperCase()
  const { fill, text } = statusColors(status)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const padX = 4
  const w = doc.getTextWidth(label) + padX * 2
  const h = 6
  const bx = align === 'right' ? x - w : x
  doc.setFillColor(...fill)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(bx, y - 4.5, w, h, 1.5, 1.5, 'FD')
  doc.setTextColor(...text)
  doc.text(label, bx + padX, y)
}

function addDetailTable(
  doc: jsPDF,
  startY: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  rows: [string, string][],
  watermarkDataUrl?: string | null
): number {
  const tableWidth = pageWidth - margin * 2
  autoTable(doc, {
    startY,
    body: rows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    tableWidth,
    willDrawPage: (data) => {
      if (watermarkDataUrl && data.pageNumber > 1) {
        drawPageWatermark(doc, watermarkDataUrl, pageWidth, pageHeight)
      }
    },
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: INK,
      valign: 'top',
    },
    columnStyles: {
      0: {
        cellWidth: tableWidth * 0.34,
        fontStyle: 'bold',
        textColor: MUTED,
      },
      1: { cellWidth: tableWidth * 0.66 },
    },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fillColor = [248, 248, 250]
      }
    },
  })
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY
}

function drawCustomerResourcesQrRow(
  doc: jsPDF,
  y: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  cameraModel: string | null | undefined,
  portalQrDataUrl: string,
  iosQrDataUrl: string,
  androidQrDataUrl: string,
  watermarkDataUrl?: string | null
): number {
  const contentWidth = pageWidth - margin * 2
  const qrSize = 24
  const headerH = 5
  const gap = (contentWidth - qrSize * 3) / 2
  const sectionHeight = headerH + qrSize + 12

  if (y + sectionHeight + 24 > pageHeight - margin) {
    doc.addPage()
    if (watermarkDataUrl) {
      drawPageWatermark(doc, watermarkDataUrl, pageWidth, pageHeight)
    }
    y = margin
  }

  y = drawSectionTitle(doc, 'Customer Resources', y, margin)

  const links = resolveDashcamAppLinks(cameraModel)
  const items = [
    { heading: 'Customer Portal', sub: 'Support & portal', dataUrl: portalQrDataUrl },
    { heading: 'IOS', sub: `${links.appName} · Download`, dataUrl: iosQrDataUrl },
    { heading: 'Android', sub: `${links.appName} · Download`, dataUrl: androidQrDataUrl },
  ]

  items.forEach((item, index) => {
    const x = margin + index * (qrSize + gap)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK)
    doc.text(item.heading, x + qrSize / 2, y + 3.5, { align: 'center', maxWidth: qrSize + 8 })

    const qrY = y + headerH
    doc.setDrawColor(...BORDER)
    doc.setFillColor(...WHITE)
    doc.roundedRect(x, qrY, qrSize, qrSize, 2, 2, 'FD')

    try {
      doc.addImage(item.dataUrl, 'PNG', x + 1, qrY + 1, qrSize - 2, qrSize - 2, undefined, 'FAST')
    } catch {
      /* optional QR image */
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(item.sub, x + qrSize / 2, qrY + qrSize + 4, { align: 'center', maxWidth: qrSize + 8 })
  })

  return y + sectionHeight + 4
}

export async function buildCustomerPortalSummaryPdf(data: CustomerPortalSummaryPdfData): Promise<jsPDF> {
  const { row, watermarkDataUrl } = data
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  if (watermarkDataUrl) {
    drawPageWatermark(doc, watermarkDataUrl, pageWidth, pageHeight)
  }

  const tz = dealerTimezone(row)
  const ref = row.demand_number ? `#${row.demand_number}` : 'Reference pending'
  const vehicle = `${row.vehicle_year} ${row.vehicle_make} ${row.vehicle_model}`.trim() || 'Your vehicle'
  const appt = row.appointment_date
    ? formatInTimeZone(new Date(row.appointment_date), tz, 'EEEE, MMMM d, yyyy · h:mm a zzz')
    : '—'
  const completed = row.completed_at
    ? formatInTimeZone(new Date(row.completed_at), tz, 'MMMM d, yyyy')
    : '—'
  const warranty = row.warranty_end
    ? formatInTimeZone(new Date(`${row.warranty_end}T12:00:00Z`), tz, 'MMMM d, yyyy')
    : 'Available after installation is completed'
  const generatedAt = formatInTimeZone(new Date(), tz, 'MMMM d, yyyy · h:mm a zzz')

  // Header band
  doc.setFillColor(...AURORA_GOLD)
  doc.rect(0, 0, pageWidth, 38, 'F')
  doc.setFillColor(170, 110, 0)
  doc.rect(0, 36, pageWidth, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...WHITE)
  doc.text('Installation Summary', pageWidth / 2, 16, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(255, 245, 220)
  doc.text(COMPANY_NAME, pageWidth / 2, 23, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(ref, pageWidth - margin, 32, { align: 'right' })

  let y = 48

  // Vehicle hero card
  doc.setFillColor(...WHITE)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.text(vehicle, margin + 6, y + 10)

  drawStatusBadge(doc, row.status, pageWidth - margin - 6, y + 10, 'right')

  const greeting = row.customer_firstname?.trim()
  if (greeting) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(`Prepared for ${greeting}`, margin + 6, y + 17)
  }

  y += 30

  // Vehicle & service
  y = drawSectionTitle(doc, 'Vehicle & Service', y, margin)
  const vehicleRows: [string, string][] = [
    ['Reference', ref],
    ['Status', statusLabel(row.status)],
    ['Vehicle', vehicle],
    ['Dealer', row.dealer_name || '—'],
    ['Service type', serviceTypeLabel(row.service_type)],
    ['Camera / dashcam', row.camera_model || '—'],
  ]
  if (row.stock_number?.trim()) {
    vehicleRows.splice(3, 0, ['Stock number', row.stock_number.trim()])
  }
  y = addDetailTable(doc, y, margin, pageWidth, pageHeight, vehicleRows, watermarkDataUrl) + 8

  // Appointment & location
  y = drawSectionTitle(doc, 'Appointment & Location', y, margin)
  y =
    addDetailTable(doc, y, margin, pageWidth, pageHeight, [
      ['Appointment', appt],
      ['Installation location', resolveAppointmentAddress(row) || '—'],
      ['Dealer address', row.dealer_address?.trim() || '—'],
    ], watermarkDataUrl) + 8

  // Warranty & completion
  y = drawSectionTitle(doc, 'Warranty & Completion', y, margin)
  y =
    addDetailTable(doc, y, margin, pageWidth, pageHeight, [
      ['Completed on', completed],
      ['Warranty valid until', warranty],
      ['Installation specialist', row.specialist_name || '—'],
    ], watermarkDataUrl) + 6

  // Warranty highlight box
  const warrantyBoxH = 18
  if (y + warrantyBoxH + 24 > pageHeight - margin) {
    doc.addPage()
    if (watermarkDataUrl) {
      drawPageWatermark(doc, watermarkDataUrl, pageWidth, pageHeight)
    }
    y = margin
  }

  doc.setFillColor(...AURORA_GOLD_LIGHT)
  doc.setDrawColor(...AURORA_GOLD)
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, y, contentWidth, warrantyBoxH, 2.5, 2.5, 'FD')
  doc.setLineWidth(0.2)

  doc.setFillColor(...AURORA_GOLD)
  doc.circle(margin + 8, y + 9, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text(warrantyBadgeLabel({ name: row.dealer_name, warranty_years: row.dealer_warranty_years }), margin + 8, y + 10.2, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text('Installation warranty coverage', margin + 16, y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const warrantyNote =
    row.warranty_end && row.status.toLowerCase() === 'completed'
      ? `Workmanship warranty is active through ${warranty}. Contact your dealer for service claims.`
      : `Standard ${warrantyPeriodDescription({ name: row.dealer_name, warranty_years: row.dealer_warranty_years })} workmanship warranty begins when your installation is marked completed.`
  doc.text(warrantyNote, margin + 16, y + 13.5, { maxWidth: contentWidth - 22 })

  y += warrantyBoxH + 10

  const links = resolveDashcamAppLinks(row.camera_model)
  const [portalQrDataUrl, iosQrDataUrl, androidQrDataUrl] = await Promise.all([
    loadImageAsDataUrl(CUSTOMER_PORTAL_QR_PATH),
    generateQrDataUrl(links.iosUrl, 256),
    generateQrDataUrl(links.androidUrl, 256),
  ])

  y = drawCustomerResourcesQrRow(
    doc,
    y,
    margin,
    pageWidth,
    pageHeight,
    row.camera_model,
    portalQrDataUrl,
    iosQrDataUrl,
    androidQrDataUrl,
    watermarkDataUrl
  )

  // Footer
  const footerY = pageHeight - 22
  doc.setDrawColor(...BORDER)
  doc.line(margin, footerY, pageWidth - margin, footerY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(
    'This summary is for your records only. For billing or invoice requests, please contact your dealer directly.',
    margin,
    footerY + 6,
    { maxWidth: contentWidth }
  )
  doc.text(`Generated ${generatedAt} · ${COMPANY_NAME}`, margin, footerY + 12)

  return doc
}

export async function downloadCustomerPortalSummaryPdf(data: CustomerPortalSummaryPdfData): Promise<void> {
  const { loadInstallationSummaryWatermark } = await import('./installation-summary-watermark')
  const watermarkDataUrl = await loadInstallationSummaryWatermark()
  const doc = await buildCustomerPortalSummaryPdf({ ...data, watermarkDataUrl })
  const ref = data.row.demand_number ?? 'installation'
  doc.save(`Aurora_Installation_Summary_${ref}.pdf`)
}
