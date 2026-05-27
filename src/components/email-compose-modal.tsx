'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlignLeft,
  Bold,
  ChevronDown,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreVertical,
  Paperclip,
  Smile,
  Strikethrough,
  Trash2,
  Underline,
  X,
  Type,
} from 'lucide-react'
import type { EmailComposePayload } from '@/lib/email-compose'

const SIGNATURE_KEY = 'aurora_email_signature'
const MAX_EXTRA_ATTACHMENTS = 5
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

const EMOJI_LIST = [
  '😀', '😊', '👍', '🙏', '✅', '❌', '⚠️', '📎', '📧', '🚗',
  '💰', '📅', '⭐', '🔔', '💡', '🎉', '👋', '🤝', '📞', '🏢',
]

export interface LockedEmailAttachment {
  id: string
  filename: string
}

interface EmailComposeModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (payload: EmailComposePayload) => Promise<{ error?: string }>
  sending?: boolean
  defaultSubject: string
  defaultTo?: string
  defaultBodyHtml?: string
  lockedAttachments?: LockedEmailAttachment[]
  title?: string
}

interface ExtraAttachment {
  id: string
  filename: string
  base64: string
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1]! : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function EmailComposeModal({
  isOpen,
  onClose,
  onSend,
  sending = false,
  defaultSubject,
  defaultTo = '',
  defaultBodyHtml = '',
  lockedAttachments = [],
  title = 'New Message',
}: EmailComposeModalProps) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState('')
  const [formatOpen, setFormatOpen] = useState(true)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [plainText, setPlainText] = useState(false)
  const [extraAttachments, setExtraAttachments] = useState<ExtraAttachment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [signatureDraft, setSignatureDraft] = useState('')

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const linkUrlRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setTo(defaultTo)
    setCc('')
    setBcc('')
    setShowCc(false)
    setShowBcc(false)
    setSubject(defaultSubject)
    setExtraAttachments([])
    setError(null)
    setEmojiOpen(false)
    setMoreOpen(false)
    if (editorRef.current) {
      editorRef.current.innerHTML = defaultBodyHtml
    }
  }, [defaultTo, defaultSubject, defaultBodyHtml])

  useEffect(() => {
    if (isOpen) {
      resetForm()
      try {
        setSignatureDraft(localStorage.getItem(SIGNATURE_KEY) ?? '')
      } catch {
        setSignatureDraft('')
      }
    }
  }, [isOpen, resetForm])

  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  const insertLink = () => {
    const url = window.prompt('Link URL', 'https://')
    if (!url?.trim()) return
    execFormat('createLink', url.trim())
  }

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, emoji)
    setEmojiOpen(false)
  }

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const next = [...extraAttachments]
    for (const file of Array.from(files)) {
      if (next.length >= MAX_EXTRA_ATTACHMENTS) {
        setError(`Maximum ${MAX_EXTRA_ATTACHMENTS} extra attachments allowed.`)
        break
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} exceeds 8 MB limit.`)
        continue
      }
      const base64 = await fileToBase64(file)
      next.push({
        id: `${Date.now()}-${file.name}`,
        filename: file.name,
        base64,
      })
    }
    setExtraAttachments(next)
  }

  const handleInsertImage = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError('Image must be 8 MB or smaller.')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    editorRef.current?.focus()
    document.execCommand(
      'insertHTML',
      false,
      `<img src="${dataUrl}" alt="${file.name.replace(/"/g, '')}" style="max-width:100%;height:auto;" />`
    )
  }

  const handleDiscard = () => {
    if (editorRef.current?.innerText.trim() || to.trim() || subject.trim()) {
      if (!window.confirm('Discard this draft?')) return
    }
    onClose()
  }

  const handleSaveSignature = () => {
    try {
      localStorage.setItem(SIGNATURE_KEY, signatureDraft)
      setMoreOpen(false)
    } catch {
      setError('Could not save signature.')
    }
  }

  const handleInsertSignature = () => {
    const sig = signatureDraft.trim()
    if (!sig) return
    editorRef.current?.focus()
    const html = sig.includes('<') ? sig : sig.replace(/\n/g, '<br/>')
    document.execCommand('insertHTML', false, `<br/><br/>--<br/>${html}`)
    setMoreOpen(false)
  }

  const handleSend = async () => {
    setError(null)
    const bodyHtml = plainText
      ? `<p>${(editorRef.current?.innerText ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`
      : (editorRef.current?.innerHTML ?? '')

    const result = await onSend({
      to,
      cc: showCc ? cc : undefined,
      bcc: showBcc ? bcc : undefined,
      subject,
      bodyHtml,
      extraAttachments: extraAttachments.map(({ filename, base64 }) => ({ filename, base64 })),
    })

    if (result.error) {
      setError(result.error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-zinc-900/40 dark:bg-black/60">
      <div
        className="flex flex-col w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] rounded-t-xl sm:rounded-xl border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-100 shadow-2xl overflow-hidden text-zinc-900"
        role="dialog"
        aria-labelledby="email-compose-title"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 bg-zinc-50">
          <h2 id="email-compose-title" className="text-sm font-medium text-zinc-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200 text-zinc-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {error && (
            <div className="mx-4 mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="px-4 py-1 border-b border-zinc-200 flex items-center gap-2">
            <label className="text-sm text-zinc-500 w-10 shrink-0">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value.toLowerCase())}
              placeholder="recipient@example.com"
              autoComplete="email"
              className="flex-1 py-2 text-sm border-0 outline-none bg-transparent text-zinc-900 placeholder:text-zinc-400"
            />
            <div className="flex gap-2 text-xs text-zinc-500 shrink-0">
              {!showCc && (
                <button type="button" className="hover:text-zinc-800" onClick={() => setShowCc(true)}>
                  Cc
                </button>
              )}
              {!showBcc && (
                <button type="button" className="hover:text-zinc-800" onClick={() => setShowBcc(true)}>
                  Bcc
                </button>
              )}
            </div>
          </div>

          {showCc && (
            <div className="px-4 py-1 border-b border-zinc-200 flex items-center gap-2">
              <label className="text-sm text-zinc-500 w-10 shrink-0">Cc</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value.toLowerCase())}
                placeholder="cc@example.com"
                className="flex-1 py-2 text-sm border-0 outline-none bg-transparent"
              />
            </div>
          )}

          {showBcc && (
            <div className="px-4 py-1 border-b border-zinc-200 flex items-center gap-2">
              <label className="text-sm text-zinc-500 w-10 shrink-0">Bcc</label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value.toLowerCase())}
                placeholder="bcc@example.com"
                className="flex-1 py-2 text-sm border-0 outline-none bg-transparent"
              />
            </div>
          )}

          <div className="px-4 py-1 border-b border-zinc-200 flex items-center gap-2">
            <label className="text-sm text-zinc-500 w-10 shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 py-2 text-sm border-0 outline-none bg-transparent font-medium"
            />
          </div>

          {formatOpen && (
            <div className="px-2 py-1 border-b border-zinc-100 flex flex-wrap items-center gap-0.5 bg-zinc-50/80">
              <ToolbarBtn title="Bold" onClick={() => execFormat('bold')}>
                <Bold className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Italic" onClick={() => execFormat('italic')}>
                <Italic className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Underline" onClick={() => execFormat('underline')}>
                <Underline className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Strikethrough" onClick={() => execFormat('strikeThrough')}>
                <Strikethrough className="w-4 h-4" />
              </ToolbarBtn>
              <span className="w-px h-5 bg-zinc-300 mx-1" />
              <ToolbarBtn title="Bullet list" onClick={() => execFormat('insertUnorderedList')}>
                <List className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Numbered list" onClick={() => execFormat('insertOrderedList')}>
                <ListOrdered className="w-4 h-4" />
              </ToolbarBtn>
              <span className="w-px h-5 bg-zinc-300 mx-1" />
              <ToolbarBtn title="Align left" onClick={() => execFormat('justifyLeft')}>
                <AlignLeft className="w-4 h-4" />
              </ToolbarBtn>
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[220px] max-h-[40vh] overflow-y-auto px-4 py-3 text-sm text-zinc-900 outline-none focus:ring-0 [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-zinc-400"
            data-placeholder="Compose your message..."
          />

          {(lockedAttachments.length > 0 || extraAttachments.length > 0) && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {lockedAttachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700"
                  title="Included with this send"
                >
                  <Paperclip className="w-3 h-3" />
                  {a.filename}
                </span>
              ))}
              {extraAttachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs text-blue-900"
                >
                  <Paperclip className="w-3 h-3" />
                  {a.filename}
                  <button
                    type="button"
                    onClick={() => setExtraAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    className="ml-0.5 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 flex flex-wrap items-center gap-1 relative">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim()}
            className="inline-flex items-center gap-1 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white pl-5 pr-2 py-2 text-sm font-medium disabled:opacity-50 mr-2"
          >
            {sending ? 'Sending…' : 'Send'}
            <ChevronDown className="w-4 h-4 opacity-70" />
          </button>

          <ToolbarBtn title="Formatting" onClick={() => setFormatOpen((v) => !v)}>
            <Type className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn title="Attach files" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn title="Insert link" onClick={insertLink}>
            <Link2 className="w-4 h-4" />
          </ToolbarBtn>
          <div className="relative">
            <ToolbarBtn title="Insert emoji" onClick={() => setEmojiOpen((v) => !v)}>
              <Smile className="w-4 h-4" />
            </ToolbarBtn>
            {emojiOpen && (
              <div className="absolute bottom-full left-0 mb-1 z-10 grid grid-cols-10 gap-0.5 p-2 rounded-lg border border-zinc-300 bg-white shadow-lg w-[220px]">
                {EMOJI_LIST.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="text-lg hover:bg-zinc-100 rounded p-0.5"
                    onClick={() => insertEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolbarBtn title="Insert image" onClick={() => imageInputRef.current?.click()}>
            <ImageIcon className="w-4 h-4" />
          </ToolbarBtn>

          <div className="relative ml-auto">
            <ToolbarBtn title="More options" onClick={() => setMoreOpen((v) => !v)}>
              <MoreVertical className="w-4 h-4" />
            </ToolbarBtn>
            {moreOpen && (
              <div className="absolute bottom-full right-0 mb-1 z-10 w-64 rounded-lg border border-zinc-300 bg-white shadow-lg py-1 text-sm">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-zinc-100"
                  onClick={() => {
                    setPlainText((v) => !v)
                    setMoreOpen(false)
                  }}
                >
                  {plainText ? 'Switch to rich text' : 'Plain text mode'}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-zinc-100"
                  onClick={handleInsertSignature}
                >
                  Insert signature
                </button>
                <div className="border-t border-zinc-200 px-3 py-2">
                  <p className="text-xs text-zinc-500 mb-1">Email signature</p>
                  <textarea
                    value={signatureDraft}
                    onChange={(e) => setSignatureDraft(e.target.value)}
                    rows={2}
                    className="w-full text-xs border border-zinc-300 rounded px-2 py-1"
                    placeholder="Your name, title, phone…"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSignature}
                    className="mt-1 text-xs text-[#1a73e8] hover:underline"
                  >
                    Save signature
                  </button>
                </div>
              </div>
            )}
          </div>

          <ToolbarBtn title="Discard draft" onClick={handleDiscard} className="text-zinc-500 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </ToolbarBtn>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleAttachFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleInsertImage(e.target.files)
              e.target.value = ''
            }}
          />
          <input ref={linkUrlRef} type="hidden" aria-hidden />
        </div>
      </div>
    </div>
  )
}

function ToolbarBtn({
  children,
  title,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-2 rounded-full text-zinc-600 hover:bg-zinc-200 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
