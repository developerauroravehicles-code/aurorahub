/** Serializable payload from the compose modal (client → server actions). */
export interface EmailComposePayload {
  to: string
  cc?: string
  bcc?: string
  subject: string
  bodyHtml: string
  extraAttachments?: { filename: string; base64: string }[]
}

export interface ParsedEmailCompose {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  bodyHtml: string
  extraAttachments: { filename: string; content: Buffer }[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseEmailFieldList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[,;\n]+/)) {
    const t = part.trim().toLowerCase()
    if (!t || !EMAIL_RE.test(t) || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function parseEmailComposePayload(payload: EmailComposePayload): {
  parsed: ParsedEmailCompose | null
  error?: string
} {
  const to = parseEmailFieldList(payload.to)
  if (to.length === 0) {
    return { parsed: null, error: 'Enter at least one valid To address' }
  }

  const subject = payload.subject.trim()
  if (!subject) {
    return { parsed: null, error: 'Subject is required' }
  }

  const extraAttachments: { filename: string; content: Buffer }[] = []
  for (const att of payload.extraAttachments ?? []) {
    const name = att.filename?.trim()
    if (!name || !att.base64) continue
    try {
      extraAttachments.push({
        filename: name.replace(/[<>:"/\\|?*]/g, '_'),
        content: Buffer.from(att.base64, 'base64'),
      })
    } catch {
      return { parsed: null, error: `Invalid attachment: ${name}` }
    }
  }

  return {
    parsed: {
      to,
      cc: parseEmailFieldList(payload.cc),
      bcc: parseEmailFieldList(payload.bcc),
      subject,
      bodyHtml: payload.bodyHtml ?? '',
      extraAttachments,
    },
  }
}
