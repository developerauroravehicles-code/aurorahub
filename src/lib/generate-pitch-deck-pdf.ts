import { jsPDF } from 'jspdf'

const AMBER = { r: 194, g: 126, b: 0 }
const AMBER_LIGHT = { r: 255, g: 248, b: 235 }
const GRAY = { r: 100, g: 100, b: 100 }
const GRAY_DARK = { r: 55, g: 65, b: 81 }
const PAGE_MARGIN = 22
const SLIDE_MAX_WIDTH = 210 - 2 * PAGE_MARGIN

function getImageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
  return 'PNG'
}

function newSlide(doc: jsPDF, title?: string): number {
  doc.addPage()
  // Header accent bar
  doc.setFillColor(AMBER.r, AMBER.g, AMBER.b)
  doc.rect(0, 0, 210, 4, 'F')
  let y = 32
  if (title) {
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(AMBER.r, AMBER.g, AMBER.b)
    doc.text(title, PAGE_MARGIN, y)
    doc.setTextColor(0, 0, 0)
    y += 16
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.line(PAGE_MARGIN, y - 4, 210 - PAGE_MARGIN, y - 4)
    y += 12
  }
  return y
}

function bodyText(doc: jsPDF, text: string, y: number, maxWidth = SLIDE_MAX_WIDTH, fontSize = 11): number {
  doc.setFontSize(fontSize)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(text, maxWidth)
  lines.forEach((line: string) => {
    doc.text(line, PAGE_MARGIN, y)
    y += 6
  })
  return y + 6
}

function bulletItem(doc: jsPDF, text: string, y: number, maxWidth = SLIDE_MAX_WIDTH - 8): number {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  // Amber bullet
  doc.setFillColor(AMBER.r, AMBER.g, AMBER.b)
  doc.circle(PAGE_MARGIN + 3, y - 1.5, 1.2, 'F')
  const lines = doc.splitTextToSize(text, maxWidth)
  lines.forEach((line: string, i: number) => {
    doc.text(line, PAGE_MARGIN + 8, y)
    y += 6
  })
  return y + 4
}

function subTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(GRAY_DARK.r, GRAY_DARK.g, GRAY_DARK.b)
  doc.text(text, PAGE_MARGIN, y)
  doc.setTextColor(0, 0, 0)
  return y + 12
}

const CONTACT = {
  name: 'Dogukan Kardas',
  email: 'doukan.krdas@gmail.com',
  linkedin: 'https://www.linkedin.com/in/doukan-krdas/',
  github: 'https://github.com/DogukanKardas',
}

export interface PitchDeckOptions {
  logoDataUrl?: string | null
}

export function buildPitchDeckPdf(options: PitchDeckOptions = {}): jsPDF {
  const { logoDataUrl } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y: number

  // ─── SLIDE 1: Cover ───
  // Top accent bar
  doc.setFillColor(AMBER.r, AMBER.g, AMBER.b)
  doc.rect(0, 0, 210, 6, 'F')
  doc.setFillColor(AMBER_LIGHT.r, AMBER_LIGHT.g, AMBER_LIGHT.b)
  doc.rect(0, 6, 210, 20, 'F')

  y = 45
  // Logo (if available)
  if (logoDataUrl) {
    try {
      const format = getImageFormatFromDataUrl(logoDataUrl)
      const logoSize = 36
      const logoX = (pageWidth - logoSize) / 2
      doc.addImage(logoDataUrl, format, logoX, y - logoSize / 2, logoSize, logoSize)
      y += logoSize / 2 + 8
    } catch {
      // Fallback: "A" initial
      doc.setFontSize(36)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(AMBER.r, AMBER.g, AMBER.b)
      doc.text('A', pageWidth / 2, y + 5, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      y += 20
    }
  } else {
    doc.setFontSize(36)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(AMBER.r, AMBER.g, AMBER.b)
    doc.text('A', pageWidth / 2, y + 5, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    y += 20
  }

  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(AMBER.r, AMBER.g, AMBER.b)
  doc.text('AuroraHub', pageWidth / 2, y, { align: 'center' })
  y += 14
  doc.setFontSize(18)
  doc.setTextColor(0, 0, 0)
  doc.text('Operational Platform', pageWidth / 2, y, { align: 'center' })
  y += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY.r, GRAY.g, GRAY.b)
  doc.text('Dashcam Installation Management for Dealer Networks', pageWidth / 2, y, { align: 'center' })
  y += 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.text('AURORA VEHICLES', pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(GRAY.r, GRAY.g, GRAY.b)
  doc.text('18439 68 Ave, Surrey V3S 9H8 • support@auroravehicles.com', pageWidth / 2, y, { align: 'center' })

  // ─── SLIDE 2: Problem ───
  y = newSlide(doc, 'Problem')
  y = bodyText(doc, 'Dealer networks struggle with fragmented appointment management:', y, SLIDE_MAX_WIDTH, 12)
  y += 6
  y = bulletItem(doc, 'Complex coordination between Sales, Finance, and Specialists', y)
  y = bulletItem(doc, 'Manual tracking of appointments and follow-ups', y)
  y = bulletItem(doc, 'Scattered documentation and invoicing', y)
  y = bulletItem(doc, 'No unified visibility across locations', y)

  // ─── SLIDE 3: Solution ───
  y = newSlide(doc, 'Solution')
  y = bodyText(
    doc,
    'AuroraHub provides a single platform for the complete appointment lifecycle—from creation to approval, completion, and invoicing.',
    y,
    SLIDE_MAX_WIDTH,
    12
  )
  y += 8
  y = bulletItem(doc, 'Role-based workflows: Sales, Finance, Specialist, Manager', y)
  y = bulletItem(doc, 'Automated SMS (Twilio) and email notifications', y)
  y = bulletItem(doc, 'Calendar integration and configurable reminders', y)
  y = bulletItem(doc, 'Integrated invoicing and Google Drive backup', y)

  // ─── SLIDE 4: How It Works ───
  y = newSlide(doc, 'How It Works')
  y = subTitle(doc, 'Sales', y)
  y = bodyText(doc, 'Creates demands with vehicle info, customer details, and appointment dates. Uses calendar for availability.', y)
  y = subTitle(doc, 'Finance', y)
  y = bodyText(doc, 'Approves or cancels demands. Approval triggers automated SMS to customer and specialist.', y)
  y = subTitle(doc, 'Specialist', y)
  y = bodyText(doc, 'Views work list, completes jobs, receives reminders. Can request manual notifications.', y)
  y = subTitle(doc, 'Manager', y)
  y = bodyText(doc, 'Full oversight: employees, dealers, demands, invoices, statements, system configuration.', y)

  // ─── SLIDE 5: Key Features ───
  y = newSlide(doc, 'Key Features')
  y = bulletItem(doc, 'Calendar integration and region-based scheduling', y)
  y = bulletItem(doc, 'Automated reminder SMS (configurable: 2h, 4h, 6h before)', y)
  y = bulletItem(doc, 'Invoice and statement PDF generation', y)
  y = bulletItem(doc, 'Google Drive: automatic Dealer / Year / Month folder structure', y)
  y = bulletItem(doc, 'Dealers, regions, and timezone support', y)
  y = bulletItem(doc, 'Scheduled reports and low-stock alerts', y)

  // ─── SLIDE 6: Tech Stack ───
  y = newSlide(doc, 'Technical Architecture')
  y = subTitle(doc, 'Stack', y)
  y = bulletItem(doc, 'Frontend: Next.js 16, React 19, Tailwind CSS', y)
  y = bulletItem(doc, 'Backend: Next.js Server Actions, Supabase (PostgreSQL)', y)
  y = bulletItem(doc, 'Auth: Supabase Auth with role-based profiles', y)
  y = bulletItem(doc, 'SMS: Twilio | Email: Resend / Nodemailer', y)
  y = bulletItem(doc, 'Storage: Google Drive API', y)
  y += 6
  y = subTitle(doc, 'Security', y)
  y = bodyText(doc, 'Row-level security (RLS), role-based access control, protected cron endpoints.', y)

  // ─── SLIDE 7: Traction ───
  y = newSlide(doc, 'Traction')
  y = subTitle(doc, 'Use Case: Aurora Vehicles (Canada)', y)
  y = bodyText(
    doc,
    'AuroraHub is developed and operated for Aurora Vehicles, streamlining dashcam installation appointments across their dealer network. The platform is in active use for demand management, automated communications, invoicing, and reporting.',
    y
  )

  // ─── SLIDE 8: CTA ───
  y = newSlide(doc, 'Your Contact Information')
  y = bodyText(doc, 'Developed and operated for Aurora Vehicles (Canada)', y)
  y = bodyText(doc, 'Available for custom deployment and operational integration', y)
  y += 14
  const nameX = PAGE_MARGIN
  if (logoDataUrl) {
    try {
      const format = getImageFormatFromDataUrl(logoDataUrl)
      const logoSize = 20
      doc.addImage(logoDataUrl, format, PAGE_MARGIN, y - 2, logoSize, logoSize)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(CONTACT.name, PAGE_MARGIN + logoSize + 8, y + 8)
    } catch {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(CONTACT.name, nameX, y + 6)
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(CONTACT.name, nameX, y + 6)
  }
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Email: ${CONTACT.email}`, PAGE_MARGIN, y)
  y += 8
  doc.text(`LinkedIn: ${CONTACT.linkedin}`, PAGE_MARGIN, y)
  y += 7
  doc.text(`GitHub: ${CONTACT.github}`, PAGE_MARGIN, y)

  // Footer on last page
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text(
    `AuroraHub Pitch Deck • ${new Date().toLocaleDateString('en-US')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  return doc
}

export function downloadPitchDeckPdf(options: PitchDeckOptions = {}): void {
  const doc = buildPitchDeckPdf(options)
  const fileName = `AuroraHub_Pitch_Deck_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

export function getPitchDeckPdfBlobUrl(options: PitchDeckOptions = {}): string {
  const doc = buildPitchDeckPdf(options)
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}
