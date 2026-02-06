'use client'

import { useState } from 'react'
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react'
import { createCalendarSetting, updateCalendarSetting, deleteCalendarSetting } from './actions'

interface CalendarSetting {
  id: string
  dealer_id: string
  day_type: 'weekday' | 'weekend'
  start_hour: number
  end_hour: number
  slot_interval_minutes: number
  appointment_duration_minutes: number
  dealers: {
    name: string
  }
}

interface Dealer {
  id: string
  name: string
}

interface CalendarManagementContentProps {
  settings: CalendarSetting[]
  dealers: Dealer[]
  createCalendarSetting: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateCalendarSetting: (settingId: string, startHour: number, endHour: number, slotIntervalMinutes: number, appointmentDurationMinutes: number) => Promise<{ success: boolean; error?: string }>
  deleteCalendarSetting: (settingId: string) => Promise<{ success: boolean; error?: string }>
}

export function CalendarManagementContent({
  settings,
  dealers,
  createCalendarSetting,
  updateCalendarSetting,
  deleteCalendarSetting
}: CalendarManagementContentProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleCreate = async (formData: FormData) => {
    setError(null)
    setSuccess(null)
    const result = await createCalendarSetting(formData)
    if (result.success) {
      setSuccess('Calendar setting created successfully!')
      setShowCreateForm(false)
      // Reset form by reloading
      window.location.reload()
    } else {
      setError(result.error || 'Failed to create calendar setting')
    }
  }

  const handleUpdate = async (settingId: string, formData: FormData) => {
    setError(null)
    setSuccess(null)
    const startHour = parseInt(formData.get('startHour') as string)
    const endHour = parseInt(formData.get('endHour') as string)
    const slotIntervalMinutes = parseInt(formData.get('slotIntervalMinutes') as string)
    const appointmentDurationMinutes = parseInt(formData.get('appointmentDurationMinutes') as string)

    const result = await updateCalendarSetting(settingId, startHour, endHour, slotIntervalMinutes, appointmentDurationMinutes)
    if (result.success) {
      setSuccess('Calendar setting updated successfully!')
      setEditingId(null)
      window.location.reload()
    } else {
      setError(result.error || 'Failed to update calendar setting')
    }
  }

  const handleDelete = async (settingId: string) => {
    if (!confirm('Are you sure you want to delete this calendar setting?')) return

    setError(null)
    setSuccess(null)
    const result = await deleteCalendarSetting(settingId)
    if (result.success) {
      setSuccess('Calendar setting deleted successfully!')
      window.location.reload()
    } else {
      setError(result.error || 'Failed to delete calendar setting')
    }
  }

  // Group settings by dealer
  const settingsByDealer = new Map<string, CalendarSetting[]>()
  settings.forEach(setting => {
    if (!settingsByDealer.has(setting.dealer_id)) {
      settingsByDealer.set(setting.dealer_id, [])
    }
    settingsByDealer.get(setting.dealer_id)!.push(setting)
  })

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-800 text-green-200 p-4 rounded-md">
          {success}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Calendar Settings</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#C27E00] text-white rounded-md hover:bg-[#a06900] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Calendar Setting
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white/5 border border-gray-800 rounded-lg p-6">
          <h3 className="text-md font-medium text-white mb-4">Create New Calendar Setting</h3>
          <form action={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Dealer</label>
                <select
                  name="dealerId"
                  required
                  className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                >
                  <option value="" className="bg-black">Select a dealer...</option>
                  {dealers.map(dealer => (
                    <option key={dealer.id} value={dealer.id} className="bg-black">
                      {dealer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Day Type</label>
                <select
                  name="dayType"
                  required
                  className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                >
                  <option value="weekday" className="bg-black">Weekday</option>
                  <option value="weekend" className="bg-black">Weekend</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Start Hour</label>
                <input
                  type="number"
                  name="startHour"
                  min="0"
                  max="23"
                  required
                  className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">End Hour</label>
                <input
                  type="number"
                  name="endHour"
                  min="0"
                  max="23"
                  required
                  className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Slot Interval (minutes)</label>
                <input
                  type="number"
                  name="slotIntervalMinutes"
                  min="1"
                  required
                  defaultValue={90}
                  className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Appointment Duration (minutes)</label>
                <input
                  type="number"
                  name="appointmentDurationMinutes"
                  min="1"
                  required
                  defaultValue={75}
                  className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-[#C27E00] text-white rounded-md hover:bg-[#a06900] transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {Array.from(settingsByDealer.entries()).map(([dealerId, dealerSettings]) => {
          const dealer = dealers.find(d => d.id === dealerId)
          return (
            <div key={dealerId} className="bg-white/5 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">{dealer?.name || 'Unknown Dealer'}</h3>
              <div className="space-y-4">
                {dealerSettings.map(setting => (
                  <div key={setting.id} className="bg-black/50 border border-gray-800 rounded-lg p-4">
                    {editingId === setting.id ? (
                      <form
                        action={(formData) => handleUpdate(setting.id, formData)}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Day Type</label>
                            <div className="px-3 py-2 bg-gray-800 text-gray-400 rounded-md capitalize">
                              {setting.day_type}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Start Hour</label>
                            <input
                              type="number"
                              name="startHour"
                              min="0"
                              max="23"
                              defaultValue={setting.start_hour}
                              required
                              className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">End Hour</label>
                            <input
                              type="number"
                              name="endHour"
                              min="0"
                              max="23"
                              defaultValue={setting.end_hour}
                              required
                              className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Slot Interval (minutes)</label>
                            <input
                              type="number"
                              name="slotIntervalMinutes"
                              min="1"
                              defaultValue={setting.slot_interval_minutes}
                              required
                              className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Appointment Duration (minutes)</label>
                            <input
                              type="number"
                              name="appointmentDurationMinutes"
                              min="1"
                              defaultValue={setting.appointment_duration_minutes}
                              required
                              className="w-full border border-gray-700 bg-black/50 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-[#C27E00] text-white rounded-md hover:bg-[#a06900] transition-colors"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-[#C27E00]/20 text-[#C27E00] rounded-md text-sm font-medium capitalize">
                              {setting.day_type}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Start Hour:</span>
                              <span className="text-white ml-2">{setting.start_hour}:00</span>
                            </div>
                            <div>
                              <span className="text-gray-400">End Hour:</span>
                              <span className="text-white ml-2">{setting.end_hour}:00</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Slot Interval:</span>
                              <span className="text-white ml-2">{setting.slot_interval_minutes} minutes</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Appointment Duration:</span>
                              <span className="text-white ml-2">{setting.appointment_duration_minutes} minutes</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingId(setting.id)}
                            className="p-2 text-[#C27E00] hover:bg-white/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(setting.id)}
                            className="p-2 text-red-400 hover:bg-white/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {settings.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No calendar settings found. Create one to get started.</p>
        </div>
      )}
    </div>
  )
}

