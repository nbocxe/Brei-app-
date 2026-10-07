import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { fragmentsToLines, type Fragment } from './lines'

type PdfjsModule = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<PdfjsModule> | null = null

/**
 * pdf.js is groot en alleen nodig bij het importeren. Door hem pas dan te laden
 * start de app op je telefoon een stuk sneller op.
 */
function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    // De worker wordt meegebundeld, zodat importeren ook offline werkt.
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })
  return pdfjsPromise
}

export type PdfExtraction = {
  /** De tekst per pagina, in leesvolgorde. */
  pages: string[]
  pageCount: number
  /** Geen letter gevonden: vrijwel zeker een gescande PDF met alleen plaatjes. */
  isScanned: boolean
}

function toFragment(item: TextItem): Fragment | null {
  if (!item.str || item.str.trim() === '') return null
  const [, skewY, , scaleY, x, y] = item.transform as number[]
  const size = Math.abs(scaleY) || Math.hypot(skewY, scaleY) || item.height || 10
  return { text: item.str, x, y, size, endX: x + (item.width ?? 0) }
}

/** Haalt de tekst uit een PDF-bestand, volledig in de browser. */
export async function extractPdfText(file: File | ArrayBuffer): Promise<PdfExtraction> {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const pdfjs = await loadPdfjs()

  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    // Een patroon-PDF heeft geen formulieren of scripts nodig.
    isEvalSupported: false,
  })

  const doc = await task.promise
  try {
    const pages: string[] = []
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number)
      try {
        const content = await page.getTextContent()
        const fragments = content.items
          .filter((item): item is TextItem => 'str' in item)
          .map(toFragment)
          .filter((fragment): fragment is Fragment => fragment !== null)
        pages.push(fragmentsToLines(fragments).join('\n'))
      } finally {
        page.cleanup()
      }
    }

    return {
      pages,
      pageCount: doc.numPages,
      isScanned: pages.every((page) => page.replace(/\s/g, '').length < 20),
    }
  } finally {
    await doc.destroy()
  }
}

/** Zet een fout van pdf.js om in iets wat je kunt lezen. */
export function describePdfError(error: unknown): string {
  const name = (error as { name?: string })?.name ?? ''
  const message = (error as { message?: string })?.message ?? ''

  if (name === 'PasswordException') {
    return 'Deze PDF is beveiligd met een wachtwoord. Sla hem zonder wachtwoord op en probeer het opnieuw.'
  }
  if (name === 'InvalidPDFException' || /invalid pdf/i.test(message)) {
    return 'Dit bestand lijkt geen geldige PDF te zijn.'
  }
  return 'Het lezen van de PDF is niet gelukt. Je kunt de tekst ook zelf plakken.'
}
