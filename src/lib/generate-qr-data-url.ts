import QRCode from 'qrcode'

export async function generateQrDataUrl(text: string, size = 256): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}

export async function loadImageAsDataUrl(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Failed to load image: ${path}`)
  }

  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error(`Failed to read image as data URL: ${path}`))
      }
    }
    reader.onerror = () => reject(new Error(`Failed to read image: ${path}`))
    reader.readAsDataURL(blob)
  })
}
