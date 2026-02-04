import { redirect } from 'next/navigation'

export default async function AdminPage() {
  // Redirect to System Management
  redirect('/dashboard/admin/system-management/user')
}

