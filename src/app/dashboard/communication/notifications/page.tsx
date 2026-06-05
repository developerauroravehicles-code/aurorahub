import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsContent } from '@/components/communication/notifications-content'
import { getNotificationsAction } from '@/app/dashboard/communication/actions'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const res = await getNotificationsAction(false)
  const notifications = 'notifications' in res ? res.notifications ?? [] : []

  return <NotificationsContent initialNotifications={notifications} currentUserId={user.id} />
}
