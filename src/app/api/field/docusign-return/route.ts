/**
 * GET /api/field/docusign-return — where DocuSign sends the signer after the
 * field app's embedded signing. Status is updated by the DocuSign webhook; this
 * page only tells the user to go back to the app.
 */
export function GET(request: Request) {
  const event = new URL(request.url).searchParams.get('event') ?? ''
  const done = event === 'signing_complete'
  const title = done ? 'İmza tamamlandı' : 'İmza penceresi kapandı'
  const body = done
    ? 'Belge imzalandı. Bu pencereyi kapatıp AuroraField uygulamasına dönebilirsiniz.'
    : 'İmza tamamlanmadı. Bu pencereyi kapatıp uygulamadan tekrar deneyebilirsiniz.'
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:-apple-system,system-ui,sans-serif;padding:32px;text-align:center;color:#111"><h1 style="font-size:22px">${title}</h1><p style="color:#555">${body}</p></body></html>`
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
