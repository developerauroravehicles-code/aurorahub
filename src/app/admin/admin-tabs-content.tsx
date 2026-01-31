'use client'

import { useState, useEffect, useTransition } from 'react'
import { createDealer, createUser, createCameraModel, deleteCameraModel, toggleCameraModelStatus, updateCameraModel, updateCameraStock, assignCameraToDealer, removeCameraFromDealer } from './actions'
import { useActionState } from 'react'
import { LogoUploadForm } from '@/app/dashboard/admin/system-management/logo/logo-upload-form'
import { createClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { ResetPasswordButton } from '@/app/dashboard/admin/employees/reset-password-button'
import { Trash2, Power, PowerOff, Edit2, Package, Building2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

function UserForm() {
  const [state, formAction, isPending] = useActionState(createUser, null)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm border border-green-100">
          {state.success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Full Name</label>
          <input
            name="fullName"
            required
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Phone</label>
          <input
            name="phone"
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="+1 555..."
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Email</label>
        <input
          name="email"
          type="email"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="user@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Password</label>
        <input
          name="password"
          type="password"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="••••••••"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Role</label>
          <select
            name="role"
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          >
            <option value="sales" className="bg-black text-white">Sales</option>
            <option value="finance" className="bg-black text-white">Finance</option>
            <option value="specialist" className="bg-black text-white">Specialist</option>
            <option value="aurora_manager" className="bg-black text-white">Aurora Manager</option>
            <option value="general_manager" className="bg-black text-white">General Manager</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Dealer Code</label>
          <input
            name="dealerCode"
            required
            className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
            placeholder="e.g. HQ"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex w-full justify-center rounded-md bg-[#C27E00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#a06900] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C27E00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Creating User...' : 'Create User'}
      </button>
    </form>
  )
}

function DealerForm() {
  const [state, formAction, isPending] = useActionState(createDealer, null)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm border border-green-100">
          {state.success}
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Dealer Name</label>
        <input
          name="name"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="e.g. Aurora HQ"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Dealer Code</label>
        <input
          name="code"
          required
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="e.g. HQ"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">Address</label>
        <input
          name="address"
          className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
          placeholder="e.g. Main Street, 123"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex w-full justify-center rounded-md bg-[#C27E00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#a06900] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C27E00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Creating Dealer...' : 'Create Dealer'}
      </button>
    </form>
  )
}

function UserList({ profiles, errors }: { profiles: any[], errors: any }) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">User List ({profiles.length})</h3>
      {errors.profiles && <p className="text-red-500 text-sm mb-2">{errors.profiles}</p>}
      <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
        <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Dealer</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {profiles.map((profile: any) => (
              <tr key={profile.id}>
                <td className="px-4 py-2 font-medium text-white">{profile.full_name}</td>
                <td className="px-4 py-2 capitalize">{profile.role?.replace('_', ' ')}</td>
                <td className="px-4 py-2">{profile.phone || '-'}</td>
                <td className="px-4 py-2">
                  {profile.dealers ? (
                    <span className="text-white">{profile.dealers.name}</span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <ResetPasswordButton userId={profile.id} userName={profile.full_name} />
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">No profiles found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DealerList({ dealers, errors }: { dealers: any[], errors: any }) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">Dealer List ({dealers.length})</h3>
      {errors.dealers && <p className="text-red-500 text-sm mb-2">{errors.dealers}</p>}
      <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
        <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {dealers.map((dealer: any) => (
              <tr key={dealer.id}>
                <td className="px-4 py-2 font-medium text-white">{dealer.name}</td>
                <td className="px-4 py-2 text-[#C27E00]">{dealer.code}</td>
                <td className="px-4 py-2 text-gray-500 text-xs font-mono">{dealer.id}</td>
              </tr>
            ))}
            {dealers.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No dealers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DatabaseManagement({ dealers, profiles, errors }: { dealers: any[], profiles: any[], errors: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Database Contents (Debug)</h3>
        <p className="text-sm text-gray-400 mb-4">View all data in the database for debugging purposes</p>
      </div>

      {/* Dealers List */}
      <div>
        <h4 className="font-semibold text-gray-400 mb-2">Dealers ({dealers.length})</h4>
        {errors.dealers && <p className="text-red-500 text-sm">{errors.dealers}</p>}
        <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {dealers.map((dealer: any) => (
                <tr key={dealer.id}>
                  <td className="px-4 py-2 font-medium text-white">{dealer.name}</td>
                  <td className="px-4 py-2 text-[#C27E00]">{dealer.code}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs font-mono">{dealer.id}</td>
                </tr>
              ))}
              {dealers.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No dealers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profiles List */}
      <div>
        <h4 className="font-semibold text-gray-400 mb-2">User Profiles ({profiles.length})</h4>
        {errors.profiles && <p className="text-red-500 text-sm">{errors.profiles}</p>}
        <div className="bg-white/5 rounded shadow overflow-hidden border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-300">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Dealer</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {profiles.map((profile: any) => (
                <tr key={profile.id}>
                  <td className="px-4 py-2 font-medium text-white">{profile.full_name}</td>
                  <td className="px-4 py-2 capitalize">{profile.role?.replace('_', ' ')}</td>
                  <td className="px-4 py-2">{profile.phone || '-'}</td>
                  <td className="px-4 py-2">
                    {profile.dealers ? (
                      <span className="text-white">{profile.dealers.name}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ResetPasswordButton userId={profile.id} userName={profile.full_name} />
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">No profiles found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function APIManagement() {
  const [twilioSettings, setTwilioSettings] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
    enabled: false
  })
  const [whatsappSettings, setWhatsappSettings] = useState({
    apiKey: '',
    phoneNumberId: '',
    businessAccountId: '',
    enabled: false
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadSettings() {
      // Load Twilio settings
      const { data: twilioData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'twilio_settings')
        .single()
      
      if (twilioData?.value) {
        setTwilioSettings(JSON.parse(twilioData.value))
      }

      // Load WhatsApp settings
      const { data: whatsappData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_settings')
        .single()
      
      if (whatsappData?.value) {
        setWhatsappSettings(JSON.parse(whatsappData.value))
      }
    }
    loadSettings()
  }, [supabase])

  const saveTwilioSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'twilio_settings',
          value: JSON.stringify(twilioSettings),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })

      if (error) throw error
      setMessage({ type: 'success', text: 'Twilio settings saved successfully!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save Twilio settings' })
    } finally {
      setLoading(false)
    }
  }

  const saveWhatsAppSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'whatsapp_settings',
          value: JSON.stringify(whatsappSettings),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })

      if (error) throw error
      setMessage({ type: 'success', text: 'WhatsApp settings saved successfully!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save WhatsApp settings' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">API Management</h3>
        <p className="text-sm text-gray-400 mb-6">Configure and manage third-party API integrations</p>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm ${
          message.type === 'success' 
            ? 'bg-green-900/50 border border-green-800 text-green-200'
            : 'bg-red-900/50 border border-red-800 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Twilio Settings */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-white mb-1">Twilio SMS API</h4>
            <p className="text-sm text-gray-400">Configure Twilio for SMS notifications</p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={twilioSettings.enabled}
              onChange={(e) => setTwilioSettings({ ...twilioSettings, enabled: e.target.checked })}
              className="sr-only"
            />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${
              twilioSettings.enabled ? 'bg-[#C27E00]' : 'bg-gray-600'
            }`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                twilioSettings.enabled ? 'transform translate-x-5' : ''
              }`} />
            </div>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Account SID</label>
            <input
              type="text"
              value={twilioSettings.accountSid}
              onChange={(e) => setTwilioSettings({ ...twilioSettings, accountSid: e.target.value })}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Auth Token</label>
            <input
              type="password"
              value={twilioSettings.authToken}
              onChange={(e) => setTwilioSettings({ ...twilioSettings, authToken: e.target.value })}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Your auth token"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
            <input
              type="text"
              value={twilioSettings.phoneNumber}
              onChange={(e) => setTwilioSettings({ ...twilioSettings, phoneNumber: e.target.value })}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="+1234567890"
            />
          </div>

          <button
            onClick={saveTwilioSettings}
            disabled={loading}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Twilio Settings'}
          </button>
        </div>
      </div>

      {/* WhatsApp Settings */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-white mb-1">WhatsApp Business API</h4>
            <p className="text-sm text-gray-400">Configure WhatsApp for messaging</p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={whatsappSettings.enabled}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, enabled: e.target.checked })}
              className="sr-only"
            />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${
              whatsappSettings.enabled ? 'bg-[#C27E00]' : 'bg-gray-600'
            }`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                whatsappSettings.enabled ? 'transform translate-x-5' : ''
              }`} />
            </div>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
            <input
              type="password"
              value={whatsappSettings.apiKey}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, apiKey: e.target.value })}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Your WhatsApp API key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number ID</label>
            <input
              type="text"
              value={whatsappSettings.phoneNumberId}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, phoneNumberId: e.target.value })}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Phone number ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Business Account ID</label>
            <input
              type="text"
              value={whatsappSettings.businessAccountId}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, businessAccountId: e.target.value })}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Business account ID"
            />
          </div>

          <button
            onClick={saveWhatsAppSettings}
            disabled={loading}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save WhatsApp Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LogoManagement() {
  const [currentLogo, setCurrentLogo] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchLogo() {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'system_logo')
        .single()
      
      if (data?.value) {
        setCurrentLogo(data.value)
      }
    }
    fetchLogo()
  }, [supabase])

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Logo Management</h3>
        <p className="text-sm text-gray-400 mb-6">Upload and manage the system logo. Maximum file size: 5MB</p>
      </div>

      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <LogoUploadForm />
      </div>

      {/* Current Logo Display */}
      {currentLogo && (
        <div className="mt-6 bg-white/5 rounded-lg border border-gray-800 p-6">
          <h4 className="text-sm font-medium text-white mb-3">Current Logo</h4>
          <div className="flex items-center justify-center bg-black rounded-lg p-4 min-h-[200px]">
            <img
              src={currentLogo}
              alt="System Logo"
              className="max-w-full max-h-48 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminTabsContent({ activeTab, dealers, profiles, cameras, errors }: { 
  activeTab: 'user' | 'dealer' | 'database' | 'api' | 'logo' | 'camera'
  dealers?: any[]
  profiles?: any[]
  cameras?: any[]
  errors?: any
}) {
  if (activeTab === 'user') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Create New User</h3>
          <p className="text-sm text-gray-400 mb-4">Add a new user to the system</p>
          <UserForm />
        </div>
        {profiles && <UserList profiles={profiles} errors={errors || {}} />}
      </div>
    )
  }

  if (activeTab === 'dealer') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Create New Dealer</h3>
          <p className="text-sm text-gray-400 mb-4">Add a new dealer to the system</p>
          <DealerForm />
        </div>
        {dealers && <DealerList dealers={dealers} errors={errors || {}} />}
      </div>
    )
  }

  if (activeTab === 'database') {
    return <DatabaseManagement dealers={dealers || []} profiles={profiles || []} errors={errors || {}} />
  }

  if (activeTab === 'api') {
    return <APIManagement />
  }

  if (activeTab === 'logo') {
    return <LogoManagement />
  }

  if (activeTab === 'camera') {
    return <CameraManagement cameras={cameras || []} dealers={dealers || []} errors={errors || {}} />
  }

  return null
}

function CameraManagement({ cameras, dealers, errors }: { cameras: any[], dealers: any[], errors: any }) {
  const [state, formAction, isPending] = useActionState(createCameraModel, null)
  const [editState, editFormAction, isEditPending] = useActionState(updateCameraModel, null)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isToggling, startToggleTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockEditingId, setStockEditingId] = useState<string | null>(null)
  const [stockValue, setStockValue] = useState<number>(0)
  const [dealerAssigningId, setDealerAssigningId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (editState?.success) {
      setEditingId(null)
      router.refresh()
    }
  }, [editState, router])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this camera model?')) return

    startDeleteTransition(async () => {
      const result = await deleteCameraModel(id)
      if (result?.success) {
        router.refresh()
      }
    })
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    startToggleTransition(async () => {
      const result = await toggleCameraModelStatus(id, !currentStatus)
      if (result?.success) {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Camera Models Management</h3>
        <p className="text-sm text-gray-400 mb-4">Add and manage camera models for the system</p>
      </div>

      {/* Create Camera Form */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h4 className="text-md font-semibold text-white mb-4">Add New Camera Model</h4>
        
        {state?.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100 mb-4">
            {state.error}
          </div>
        )}
        
        {state?.success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm border border-green-100 mb-4">
            {state.success}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Camera Model Name *
            </label>
            <input
              type="text"
              name="name"
              required
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="e.g., Aurora Pro 4K"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={3}
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Camera model description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stock Quantity *
            </label>
            <input
              type="number"
              name="stockQuantity"
              min="0"
              defaultValue="0"
              required
              className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="0"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Camera Model'}
          </button>
        </form>
      </div>

      {/* Camera Models List */}
      <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
        <h4 className="text-md font-semibold text-white mb-4">
          Camera Models ({cameras.length})
        </h4>
        {errors.cameras && <p className="text-red-500 text-sm mb-2">{errors.cameras}</p>}
        
        {cameras.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No camera models found. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {cameras.map((camera) => (
              <div
                key={camera.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  camera.is_active 
                    ? 'bg-white/5 border-gray-800' 
                    : 'bg-white/2 border-gray-900 opacity-60'
                }`}
              >
                <div className="flex-1">
                  {editingId === camera.id ? (
                    <form action={editFormAction} className="space-y-3">
                      <input type="hidden" name="id" value={camera.id} />
                      <input
                        type="text"
                        name="name"
                        defaultValue={camera.name}
                        required
                        className="block w-full rounded-md border border-gray-700 bg-white/10 px-3 py-2 text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                      />
                      <textarea
                        name="description"
                        defaultValue={camera.description || ''}
                        rows={2}
                        className="block w-full rounded-md border border-gray-700 bg-white/10 px-3 py-2 text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                      />
                      <input
                        type="number"
                        name="stockQuantity"
                        defaultValue={camera.stock_quantity || 0}
                        min="0"
                        required
                        className="block w-full rounded-md border border-gray-700 bg-white/10 px-3 py-2 text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isEditPending}
                          className="bg-[#C27E00] hover:bg-[#a06900] text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      {editState?.error && (
                        <p className="text-red-400 text-xs">{editState.error}</p>
                      )}
                      {editState?.success && (
                        <p className="text-green-400 text-xs">{editState.success}</p>
                      )}
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <h5 className="text-white font-medium">{camera.name}</h5>
                        {!camera.is_active && (
                          <span className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-400">
                            Inactive
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs rounded bg-[#C27E00]/20 text-[#C27E00] border border-[#C27E00]/30">
                          Stock: {camera.stock_quantity || 0}
                        </span>
                      </div>
                      {camera.description && (
                        <p className="text-sm text-gray-400 mt-1">{camera.description}</p>
                      )}
                      {camera.dealer_cameras && camera.dealer_cameras.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Assigned to {camera.dealer_cameras.length} dealer{camera.dealer_cameras.length !== 1 ? 's' : ''}:</p>
                          <div className="flex flex-wrap gap-1">
                            {camera.dealer_cameras.slice(0, 3).map((dc: any) => (
                              <span
                                key={dc.dealer_id}
                                className="text-xs px-2 py-0.5 bg-[#C27E00]/20 text-[#C27E00] rounded border border-[#C27E00]/30"
                              >
                                {dc.dealers?.name || 'Unknown'}
                              </span>
                            ))}
                            {camera.dealer_cameras.length > 3 && (
                              <span className="text-xs px-2 py-0.5 text-gray-400">
                                +{camera.dealer_cameras.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {editingId !== camera.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(camera.id)
                        setStockEditingId(null)
                        setDealerAssigningId(null)
                      }}
                      className="p-2 rounded text-blue-500 hover:bg-blue-900/20 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setStockEditingId(camera.id)
                        setStockValue(camera.stock_quantity || 0)
                        setEditingId(null)
                        setDealerAssigningId(null)
                      }}
                      className="p-2 rounded text-green-500 hover:bg-green-900/20 transition-colors"
                      title="Update Stock"
                    >
                      <Package className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDealerAssigningId(camera.id)
                        setEditingId(null)
                        setStockEditingId(null)
                      }}
                      className="p-2 rounded text-purple-500 hover:bg-purple-900/20 transition-colors"
                      title="Assign to Dealer"
                    >
                      <Building2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(camera.id, camera.is_active)}
                      disabled={isToggling}
                      className={`p-2 rounded transition-colors ${
                        camera.is_active
                          ? 'text-yellow-500 hover:bg-yellow-900/20'
                          : 'text-green-500 hover:bg-green-900/20'
                      } disabled:opacity-50`}
                      title={camera.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {camera.is_active ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(camera.id)}
                      disabled={isDeleting}
                      className="p-2 rounded text-red-500 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock Edit Modal */}
      {stockEditingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Update Stock</h3>
              <button
                onClick={() => setStockEditingId(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={stockValue}
                  onChange={(e) => setStockValue(parseInt(e.target.value) || 0)}
                  className="block w-full rounded-md border border-gray-700 bg-white/5 px-3 py-2 text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const camera = cameras.find(c => c.id === stockEditingId)
                    if (camera) {
                      const result = await updateCameraStock(stockEditingId, stockValue)
                      if (result?.success) {
                        setStockEditingId(null)
                        router.refresh()
                      } else {
                        alert(result?.error || 'Failed to update stock')
                      }
                    }
                  }}
                  className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Update Stock
                </button>
                <button
                  onClick={() => setStockEditingId(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dealer Assignment Modal */}
      {dealerAssigningId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-white font-semibold text-lg">Assign to Dealers</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Select multiple dealers to assign this camera model to
                </p>
              </div>
              <button
                onClick={() => setDealerAssigningId(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {dealers.map((dealer) => (
                  <DealerAssignmentItem
                    key={dealer.id}
                    dealer={dealer}
                    cameraId={dealerAssigningId}
                    onAssign={async () => {
                      const result = await assignCameraToDealer(dealerAssigningId, dealer.id)
                      if (result?.success) {
                        router.refresh()
                      } else {
                        if (result?.error && !result.error.includes('already assigned')) {
                          alert(result.error || 'Failed to assign camera')
                        }
                      }
                    }}
                    onRemove={async () => {
                      const result = await removeCameraFromDealer(dealerAssigningId, dealer.id)
                      if (result?.success) {
                        router.refresh()
                      } else {
                        alert(result?.error || 'Failed to remove camera')
                      }
                    }}
                  />
                ))}
              </div>
              <div className="pt-4 border-t border-gray-800">
                <button
                  onClick={() => setDealerAssigningId(null)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DealerAssignmentItem({ dealer, cameraId, onAssign, onRemove }: { 
  dealer: any
  cameraId: string
  onAssign: () => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [isAssigned, setIsAssigned] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check if camera is assigned to this dealer
    const checkAssignment = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('dealer_cameras')
        .select('id')
        .eq('camera_model_id', cameraId)
        .eq('dealer_id', dealer.id)
        .maybeSingle()
      setIsAssigned(!!data)
    }
    checkAssignment()
  }, [cameraId, dealer.id])

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      if (isAssigned) {
        await onRemove()
        setIsAssigned(false)
      } else {
        await onAssign()
        setIsAssigned(true)
      }
    } catch (error) {
      console.error('Error toggling assignment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
      isAssigned
        ? 'bg-[#C27E00]/10 border-[#C27E00]/40 shadow-sm'
        : 'bg-white/5 border-gray-800 hover:bg-white/10'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isAssigned ? (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#C27E00]"></div>
        ) : (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-transparent"></div>
        )}
        <div className="min-w-0 flex-1">
          <span className={`text-sm block truncate ${isAssigned ? 'text-white font-medium' : 'text-gray-300'}`}>
            {dealer.name}
          </span>
          <span className="text-xs text-gray-500">({dealer.code})</span>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`flex-shrink-0 px-4 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isAssigned
            ? 'bg-red-900/60 text-red-200 hover:bg-red-900/80 border border-red-800/50'
            : 'bg-[#C27E00] text-white hover:bg-[#a06900] border border-[#C27E00]/50'
        }`}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        ) : (
          isAssigned ? 'Remove' : 'Assign'
        )}
      </button>
    </div>
  )
}
