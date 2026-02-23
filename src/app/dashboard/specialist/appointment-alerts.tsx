'use client'

import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export interface AppointmentAlert {
  id: string
  appointment_date: string
  customer_firstname: string
  customer_lastname: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  camera_model: string
  customer_address: string | null
  stock_number: string | null
  timezoneName?: string | null
}

interface AppointmentAlertsProps {
  appointments: AppointmentAlert[]
}

type AlertStatus = 'overdue' | 'today' | 'tomorrow' | 'normal'

function getAlertStatus(appointmentDate: string): AlertStatus {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  
  const appointment = new Date(appointmentDate)
  appointment.setHours(0, 0, 0, 0)
  
  const diffTime = appointment.getTime() - now.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  return 'normal'
}

function getStatusColor(status: AlertStatus): string {
  switch (status) {
    case 'overdue':
      return 'bg-red-900/30 border-red-800 text-red-200'
    case 'today':
      return 'bg-blue-900/30 border-blue-800 text-blue-200'
    case 'tomorrow':
      return 'bg-yellow-900/30 border-yellow-800 text-yellow-200'
    default:
      return 'bg-white/5 border-gray-800 text-gray-300'
  }
}

function getStatusLabel(status: AlertStatus): string {
  switch (status) {
    case 'overdue':
      return 'OVERDUE'
    case 'today':
      return 'TODAY'
    case 'tomorrow':
      return 'TOMORROW'
    default:
      return ''
  }
}

export function AppointmentAlerts({ appointments }: AppointmentAlertsProps) {
  // 4-hour reminder SMS now sent by cron to both customer and specialist at the same time (see send-reminders API)

  // Filter appointments to show only overdue, today, and tomorrow
  const filteredAppointments = appointments.filter(apt => {
    const status = getAlertStatus(apt.appointment_date)
    return status === 'overdue' || status === 'today' || status === 'tomorrow'
  })

  if (filteredAppointments.length === 0) {
    return null
  }

  // Sort: overdue first, then today, then tomorrow
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const statusA = getAlertStatus(a.appointment_date)
    const statusB = getAlertStatus(b.appointment_date)
    
    // filteredAppointments only contains overdue, today, or tomorrow, so 'normal' is excluded
    const priority: Record<Exclude<AlertStatus, 'normal'>, number> = { overdue: 0, today: 1, tomorrow: 2 }
    return priority[statusA as Exclude<AlertStatus, 'normal'>] - priority[statusB as Exclude<AlertStatus, 'normal'>]
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Appointment Alerts</h2>
      </div>
      
      <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
        <ul className="divide-y divide-gray-800">
          {sortedAppointments.map(appointment => {
            const status = getAlertStatus(appointment.appointment_date)
            const statusColor = getStatusColor(status)
            const statusLabel = getStatusLabel(status)
            
            return (
              <li 
                key={appointment.id} 
                className={`p-4 border-l-4 ${statusColor} hover:bg-white/5 transition-colors`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-white">
                        {appointment.customer_firstname} {appointment.customer_lastname}
                      </p>
                      {statusLabel && (
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColor}`}>
                          {statusLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {appointment.vehicle_year} {appointment.vehicle_make} {appointment.vehicle_model}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Camera: {appointment.camera_model}
                    </p>
                    {appointment.stock_number && (
                      <p className="text-sm text-gray-400 mt-1">
                        Stock: {appointment.stock_number}
                      </p>
                    )}
                    <p className="text-xs text-[#C27E00] mt-1 font-semibold">
                      Appointment: {appointment.timezoneName
                        ? formatInTimeZone(new Date(appointment.appointment_date), appointment.timezoneName, 'PPP h:mm a')
                        : format(new Date(appointment.appointment_date), 'PPP h:mm a')}
                    </p>
                    {appointment.customer_address && (
                      <p className="text-xs text-gray-500 mt-1">
                        Address: {appointment.customer_address}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {appointment.timezoneName
                        ? formatInTimeZone(new Date(appointment.appointment_date), appointment.timezoneName, 'MMM d, yyyy')
                        : format(new Date(appointment.appointment_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

