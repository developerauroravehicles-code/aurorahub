import { jsPDF } from 'jspdf'

const AURORA_COMPANY = {
  name: 'AURORA VEHICLES INC.',
  address: '18439 68 Ave, Surrey BC V3S 9H8',
  phone: '604 833 5801',
  email: 'support@auroravehicles.com',
} as const

function isSectionHeader(line: string): boolean {
  const t = line.trim()
  if (!t || t === '---') return false
  if (/^SECTION \d+/i.test(t)) return true
  if (/^\d+\.\d+\s/.test(t)) return true
  if (t.length <= 55 && t === t.toUpperCase() && /[A-Z]/.test(t) && !t.includes('{{')) return true
  return false
}

function isSubHeader(line: string): boolean {
  return /^\d+\.\d+\s/.test(line.trim())
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text('Confidential — Aurora Vehicles Inc.', 18, pageHeight - 10)
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 18, pageHeight - 10, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

export function buildCompliancePdf(documentTitle: string, mergedBody: string): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  const maxWidth = pageWidth - margin * 2
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(194, 126, 0)
  doc.text(AURORA_COMPANY.name, margin, y)
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  y += 4
  doc.text(AURORA_COMPANY.address, margin, y)
  y += 3.5
  doc.text(`${AURORA_COMPANY.phone}  •  ${AURORA_COMPANY.email}`, margin, y)
  y += 8

  doc.setDrawColor(194, 126, 0)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(documentTitle, margin, y)
  y += 9

  const bodyLines = mergedBody.split('\n')
  let lineIndex = 0
  while (lineIndex < bodyLines.length && bodyLines[lineIndex]?.trim() === '') lineIndex++
  if (bodyLines[lineIndex]?.trim().toUpperCase() === documentTitle.toUpperCase()) {
    lineIndex++
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage()
      y = margin
    }
  }

  for (; lineIndex < bodyLines.length; lineIndex++) {
    const raw = bodyLines[lineIndex] ?? ''
    const line = raw.trimEnd()

    if (line.trim() === '---') {
      ensureSpace(8)
      y += 3
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.2)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6
      continue
    }

    if (line.trim() === '') {
      y += 3
      continue
    }

    if (isSectionHeader(line)) {
      ensureSpace(12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(isSubHeader(line) ? 10 : 11)
      const wrapped = doc.splitTextToSize(line.trim(), maxWidth) as string[]
      for (const wLine of wrapped) {
        ensureSpace(6)
        doc.text(wLine, margin, y)
        y += isSubHeader(line) ? 5.5 : 6
      }
      y += 2
      continue
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const wrapped = doc.splitTextToSize(line, maxWidth) as string[]
    for (const wLine of wrapped) {
      ensureSpace(5)
      doc.text(wLine, margin, y)
      y += 5
    }
  }

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    addPageFooter(doc, p, totalPages)
  }

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
