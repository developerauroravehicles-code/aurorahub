import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/meet/leave
 * Body: { roomId: string }
 *
 * Marks the authenticated user as left in comm_meet_participants.
 * Called via fetch({ keepalive: true }) on beforeunload so it survives tab close.
 */
export async function POST(request: Request) {
  try {
    const { roomId } = (await request.json()) as { roomId?: string }
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase
      .from('comm_meet_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
