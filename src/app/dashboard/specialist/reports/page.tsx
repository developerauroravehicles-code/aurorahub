'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { exportReportToPdf, type ExportReportOptions } from '@/lib/export-report-pdf'
import { SendReportEmailModal } from '@/components/send-report-email-modal'
import { FileDown, Mail } from 'lucide-react'

interface Demand {
  id: string
  customer_firstname: string
  customer_lastname: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  camera_model: string
  appointment_date: string
  status: string
  created_at: string
}

export default function SpecialistReportsPage() {
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(true)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [reportOptionsForEmail, setReportOptionsForEmail] = useState<ExportReportOptions | null>(null)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const supabase = createClient()

  useEffect(() => {
    fetchDemands()
  }, [startDate, endDate])

  const fetchDemands = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch demands assigned to this specialist
      const { data: demandsData, error } = await supabase
        .from('demands')
        .select('id, status, created_at, camera_model, vehicle_make, vehicle_model, vehicle_year, appointment_date, customer_firstname, customer_lastname')
        .eq('assigned_specialist_id', user.id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching demands:', error)
      } else {
        setDemands(demandsData || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const totalDemands = demands.length
  const totalAppointments = demands.length
  const cameraCounts = demands.reduce((acc, demand) => {
    const camera = demand.camera_model || 'Unknown'
    acc[camera] = (acc[camera] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const statusCounts = demands.reduce((acc, demand) => {
    const status = demand.status || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const vehicleMakeCounts = demands.reduce((acc, demand) => {
    const make = demand.vehicle_make || 'Unknown'
    acc[make] = (acc[make] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const getReportOptions = async (): Promise<ExportReportOptions> => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      : { data: null }
    const dateRangeStr = `${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`
    return {
      reportTitle: 'Specialist Reports',
      dateRange: dateRangeStr,
      exporterFullName: profile?.full_name ?? 'N/A',
      exporterEmail: user?.email ?? 'N/A',
      appliedFilters: ['Scope: My assigned work'],
      totalDemands,
      totalAppointments,
      cameraCounts,
      statusCounts,
      vehicleMakeCounts,
      demands: demands.map((d) => ({
        customer: `${d.customer_firstname} ${d.customer_lastname}`,
        vehicle: `${d.vehicle_year} ${d.vehicle_make} ${d.vehicle_model}`,
        camera: d.camera_model,
        appointment: formatInTimeZone(new Date(d.appointment_date), SYSTEM_DEFAULT_TIMEZONE, 'MMM d, yyyy HH:mm'),
        status: d.status.replace('_', ' ').toUpperCase(),
        created: formatInTimeZone(new Date(d.created_at), SYSTEM_DEFAULT_TIMEZONE, 'MMM d, yyyy'),
      })),
    }
  }

  const handleExportPdf = async () => {
    const opts = await getReportOptions()
    exportReportToPdf(opts)
  }

  const handleOpenEmailModal = async () => {
    const opts = await getReportOptions()
    setReportOptionsForEmail(opts)
    setEmailModalOpen(true)
  }

  const setDateRange = (months: number) => {
    const end = new Date()
    const start = subMonths(end, months)
    setStartDate(format(startOfMonth(start), 'yyyy-MM-dd'))
    setEndDate(format(endOfMonth(end), 'yyyy-MM-dd'))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Specialist Reports</h1>
          <p className="text-gray-400">View detailed reports of your assigned work and appointments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleOpenEmailModal}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-gray-600 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            Send E-mail
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Date Range Filter</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-700 bg-white/5 p-2 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange(1)}
              className="px-4 py-2 bg-white/5 border border-gray-700 text-white rounded hover:bg-white/10 transition-colors text-sm"
            >
              Last Month
            </button>
            <button
              onClick={() => setDateRange(3)}
              className="px-4 py-2 bg-white/5 border border-gray-700 text-white rounded hover:bg-white/10 transition-colors text-sm"
            >
              Last 3 Months
            </button>
            <button
              onClick={() => setDateRange(6)}
              className="px-4 py-2 bg-white/5 border border-gray-700 text-white rounded hover:bg-white/10 transition-colors text-sm"
            >
              Last 6 Months
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading reports...</p>
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Assigned Work</h3>
              <p className="text-3xl font-bold text-white">{totalDemands}</p>
            </div>
            <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Appointments</h3>
              <p className="text-3xl font-bold text-white">{totalAppointments}</p>
            </div>
            <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Date Range</h3>
              <p className="text-sm text-white">
                {format(new Date(startDate), 'MMM d, yyyy')} - {format(new Date(endDate), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Camera Model Report */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Camera Models</h2>
            {Object.keys(cameraCounts).length === 0 ? (
              <p className="text-gray-400">No camera data available for this period.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(cameraCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([camera, count]) => (
                    <div key={camera} className="flex items-center justify-between p-3 bg-white/5 rounded border border-gray-800">
                      <span className="text-white font-medium">{camera}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">{count} job{count !== 1 ? 's' : ''}</span>
                        <div className="w-32 bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-[#C27E00] h-2 rounded-full"
                            style={{ width: `${(count / totalDemands) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-12 text-right">
                          {totalDemands > 0 ? Math.round((count / totalDemands) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Status Report */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Status Breakdown</h2>
            {Object.keys(statusCounts).length === 0 ? (
              <p className="text-gray-400">No status data available for this period.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const statusColors = {
                    pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                    approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border-green-800',
                    cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                  }
                  return (
                    <div
                      key={status}
                      className={`p-4 rounded-lg border ${statusColors[status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}
                    >
                      <p className="text-sm font-medium mb-1">
                        {status.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs mt-1 opacity-75">
                        {totalDemands > 0 ? Math.round((count / totalDemands) * 100) : 0}% of total
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Vehicle Make Report */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Vehicle Makes</h2>
            {Object.keys(vehicleMakeCounts).length === 0 ? (
              <p className="text-gray-400">No vehicle data available for this period.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(vehicleMakeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([make, count]) => (
                    <div key={make} className="flex items-center justify-between p-3 bg-white/5 rounded border border-gray-800">
                      <span className="text-white font-medium">{make}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">{count} vehicle{count !== 1 ? 's' : ''}</span>
                        <div className="w-32 bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-[#C27E00] h-2 rounded-full"
                            style={{ width: `${(count / totalDemands) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-12 text-right">
                          {totalDemands > 0 ? Math.round((count / totalDemands) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Detailed List */}
          <div className="bg-white/5 border border-gray-800 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Detailed Work List</h2>
            {demands.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No assigned work found for the selected date range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Camera</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Appointment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {demands.map((demand) => {
                      const statusColors = {
                        pending_finance: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
                        approved: 'bg-blue-900/50 text-blue-300 border-blue-800',
                        completed: 'bg-green-900/50 text-green-300 border-green-800',
                        cancelled: 'bg-red-900/50 text-red-300 border-red-800'
                      }
                      return (
                        <tr key={demand.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                            {demand.customer_firstname} {demand.customer_lastname}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {demand.vehicle_year} {demand.vehicle_make} {demand.vehicle_model}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {demand.camera_model}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {format(new Date(demand.appointment_date), 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[demand.status as keyof typeof statusColors] || 'bg-gray-900/50 text-gray-300 border-gray-800'}`}>
                              {demand.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                            {format(new Date(demand.created_at), 'MMM d, yyyy')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {reportOptionsForEmail && (
        <SendReportEmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          reportOptions={reportOptionsForEmail}
        />
      )}
    </div>
  )
}

