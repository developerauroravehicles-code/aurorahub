import { getSystemLogo } from '@/lib/get-system-logo'
import { WhitepaperDownload } from './whitepaper-download'
import { PitchDeckDownload } from './pitch-deck-download'

export default async function WhitepaperPage() {
  const logoDataUrl = await getSystemLogo()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Documents & Presentations</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-gray-500">
          Download the whitepaper or pitch deck as PDF.
        </p>
      </div>
      <div className="space-y-4">
        <WhitepaperDownload />
        <PitchDeckDownload logoDataUrl={logoDataUrl} />
      </div>
    </div>
  )
}
