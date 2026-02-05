'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function APIManagementContent() {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save Twilio settings'
      setMessage({ type: 'error', text: errorMessage })
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save WhatsApp settings'
      setMessage({ type: 'error', text: errorMessage })
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

