import { jsPDF } from 'jspdf'

const AURORA_COMPANY = {
  name: 'AURORA VEHICLES',
  tagline: 'Operational Platform',
  address: '18439 68 Ave, Surrey V3S 9H8',
  contact: 'support@auroravehicles.com',
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(194, 126, 0)
  doc.text(text, 14, y)
  doc.setTextColor(0, 0, 0)
  return y + 8
}

function bodyText(doc: jsPDF, text: string, y: number, maxWidth: number): number {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(text, maxWidth)
  lines.forEach((line: string) => {
    doc.text(line, 14, y)
    y += 5
  })
  return y + 4
}

function bulletItem(doc: jsPDF, text: string, y: number, maxWidth: number): number {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(`• ${text}`, maxWidth)
  lines.forEach((line: string) => {
    doc.text(line, 18, y)
    y += 5
  })
  return y + 2
}

function subSection(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(text, 14, y)
  return y + 6
}

export function buildWhitepaperPdf(): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const maxWidth = pageWidth - 2 * margin

  let y = 20

  // Cover / Title
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(194, 126, 0)
  doc.text('Operational Platform', pageWidth / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(18)
  doc.setTextColor(0, 0, 0)
  doc.text('Whitepaper', pageWidth / 2, y, { align: 'center' })
  y += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(AURORA_COMPANY.name, pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(AURORA_COMPANY.address, pageWidth / 2, y, { align: 'center' })
  y += 5
  doc.text(AURORA_COMPANY.contact, pageWidth / 2, y, { align: 'center' })
  y += 15
  doc.setTextColor(0, 0, 0)

  // Line
  doc.setDrawColor(194, 126, 0)
  doc.line(margin, y, pageWidth - margin, y)
  y += 12

  // 1. Executive Summary
  y = sectionTitle(doc, '1. Executive Summary', y)
  y = bodyText(
    doc,
    'AuroraHub is an integrated operational platform designed to streamline dashcam installation appointment management for Aurora Vehicles and its dealer network. The platform coordinates Sales, Finance, and Specialist roles through a unified workflow—from demand creation and approval to job completion and invoicing.',
    y,
    maxWidth
  )
  y = bodyText(
    doc,
    'This whitepaper describes the platform architecture, core capabilities, operational workflows, and technical foundations that enable efficient appointment scheduling, automated communications (SMS, email), and financial documentation.',
    y,
    maxWidth
  )
  y += 6

  // 2. Platform Overview
  y = sectionTitle(doc, '2. Platform Overview', y)
  y = bodyText(
    doc,
    'AuroraHub centralizes the end-to-end lifecycle of vehicle dashcam installation appointments. Dealers, regions, and users are organized hierarchically. Each appointment (demand) flows through configurable statuses: pending finance approval, approved, completed, or cancelled.',
    y,
    maxWidth
  )
  y = subSection(doc, '2.1 Core Entities', y)
  y = bulletItem(doc, 'Dealers: Physical locations where installations occur', y, maxWidth - 4)
  y = bulletItem(doc, 'Regions: Geographic groupings with timezone support', y, maxWidth - 4)
  y = bulletItem(doc, 'Demands: Appointment requests with vehicle, customer, and specialist details', y, maxWidth - 4)
  y = bulletItem(doc, 'Profiles: Users with roles (Sales, Finance, Specialist, Manager)', y, maxWidth - 4)
  y += 4

  // 3. Role-Based Operations
  y = sectionTitle(doc, '3. Role-Based Operations', y)
  y = subSection(doc, '3.1 Sales', y)
  y = bodyText(
    doc,
    'Creates demands with vehicle info, stock numbers, and appointment dates. Uses calendar integration for availability. Can view reports on demands and appointments.',
    y,
    maxWidth
  )
  y = subSection(doc, '3.2 Finance', y)
  y = bodyText(
    doc,
    'Approves or cancels demands. Approval triggers automated SMS to customer, specialist, and optionally Aurora Managers. Manages rescheduling with appropriate notifications.',
    y,
    maxWidth
  )
  y = subSection(doc, '3.3 Specialist', y)
  y = bodyText(
    doc,
    'Views assigned work list, completes jobs, and receives SMS reminders. Can request manual reminders for upcoming appointments.',
    y,
    maxWidth
  )
  y = subSection(doc, '3.4 Aurora Manager / General Manager', y)
  y = bodyText(
    doc,
    'Full administrative access: employee management, dealer assignment, demand oversight, invoices, statements, system configuration, and centralized logs.',
    y,
    maxWidth
  )
  y += 6

  // Page break if needed
  if (y > pageHeight - 50) {
    doc.addPage()
    y = 20
  }

  // 4. Communication & Automation
  y = sectionTitle(doc, '4. Communication & Automation', y)
  y = subSection(doc, '4.1 SMS System', y)
  y = bodyText(
    doc,
    'Twilio-integrated SMS with configurable templates. Triggers: appointment created, cancellation, rescheduling, and 4-hour (or 2/6 hour) reminder. All templates support placeholders (date, address, phone, signature). Recipients are configurable per trigger.',
    y,
    maxWidth
  )
  y = subSection(doc, '4.2 Email', y)
  y = bodyText(
    doc,
    'SMTP-based email for reports and automation notifications. Configurable for Gmail and other providers. Scheduled report delivery supported.',
    y,
    maxWidth
  )
  y = subSection(doc, '4.3 Cron Jobs', y)
  y = bulletItem(doc, 'Send Reminders: Hourly; sends appointment reminders (configurable hours before)', y, maxWidth - 4)
  y = bulletItem(doc, 'Send Scheduled Reports: Hourly; delivers configured report emails', y, maxWidth - 4)
  y = bulletItem(doc, 'Check Low Stock: Daily; inventory alerts', y, maxWidth - 4)
  y += 4

  // 5. Financial & Documentation
  y = sectionTitle(doc, '5. Financial & Documentation', y)
  y = bodyText(
    doc,
    'Invoice generation for completed demands with vehicle details, warranty, and editable amounts. Google Drive integration: automatic upload to Dealer / Year / Month folders. Statement generation: dealer and date-range filtered summaries with PDF download and Drive save (Statements / Dealer / Year).',
    y,
    maxWidth
  )
  y += 6

  // 6. Technical Architecture
  if (y > pageHeight - 60) {
    doc.addPage()
    y = 20
  }
  y = sectionTitle(doc, '6. Technical Architecture', y)
  y = subSection(doc, '6.1 Stack', y)
  y = bulletItem(doc, 'Frontend: Next.js 16, React 19, Tailwind CSS', y, maxWidth - 4)
  y = bulletItem(doc, 'Backend: Next.js Server Actions, API Routes', y, maxWidth - 4)
  y = bulletItem(doc, 'Database: Supabase (PostgreSQL)', y, maxWidth - 4)
  y = bulletItem(doc, 'Auth: Supabase Auth with role-based profiles', y, maxWidth - 4)
  y = bulletItem(doc, 'SMS: Twilio | Email: Nodemailer / Resend', y, maxWidth - 4)
  y = bulletItem(doc, 'PDF: jsPDF, jspdf-autotable', y, maxWidth - 4)
  y = bulletItem(doc, 'Storage: Google Drive API', y, maxWidth - 4)
  y += 4
  y = subSection(doc, '6.2 Security', y)
  y = bodyText(
    doc,
    'Row-level security (RLS) on Supabase. Role-based access control. Cron endpoints protected by CRON_SECRET. Service account for admin operations (e.g., reminders, reports).',
    y,
    maxWidth
  )
  y += 6

  // 7. Conclusion
  y = sectionTitle(doc, '7. Conclusion', y)
  y = bodyText(
    doc,
    'AuroraHub provides a unified operational platform for dashcam installation appointment management. By combining role-based workflows, automated communications, and integrated financial documentation, it reduces manual coordination and improves visibility across dealers and specialists. The architecture is designed for scalability and extensibility as the network grows.',
    y,
    maxWidth
  )
  y += 10

  // Footer
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text(
    `AuroraHub Operational Platform Whitepaper • ${new Date().toLocaleDateString('en-US')} • Confidential`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  return doc
}

export function downloadWhitepaperPdf(): void {
  const doc = buildWhitepaperPdf()
  const fileName = `AuroraHub_Operational_Platform_Whitepaper_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

export function getWhitepaperPdfBlobUrl(): string {
  const doc = buildWhitepaperPdf()
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}
