'use client'

import {
  createOcrImageVariants,
  downscaleCanvas,
  loadFileToCanvas,
  resizeCanvasToDimension,
  rotateCanvasByDegrees,
  rotateCanvasQuarterTurns,
} from '@/lib/preprocess-image-for-ocr'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export const DEMAND_DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export function validateDemandDocumentFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return 'Please upload a JPEG, PNG, WebP image, or PDF file.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File is too large. Maximum size is 10 MB.'
  }
  return null
}

function scoreOcrText(text: string): number {
  const alnum = (text.match(/[A-Za-z0-9]/g) ?? []).length
  const hasVin = /[A-HJ-NPR-Z0-9]{17}/i.test(text)
  const hasPhone = /\d{3}\D?\d{3}\D?\d{4}/.test(text)
  const hasYearMake = /\b20\d{2}\s+[A-Za-z]/i.test(text)
  const hasStock = /\b\d[A-Z0-9]{4,6}\b/i.test(text)
  return (
    alnum +
    (hasVin ? 80 : 0) +
    (hasPhone ? 40 : 0) +
    (hasYearMake ? 30 : 0) +
    (hasStock ? 20 : 0)
  )
}

type PdfDocument = import('pdfjs-dist').PDFDocumentProxy
type PdfTextItem = { str: string; transform: number[] }

const PDF_TEXT_LAYER_PAGES = 3
const PDF_TEXT_LAYER_MIN_CHARS = 40
const PDF_TEXT_ROW_TOLERANCE = 3

async function loadPdfDocument(file: File): Promise<PdfDocument> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const buffer = await file.arrayBuffer()
  return pdfjs.getDocument({ data: buffer }).promise
}

/**
 * Rebuilds visual rows from positioned glyph runs. Label and value live in
 * separate cells, so the parser needs them on the same line to pair them up.
 */
function buildLinesFromTextItems(items: PdfTextItem[]): string {
  const rows: Array<{ y: number; parts: Array<{ x: number; str: string }> }> = []

  for (const item of items) {
    if (!item.str.trim()) continue
    const [, , , , x, y] = item.transform
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= PDF_TEXT_ROW_TOLERANCE)
    if (row) row.parts.push({ x, str: item.str })
    else rows.push({ y, parts: [{ x, str: item.str }] })
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
}

/**
 * Digitally generated PDFs (print-to-PDF, exports) already carry exact text.
 * Reading it beats OCR outright, so it is always tried first.
 */
async function extractPdfTextLayer(pdf: PdfDocument): Promise<string> {
  const pageCount = Math.min(pdf.numPages, PDF_TEXT_LAYER_PAGES)
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items.flatMap((item) =>
      'str' in item && 'transform' in item ? [{ str: item.str, transform: item.transform }] : []
    )
    const text = buildLinesFromTextItems(items)
    if (text) pages.push(text)
  }

  return pages.join('\n')
}

async function renderPdfPageToCanvas(pdf: PdfDocument): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 3 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare PDF page for OCR.')
  await page.render({ canvasContext: context, viewport, canvas }).promise
  return canvas
}

type OcrWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>

const ROTATION_PROBE_MAX_DIMENSION = 1200
const ROTATION_PROBE_CONFIDENT_SCORE = 250
const ROTATION_SWEEP_DIMENSION = 2000
const ROTATION_SWEEP_ACCEPT_SCORE = 350
const ROTATION_SWEEP_EARLY_EXIT_SCORE = 600
const READABLE_RESULT_MIN_WORDS = 12

function countReadableWords(text: string): number {
  return (text.match(/[A-Za-z]{4,}/g) ?? []).length
}

/**
 * Sweep scoring leans on real words: noise glyphs from a sideways/tilted photo
 * still rack up alphanumeric counts, but they rarely form 4+ letter words.
 */
function sweepScore(text: string): number {
  return scoreOcrText(text) + countReadableWords(text) * 5
}

async function probeRecognize(
  source: HTMLCanvasElement,
  worker: OcrWorker
): Promise<string> {
  const { PSM } = await import('tesseract.js')
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1',
  })
  const {
    data: { text },
  } = await worker.recognize(source)
  return text
}

/**
 * Phone photos of landscape forms usually arrive rotated a quarter turn.
 * Tesseract cannot read sideways text, so probe all four orientations on a
 * small copy and keep whichever scores best.
 */
async function detectBestQuarterTurns(
  canvas: HTMLCanvasElement,
  worker: OcrWorker
): Promise<0 | 1 | 2 | 3> {
  const probe = downscaleCanvas(canvas, ROTATION_PROBE_MAX_DIMENSION)
  let best: { turns: 0 | 1 | 2 | 3; score: number } = { turns: 0, score: -1 }

  for (const turns of [0, 1, 3, 2] as const) {
    const rotated = turns === 0 ? probe : rotateCanvasQuarterTurns(probe, turns)
    const score = scoreOcrText(await probeRecognize(rotated, worker))
    if (score > best.score) best = { turns, score }
    if (score >= ROTATION_PROBE_CONFIDENT_SCORE) break
  }

  return best.turns
}

/**
 * Last-resort rescue for tilted photos (document at an arbitrary angle on a
 * desk). Sweeps the full circle in 15-degree steps, refines around the best
 * hit, and returns the angle only when something genuinely readable appears.
 */
async function findBestRotationAngle(
  canvas: HTMLCanvasElement,
  worker: OcrWorker
): Promise<number | null> {
  const probe = resizeCanvasToDimension(canvas, ROTATION_SWEEP_DIMENSION)
  let best = { angle: 0, score: -1 }

  for (let angle = 0; angle < 360; angle += 15) {
    const rotated = angle === 0 ? probe : rotateCanvasByDegrees(probe, angle)
    const score = sweepScore(await probeRecognize(rotated, worker))
    if (score > best.score) best = { angle, score }
    if (score >= ROTATION_SWEEP_EARLY_EXIT_SCORE) break
  }

  const coarseAngle = best.angle
  for (let angle = coarseAngle - 12; angle <= coarseAngle + 12; angle += 4) {
    if (angle === coarseAngle) continue
    const rotated = rotateCanvasByDegrees(probe, angle)
    const score = sweepScore(await probeRecognize(rotated, worker))
    if (score > best.score) best = { angle, score }
  }

  return best.score >= ROTATION_SWEEP_ACCEPT_SCORE ? best.angle : null
}

async function recognizeCanvas(
  imageSource: HTMLCanvasElement | string,
  worker: OcrWorker
): Promise<string> {
  const { PSM } = await import('tesseract.js')
  const modes = [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT] as const
  let bestText = ''
  let bestScore = 0

  for (const mode of modes) {
    await worker.setParameters({
      tessedit_pageseg_mode: mode,
      preserve_interword_spaces: '1',
    })
    const {
      data: { text },
    } = await worker.recognize(imageSource)
    const score = scoreOcrText(text)
    if (score > bestScore) {
      bestScore = score
      bestText = text
    }
  }

  return bestText
}

async function recognizeVariants(
  canvas: HTMLCanvasElement,
  worker: OcrWorker
): Promise<Array<{ text: string; score: number }>> {
  const collected: Array<{ text: string; score: number }> = []
  for (const source of createOcrImageVariants(canvas)) {
    const text = await recognizeCanvas(source, worker)
    if (text.trim()) collected.push({ text: text.trim(), score: scoreOcrText(text) })
  }
  return collected
}

async function recognizeBestFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')

  try {
    const turns = await detectBestQuarterTurns(canvas, worker)
    const upright = turns === 0 ? canvas : rotateCanvasQuarterTurns(canvas, turns)
    let collected = await recognizeVariants(upright, worker)

    // If no variant produced readable words, the photo is likely tilted at an
    // arbitrary angle; try to rescue it with a rotation sweep.
    const isReadable = collected.some(
      (entry) => countReadableWords(entry.text) >= READABLE_RESULT_MIN_WORDS
    )
    if (!isReadable) {
      const angle = await findBestRotationAngle(canvas, worker)
      if (angle !== null && angle !== 0) {
        const rescued = await recognizeVariants(rotateCanvasByDegrees(canvas, angle), worker)
        const bestBefore = Math.max(0, ...collected.map((entry) => sweepScore(entry.text)))
        const bestAfter = Math.max(0, ...rescued.map((entry) => sweepScore(entry.text)))
        // Replace (not merge): garbled sideways reads would only feed the
        // parser noise next to the clean rescue.
        if (bestAfter > bestBefore) collected = rescued
      }
    }

    if (collected.length === 0) return ''

    // Best read first: the parser prefers earlier label matches, so a garbled
    // variant must never shadow a clean one.
    collected.sort((a, b) => b.score - a.score)
    return collected.map((entry) => entry.text).join('\n')
  } finally {
    await worker.terminate()
  }
}

/**
 * Reads a document as text. PDFs with an embedded text layer are read exactly;
 * everything else falls back to client-side OCR on the first page.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const validationError = validateDemandDocumentFile(file)
  if (validationError) throw new Error(validationError)

  let canvas: HTMLCanvasElement
  if (file.type === 'application/pdf') {
    const pdf = await loadPdfDocument(file)
    const textLayer = await extractPdfTextLayer(pdf)
    if (textLayer.replace(/\s/g, '').length >= PDF_TEXT_LAYER_MIN_CHARS) {
      return textLayer
    }
    canvas = await renderPdfPageToCanvas(pdf)
  } else {
    canvas = await loadFileToCanvas(file)
  }

  const text = await recognizeBestFromCanvas(canvas)

  if (!text.trim() || scoreOcrText(text) < 8) {
    throw new Error(
      'Could not read enough text from this photo. For best results, print or export the document as a PDF instead of photographing it.'
    )
  }

  return text
}
