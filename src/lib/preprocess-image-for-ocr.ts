'use client'

const TARGET_MAX_DIMENSION = 2600

/** Load an image file into a canvas for OCR preprocessing. */
export async function loadFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not load image file.'))
      element.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare image for OCR.')
    context.drawImage(image, 0, 0)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Rotate by 90-degree steps; phone photos of landscape forms arrive sideways. */
export function rotateCanvasQuarterTurns(
  source: HTMLCanvasElement,
  turns: 1 | 2 | 3
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const swapDimensions = turns % 2 === 1
  canvas.width = swapDimensions ? source.height : source.width
  canvas.height = swapDimensions ? source.width : source.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not rotate image for OCR.')
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((turns * Math.PI) / 2)
  context.drawImage(source, -source.width / 2, -source.height / 2)
  return canvas
}

/** Shrink to a probe size for cheap orientation checks. */
export function downscaleCanvas(source: HTMLCanvasElement, maxDimension: number): HTMLCanvasElement {
  const largest = Math.max(source.width, source.height)
  if (largest <= maxDimension) return source
  return scaleCanvas(source, maxDimension / largest)
}

/** Resize so the longest side matches the target (up- or downscale). */
export function resizeCanvasToDimension(
  source: HTMLCanvasElement,
  targetDimension: number
): HTMLCanvasElement {
  const largest = Math.max(source.width, source.height)
  if (largest === targetDimension) return source
  return scaleCanvas(source, targetDimension / largest)
}

/** Rotate by arbitrary degrees onto a white background with expanded bounds. */
export function rotateCanvasByDegrees(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(source.width * cos + source.height * sin)
  canvas.height = Math.ceil(source.width * sin + source.height * cos)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not rotate image for OCR.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(radians)
  context.drawImage(source, -source.width / 2, -source.height / 2)
  return canvas
}

function scaleCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not scale image for OCR.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

function transformPixels(
  source: HTMLCanvasElement,
  transform: (gray: number) => number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not transform image for OCR.')
  context.drawImage(source, 0, 0)

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const value = transform(gray)
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  context.putImageData(imageData, 0, 0)
  return canvas
}

/** Build several OCR-friendly variants (scale, contrast, binarize). */
export function createOcrImageVariants(source: HTMLCanvasElement): HTMLCanvasElement[] {
  const scale = Math.max(1.5, TARGET_MAX_DIMENSION / Math.max(source.width, source.height))
  const scaled = scaleCanvas(source, scale)

  const highContrast = transformPixels(scaled, (gray) => {
    const stretched = (gray - 128) * 1.75 + 128
    return Math.min(255, Math.max(0, stretched))
  })

  const binary = transformPixels(scaled, (gray) => (gray >= 145 ? 255 : 0))
  const binaryDark = transformPixels(scaled, (gray) => (gray >= 120 ? 255 : 0))

  return [scaled, highContrast, binary, binaryDark]
}
