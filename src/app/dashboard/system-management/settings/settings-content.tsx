'use client'

import { Settings, Key } from 'lucide-react'
import Link from 'next/link'

export function SettingsContent({ keys }: { keys: string[] }) {
  const settingGroups: Record<string, string> = {
    sms_settings: 'SMS',
    mail_settings: 'Mail',
    mail_logs: 'Mail Logs',
  }

  return (
    <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
      <div className="space-y-4">
        {keys.length === 0 ? (
          <p className="text-gray-500 py-6 text-center">Henüz sistem ayarı tanımlanmamış.</p>
        ) : (
          <div className="grid gap-3">
            {keys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/30 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-gray-500" />
                  <span className="text-white font-mono text-sm">{key}</span>
                  {settingGroups[key] && (
                    <span className="text-xs text-gray-500">({settingGroups[key]})</span>
                  )}
                </div>
                <span className="text-gray-500 text-xs">***</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 pt-4 border-t border-gray-800">
        <p className="text-sm text-gray-500 mb-2">İlgili ayarlar:</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/infrastructure/sms"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 text-sm"
          >
            <Settings className="h-3 w-3" /> SMS
          </Link>
          <Link
            href="/dashboard/infrastructure/mail"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 text-sm"
          >
            <Settings className="h-3 w-3" /> Mail
          </Link>
        </div>
      </div>
    </div>
  )
}
