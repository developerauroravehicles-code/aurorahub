'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Mail, Plus, Trash2, X } from 'lucide-react'
import { addDealerInvoiceEmail, removeDealerInvoiceEmail } from '../region/actions'
import type { DealerInvoiceEmail } from '@/types/system-management'

export function DealerInvoiceEmailsManagement({
  dealerId,
  dealerName,
  emails,
}: {
  dealerId: string
  dealerName: string
  emails: DealerInvoiceEmail[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    const r = await addDealerInvoiceEmail(dealerId, newEmail, newLabel)
    setPending(false)
    if (!r.success) {
      setError(r.error ?? 'Failed to add email')
      return
    }
    setNewEmail('')
    setNewLabel('')
    router.refresh()
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this invoice email?')) return
    setPending(true)
    const r = await removeDealerInvoiceEmail(id)
    setPending(false)
    if (!r.success) alert(r.error ?? 'Failed to remove')
    else router.refresh()
  }

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="invoice-emails-title"
              className="w-full max-w-md min-w-0 overflow-hidden rounded-lg border border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-900 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-gray-800 px-4 py-3">
                <div className="min-w-0">
                  <h3
                    id="invoice-emails-title"
                    className="text-lg font-semibold text-zinc-900 dark:text-white"
                  >
                    Invoice emails
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-gray-400 truncate">{dealerName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[min(60vh,28rem)] overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
                {emails.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-gray-500">No invoice emails configured.</p>
                ) : (
                  <ul className="space-y-2">
                    {emails.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-2 rounded border border-zinc-200 dark:border-gray-700 px-3 py-2 text-sm min-w-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-zinc-900 dark:text-white break-all">{row.email}</p>
                          {row.label && (
                            <p className="text-xs text-zinc-500 dark:text-gray-500 truncate">{row.label}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleRemove(row.id)}
                          className="shrink-0 text-red-500 hover:text-red-400 disabled:opacity-50"
                          aria-label="Remove email"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  onSubmit={handleAdd}
                  className="space-y-3 border-t border-zinc-200 dark:border-gray-800 pt-4 min-w-0"
                >
                  <p className="text-sm font-medium text-zinc-800 dark:text-gray-200">Add email</p>
                  <div className="space-y-2 min-w-0">
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="billing@dealer.com"
                      className="box-border w-full min-w-0 rounded border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-gray-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Label (optional)"
                      className="box-border w-full min-w-0 rounded border border-zinc-300 dark:border-gray-700 bg-zinc-50 dark:bg-gray-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                  {error && <p className="text-sm text-red-500 break-words">{error}</p>}
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded bg-[#C27E00] hover:bg-[#a06900] text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    Add
                  </button>
                </form>
              </div>

              <div className="border-t border-zinc-200 dark:border-gray-800 px-4 py-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border border-zinc-300 dark:border-gray-600 px-4 py-2 text-sm text-zinc-800 dark:text-gray-200 hover:bg-zinc-100 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-zinc-600 hover:bg-zinc-500 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5"
        title="Invoice email recipients"
      >
        <Mail className="w-4 h-4 shrink-0" />
        <span className="truncate">Invoice emails{emails.length > 0 ? ` (${emails.length})` : ''}</span>
      </button>
      {modal}
    </>
  )
}
