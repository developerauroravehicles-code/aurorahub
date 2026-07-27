'use client'

import { Mail, Phone, Clock } from 'lucide-react'
import type { PortalContactInfo } from '@/types/customer-portal'

type Props = {
  contact: PortalContactInfo | null
}

export function PortalContactPanel({ contact }: Props) {
  if (!contact) return null
  const { phone, email, hours } = contact
  if (!phone?.trim() && !email?.trim() && !hours?.trim()) return null

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Contact Aurora</h3>
      <ul className="text-sm text-zinc-700 dark:text-gray-300 space-y-1.5">
        {phone?.trim() ? (
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#C27E00] shrink-0" />
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-[#C27E00] hover:underline">
              {phone.trim()}
            </a>
          </li>
        ) : null}
        {email?.trim() ? (
          <li className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#C27E00] shrink-0" />
            <a href={`mailto:${email.trim()}`} className="hover:text-[#C27E00] hover:underline">
              {email.trim()}
            </a>
          </li>
        ) : null}
        {hours?.trim() ? (
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-[#C27E00] shrink-0 mt-0.5" />
            <span>{hours.trim()}</span>
          </li>
        ) : null}
      </ul>
    </section>
  )
}
