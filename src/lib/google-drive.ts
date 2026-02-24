/**
 * Google Drive API utilities for uploading invoice PDFs.
 * Uses Service Account credentials for server-side automation.
 * Folder structure: Dealer > Year > Month
 */

import { google } from 'googleapis'

export interface GoogleDriveSettings {
  enabled: boolean
  clientId?: string
  clientSecret?: string
  defaultFolderId?: string
  /** OAuth2 refresh token - use when Service Account key is disabled by org */
  refreshToken?: string
  useOAuth?: boolean
  /** Service Account email (client_email from JSON key) */
  serviceAccountEmail?: string
  /** Service Account private key (private_key from JSON key) */
  serviceAccountPrivateKey?: string
  /** @deprecated use serviceAccountEmail */
  clientEmail?: string
  /** @deprecated use serviceAccountPrivateKey */
  privateKey?: string
}

/** Sanitize folder name for Drive (remove invalid characters) */
function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim() || 'Unknown'
}

/**
 * Find or create a folder by name under parent. Returns folder ID.
 */
async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  folderName: string
): Promise<string> {
  const sanitized = sanitizeFolderName(folderName)
  if (!sanitized) throw new Error('Invalid folder name')

  // Search for existing folder (escape single quotes in name for Drive query)
  // supportsAllDrives required when root is in a Shared Drive (Service Accounts need Shared Drive - no personal quota)
  const escapedName = sanitized.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const { data: list } = await drive.files.list({
    q: `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  })

  if (list.files?.length && list.files[0].id) {
    return list.files[0].id
  }

  // Create folder (supportsAllDrives for Shared Drive compatibility)
  const { data: created } = await drive.files.create({
    requestBody: {
      name: sanitized,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id',
    supportsAllDrives: true
  })

  if (!created.id) throw new Error('Failed to create folder')
  return created.id
}

/**
 * Upload a PDF buffer to Google Drive.
 * Creates folder structure: rootFolder / Dealer / Year / Month
 * @param pdfBuffer - PDF file as Buffer or Uint8Array
 * @param fileName - e.g. Invoice_#ARR-001_2025-02-09.pdf
 * @param dealerName - dealer name for folder
 * @param settings - Google Drive credentials from system_settings
 */
export async function uploadInvoiceToDrive(
  pdfBuffer: Buffer | Uint8Array,
  fileName: string,
  dealerName: string,
  settings: GoogleDriveSettings
): Promise<{ success: true; fileId: string; webViewLink?: string } | { success: false; error: string }> {
  if (!settings.enabled) {
    return { success: false, error: 'Google Drive integration is disabled' }
  }

  const rootFolderId = settings.defaultFolderId?.trim()
  if (!rootFolderId) {
    return { success: false, error: 'Default Folder ID is required. Set it in System Management > API.' }
  }

  let auth: google.auth.OAuth2 | ReturnType<typeof google.auth.GoogleAuth>
  const useOAuth = settings.useOAuth && settings.refreshToken && settings.clientId && settings.clientSecret

  if (useOAuth) {
    const oauth2 = new google.auth.OAuth2(settings.clientId, settings.clientSecret)
    oauth2.setCredentials({ refresh_token: settings.refreshToken })
    auth = oauth2
  } else {
    const email = settings.serviceAccountEmail || settings.clientEmail
    const privateKey = settings.serviceAccountPrivateKey || settings.privateKey
    if (!email || !privateKey) {
      return { success: false, error: 'Google Drive not configured. Use OAuth (Connect to Google) or Service Account in System Management > API.' }
    }
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/drive']
    })
  }

  try {
    const drive = google.drive({ version: 'v3', auth })

    // Dealer folder
    const dealerFolderId = await findOrCreateFolder(drive, rootFolderId, sanitizeFolderName(dealerName) || 'Unknown Dealer')

    // Year folder (e.g. 2025)
    const year = new Date().getFullYear().toString()
    const yearFolderId = await findOrCreateFolder(drive, dealerFolderId, year)

    // Month folder (e.g. 01, 02, ... 12)
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const monthFolderId = await findOrCreateFolder(drive, yearFolderId, month)

    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)
    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_') || 'invoice.pdf'

    const { Readable } = await import('stream')
    const { data: file } = await drive.files.create({
      requestBody: {
        name: sanitizedFileName,
        parents: [monthFolderId]
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(buffer)
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    })

    return {
      success: true,
      fileId: file.id!,
      webViewLink: file.webViewLink ?? undefined
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Drive upload failed: ${msg}` }
  }
}
