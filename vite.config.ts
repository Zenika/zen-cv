import { fileURLToPath, URL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const raphaelFile = fileURLToPath(new URL('./src/bdd/raphael.json', import.meta.url))
const zenikaLogoFile = fileURLToPath(new URL('./public/images/zenika.png', import.meta.url))

// Dev-only API to read/write src/bdd/raphael.json from the browser
function bddApi(): Plugin {
  return {
    name: 'bdd-api',
    configureServer(server) {
      // Renders the app with headless Chrome and returns it as a PDF
      server.middlewares.use('/api/cv.pdf', async (_req, res) => {
        const { chromium } = await import('@playwright/test')
        // Fall back to the system Chrome when Playwright's browser isn't installed
        const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
        try {
          const page = await browser.newPage()
          await page.goto(server.resolvedUrls?.local[0] ?? 'http://localhost:5173/')
          await page.waitForSelector('.cv-company')
          // The logo is drawn on every page by the PDF footer, so hide the in-page one
          await page.addStyleTag({
            content: '[id^="__vue-devtools"], .cv-footer { display: none !important; }',
          })
          await page.evaluate(() => document.fonts.ready)
          // Header/footer templates can't load URLs, so the logo is inlined
          const logo = (await readFile(zenikaLogoFile)).toString('base64')
          const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `<div style="width: 100%; text-align: center;"><img src="data:image/png;base64,${logo}" style="height: 10mm;" /></div>`,
          })
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', 'attachment; filename="cv-raphael-grand.pdf"')
          res.end(pdf)
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        } finally {
          await browser.close()
        }
      })

      server.middlewares.use('/api/raphael', async (req, res) => {
        try {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            res.end(await readFile(raphaelFile, 'utf-8'))
            return
          }
          if (req.method === 'PUT') {
            let body = ''
            for await (const chunk of req) body += chunk
            const data = JSON.parse(body)
            await writeFile(raphaelFile, JSON.stringify(data, null, 2) + '\n', 'utf-8')
            res.statusCode = 204
            res.end()
            return
          }
          res.statusCode = 405
          res.end()
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    bddApi(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
