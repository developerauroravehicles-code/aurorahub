'use client'

import { useRef, useState } from 'react'
import { Paperclip, Send, Loader2, CheckCheck } from 'lucide-react'
import type { CommAttachment, CommMessage } from '@/lib/communication/types'
import type { MemberReadMap } from '@/components/communication/chat/chat-content'
import {
  sendMessageAction,
  uploadChatAttachmentAction,
} from '@/app/dashboard/communication/actions'

type Props = {
  conversationId: string
  messages: CommMessage[]
  currentUserId: string
  onMessageSent: (message: CommMessage) => void
}

export function MessageComposer({ conversationId, messages, currentUserId, onMessageSent }: Props) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    const res = await sendMessageAction(conversationId, body)
    setSending(false)
    if ('message' in res && res.message) {
      setBody('')
      onMessageSent(res.message as CommMessage)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.set('file', file)
    const uploadRes = await uploadChatAttachmentAction(conversationId, fd)
    if ('attachment' in uploadRes && uploadRes.attachment) {
      const res = await sendMessageAction(conversationId, file.name, [uploadRes.attachment as CommAttachment])
      if ('message' in res && res.message) {
        onMessageSent(res.message as CommMessage)
      }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="border-t border-zinc-200 p-4 dark:border-gray-700">
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.txt,.doc,.docx"
          onChange={handleFile}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </button>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Type a message..."
          rows={2}
          className="min-h-[44px] flex-1 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-black"
        />
        <button
          type="button"
          disabled={sending || !body.trim()}
          onClick={() => void handleSend()}
          className="rounded-md bg-[#C27E00] p-2 text-white disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-400">{messages.length} messages</p>
    </div>
  )
}

export function MessageThread({
  messages,
  currentUserId,
  memberReadMap,
}: {
  messages: CommMessage[]
  currentUserId: string
  memberReadMap?: MemberReadMap
}) {
  // For each own message, compute which OTHER members have seen it
  // A member is considered to have seen a message if their last_read_at >= message.created_at
  const seenByMap = new Map<string, string[]>()
  if (memberReadMap) {
    for (const msg of messages) {
      if (msg.sender_id !== currentUserId) continue
      const readers: string[] = []
      for (const [uid, { lastReadAt, fullName }] of memberReadMap.entries()) {
        if (uid === currentUserId) continue
        if (lastReadAt && new Date(lastReadAt) >= new Date(msg.created_at)) {
          readers.push(fullName ?? 'Someone')
        }
      }
      if (readers.length > 0) seenByMap.set(msg.id, readers)
    }
  }

  // Only show the "Görüldü" indicator on the LAST own message that has been seen
  const ownMessages = messages.filter((m) => m.sender_id === currentUserId)
  const lastSeenOwnMsgId = [...ownMessages].reverse().find((m) => seenByMap.has(m.id))?.id ?? null

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => {
        const isOwn = msg.sender_id === currentUserId
        const sender = msg.sender as { full_name?: string | null } | undefined
        const attachments = (msg.attachments ?? []) as CommAttachment[]
        const showSeen = isOwn && msg.id === lastSeenOwnMsgId

        return (
          <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                isOwn
                  ? 'bg-[#C27E00] text-white'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-gray-800 dark:text-white'
              }`}
            >
              {!isOwn && (
                <p className="mb-1 text-xs font-medium opacity-70">{sender?.full_name ?? 'User'}</p>
              )}
              {msg.body && <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>}
              {attachments.map((a) => (
                <a
                  key={a.fileId}
                  href={a.webViewLink ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 block text-xs underline ${isOwn ? 'text-white/90' : 'text-[#C27E00]'}`}
                >
                  {a.name}
                </a>
              ))}
              <p className={`mt-1 text-[10px] ${isOwn ? 'text-white/60' : 'text-zinc-400'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Görüldü indicator — only on the last seen own message */}
            {showSeen && (
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-400 dark:text-gray-500">
                <CheckCheck className="h-3 w-3 text-[#C27E00]" />
                <span>
                  Seen
                  {(seenByMap.get(msg.id)?.length ?? 0) > 1
                    ? ` by ${seenByMap.get(msg.id)!.join(', ')}`
                    : ''}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
