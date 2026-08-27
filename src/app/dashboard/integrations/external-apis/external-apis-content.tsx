'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2 } from 'lucide-react'

type LegacySettings = {
  twilio: { accountSid: string; authToken: string; phoneNumber: string; enabled: boolean }
  whatsapp: { apiKey: string; phoneNumberId: string; businessAccountId: string; enabled: boolean }
  googleDrive: {
    clientId: string
    clientSecret: string
    defaultFolderId: string
    refreshToken: string
    useOAuth: boolean
    serviceAccountEmail: string
    serviceAccountPrivateKey: string
    enabled: boolean
  }
  docusign: {
    enabled: boolean
    integrationKey: string
    accountId: string
    userId: string
    rsaPrivateKey: string
    baseUri: string
    authServer: string
  }
}

type ExternalConnection = {
  id: string
  provider_type: string
  label: string
  config: Record<string, unknown>
  enabled: boolean
}

const DRIVE_ERRORS: Record<string, string> = {
  no_client_id: 'Save Client ID and Secret first, then click Connect.',
  no_credentials: 'Client ID and Secret required for OAuth.',
  no_code: 'Authorization was cancelled.',
  no_refresh_token: 'Google did not return a refresh token. Try again with prompt=consent.',
  session_expired: 'Session expired. Please log in again.',
  unauthorized: 'Only platform admins can connect Drive.',
  oauth_access_denied: 'Authorization was denied.',
  token_exchange_failed: 'Failed to exchange authorization code.',
}

export function ExternalAPIsContent() {
  const [legacy, setLegacy] = useState<LegacySettings>({
    twilio: { accountSid: '', authToken: '', phoneNumber: '', enabled: false },
    whatsapp: { apiKey: '', phoneNumberId: '', businessAccountId: '', enabled: false },
    googleDrive: {
      clientId: '', clientSecret: '', defaultFolderId: '', refreshToken: '',
      useOAuth: false, serviceAccountEmail: '', serviceAccountPrivateKey: '', enabled: false,
    },
    docusign: {
      enabled: false,
      integrationKey: '',
      accountId: '',
      userId: '',
      rsaPrivateKey: '',
      baseUri: 'https://na4.docusign.net',
      authServer: 'account.docusign.com',
    },
  })
  const [connections, setConnections] = useState<ExternalConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddDrive, setShowAddDrive] = useState(false)
  const [newDriveLabel, setNewDriveLabel] = useState('')
  const [newDriveFolderId, setNewDriveFolderId] = useState('')
  const searchParams = useSearchParams()
  const supabase = createClient()

  const externalApisBase = '/dashboard/integrations/external-apis'

  useEffect(() => {
    async function load() {
      const [
        { data: twilioData },
        { data: whatsappData },
        { data: googleDriveData },
        { data: docusignData },
        { data: connData },
      ] = await Promise.all([
        supabase.from('system_settings').select('value').eq('key', 'twilio_settings').single(),
        supabase.from('system_settings').select('value').eq('key', 'whatsapp_settings').single(),
        supabase.from('system_settings').select('value').eq('key', 'google_drive_settings').single(),
        supabase.from('system_settings').select('value').eq('key', 'docusign_settings').single(),
        supabase.from('external_api_connections').select('*').order('created_at'),
      ])
      if (twilioData?.value) setLegacy((s) => ({ ...s, twilio: { ...s.twilio, ...JSON.parse(twilioData.value) } }))
      if (whatsappData?.value) setLegacy((s) => ({ ...s, whatsapp: { ...s.whatsapp, ...JSON.parse(whatsappData.value) } }))
      if (googleDriveData?.value) {
        const p = JSON.parse(googleDriveData.value)
        setLegacy((s) => ({
          ...s,
          googleDrive: {
            clientId: p.clientId ?? '', clientSecret: p.clientSecret ?? '', defaultFolderId: p.defaultFolderId ?? '',
            refreshToken: p.refreshToken ?? '', useOAuth: p.useOAuth ?? false,
            serviceAccountEmail: p.serviceAccountEmail ?? '', serviceAccountPrivateKey: p.serviceAccountPrivateKey ?? '',
            enabled: p.enabled ?? false,
          },
        }))
      }
      if (docusignData?.value) {
        const p = JSON.parse(docusignData.value)
        setLegacy((s) => ({
          ...s,
          docusign: {
            enabled: p.enabled ?? false,
            integrationKey: p.integrationKey ?? '',
            accountId: p.accountId ?? '',
            userId: p.userId ?? '',
            rsaPrivateKey: p.rsaPrivateKey ?? '',
            baseUri: p.baseUri ?? 'https://na4.docusign.net',
            authServer: p.authServer ?? 'account.docusign.com',
          },
        }))
      }
      setConnections((connData ?? []) as ExternalConnection[])
    }
    load()
  }, [supabase])

  useEffect(() => {
    const drive = searchParams.get('drive')
    const err = searchParams.get('drive_error')
    if (drive === 'connected') {
      setMessage({ type: 'success', text: 'Google Drive connected successfully!' })
      window.history.replaceState({}, '', externalApisBase)
      supabase.from('system_settings').select('value').eq('key', 'google_drive_settings').single().then(({ data }) => {
        if (data?.value) {
          const p = JSON.parse(data.value)
          setLegacy((s) => ({
            ...s,
            googleDrive: { ...s.googleDrive, refreshToken: p.refreshToken ?? '', useOAuth: p.useOAuth ?? false },
          }))
        }
      })
    } else if (drive === 'connection_ok' && searchParams.get('connection_id')) {
      setMessage({ type: 'success', text: 'Additional Drive folder connected!' })
      window.history.replaceState({}, '', externalApisBase)
      supabase.from('external_api_connections').select('*').order('created_at').then(({ data }) =>
        setConnections((data ?? []) as ExternalConnection[])
      )
    } else if (err) {
      setMessage({ type: 'error', text: DRIVE_ERRORS[err] ?? err })
      window.history.replaceState({}, '', externalApisBase)
    }
  }, [searchParams, supabase])

  const save = async (key: string, value: unknown) => {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      if (error) throw error
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' })
    } finally {
      setLoading(false)
    }
  }

  const addDriveConnection = async () => {
    if (!newDriveLabel.trim()) {
      setMessage({ type: 'error', text: 'Label is required.' })
      return
    }
    const clientId = legacy.googleDrive.clientId?.trim()
    const clientSecret = legacy.googleDrive.clientSecret?.trim()
    if (!clientId || !clientSecret) {
      setMessage({ type: 'error', text: 'Primary Drive must have Client ID and Secret. Configure main Drive first.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const { data, error } = await supabase.from('external_api_connections').insert({
        provider_type: 'google_drive',
        label: newDriveLabel.trim(),
        config: {
          clientId,
          clientSecret,
          defaultFolderId: newDriveFolderId.trim() || undefined,
        },
        enabled: true,
      }).select('id').single()
      if (error) throw error
      setShowAddDrive(false)
      setNewDriveLabel('')
      setNewDriveFolderId('')
      window.location.href = `/api/drive-oauth/authorize?connection_id=${(data as { id: string }).id}`
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to add' })
    } finally {
      setLoading(false)
    }
  }

  const deleteConnection = async (id: string) => {
    if (!confirm('Delete this connection?')) return
    const { error } = await supabase.from('external_api_connections').delete().eq('id', id)
    if (!error) {
      setConnections((c) => c.filter((x) => x.id !== id))
      setMessage({ type: 'success', text: 'Connection removed.' })
    }
  }

  const connectDriveOAuth = () => {
    if (!legacy.googleDrive.clientId?.trim() || !legacy.googleDrive.clientSecret?.trim()) {
      setMessage({ type: 'error', text: 'Client ID and Client Secret are required.' })
      return
    }
    setLoading(true)
    setMessage(null)
    supabase.from('system_settings').upsert({
      key: 'google_drive_settings',
      value: JSON.stringify(legacy.googleDrive),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(({ error }) => {
      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
      } else {
        window.location.href = '/api/drive-oauth/authorize'
      }
    })
  }

  const driveConnections = connections.filter((c) => c.provider_type === 'google_drive')

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">External APIs</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-6">Configure third-party API integrations. Existing connections are preserved. You can add multiple entries for the same source (e.g. different Drive folders).</p>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-900/50 border border-green-800 text-green-200' : 'bg-red-900/50 border border-red-800 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Twilio - Legacy */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">Twilio SMS API</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">For SMS notifications (existing connection)</p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={legacy.twilio.enabled} onChange={(e) => setLegacy((s) => ({ ...s, twilio: { ...s.twilio, enabled: e.target.checked } }))} className="sr-only" />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${legacy.twilio.enabled ? 'bg-[#C27E00]' : 'bg-gray-600'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${legacy.twilio.enabled ? 'transform translate-x-5' : ''}`} />
            </div>
          </label>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Account SID</label>
            <input type="text" value={legacy.twilio.accountSid} onChange={(e) => setLegacy((s) => ({ ...s, twilio: { ...s.twilio, accountSid: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Auth Token</label>
            <input type="password" value={legacy.twilio.authToken} onChange={(e) => setLegacy((s) => ({ ...s, twilio: { ...s.twilio, authToken: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" placeholder="Your auth token" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Phone Number</label>
            <input type="text" value={legacy.twilio.phoneNumber} onChange={(e) => setLegacy((s) => ({ ...s, twilio: { ...s.twilio, phoneNumber: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" placeholder="+1234567890" />
          </div>
          <button onClick={() => save('twilio_settings', legacy.twilio)} disabled={loading} className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      {/* WhatsApp - Legacy */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">WhatsApp Business API</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">For messaging (existing connection)</p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={legacy.whatsapp.enabled} onChange={(e) => setLegacy((s) => ({ ...s, whatsapp: { ...s.whatsapp, enabled: e.target.checked } }))} className="sr-only" />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${legacy.whatsapp.enabled ? 'bg-[#C27E00]' : 'bg-gray-600'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${legacy.whatsapp.enabled ? 'transform translate-x-5' : ''}`} />
            </div>
          </label>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">API Key</label>
            <input type="password" value={legacy.whatsapp.apiKey} onChange={(e) => setLegacy((s) => ({ ...s, whatsapp: { ...s.whatsapp, apiKey: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" placeholder="Your WhatsApp API key" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Phone Number ID</label>
            <input type="text" value={legacy.whatsapp.phoneNumberId} onChange={(e) => setLegacy((s) => ({ ...s, whatsapp: { ...s.whatsapp, phoneNumberId: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Business Account ID</label>
            <input type="text" value={legacy.whatsapp.businessAccountId} onChange={(e) => setLegacy((s) => ({ ...s, whatsapp: { ...s.whatsapp, businessAccountId: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" />
          </div>
          <button onClick={() => save('whatsapp_settings', legacy.whatsapp)} disabled={loading} className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      {/* Google Drive - Legacy (Primary) */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">Google Drive (Default)</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">Primary Drive connection for invoices and uploads. See docs/GOOGLE_DRIVE_SETUP.md</p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={legacy.googleDrive.enabled} onChange={(e) => setLegacy((s) => ({ ...s, googleDrive: { ...s.googleDrive, enabled: e.target.checked } }))} className="sr-only" />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${legacy.googleDrive.enabled ? 'bg-[#C27E00]' : 'bg-gray-600'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${legacy.googleDrive.enabled ? 'transform translate-x-5' : ''}`} />
            </div>
          </label>
        </div>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[#C27E00]/10 border border-[#C27E00]/30 mb-4">
            <h5 className="text-sm font-semibold text-[#C27E00] mb-2">OAuth 2.0</h5>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">OAuth Client ID</label>
                <input type="text" value={legacy.googleDrive.clientId} onChange={(e) => setLegacy((s) => ({ ...s, googleDrive: { ...s.googleDrive, clientId: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" placeholder="xxx.apps.googleusercontent.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">OAuth Client Secret</label>
                <input type="password" value={legacy.googleDrive.clientSecret} onChange={(e) => setLegacy((s) => ({ ...s, googleDrive: { ...s.googleDrive, clientSecret: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" placeholder="GOCSPX-xxx" />
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Redirect URI: /api/drive-oauth/callback</p>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={connectDriveOAuth} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors text-sm bg-[#C27E00] hover:bg-[#a06900] text-white disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{loading ? 'Saving...' : 'Connect to Google'}
              </button>
              {legacy.googleDrive.refreshToken && <span className="text-sm text-green-400">✓ Connected</span>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Root Folder ID</label>
            <input type="text" value={legacy.googleDrive.defaultFolderId} onChange={(e) => setLegacy((s) => ({ ...s, googleDrive: { ...s.googleDrive, defaultFolderId: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-gray-500 focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] sm:text-sm" placeholder="Drive folder ID" />
          </div>
          <hr className="border-zinc-300 dark:border-gray-700 my-4" />
          <p className="text-xs text-zinc-500 dark:text-gray-500">Service Account (optional):</p>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Service Account Email</label>
            <input type="text" value={legacy.googleDrive.serviceAccountEmail} onChange={(e) => setLegacy((s) => ({ ...s, googleDrive: { ...s.googleDrive, serviceAccountEmail: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Service Account Private Key</label>
            <textarea value={legacy.googleDrive.serviceAccountPrivateKey} onChange={(e) => setLegacy((s) => ({ ...s, googleDrive: { ...s.googleDrive, serviceAccountPrivateKey: e.target.value } }))} rows={3} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white font-mono text-sm" placeholder="-----BEGIN PRIVATE KEY-----" />
          </div>
          <button onClick={() => save('google_drive_settings', legacy.googleDrive)} disabled={loading} className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      {/* Additional Drive folders */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">Additional Google Drive Folders</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">Additional Drive connections for different folders (uses the same OAuth app)</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddDrive(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm bg-[#C27E00]/20 text-[#C27E00] hover:bg-[#C27E00]/30 border border-[#C27E00]/50"
          >
            <Plus className="h-4 w-4" /> Add Drive
          </button>
        </div>

        {showAddDrive && (
          <div className="mb-4 p-4 rounded-lg border border-zinc-300 dark:border-gray-700 bg-zinc-100/90 dark:bg-black/30 space-y-3">
            <h5 className="text-sm font-medium text-zinc-900 dark:text-white">Yeni Drive Bağlantısı</h5>
            <div>
              <label className="block text-sm text-zinc-500 dark:text-gray-400 mb-1">Label (örn. Statements, Reports)</label>
              <input type="text" value={newDriveLabel} onChange={(e) => setNewDriveLabel(e.target.value)} placeholder="Statements Folder" className="block w-full rounded border border-zinc-300 dark:border-gray-700 bg-zinc-100/90 dark:bg-black/30 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-500 dark:text-gray-400 mb-1">Folder ID (optional – can be updated after Connect)</label>
              <input type="text" value={newDriveFolderId} onChange={(e) => setNewDriveFolderId(e.target.value)} placeholder="Drive folder ID" className="block w-full rounded border border-zinc-300 dark:border-gray-700 bg-zinc-100/90 dark:bg-black/30 px-3 py-2 text-zinc-900 dark:text-white text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={addDriveConnection} disabled={loading} className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-[#C27E00] text-white disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add & Connect
              </button>
              <button onClick={() => { setShowAddDrive(false); setNewDriveLabel(''); setNewDriveFolderId('') }} className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:text-white text-sm">Cancel</button>
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {driveConnections.map((c) => {
            const isConnected = !!(c.config as { refreshToken?: string })?.refreshToken
            return (
              <li key={c.id} className="flex items-center justify-between rounded border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-black/20 px-4 py-3">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-white">{c.label}</span>
                  <span className="ml-2 text-xs text-zinc-500 dark:text-gray-500">Drive • {isConnected ? '✓ Connected' : 'Not connected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!isConnected && (
                    <a href={`/api/drive-oauth/authorize?connection_id=${c.id}`} className="text-xs text-[#C27E00] hover:underline">Connect</a>
                  )}
                  <button onClick={() => deleteConnection(c.id)} className="p-1.5 text-zinc-500 dark:text-gray-500 hover:text-red-400" title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            )
          })}
          {driveConnections.length === 0 && !showAddDrive && <li className="text-sm text-zinc-500 dark:text-gray-500 py-2">No additional Drive connections yet.</li>}
        </ul>
      </div>

      {/* DocuSign Production */}
      <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-1">DocuSign (Production)</h4>
            <p className="text-sm text-zinc-500 dark:text-gray-400">
              JWT integration for employment agreements and release forms. Connect webhook: /api/docusign/webhook
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={legacy.docusign.enabled} onChange={(e) => setLegacy((s) => ({ ...s, docusign: { ...s.docusign, enabled: e.target.checked } }))} className="sr-only" />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${legacy.docusign.enabled ? 'bg-[#C27E00]' : 'bg-gray-600'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${legacy.docusign.enabled ? 'transform translate-x-5' : ''}`} />
            </div>
          </label>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Integration Key</label>
              <input type="text" value={legacy.docusign.integrationKey} onChange={(e) => setLegacy((s) => ({ ...s, docusign: { ...s.docusign, integrationKey: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Account ID</label>
              <input type="text" value={legacy.docusign.accountId} onChange={(e) => setLegacy((s) => ({ ...s, docusign: { ...s.docusign, accountId: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Impersonated User ID</label>
              <input type="text" value={legacy.docusign.userId} onChange={(e) => setLegacy((s) => ({ ...s, docusign: { ...s.docusign, userId: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">API Base URI</label>
              <input type="text" value={legacy.docusign.baseUri} onChange={(e) => setLegacy((s) => ({ ...s, docusign: { ...s.docusign, baseUri: e.target.value } }))} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white sm:text-sm" placeholder="https://na4.docusign.net" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">RSA Private Key (PEM)</label>
            <textarea value={legacy.docusign.rsaPrivateKey} onChange={(e) => setLegacy((s) => ({ ...s, docusign: { ...s.docusign, rsaPrivateKey: e.target.value } }))} rows={5} className="block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-zinc-200/50 dark:bg-white/5 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs sm:text-sm" placeholder="-----BEGIN RSA PRIVATE KEY-----..." />
          </div>
          <button onClick={() => save('docusign_settings', legacy.docusign)} disabled={loading} className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50">{loading ? 'Saving...' : 'Save DocuSign Settings'}</button>
        </div>
      </div>
    </div>
  )
}
