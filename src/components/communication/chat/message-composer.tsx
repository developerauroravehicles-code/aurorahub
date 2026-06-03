'use client'

import { useRef, useState } from 'react'
import { Paperclip, Send, Loader2 } from 'lucide-react'
import type { CommAttachment, CommMessage } from '@/lib/communication/types'
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
}: {
  messages: CommMessage[]
  currentUserId: string
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => {
        const isOwn = msg.sender_id === currentUserId
        const sender = msg.sender as { full_name?: string | null } | undefined
        const attachments = (msg.attachments ?? []) as CommAttachment[]

        return (
          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
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
          </div>
        )
      })}
    </div>
  )
}
