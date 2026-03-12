'use client'

import { useState } from 'react'
import { RescheduleDemandModal } from './reschedule-demand-modal'

interface Demand {
  id: string
  status?: string
  demand_number?: number | string
  dealer_id?: string | null
  is_external?: boolean | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  customer_address: string | null
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  stock_number: string | null
  camera_model: string
  appointment_date: string
  dealers?: { region_codes?: { timezone_id?: string; timezones?: { name: string } } } | null
}

interface RescheduleDemandButtonProps {
  demand: Demand
}

export function RescheduleDemandButton({ demand }: RescheduleDemandButtonProps) {
  const [open, setOpen] = useState(false)
  if (demand.status === 'cancelled') return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
      >
        Reschedule / Edit
      </button>
      <RescheduleDemandModal demand={demand} isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}
