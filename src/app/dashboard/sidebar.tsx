'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { LogOut, LayoutDashboard, FileText, Users, Settings, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DealerClock } from '@/components/dealer-clock'

interface Profile {
  role: string
  full_name?: string | null
  dealer_id?: string | null
}

export function Sidebar({ 
  profile, 
  timezoneName = null, 
  timezoneDisplayName 
}: { 
  profile: Profile
  timezoneName?: string | null
  timezoneDisplayName?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Define links based on role
  const role = profile.role
  const links = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  ]

  if (role === 'sales') {
    links.push({ name: 'Demands', href: '/dashboard/sales/demands', icon: FileText })
    links.push({ name: 'Reports', href: '/dashboard/sales/reports', icon: FileText })
  } else if (role === 'finance') {
    links.push({ name: 'Demands', href: '/dashboard/finance/demands', icon: FileText })
    links.push({ name: 'Reports', href: '/dashboard/finance/reports', icon: FileText })
  } else if (role === 'specialist') {
    links.push({ name: 'Work List', href: '/dashboard/specialist/work', icon: FileText })
    links.push({ name: 'Reports', href: '/dashboard/specialist/reports', icon: FileText })
  } else if (['aurora_manager', 'general_manager'].includes(role)) {
    links.push({ name: 'Demands', href: '/dashboard/admin/demands', icon: FileText })
    links.push({ name: 'Reports', href: '/dashboard/admin/reports', icon: FileText })
    links.push({ name: 'Employees', href: '/dashboard/admin/employees', icon: Users })
    
    if (role === 'aurora_manager') {
      links.push({ name: 'Invoice', href: '/dashboard/admin/invoices', icon: Receipt })
      links.push({ name: 'System Management', href: '/dashboard/system-management', icon: Settings })
    }
  }

  return (
    <div className="flex w-64 flex-col bg-black text-white border-r border-gray-800">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Dealer Clock - Top of Sidebar */}
        {timezoneName && (
          <div className="px-4 pt-6 pb-4 border-b border-gray-800">
            <DealerClock timezoneName={timezoneName} timezoneDisplayName={timezoneDisplayName} />
          </div>
        )}
        
        <nav className="flex-1 space-y-1 px-4 py-6">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.name}
                href={link.href}
                className={clsx(
                  pathname.startsWith(link.href) && link.href !== '/dashboard' || (pathname === '/dashboard' && link.href === '/dashboard')
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white',
                  'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors'
                )}
              >
                <Icon className={clsx(
                  "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                  pathname.startsWith(link.href) ? "text-[#C27E00]" : "text-gray-500 group-hover:text-gray-300"
                )} />
                {link.name}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="border-t border-gray-800 p-6">
        <div className="flex items-center mb-6">
          <div className="ml-0">
            <p className="text-sm font-medium text-white">{profile.full_name || 'User'}</p>
            <p className="text-xs font-medium text-gray-500 capitalize">{role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center rounded-md bg-white/5 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  )
}

