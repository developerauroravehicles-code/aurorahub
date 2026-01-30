import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
      <p className="mt-4 text-gray-400">Welcome to AuroraHub. Select an option from the sidebar to get started.</p>
    </div>
  )
}

