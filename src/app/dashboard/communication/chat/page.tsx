import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatContent } from '@/components/communication/chat/chat-content'
import {
  getConversationsAction,
  getMessageableProfilesAction,
} from '@/app/dashboard/communication/actions'
import { Suspense } from 'react'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [convRes, profilesRes] = await Promise.all([
    getConversationsAction(),
    getMessageableProfilesAction(),
  ])

  const conversations = 'conversations' in convRes ? convRes.conversations ?? [] : []
  const profiles = 'profiles' in profilesRes ? profilesRes.profiles ?? [] : []

  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading chat...</div>}>
      <ChatContent
        currentUserId={user.id}
        initialConversations={conversations}
        initialProfiles={profiles}
      />
    </Suspense>
  )
}
