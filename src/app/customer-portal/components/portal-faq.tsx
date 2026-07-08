'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'Where can I find my VIN?',
    a: 'Your VIN is a 17-character code on your dashboard (visible through the windshield), driver door jamb, or registration documents. You can enter the full VIN or the last 6 characters.',
  },
  {
    q: 'Why is my installation still pending approval?',
    a: 'Your dealer reviews each request before scheduling. Status updates automatically on this page — use Refresh status or check back later.',
  },
  {
    q: 'How do I reschedule or cancel?',
    a: 'Contact your dealer using the phone number shown on your installation card. Changes cannot be made directly through this portal.',
  },
  {
    q: 'When does my warranty start?',
    a: 'Installation warranty coverage begins when your job is marked completed. The coverage period is set by your dealer (typically 1–5 years from completion).',
  },
  {
    q: 'Can I get an invoice here?',
    a: 'This portal shows installation and warranty information only. For invoices or billing, contact your dealer directly.',
  },
]

export function PortalFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/50 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
        <HelpCircle className="h-5 w-5 text-[#C27E00]" />
        Frequently asked questions
      </h2>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index
          return (
            <div key={item.q} className="py-3">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-start justify-between gap-3 text-left text-sm font-medium text-zinc-800 dark:text-gray-200"
                aria-expanded={isOpen}
              >
                {item.q}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 mt-0.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-gray-400 leading-relaxed">{item.a}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
