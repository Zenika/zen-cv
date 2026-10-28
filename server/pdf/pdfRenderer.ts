import { readFile } from 'node:fs/promises'
import { chromium, type Browser } from 'playwright'
import { PdfExportError } from '../services/errors.ts'

export type PdfRenderer = {
  render(id: string): Promise<Uint8Array>
  close(): Promise<void>
}

type PdfRendererOptions = {
  baseUrl: () => string
  logoFile: string
}

export function createPdfRenderer({ baseUrl, logoFile }: PdfRendererOptions): PdfRenderer {
  let browser: Promise<Browser> | undefined

  function getBrowser() {
    if (!browser) {
      const launching = chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
      launching.then(
        (launched) => launched.on('disconnected', () => (browser = undefined)),
        () => (browser = undefined),
      )
      browser = launching
    }
    return browser
  }

  return {
    async render(id) {
      const context = await (await getBrowser()).newContext()
      try {
        const page = await context.newPage()
        await page.goto(new URL(`cv/${encodeURIComponent(id)}`, baseUrl()).href)
        await page.waitForSelector('.cv-header, .load-error')
        const loadError = await page.$('.load-error__message')
        if (loadError)
          throw new PdfExportError(
            (await loadError.textContent()) ?? 'le CV n’a pas pu être chargé.',
          )
        await page.addStyleTag({
          content: '[id^="__vue-devtools"], .cv-page__footer { display: none !important; }',
        })
        await page.evaluate(() => document.fonts.ready)
        const logo = (await readFile(logoFile)).toString('base64')
        return await page.pdf({
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate:
            '<div style="position: absolute; top: 0; right: 0; left: 0; height: 10px; background: #ee2238; -webkit-print-color-adjust: exact;"></div>',
          footerTemplate: `<div style="width: 100%; text-align: center;"><img src="data:image/png;base64,${logo}" style="height: 10mm;" /></div>`,
        })
      } finally {
        await context.close()
      }
    },

    async close() {
      const launched = browser
      browser = undefined
      await (await launched?.catch(() => undefined))?.close()
    },
  }
}
