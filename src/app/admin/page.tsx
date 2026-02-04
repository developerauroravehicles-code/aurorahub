import { redirect } from 'next/navigation'

export default async function AdminPage() {
  // Redirect to System Management
  redirect('/dashboard/system-management/user')
}

