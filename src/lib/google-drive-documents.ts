import {
  findOrCreateFolder,
  getDriveClient,
  sanitizeFolderName,
  type GoogleDriveSettings,
} from '@/lib/google-drive'

export type PersonnelDriveContext = {
  workerId: string
  fullName: string
  category: 'onboarding' | 'offboarding'
}

export type DriveUploadResult =
  | { success: true; fileId: string; webViewLink?: string; folderPath: string }
  | { success: false; error: string }

function personnelFolderName(workerId: string, fullName: string): string {
  const safeName = sanitizeFolderName(fullName) || 'Unknown'
  const safeId = sanitizeFolderName(workerId) || 'NO-ID'
  return `${safeId}_${safeName}`
}

export async function resolvePersonnelDocumentFolder(
  settings: GoogleDriveSettings,
  ctx: PersonnelDriveContext
): Promise<{ folderId: string; folderPath: string } | { error: string }> {
  const client = await getDriveClient(settings)
  if (!client.drive || !client.rootFolderId) {
    return { error: client.error ?? 'Google Drive not available' }
  }

  const { drive, rootFolderId } = client
  const categoryFolder = ctx.category === 'onboarding' ? 'Onboarding' : 'Offboarding'
  const pathParts = ['Documents', 'Personnel', personnelFolderName(ctx.workerId, ctx.fullName), categoryFolder]

  try {
    let parentId = rootFolderId
    for (const part of pathParts) {
      parentId = await findOrCreateFolder(drive, parentId, part)
    }
    return { folderId: parentId, folderPath: pathParts.join('/') }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Failed to resolve folder: ${msg}` }
  }
}

export async function uploadCompliancePdfToDrive(
  settings: GoogleDriveSettings,
  ctx: PersonnelDriveContext,
  fileName: string,
  pdfBuffer: Buffer | Uint8Array,
  existingFileId?: string | null
): Promise<DriveUploadResult> {
  const folder = await resolvePersonnelDocumentFolder(settings, ctx)
  if ('error' in folder) return { success: false, error: folder.error }

  const client = await getDriveClient(settings)
  if (!client.drive) return { success: false, error: client.error ?? 'Drive unavailable' }

  const { drive } = client

  try {
    if (existingFileId?.trim()) {
      try {
        await drive.files.delete({ fileId: existingFileId.trim(), supportsAllDrives: true })
      } catch {
        /* ignore missing file */
      }
    }

    const { Readable } = await import('stream')
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)
    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_') || 'document.pdf'

    const { data: file } = await drive.files.create({
      requestBody: {
        name: sanitizedFileName,
        parents: [folder.folderId],
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })

    return {
      success: true,
      fileId: file.id!,
      webViewLink: file.webViewLink ?? undefined,
      folderPath: folder.folderPath,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Drive upload failed: ${msg}` }
  }
}

export async function uploadComplianceFileToDrive(
  settings: GoogleDriveSettings,
  ctx: PersonnelDriveContext,
  fileName: string,
  mimeType: string,
  buffer: Buffer | Uint8Array,
  existingFileId?: string | null
): Promise<DriveUploadResult> {
  const folder = await resolvePersonnelDocumentFolder(settings, ctx)
  if ('error' in folder) return { success: false, error: folder.error }

  const client = await getDriveClient(settings)
  if (!client.drive) return { success: false, error: client.error ?? 'Drive unavailable' }

  const { drive } = client

  try {
    if (existingFileId?.trim()) {
      try {
        await drive.files.delete({ fileId: existingFileId.trim(), supportsAllDrives: true })
      } catch {
        /* ignore */
      }
    }

    const { Readable } = await import('stream')
    const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_') || 'upload'

    const { data: file } = await drive.files.create({
      requestBody: {
        name: sanitizedFileName,
        parents: [folder.folderId],
      },
      media: {
        mimeType: mimeType || 'application/octet-stream',
        body: Readable.from(fileBuffer),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })

    return {
      success: true,
      fileId: file.id!,
      webViewLink: file.webViewLink ?? undefined,
      folderPath: folder.folderPath,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Drive upload failed: ${msg}` }
  }
}

export async function downloadDriveFile(
  settings: GoogleDriveSettings,
  fileId: string
): Promise<{ success: true; buffer: Buffer; mimeType: string } | { success: false; error: string }> {
  const client = await getDriveClient(settings)
  if (!client.drive) return { success: false, error: client.error ?? 'Drive unavailable' }

  try {
    const meta = await client.drive.files.get({
      fileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    })
    const res = await client.drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )
    const buffer = Buffer.from(res.data as ArrayBuffer)
    return { success: true, buffer, mimeType: meta.data.mimeType ?? 'application/octet-stream' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
