'use client'

import { forwardRef } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import type { DemandHandoffDemand } from '@/app/dashboard/sales/demands/new/actions'
import { warrantyPeriodDescription } from '@/lib/warranty-period'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { DashcamAppQrGrid } from '@/components/dashcam-app-qr-grid'
import './demand-customer-handoff-print.css'

export type DemandHandoffPrintData = {
  demand: DemandHandoffDemand
  dealer: { name: string; warranty_years: number | null }
  timezoneName: string | null
  onPrintReadyChange?: (ready: boolean) => void
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div className="demand-handoff-row">
      <span className="demand-handoff-label">{label}</span>
      <span className="demand-handoff-value">{value}</span>
    </div>
  )
}

export const DemandCustomerHandoffPrint = forwardRef<HTMLDivElement, DemandHandoffPrintData>(
  function DemandCustomerHandoffPrint({ demand, dealer, timezoneName, onPrintReadyChange }, ref) {
    const tz = timezoneName ?? SYSTEM_DEFAULT_TIMEZONE
    const createdAt = demand.created_at
      ? formatInTimeZone(new Date(demand.created_at), tz, 'MMMM d, yyyy h:mm a')
      : '—'
    const appointmentAt = demand.appointment_date
      ? formatInTimeZone(new Date(demand.appointment_date), tz, 'EEEE, MMMM d, yyyy · h:mm a')
      : '—'
    const warrantyDesc = warrantyPeriodDescription({
      name: dealer.name,
      warranty_years: dealer.warranty_years,
    })

    return (
      <div ref={ref} className="demand-handoff-print-root" aria-hidden="true">
        <div className="demand-handoff-sheet">
          <header className="demand-handoff-header">
            <h1>Aurora Vehicles Incorporation</h1>
            <p>
              Customer Installation Summary
              {demand.demand_number != null ? ` · Demand #${demand.demand_number}` : ''}
            </p>
            <p>Created {createdAt}</p>
          </header>

          <section className="demand-handoff-section">
            <h2 className="demand-handoff-section-title">Customer Information</h2>
            <div className="demand-handoff-grid">
              <Field label="First Name" value={demand.customer_firstname} />
              <Field label="Last Name" value={demand.customer_lastname} />
              <Field label="Phone" value={demand.customer_phone} />
              <Field label="Address" value={demand.customer_address ?? dealer.name} />
            </div>
          </section>

          <section className="demand-handoff-section">
            <h2 className="demand-handoff-section-title">Vehicle Information</h2>
            <div className="demand-handoff-grid">
              <Field label="Make" value={demand.vehicle_make} />
              <Field label="Model" value={demand.vehicle_model} />
              <Field label="Year" value={demand.vehicle_year} />
              <Field label="Stock Number" value={demand.stock_number} />
              <Field label="VIN (Last 6)" value={demand.vin_last6} />
              <Field label="Camera Model" value={demand.camera_model} />
            </div>
          </section>

          <section className="demand-handoff-section">
            <h2 className="demand-handoff-section-title">Appointment</h2>
            <div className="demand-handoff-grid">
              <Field label="Scheduled Date & Time" value={appointmentAt} />
              <Field label="Dealer" value={dealer.name} />
              {demand.comment ? (
                <div className="demand-handoff-row demand-handoff-full">
                  <span className="demand-handoff-label">Notes</span>
                  <span className="demand-handoff-value">{demand.comment}</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="demand-handoff-section demand-handoff-warranty">
            <h2 className="demand-handoff-section-title">Warranty Information</h2>
            <p className="demand-handoff-value" style={{ margin: 0 }}>
              Warranty coverage begins after your installation is marked completed.
            </p>
            <ul>
              <li>Covers workmanship related to your dashcam installation.</li>
              <li>
                Standard installation warranty period is {warrantyDesc} from the completion date.
              </li>
              <li>Contact your dealer for warranty service or questions.</li>
              <li>
                Included SD card warranty: 6 months from installation completion (when applicable).
              </li>
            </ul>
          </section>

          <div className="demand-handoff-tail">
            <section className="demand-handoff-section">
              <h2 className="demand-handoff-section-title">Customer Resources</h2>
              <p className="demand-handoff-value" style={{ margin: '0 0 4px', fontSize: '9pt', color: '#52525b' }}>
                Scan the QR codes below for customer support, portal access, and the dashcam mobile app for your
                camera model.
              </p>
              <DashcamAppQrGrid
                cameraModel={demand.camera_model}
                variant="print"
                onReadyChange={onPrintReadyChange}
              />
            </section>

            <footer className="demand-handoff-footer">
              <p style={{ margin: 0 }}>
                For your information only. This document does not include pricing, billing, or payment
                details. For invoice requests, please contact your dealer directly.
              </p>
            </footer>
          </div>
        </div>
      </div>
    )
  }
)

export async function printDemandHandoffSheet(root: HTMLDivElement | null) {
  if (!root) return

  document.querySelectorAll('.demand-handoff-print-root').forEach((el) => {
    el.classList.remove('demand-handoff-print-active')
  })
  root.classList.add('demand-handoff-print-active')

  const images = root.querySelectorAll('img')
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
    )
  )

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      root.classList.remove('demand-handoff-print-active')
      window.removeEventListener('afterprint', cleanup)
      resolve()
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  })
}
