import { getSystemLogo } from '@/app/dashboard/admin/system-management/logo/actions'

export async function SystemLogo() {
  const logoUrl = await getSystemLogo()
  
  if (!logoUrl) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-9xl font-bold tracking-wider text-white mb-3" style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}>A</div>
        <p className="text-2xl font-semibold text-white tracking-wider uppercase mb-2">AURORA VEHICLES</p>
        <p className="text-xl font-medium text-gray-300 tracking-wide">Auto Dash Cam & Accessories</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <img
        src={logoUrl}
        alt="Aurora Vehicles Logo"
        className="max-w-md max-h-96 object-contain mb-3 brightness-0 invert"
      />
      <p className="text-2xl font-semibold text-white tracking-wider uppercase mb-2">AURORA VEHICLES</p>
      <p className="text-xl font-medium text-gray-300 tracking-wide">Auto Dash Cam & Accessories</p>
    </div>
  )
}
