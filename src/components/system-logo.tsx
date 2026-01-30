import { getSystemLogo } from '@/app/dashboard/admin/system-management/logo/actions'

export async function SystemLogo() {
  const logoUrl = await getSystemLogo()
  
  if (!logoUrl) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-[12rem] font-bold tracking-wider text-white" style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}>A</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <img
        src={logoUrl}
        alt="Aurora Vehicles Logo"
        className="max-w-xl max-h-[30rem] object-contain brightness-0 invert"
      />
    </div>
  )
}
