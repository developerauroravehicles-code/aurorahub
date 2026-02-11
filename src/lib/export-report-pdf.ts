import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number }
}

export interface ReportDemandRow {
  customer: string
  vehicle: string
  camera: string
  appointment: string
  status: string
  created: string
}

export interface ExportReportOptions {
  reportTitle: string
  dateRange: string
  exporterFullName: string
  exporterEmail: string
  appliedFilters?: string[]
  totalDemands: number
  totalAppointments: number
  cameraCounts: Record<string, number>
  statusCounts: Record<string, number>
  vehicleMakeCounts: Record<string, number>
  demands: ReportDemandRow[]
}

function buildReportPdf(options: ExportReportOptions): jsPDF {
  const {
    reportTitle,
    dateRange,
    exporterFullName,
    exporterEmail,
    appliedFilters,
    totalDemands,
    totalAppointments,
    cameraCounts,
    statusCounts,
    vehicleMakeCounts,
    demands,
  } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(reportTitle, 14, yPos)
  yPos += 8

  // Date range
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Date Range: ${dateRange}`, 14, yPos)
  yPos += 6

  // Applied filters (if any)
  if (appliedFilters && appliedFilters.length > 0) {
    appliedFilters.forEach((filter) => {
      doc.text(filter, 14, yPos)
      yPos += 5
    })
    yPos += 2
  }

  // Exported by
  doc.text(`Exported by: ${exporterFullName || 'N/A'}`, 14, yPos)
  doc.text(`Email: ${exporterEmail || 'N/A'}`, 14, yPos + 5)
  yPos += 12

  // Summary stats
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Total Demands: ${totalDemands}`, 14, yPos)
  doc.text(`Total Appointments: ${totalAppointments}`, 70, yPos)
  yPos += 12

  // Camera Models
  if (Object.keys(cameraCounts).length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Camera Models', 14, yPos)
    yPos += 6

    const cameraData = Object.entries(cameraCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([camera, count]) => [
        camera,
        String(count),
        totalDemands > 0 ? `${Math.round((count / totalDemands) * 100)}%` : '0%',
      ])

    autoTable(doc, {
      startY: yPos,
      head: [['Camera', 'Count', '%']],
      body: cameraData,
      theme: 'grid',
      headStyles: { fillColor: [194, 126, 0] },
      margin: { left: 14 },
    })
    yPos = (doc as JsPDFWithAutoTable).lastAutoTable!.finalY + 12
  }

  // Status Breakdown
  if (Object.keys(statusCounts).length > 0) {
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Status Breakdown', 14, yPos)
    yPos += 6

    const statusData = Object.entries(statusCounts).map(([status, count]) => [
      status.replace('_', ' ').toUpperCase(),
      String(count),
      totalDemands > 0 ? `${Math.round((count / totalDemands) * 100)}%` : '0%',
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Status', 'Count', '%']],
      body: statusData,
      theme: 'grid',
      headStyles: { fillColor: [194, 126, 0] },
      margin: { left: 14 },
    })
    yPos = (doc as JsPDFWithAutoTable).lastAutoTable!.finalY + 12
  }

  // Vehicle Makes
  if (Object.keys(vehicleMakeCounts).length > 0) {
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Vehicle Makes', 14, yPos)
    yPos += 6

    const vehicleData = Object.entries(vehicleMakeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([make, count]) => [
        make,
        String(count),
        totalDemands > 0 ? `${Math.round((count / totalDemands) * 100)}%` : '0%',
      ])

    autoTable(doc, {
      startY: yPos,
      head: [['Make', 'Count', '%']],
      body: vehicleData,
      theme: 'grid',
      headStyles: { fillColor: [194, 126, 0] },
      margin: { left: 14 },
    })
    yPos = (doc as JsPDFWithAutoTable).lastAutoTable!.finalY + 12
  }

  // Detailed Demand List
  if (demands.length > 0) {
    if (yPos > 230) {
      doc.addPage()
      yPos = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Detailed Demand List', 14, yPos)
    yPos += 6

    const demandRows = demands.map((d) => [
      d.customer,
      d.vehicle,
      d.camera,
      d.appointment,
      d.status,
      d.created,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Customer', 'Vehicle', 'Camera', 'Appointment', 'Status', 'Created']],
      body: demandRows,
      theme: 'grid',
      headStyles: { fillColor: [194, 126, 0], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
      },
      margin: { left: 14 },
    })
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Page ${i} of ${pageCount} - AuroraHub Report - Generated ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  return doc
}

/** Returns base64 string of the PDF (for email attachment) */
export function generateReportPdfBase64(options: ExportReportOptions): string {
  const doc = buildReportPdf(options)
  const dataUri = doc.output('datauristring')
  return dataUri.split(',')[1] ?? ''
}

export function exportReportToPdf(options: ExportReportOptions): void {
  const doc = buildReportPdf(options)
  const fileName = `${options.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}
