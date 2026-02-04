import { redirect } from 'next/navigation'

export default async function SystemManagementPage() {
  // Redirect to user management as default
  redirect('/dashboard/admin/system-management/user')
}
