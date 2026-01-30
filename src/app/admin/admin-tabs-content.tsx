'use client'

import { useState, useEffect } from 'react'
import { createDealer, createUser } from './actions'
import { useActionState } from 'react'
import { LogoUploadForm } from '@/app/dashboard/admin/system-management/logo/logo-upload-form'
import { createClient } from '@/lib/supabase/client'
import { ResetPasswordButton } from '@/app/dashboard/admin/employees/reset-password-button'

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

export function AdminTabsContent({ activeTab, dealers, profiles, errors }: { 
  activeTab: 'user' | 'dealer' | 'database' | 'api' | 'logo'
  dealers?: any[]
  profiles?: any[]
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

  return null
}
