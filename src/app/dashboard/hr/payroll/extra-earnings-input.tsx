'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { ExtraEarningLine } from './payroll-utils'

export const EXTRA_PAYMENT_PRESETS = ['Bonus', 'Commission', 'Overtime'] as const

const inputForm =
  'w-full min-w-0 rounded border border-zinc-300 dark:border-gray-700 bg-zinc-200 dark:bg-gray-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]'

const inputStub =
  'w-full min-w-0 rounded border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/40 px-2 py-1.5 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]'

const presetBtn =
  'rounded border border-zinc-300 dark:border-gray-600 bg-zinc-100 dark:bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-800 dark:text-gray-200 hover:bg-zinc-200 dark:hover:bg-white/20'

type Props = {
  extras: ExtraEarningLine[]
  onChange: (next: ExtraEarningLine[]) => void
  variant?: 'form' | 'stub'
  /** Section title */
  title?: string
  /** Short helper under title */
  hint?: string
}

export function ExtraEarningsInput({
  extras,
  onChange,
  variant = 'form',
  title = 'Extra payments (added to gross)',
  hint = 'Bonus, commission, overtime, etc. Gross CAD. Base gross + extra rows = effective gross.',
}: Props) {
  const ic = variant === 'stub' ? inputStub : inputForm

  function appendRow(initialLabel = '') {
    onChange([...extras, { id: crypto.randomUUID(), label: initialLabel, amount: 0 }])
  }

  function updateExtra(id: string, patch: Partial<Pick<ExtraEarningLine, 'label' | 'amount'>>) {
    onChange(extras.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  function removeExtra(id: string) {
    onChange(extras.filter((e) => e.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`${variant === 'stub' ? 'text-sm font-medium text-zinc-600 dark:text-gray-300' : 'text-xs font-medium text-zinc-600 dark:text-gray-300'}`}>
            {title}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-gray-500 mt-0.5 leading-snug">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => appendRow()}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs bg-zinc-200 dark:bg-white/10 dark:border-gray-600 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-white/20"
        >
          <Plus className="w-3.5 h-3.5" /> Add row
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick add">
        <span className="w-full text-[10px] uppercase tracking-wide text-zinc-500 dark:text-gray-500 sm:w-auto sm:mr-1">Quick:</span>
        {EXTRA_PAYMENT_PRESETS.map((p) => (
          <button key={p} type="button" className={presetBtn} onClick={() => appendRow(p)}>
            {p}
          </button>
        ))}
        <button type="button" className={presetBtn} onClick={() => appendRow()}>
          Other
        </button>
      </div>

      {extras.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-gray-500">No rows yet — optional.</p>
      ) : (
        <ul className="space-y-2">
          {extras.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Description"
                className={`${ic} flex-1 min-w-[140px]`}
                value={row.label}
                onChange={(e) => updateExtra(row.id, { label: e.target.value })}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Gross CAD"
                className={`${ic} w-28`}
                value={row.amount || ''}
                onChange={(e) => updateExtra(row.id, { amount: parseFloat(e.target.value) || 0 })}
              />
              <button type="button" onClick={() => removeExtra(row.id)} className="p-2 text-zinc-500 hover:text-red-500" aria-label="Remove row">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
