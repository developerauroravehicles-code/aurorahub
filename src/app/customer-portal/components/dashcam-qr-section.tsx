'use client'

import {
  CUSTOMER_PORTAL_QR_PATH,
  resolveDashcamAppLinks,
} from '@/lib/dashcam-app-links'

type Props = {
  cameraModel: string
}

function qrApiSrc(data: string, size = 152): string {
  return `/api/qr?size=${size}&data=${encodeURIComponent(data)}`
}

function QrTile({
  heading,
  subtitle,
  src,
  href,
}: {
  heading: string
  subtitle: string
  src: string
  href?: string
}) {
  const inner = (
    <>
      <p className="text-xs font-semibold text-zinc-900 dark:text-white">{heading}</p>
      <div className="flex h-[76px] w-[76px] items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white p-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={heading}
          width={72}
          height={72}
          className="h-[72px] w-[72px] object-contain"
          loading="lazy"
        />
      </div>
      <p className="text-[10px] leading-tight text-zinc-500 dark:text-gray-400">{subtitle}</p>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-2 flex flex-col items-center text-center gap-1.5 hover:border-[#C27E00]/50 transition-colors"
      >
        {inner}
      </a>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-2 flex flex-col items-center text-center gap-1.5">
      {inner}
    </div>
  )
}

export function DashcamQrSection({ cameraModel }: Props) {
  const model = cameraModel.trim()
  if (!model) return null

  const links = resolveDashcamAppLinks(model)

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 space-y-2">
      <p className="text-xs text-zinc-500 dark:text-gray-500">
        Scan for support, portal access, and the {links.appName} mobile app.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <QrTile
          heading="Customer Portal"
          subtitle="Support & portal"
          src={CUSTOMER_PORTAL_QR_PATH}
        />
        <QrTile
          heading="IOS"
          subtitle={`${links.appName} · Scan`}
          src={qrApiSrc(links.iosUrl)}
          href={links.iosUrl}
        />
        <QrTile
          heading="Android"
          subtitle={`${links.appName} · Scan`}
          src={qrApiSrc(links.androidUrl)}
          href={links.androidUrl}
        />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <a
          href={links.iosUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#C27E00] hover:underline"
        >
          Open IOS App Store
        </a>
        <a
          href={links.androidUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#C27E00] hover:underline"
        >
          Open Android Play Store
        </a>
      </div>
    </div>
  )
}
