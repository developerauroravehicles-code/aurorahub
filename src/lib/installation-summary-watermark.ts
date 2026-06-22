const WATERMARK_VERSION = 3
const WATERMARK_SRC = `/branding/aurora-watermark.png?v=${WATERMARK_VERSION}`
const WATERMARK_OPACITY = 0.3

let cachedWatermark: { version: number; data: string | null } | undefined

function processWatermarkPixels(sourceDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const luminance = Math.max(r, g, b)

        // White / light background -> transparent
        if (luminance > 235) {
          pixels[i + 3] = 0
          continue
        }

        // Black logo ink -> black filigran at 30% (preserve original color)
        const strength = 1 - luminance / 255
        pixels[i] = 0
        pixels[i + 1] = 0
        pixels[i + 2] = 0
        pixels[i + 3] = Math.round(255 * WATERMARK_OPACITY * strength)
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Watermark image failed to load'))
    img.src = sourceDataUrl
  })
}

/** Load Aurora logo watermark for Installation Summary PDF (browser only). */
export async function loadInstallationSummaryWatermark(): Promise<string | null> {
  if (cachedWatermark?.version === WATERMARK_VERSION) return cachedWatermark.data

  if (typeof window === 'undefined') {
    cachedWatermark = { version: WATERMARK_VERSION, data: null }
    return null
  }

  try {
    const response = await fetch(WATERMARK_SRC)
    if (!response.ok) {
      cachedWatermark = { version: WATERMARK_VERSION, data: null }
      return null
    }
    const blob = await response.blob()
    const sourceDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('Invalid watermark data'))
      }
      reader.onerror = () => reject(new Error('Failed to read watermark'))
      reader.readAsDataURL(blob)
    })
    const data = await processWatermarkPixels(sourceDataUrl)
    cachedWatermark = { version: WATERMARK_VERSION, data }
    return data
  } catch {
    cachedWatermark = { version: WATERMARK_VERSION, data: null }
    return null
  }
}
