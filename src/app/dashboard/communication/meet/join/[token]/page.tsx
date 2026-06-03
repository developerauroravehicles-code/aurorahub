import { redirect } from 'next/navigation'
import { joinMeetByTokenAction } from '@/app/dashboard/communication/actions'

export default async function MeetJoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const res = await joinMeetByTokenAction(token)

  if ('error' in res && res.error) {
    redirect('/dashboard/communication/meet')
  }

  if ('roomId' in res && res.roomId) {
    redirect(`/dashboard/communication/meet/${res.roomId}`)
  }

  redirect('/dashboard/communication/meet')
}
