/** Flat print stylesheet used inside an isolated iframe (no dashboard CSS bleed). */
export const DEMAND_HANDOFF_PRINT_STYLES = `
  @page {
    size: letter;
    margin: 0.45in;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #18181b;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .demand-handoff-sheet {
    width: 100%;
    max-width: 100%;
    margin: 0;
  }

  .demand-handoff-header {
    border-bottom: 2px solid #c27e00;
    padding-bottom: 6px;
    margin-bottom: 8px;
    break-after: avoid;
    page-break-after: avoid;
  }

  .demand-handoff-header h1 {
    margin: 0;
    font-size: 16pt;
    font-weight: 700;
    color: #18181b;
  }

  .demand-handoff-header p {
    margin: 2px 0 0;
    font-size: 8.5pt;
    color: #71717a;
  }

  .demand-handoff-section {
    margin-bottom: 6px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .demand-handoff-section-title {
    font-size: 9.5pt;
    font-weight: 700;
    color: #18181b;
    margin: 0 0 3px;
    padding-left: 8px;
    border-left: 3px solid #c27e00;
    break-after: avoid;
    page-break-after: avoid;
  }

  .demand-handoff-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 14px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .demand-handoff-row {
    display: flex;
    flex-direction: column;
    gap: 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .demand-handoff-label {
    font-size: 7pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #71717a;
    line-height: 1.35;
  }

  .demand-handoff-value {
    font-size: 9pt;
    color: #18181b;
    word-break: break-word;
  }

  .demand-handoff-full {
    grid-column: 1 / -1;
  }

  .demand-handoff-notes {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .demand-handoff-warranty ul {
    margin: 2px 0 0;
    padding-left: 16px;
    font-size: 8pt;
    color: #3f3f46;
  }

  .demand-handoff-warranty li {
    margin-bottom: 1px;
  }

  .demand-handoff-tail {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .demand-handoff-qr-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    margin-top: 2px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .demand-handoff-qr-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;
    padding: 4px 2px;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    background: #fafafa;
    min-width: 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .demand-handoff-qr-heading {
    width: 100%;
    min-height: 1.1em;
    line-height: 1.2;
    margin: 0;
    padding: 0;
    font-size: 8pt;
    font-weight: 600;
    color: #18181b;
  }

  .demand-handoff-qr-image-wrap {
    width: 68px;
    height: 68px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 4px;
    overflow: hidden;
  }

  .demand-handoff-qr-image-wrap img,
  .demand-handoff-qr-image {
    width: 64px;
    height: 64px;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }

  .demand-handoff-qr-card-subtitle {
    margin: 0;
    font-size: 6.5pt;
    line-height: 1.2;
    color: #71717a;
  }

  .demand-handoff-footer {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #e4e4e7;
    font-size: 7.5pt;
    color: #71717a;
    break-inside: avoid;
    page-break-inside: avoid;
  }
`
