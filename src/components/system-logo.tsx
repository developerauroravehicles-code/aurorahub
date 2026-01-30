import { getSystemLogo } from '@/app/dashboard/admin/system-management/logo/actions'

export async function SystemLogo() {
  const logoUrl = await getSystemLogo()
  
  if (!logoUrl) {
    return (
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">Aurora Vehicles</h1>
        <p className="text-xl text-gray-400">Auto Dashcam & Accessories</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <img
        src={logoUrl}
        alt="Aurora Vehicles Logo"
        className="max-w-xs max-h-48 object-contain mb-4"
      />
    </div>
  )
}
