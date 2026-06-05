'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToNotifications } from '@/lib/communication/realtime'

export function useUnreadNotificationCount(userId: string | null) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('comm_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
      setCount(c ?? 0)
    }

    void fetchCount()

    const cleanup = subscribeToNotifications(
      supabase,
      userId,
      () => { void fetchCount() },
      () => { void fetchCount() }
    )

    return cleanup
  }, [userId])

  return count
}
