export type BarcodeExcelRow = {
  code: string
  kind: string
  model?: string | null
  status?: string | null
  batch?: string | null
}

function barcodeExcelFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `barcodes-${stamp}.xlsx`
}

async function downloadWorkbook(wb: import('exceljs').Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportBarcodesToExcel(rows: BarcodeExcelRow[]): Promise<void> {
  if (rows.length === 0) return

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Aurora Hub'
  wb.created = new Date()

  const ws = wb.addWorksheet('Barcodes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { header: 'Barcode', key: 'barcode', width: 28 },
    { header: 'Kind', key: 'kind', width: 10 },
    { header: 'Model', key: 'model', width: 28 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Batch', key: 'batch', width: 38 },
  ]

  const header = ws.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle' }

  for (const row of rows) {
    const added = ws.addRow({
      barcode: row.code,
      kind: row.kind,
      model: row.model ?? '',
      status: row.status ?? '',
      batch: row.batch ?? '',
    })
    added.getCell(1).numFmt = '@'
    added.getCell(5).numFmt = '@'
  }

  await downloadWorkbook(wb, barcodeExcelFilename())
}
