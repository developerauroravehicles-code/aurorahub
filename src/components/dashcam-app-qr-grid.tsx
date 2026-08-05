'use client'

import { useEffect, useState } from 'react'
import { CUSTOMER_PORTAL_QR_PATH, resolveDashcamAppLinks } from '@/lib/dashcam-app-links'
import { loadImageAsDataUrl } from '@/lib/generate-qr-data-url'

async function createQrDataUrl(text: string, size: number): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}

type Props = {
  cameraModel: string | null
  variant?: 'screen' | 'print'
  layout?: 'default' | 'compact'
  onReadyChange?: (ready: boolean) => void
  qrSize?: number
}

type QrCardProps = {
  heading: string
  subtitle: string
  src: string | null
  loading?: boolean
  variant: 'screen' | 'print'
  layout: 'default' | 'compact'
  qrSize?: number
}

function QrCard({ heading, subtitle, src, loading, variant, layout, qrSize = 120 }: QrCardProps) {
  const isPrint = variant === 'print'
  const isCompact = layout === 'compact' && !isPrint

  return (
    <div
      className={
        isPrint
          ? 'demand-handoff-qr-card'
          : isCompact
            ? 'rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-2 flex flex-col items-center text-center gap-1.5'
            : 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-3 flex flex-col items-center text-center gap-2'
      }
    >
      <p
        className={
          isPrint ? 'demand-handoff-qr-card-title demand-handoff-qr-heading' : 'text-xs font-semibold text-zinc-900 dark:text-white'
        }
      >
        {heading}
      </p>

      <div
        className={
          isPrint
            ? 'demand-handoff-qr-image-wrap'
            : 'flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700'
        }
        style={isPrint ? undefined : { width: qrSize, height: qrSize }}
      >
        {loading || !src ? (
          <div
            className={
              isPrint ? 'demand-handoff-qr-skeleton' : 'w-full h-full animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-lg'
            }
            aria-hidden="true"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={heading}
            width={qrSize}
            height={qrSize}
            className={isPrint ? 'demand-handoff-qr-image' : 'object-contain shrink-0'}
            style={{ width: qrSize, height: qrSize, maxWidth: '100%', maxHeight: '100%' }}
          />
        )}
      </div>

      <p
        className={
          isPrint
            ? 'demand-handoff-qr-card-subtitle'
            : isCompact
              ? 'text-[10px] leading-tight text-zinc-500 dark:text-gray-400'
              : 'text-[11px] text-zinc-500 dark:text-gray-400'
        }
      >
        {subtitle}
      </p>
    </div>
  )
}

export function DashcamAppQrGrid({
  cameraModel,
  variant = 'screen',
  layout = 'default',
  onReadyChange,
  qrSize: qrSizeProp,
}: Props) {
  const isPrint = variant === 'print'
  const qrSize = qrSizeProp ?? (isPrint ? 68 : 120)
  const links = resolveDashcamAppLinks(cameraModel)

  const [portalQr, setPortalQr] = useState<string | null>(isPrint ? null : CUSTOMER_PORTAL_QR_PATH)
  const [androidQr, setAndroidQr] = useState<string | null>(null)
  const [iosQr, setIosQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAssets() {
      setLoading(true)
      onReadyChange?.(false)
      try {
        const portalPromise = isPrint
          ? loadImageAsDataUrl(CUSTOMER_PORTAL_QR_PATH)
          : Promise.resolve(CUSTOMER_PORTAL_QR_PATH)
        const [portal, android, ios] = await Promise.all([
          portalPromise,
          createQrDataUrl(links.androidUrl, qrSize * 2),
          createQrDataUrl(links.iosUrl, qrSize * 2),
        ])
        if (!cancelled) {
          setPortalQr(portal)
          setAndroidQr(android)
          setIosQr(ios)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          onReadyChange?.(true)
        }
      }
    }

    void loadAssets()
    return () => {
      cancelled = true
    }
  }, [isPrint, links.androidUrl, links.iosUrl, onReadyChange, qrSize])

  const gridClass = isPrint
    ? 'demand-handoff-qr-grid'
    : layout === 'compact'
      ? 'grid grid-cols-3 gap-2'
      : 'grid gap-3 grid-cols-1 sm:grid-cols-3'

  return (
    <div className={gridClass}>
      <QrCard
        variant={variant}
        layout={layout}
        heading="Customer Portal"
        subtitle="Support & portal access"
        src={portalQr}
        loading={isPrint && !portalQr}
        qrSize={qrSize}
      />
      <QrCard
        variant={variant}
        layout={layout}
        heading="IOS"
        subtitle={`${links.appName} · Scan to download`}
        src={iosQr}
        loading={loading}
        qrSize={qrSize}
      />
      <QrCard
        variant={variant}
        layout={layout}
        heading="Android"
        subtitle={`${links.appName} · Scan to download`}
        src={androidQr}
        loading={loading}
        qrSize={qrSize}
      />
    </div>
  )
}
