'use client'

import { useState, useEffect } from 'react'
import { Mail, Send, Info } from 'lucide-react'
import { loadMailSettings, saveMailSettingsAction, sendTestEmail } from './actions'
import type { MailSettings } from '@/lib/mail-sender'

export function MailSettingsContent() {
  const [settings, setSettings] = useState<Partial<MailSettings>>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    fromEmail: '',
    fromName: 'AuroraHub',
    enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadMailSettings().then((res) => {
      if (res.settings) {
        setSettings((prev) => ({ ...prev, ...res.settings }))
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const res = await saveMailSettingsAction(settings)
    setSaving(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setMessage({ type: 'success', text: 'Mail settings saved.' })
    }
  }

  const handleTest = async () => {
    if (!testEmail.trim()) {
      setMessage({ type: 'error', text: 'Enter test email address.' })
      return
    }
    setTesting(true)
    setMessage(null)
    const res = await sendTestEmail(testEmail.trim())
    setTesting(false)
    if (res.success) {
      setMessage({ type: 'success', text: `Test email sent to ${testEmail}.` })
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Send failed.' })
    }
  }

  if (loading) {
    return <div className="text-zinc-500 dark:text-gray-400 py-8 text-center">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Mail Settings</h3>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-4">
          Configure your Gmail SMTP account. Email reports and automation notifications will be sent from this account.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-800 text-green-200'
              : 'bg-red-900/50 border border-red-800 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-zinc-100/90 dark:bg-black/30 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="enabled"
            checked={settings.enabled ?? false}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
          />
          <label htmlFor="enabled" className="text-sm font-medium text-zinc-600 dark:text-gray-300">
            Enable mail sending
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">SMTP Host</label>
            <input
              type="text"
              value={settings.host ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, host: e.target.value }))}
              placeholder="smtp.gmail.com"
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Port</label>
            <input
              type="number"
              value={settings.port ?? 587}
              onChange={(e) => setSettings((s) => ({ ...s, port: parseInt(e.target.value) || 587 }))}
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="secure"
              checked={settings.secure ?? false}
              onChange={(e) => setSettings((s) => ({ ...s, secure: e.target.checked }))}
              className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
            />
            <label htmlFor="secure" className="text-sm text-zinc-600 dark:text-gray-300">SSL/TLS (for port 465)</label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={settings.user ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, user: e.target.value }))}
              placeholder="your-email@gmail.com"
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">App Password</label>
            <input
              type="password"
              value={settings.password ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, password: e.target.value }))}
              placeholder="Leave blank to keep current password"
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Sender email</label>
            <input
              type="email"
              value={settings.fromEmail ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, fromEmail: e.target.value.toLowerCase() }))}
              placeholder="your-email@gmail.com"
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-1">Sender name</label>
            <input
              type="text"
              value={settings.fromName ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, fromName: e.target.value }))}
              placeholder="AuroraHub"
              className="w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-gray-800 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#C27E00] hover:bg-[#a06900] text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value.toLowerCase())}
              placeholder="Test email address"
              className="border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 text-zinc-900 dark:text-white rounded px-3 py-2 text-sm w-56 focus:ring-1 focus:ring-[#C27E00]"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !settings.enabled}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {testing ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-5">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-zinc-600 dark:text-gray-300 space-y-3">
            <h4 className="font-medium text-blue-200">Gmail SMTP setup</h4>
            <ol className="list-decimal list-inside space-y-2 text-zinc-500 dark:text-gray-400">
              <li>Use SMTP Host: <code className="text-zinc-600 dark:text-gray-300">smtp.gmail.com</code> and Port: <code className="text-zinc-600 dark:text-gray-300">587</code> (STARTTLS). For port 465, enable SSL/TLS.</li>
              <li>Username: your full Gmail address (e.g. <code className="text-zinc-600 dark:text-gray-300">you@gmail.com</code>).</li>
              <li>Password: use an <strong>App Password</strong>, not your regular Gmail password. Enable 2-Step Verification first, then go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-[#C27E00] hover:underline">Google App Passwords</a> to generate one.</li>
              <li>Sender email and username should match your Gmail address.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
