'use client'

import { ExternalLink, BookOpen, Camera } from 'lucide-react'
import type { CustomerPortalRow, PortalTroubleshootingItem } from '@/types/customer-portal'
import { DashcamQrSection } from './dashcam-qr-section'

type Props = {
  row: CustomerPortalRow
}

function parseTroubleshooting(raw: unknown): PortalTroubleshootingItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is PortalTroubleshootingItem => {
      if (!item || typeof item !== 'object') return false
      const o = item as Record<string, unknown>
      return typeof o.title === 'string' && typeof o.body === 'string'
    })
    .map((item) => ({
      title: item.title.trim(),
      body: item.body.trim(),
    }))
    .filter((item) => item.title && item.body)
}

export function CameraInfoPanel({ row }: Props) {
  const imageUrl = row.camera_image_url?.trim()
  const manualUrl = row.camera_manual_url?.trim()
  const troubleshooting = parseTroubleshooting(row.camera_troubleshooting)
  const cameraModel = (row.camera_model ?? '').trim()
  const hasDashcamDetails = Boolean(imageUrl || manualUrl || troubleshooting.length)

  // Always show when we have a camera model (QR section) or catalog extras
  if (!cameraModel && !hasDashcamDetails) return null

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <Camera className="h-4 w-4 text-[#C27E00]" />
        Your dashcam
        {cameraModel ? `: ${cameraModel}` : ''}
      </h3>

      {imageUrl ? (
        <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={cameraModel ? `${cameraModel} dashcam` : 'Dashcam'}
            className="w-full max-h-48 object-contain bg-zinc-100 dark:bg-zinc-950"
          />
        </div>
      ) : null}

      {manualUrl ? (
        <a
          href={manualUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#C27E00] hover:underline"
        >
          <BookOpen className="h-4 w-4" />
          Download user manual
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}

      {troubleshooting.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Common issues & tips</p>
          <ul className="space-y-2">
            {troubleshooting.map((item, i) => (
              <li
                key={`${item.title}-${i}`}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-3 text-xs"
              >
                <p className="font-semibold text-zinc-800 dark:text-gray-200">{item.title}</p>
                <p className="text-zinc-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Always render when camera model exists — do not gate on catalog media */}
      {cameraModel ? <DashcamQrSection cameraModel={cameraModel} /> : null}
    </section>
  )
}
