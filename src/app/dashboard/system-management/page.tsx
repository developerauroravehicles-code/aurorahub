import { redirect } from 'next/navigation'

export default async function SystemManagementPage() {
  redirect('/dashboard/identity')
}
