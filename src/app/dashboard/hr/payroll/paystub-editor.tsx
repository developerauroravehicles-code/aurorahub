'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { downloadPayStubPdf } from '@/lib/generate-paystub-pdf'
import { computeEffectiveGrossAndNet, type ExtraEarningLine } from './payroll-utils'
import { updatePaymentDeductionMetadata } from './actions'
import { ExtraEarningsInput } from './extra-earnings-input'
import { Download, Loader2 } from 'lucide-react'

type PaymentStub = {
  id: string
  personnel_id: string
  personnel: { full_name: string | null } | null
  payment_type: string | null
  period_start: string | null
  period_end: string | null
  completed_count: number | null
  deduction_metadata: Record<string, number | unknown> | null
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  salary: 'Salary',
  hourly: 'Hourly',
  per_installation: 'Per Installation',
  per_completed_tiered: 'Per Completed (Tiered)',
  commission: 'Commission',
  bonus: 'Bonus',
  job_based: 'Job Based',
  dealer_commission: 'Dealer Commission',
  platform_commission: 'Platform Commission',
}

function parseExtras(meta: Record<string, unknown> | null): ExtraEarningLine[] {
  if (!meta) return []
  const x = meta.extra_earnings
  if (!Array.isArray(x)) return []
  const out: ExtraEarningLine[] = []
  for (const row of x) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const amount = typeof o.amount === 'number' ? o.amount : parseFloat(String(o.amount ?? 0))
    if (!Number.isFinite(amount) || amount <= 0) continue
    out.push({
      id: typeof o.id === 'string' && o.id.length ? o.id : crypto.randomUUID(),
      label: (typeof o.label === 'string' ? o.label : 'Extra payment').trim() || 'Extra payment',
      amount: Math.round(amount * 100) / 100,
    })
  }
  return out
}

function metaNumber(meta: Record<string, unknown>, key: string): number {
  const v = meta[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const p = parseFloat(String(v ?? 0))
  return Number.isFinite(p) ? p : 0
}

const inputClass =
  'w-full min-w-0 rounded border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/40 px-2 py-1.5 text-sm text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00]'

export function PayStubEditor({ payment }: { payment: PaymentStub }) {
  const router = useRouter()
  const meta = (payment.deduction_metadata ?? {}) as Record<string, unknown>

  const [gross, setGross] = useState(() => metaNumber(meta, 'gross'))
  const [cpp, setCpp] = useState(() => metaNumber(meta, 'cpp'))
  const [ei, setEi] = useState(() => metaNumber(meta, 'ei'))
  const [federalTax, setFederalTax] = useState(() => metaNumber(meta, 'federal_tax'))
  const [provTax, setProvTax] = useState(() => metaNumber(meta, 'provincial_tax'))
  const [extras, setExtras] = useState<ExtraEarningLine[]>(() => parseExtras(meta))

  useEffect(() => {
    const m = (payment.deduction_metadata ?? {}) as Record<string, unknown>
    setGross(metaNumber(m, 'gross'))
    setCpp(metaNumber(m, 'cpp'))
    setEi(metaNumber(m, 'ei'))
    setFederalTax(metaNumber(m, 'federal_tax'))
    setProvTax(metaNumber(m, 'provincial_tax'))
    setExtras(parseExtras(m))
  }, [payment.id, payment.deduction_metadata])

  const { effectiveGross, net } = useMemo(
    () => computeEffectiveGrossAndNet(gross, extras, cpp, ei, federalTax, provTax),
    [gross, extras, cpp, ei, federalTax, provTax]
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    setSaving(true)
    const result = await updatePaymentDeductionMetadata(payment.id, {
      gross,
      cpp,
      ei,
      federal_tax: federalTax,
      provincial_tax: provTax,
      extra_earnings: extras.map((e) => ({ ...e })),
    })
    setSaving(false)
    if (result?.error) setError(result.error)
    else router.refresh()
  }

  function handleDownloadPdf() {
    downloadPayStubPdf({
      employeeName: payment.personnel?.full_name?.trim() || 'Employee',
      periodLabel:
        payment.period_start && payment.period_end
          ? `${new Date(payment.period_start).toLocaleDateString()} – ${new Date(payment.period_end).toLocaleDateString()}`
          : null,
      paymentTypeLabel: PAYMENT_TYPE_LABELS[payment.payment_type ?? ''] ?? payment.payment_type ?? null,
      gross,
      extraEarnings: extras.map((e) => ({ label: e.label, amount: e.amount })),
      cpp,
      ei,
      federal_tax: federalTax,
      provincial_tax: provTax,
      net,
      documentKind: 'record',
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <dl className="space-y-3 text-sm rounded-lg border border-zinc-200 dark:border-gray-700 bg-zinc-50/90 dark:bg-black/20 p-4">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <dt className="text-zinc-500 dark:text-gray-400">Base gross earnings (CAD)</dt>
          <dd className="w-36 shrink-0">
            <input type="number" step="0.01" min="0" className={inputClass} value={gross || ''} onChange={(e) => setGross(parseFloat(e.target.value) || 0)} />
          </dd>
        </div>

        <div className="border-t border-zinc-200 dark:border-gray-700 pt-3">
          <ExtraEarningsInput variant="stub" extras={extras} onChange={setExtras} />
        </div>

        <div className="flex justify-between text-zinc-700 dark:text-gray-200 pt-2 border-t border-zinc-200 dark:border-gray-700">
          <dt>Effective gross (gross + extras)</dt>
          <dd className="font-medium">{effectiveGross.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD</dd>
        </div>

        <div className="flex flex-wrap justify-between gap-2 items-center">
          <dt className="text-zinc-500 dark:text-gray-400">CPP (deduction CAD)</dt>
          <dd className="w-36 shrink-0">
            <input type="number" step="0.01" min="0" className={inputClass} value={cpp || ''} onChange={(e) => setCpp(parseFloat(e.target.value) || 0)} />
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <dt className="text-zinc-500 dark:text-gray-400">EI (deduction CAD)</dt>
          <dd className="w-36 shrink-0">
            <input type="number" step="0.01" min="0" className={inputClass} value={ei || ''} onChange={(e) => setEi(parseFloat(e.target.value) || 0)} />
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <dt className="text-zinc-500 dark:text-gray-400">Federal tax (CAD)</dt>
          <dd className="w-36 shrink-0">
            <input type="number" step="0.01" min="0" className={inputClass} value={federalTax || ''} onChange={(e) => setFederalTax(parseFloat(e.target.value) || 0)} />
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <dt className="text-zinc-500 dark:text-gray-400">Provincial tax — BC (CAD)</dt>
          <dd className="w-36 shrink-0">
            <input type="number" step="0.01" min="0" className={inputClass} value={provTax || ''} onChange={(e) => setProvTax(parseFloat(e.target.value) || 0)} />
          </dd>
        </div>

        <div className="flex justify-between border-t border-zinc-300 dark:border-gray-700 pt-3 mt-2">
          <dt className="font-medium text-zinc-900 dark:text-white">Net pay (computed)</dt>
          <dd className={`font-semibold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {net.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD
          </dd>
        </div>
      </dl>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#C27E00] text-white text-sm hover:bg-[#a06900] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save stub to payment
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white text-sm border border-zinc-300 dark:border-gray-700 hover:bg-zinc-300 dark:hover:bg-white/20"
        >
          <Download className="w-4 h-4" /> Download PDF (current values)
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-gray-500">
        Net pay = effective gross − CPP − EI − federal − provincial (after save, the payment &quot;Net&quot; column matches this figure).
      </p>
    </div>
  )
}
