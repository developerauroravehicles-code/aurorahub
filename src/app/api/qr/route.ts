import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

const MAX_LEN = 2048

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get('data')?.trim() ?? ''
  if (!data || data.length > MAX_LEN) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const sizeRaw = Number(request.nextUrl.searchParams.get('size') ?? '160')
  const size = Number.isFinite(sizeRaw) ? Math.min(Math.max(Math.round(sizeRaw), 64), 512) : 160

  try {
    const png = await QRCode.toBuffer(data, {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    })

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch (err) {
    console.error('QR generation failed', err)
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}
