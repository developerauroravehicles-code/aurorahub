'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
  const [googleDriveSettings, setGoogleDriveSettings] = useState({
    clientId: '',
    clientSecret: '',
    defaultFolderId: '',
    refreshToken: '',
    useOAuth: false,
    serviceAccountEmail: '',
    serviceAccountPrivateKey: '',
    enabled: false
  })
  const searchParams = useSearchParams()
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

      // Load Google Drive settings
      const { data: googleDriveData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'google_drive_settings')
        .single()
      
      if (googleDriveData?.value) {
        const parsed = JSON.parse(googleDriveData.value)
        setGoogleDriveSettings({
          clientId: parsed.clientId ?? '',
          clientSecret: parsed.clientSecret ?? '',
          defaultFolderId: parsed.defaultFolderId ?? '',
          refreshToken: parsed.refreshToken ?? '',
          useOAuth: parsed.useOAuth ?? false,
          serviceAccountEmail: parsed.serviceAccountEmail ?? '',
          serviceAccountPrivateKey: parsed.serviceAccountPrivateKey ?? '',
          enabled: parsed.enabled ?? false
        })
      }
    }
    loadSettings()
  }, [supabase])

  useEffect(() => {
    const drive = searchParams.get('drive')
    const err = searchParams.get('drive_error')
    if (drive === 'connected') {
      setMessage({ type: 'success', text: 'Google Drive connected successfully!' })
      window.history.replaceState({}, '', '/dashboard/infrastructure/api')
      // Refetch to show Connected badge
      supabase.from('system_settings').select('value').eq('key', 'google_drive_settings').single().then(({ data }) => {
        if (data?.value) {
          const p = JSON.parse(data.value)
          setGoogleDriveSettings(s => ({ ...s, refreshToken: p.refreshToken ?? '', useOAuth: p.useOAuth ?? false }))
        }
      })
    } else if (err) {
      const msg: Record<string, string> = {
        no_client_id: 'Save Client ID and Secret first, then click Connect.',
        no_credentials: 'Client ID and Secret required for OAuth.',
        no_code: 'Authorization was cancelled.',
        no_refresh_token: 'Google did not return a refresh token. Try again with prompt=consent.',
        session_expired: 'Session expired. Please log in again.',
        unauthorized: 'Only Aurora Managers can connect Drive.',
        oauth_access_denied: 'Authorization was denied.',
        token_exchange_failed: 'Failed to exchange authorization code.'
      }
      setMessage({ type: 'error', text: msg[err] ?? err })
      window.history.replaceState({}, '', '/dashboard/infrastructure/api')
    }
  }, [searchParams])

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

  const saveGoogleDriveSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'google_drive_settings',
          value: JSON.stringify(googleDriveSettings),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })

      if (error) throw error
      setMessage({ type: 'success', text: 'Google Drive settings saved successfully!' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save Google Drive settings'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">API Management</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-6">Configure and manage third-party API integrations</p>
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
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">Twilio SMS API</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">Configure Twilio for SMS notifications</p>
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
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Account SID</label>
            <input
              type="text"
              value={twilioSettings.accountSid}
              onChange={(e) => setTwilioSettings({ ...twilioSettings, accountSid: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Auth Token</label>
            <input
              type="password"
              value={twilioSettings.authToken}
              onChange={(e) => setTwilioSettings({ ...twilioSettings, authToken: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Your auth token"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Phone Number</label>
            <input
              type="text"
              value={twilioSettings.phoneNumber}
              onChange={(e) => setTwilioSettings({ ...twilioSettings, phoneNumber: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
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
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">WhatsApp Business API</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">Configure WhatsApp for messaging</p>
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
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">API Key</label>
            <input
              type="password"
              value={whatsappSettings.apiKey}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, apiKey: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Your WhatsApp API key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Phone Number ID</label>
            <input
              type="text"
              value={whatsappSettings.phoneNumberId}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, phoneNumberId: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Phone number ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Business Account ID</label>
            <input
              type="text"
              value={whatsappSettings.businessAccountId}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, businessAccountId: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
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

      {/* Google Drive Settings */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">Google Drive</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">Upload invoices to Drive. Use <strong>OAuth</strong> (no Service Account key needed) or Service Account. See docs/GOOGLE_DRIVE_SETUP.md.</p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={googleDriveSettings.enabled}
              onChange={(e) => setGoogleDriveSettings({ ...googleDriveSettings, enabled: e.target.checked })}
              className="sr-only"
            />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${
              googleDriveSettings.enabled ? 'bg-[#C27E00]' : 'bg-gray-600'
            }`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                googleDriveSettings.enabled ? 'transform translate-x-5' : ''
              }`} />
            </div>
          </label>
        </div>

        <div className="space-y-4">
          {/* OAuth - recommended when Service Account key is disabled */}
          <div className="p-4 rounded-lg bg-[#C27E00]/10 border border-[#C27E00]/30 mb-4">
            <h5 className="text-sm font-semibold text-[#C27E00] mb-2">OAuth 2.0 (recommended for work/organization accounts)</h5>
            <p className="text-xs text-zinc-500 dark:text-gray-400 mb-3">Use when Service Account key creation is disabled by your organization. No key file needed.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">OAuth Client ID</label>
                <input
                  type="text"
                  value={googleDriveSettings.clientId}
                  onChange={(e) => setGoogleDriveSettings({ ...googleDriveSettings, clientId: e.target.value })}
                  className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                  placeholder="xxx.apps.googleusercontent.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">OAuth Client Secret</label>
                <input
                  type="password"
                  value={googleDriveSettings.clientSecret}
                  onChange={(e) => setGoogleDriveSettings({ ...googleDriveSettings, clientSecret: e.target.value })}
                  className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
                  placeholder="GOCSPX-xxx"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Create OAuth 2.0 Client ID (Web application) in GCP. Add redirect URI: /api/drive-oauth/callback (e.g. https://yourdomain.com/api/drive-oauth/callback or http://localhost:3000/api/drive-oauth/callback)</p>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Enter Client ID, Secret and Root Folder ID. Click Connect to save and authorize.</p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!googleDriveSettings.clientId?.trim() || !googleDriveSettings.clientSecret?.trim()) {
                    setMessage({ type: 'error', text: 'Client ID and Client Secret are required.' })
                    return
                  }
                  setLoading(true)
                  setMessage(null)
                  try {
                    const { error } = await supabase
                      .from('system_settings')
                      .upsert({
                        key: 'google_drive_settings',
                        value: JSON.stringify(googleDriveSettings),
                        updated_at: new Date().toISOString()
                      }, { onConflict: 'key' })
                    if (error) throw error
                    window.location.href = '/api/drive-oauth/authorize'
                  } catch (e) {
                    setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' })
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors text-sm bg-[#C27E00] hover:bg-[#a06900] text-white disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Connect to Google'}
              </button>
              {googleDriveSettings.refreshToken && (
                <span className="text-sm text-green-400">✓ Connected</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Root Folder ID</label>
            <input
              type="text"
              value={googleDriveSettings.defaultFolderId}
              onChange={(e) => setGoogleDriveSettings({ ...googleDriveSettings, defaultFolderId: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="Drive folder ID (My Drive folder or Shared Drive)"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-gray-500">OAuth: use any folder in your Drive. Service Account: use Shared Drive.</p>
          </div>

          <hr className="border-zinc-300 dark:border-gray-700 my-4" />
          <p className="text-xs text-zinc-500 dark:text-gray-500">Or use Service Account (requires key file; not available when org policy blocks it):</p>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Service Account Email</label>
            <input
              type="text"
              value={googleDriveSettings.serviceAccountEmail}
              onChange={(e) => setGoogleDriveSettings({ ...googleDriveSettings, serviceAccountEmail: e.target.value })}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm"
              placeholder="xxx@xxx.iam.gserviceaccount.com"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-gray-500">From the JSON key file (client_email)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Service Account Private Key</label>
            <textarea
              value={googleDriveSettings.serviceAccountPrivateKey}
              onChange={(e) => setGoogleDriveSettings({ ...googleDriveSettings, serviceAccountPrivateKey: e.target.value })}
              rows={4}
              className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm font-mono text-sm"
              placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-gray-500">From the JSON key file (private_key), including BEGIN/END lines</p>
          </div>

          <button
            onClick={saveGoogleDriveSettings}
            disabled={loading}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Google Drive Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

