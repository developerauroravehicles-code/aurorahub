import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customer Portal — Aurora Vehicles',
  description:
    'Look up your dashcam installation appointment, warranty information, and rate your specialist using your vehicle VIN.',
  openGraph: {
    title: 'Customer Portal — Aurora Vehicles',
    description: 'Track installation status and warranty by VIN.',
  },
}

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return children
}
