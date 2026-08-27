import { createSign } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoogleDriveSettings } from '@/lib/google-drive'
import { downloadDriveFile, uploadCompliancePdfToDrive } from '@/lib/google-drive-documents'

export type DocuSignSettings = {
  enabled: boolean
  integrationKey: string
  accountId: string
  userId: string
  rsaPrivateKey: string
  baseUri: string
  /** Production: account.docusign.com */
  authServer?: string
}

const DEFAULT_AUTH_SERVER = 'account.docusign.com'

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n').trim()
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createJwtAssertion(settings: DocuSignSettings): string {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: settings.integrationKey,
    sub: settings.userId,
    aud: settings.authServer ?? DEFAULT_AUTH_SERVER,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()
  const signature = signer.sign(normalizePrivateKey(settings.rsaPrivateKey))
  return `${signingInput}.${base64UrlEncode(signature)}`
}

export async function getDocuSignAccessToken(
  settings: DocuSignSettings
): Promise<{ accessToken: string } | { error: string }> {
  if (!settings.enabled) return { error: 'DocuSign integration is disabled' }
  if (!settings.integrationKey || !settings.userId || !settings.rsaPrivateKey) {
    return { error: 'DocuSign is not fully configured' }
  }

  const authServer = settings.authServer ?? DEFAULT_AUTH_SERVER
  const jwt = createJwtAssertion(settings)

  try {
    const res = await fetch(`https://${authServer}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
    if (!res.ok || !data.access_token) {
      return { error: data.error_description ?? data.error ?? 'DocuSign token request failed' }
    }
    return { accessToken: data.access_token }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}

function apiBase(settings: DocuSignSettings): string {
  const base = settings.baseUri.replace(/\/+$/, '')
  return `${base}/restapi/v2.1/accounts/${settings.accountId}`
}

export async function createDocuSignEnvelope(
  settings: DocuSignSettings,
  params: {
    documentBase64: string
    documentName: string
    signerEmail: string
    signerName: string
    emailSubject: string
    clientUserId?: string
  }
): Promise<{ envelopeId: string } | { error: string }> {
  const tokenResult = await getDocuSignAccessToken(settings)
  if ('error' in tokenResult) return { error: tokenResult.error }

  const signer: Record<string, unknown> = {
    email: params.signerEmail,
    name: params.signerName,
    recipientId: '1',
    routingOrder: '1',
    tabs: {
      signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '700' }],
      dateSignedTabs: [{ documentId: '1', pageNumber: '1', xPosition: '300', yPosition: '700' }],
    },
  }
  if (params.clientUserId) {
    signer.clientUserId = params.clientUserId
  }

  const body = {
    emailSubject: params.emailSubject,
    documents: [
      {
        documentBase64: params.documentBase64,
        name: params.documentName,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: { signers: [signer] },
    status: 'sent',
  }

  try {
    const res = await fetch(`${apiBase(settings)}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as { envelopeId?: string; message?: string; errorCode?: string }
    if (!res.ok || !data.envelopeId) {
      return { error: data.message ?? data.errorCode ?? 'Failed to create envelope' }
    }
    return { envelopeId: data.envelopeId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}

export async function createEmbeddedSigningUrl(
  settings: DocuSignSettings,
  params: {
    envelopeId: string
    signerEmail: string
    signerName: string
    clientUserId: string
    returnUrl: string
  }
): Promise<{ url: string } | { error: string }> {
  const tokenResult = await getDocuSignAccessToken(settings)
  if ('error' in tokenResult) return { error: tokenResult.error }

  const body = {
    returnUrl: params.returnUrl,
    authenticationMethod: 'none',
    email: params.signerEmail,
    userName: params.signerName,
    clientUserId: params.clientUserId,
  }

  try {
    const res = await fetch(
      `${apiBase(settings)}/envelopes/${params.envelopeId}/views/recipient`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )
    const data = (await res.json()) as { url?: string; message?: string }
    if (!res.ok || !data.url) {
      return { error: data.message ?? 'Failed to create signing URL' }
    }
    return { url: data.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}

export async function downloadSignedEnvelopeDocument(
  settings: DocuSignSettings,
  envelopeId: string
): Promise<{ buffer: Buffer } | { error: string }> {
  const tokenResult = await getDocuSignAccessToken(settings)
  if ('error' in tokenResult) return { error: tokenResult.error }

  try {
    const res = await fetch(
      `${apiBase(settings)}/envelopes/${envelopeId}/documents/combined`,
      {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      }
    )
    if (!res.ok) {
      const text = await res.text()
      return { error: text || 'Failed to download signed document' }
    }
    const arrayBuffer = await res.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}

export async function archiveSignedDocumentToDrive(
  driveSettings: GoogleDriveSettings,
  params: {
    envelopeId: string
    assignmentId: string
    templateCode: string
    workerId: string
    fullName: string
    category: 'onboarding' | 'offboarding'
    signedBuffer: Buffer
  }
): Promise<{ fileId: string; webViewLink?: string } | { error: string }> {
  const fileName = `${params.templateCode}_signed_${params.envelopeId.slice(0, 8)}.pdf`
  const upload = await uploadCompliancePdfToDrive(
    driveSettings,
    {
      workerId: params.workerId,
      fullName: params.fullName,
      category: params.category,
    },
    fileName,
    params.signedBuffer
  )
  if (!upload.success) return { error: upload.error }
  return { fileId: upload.fileId, webViewLink: upload.webViewLink }
}

export async function getDocuSignSettingsFromDb(
  supabase: SupabaseClient
): Promise<DocuSignSettings | null> {
  const { data: row } = await supabase.from('system_settings').select('value').eq('key', 'docusign_settings').single()
  if (!row?.value) return null
  try {
    return JSON.parse(row.value) as DocuSignSettings
  } catch {
    return null
  }
}

export async function downloadDrivePdfBase64(
  driveSettings: GoogleDriveSettings,
  fileId: string
): Promise<{ base64: string } | { error: string }> {
  const result = await downloadDriveFile(driveSettings, fileId)
  if (!result.success) return { error: result.error }
  return { base64: result.buffer.toString('base64') }
}
