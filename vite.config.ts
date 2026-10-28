import { fileURLToPath, URL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

import type { ServerResponse } from 'node:http'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const databaseFile = fileURLToPath(new URL('./src/bdd/cv-database.json', import.meta.url))
const zenikaLogoFile = fileURLToPath(new URL('./public/images/zenika.png', import.meta.url))

type StoredCv = { firstname: string; name: string; title: string } & Record<string, unknown>

// Dev-only API to read/write the CVs of src/bdd/cv-database.json from the browser:
// GET /api/cvs, GET|PUT /api/cvs/:id and GET /api/cvs/:id/pdf
function bddApi(): Plugin {
  return {
    name: 'bdd-api',
    configureServer(server) {
      async function readDatabase(): Promise<Record<string, StoredCv>> {
        return JSON.parse(await readFile(databaseFile, 'utf-8'))
      }

      // Renders the CV page with headless Chrome and returns it as a PDF
      async function exportPdf(id: string, res: ServerResponse) {
        const { chromium } = await import('@playwright/test')
        // Fall back to the system Chrome when Playwright's browser isn't installed
        const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
        try {
          const page = await browser.newPage()
          await page.goto(
            `${server.resolvedUrls?.local[0] ?? 'http://localhost:5173/'}cv/${encodeURIComponent(id)}`,
          )
          // Either the CV or its load error shows up, so a failed load doesn't wait for the timeout
          await page.waitForSelector('.cv-header, .load-error')
          const loadError = await page.$('.load-error__message')
          if (loadError) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end(await loadError.textContent())
            return
          }
          // The logo is drawn on every page by the PDF footer, so hide the in-page one
          await page.addStyleTag({
            content: '[id^="__vue-devtools"], .cv-page__footer { display: none !important; }',
          })
          await page.evaluate(() => document.fonts.ready)
          // Header/footer templates can't load URLs, so the logo is inlined
          const logo = (await readFile(zenikaLogoFile)).toString('base64')
          const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            // Repeats the .cv red top border on every page
            headerTemplate:
              '<div style="position: absolute; top: 0; right: 0; left: 0; height: 10px; background: #ee2238; -webkit-print-color-adjust: exact;"></div>',
            footerTemplate: `<div style="width: 100%; text-align: center;"><img src="data:image/png;base64,${logo}" style="height: 10mm;" /></div>`,
          })
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename="cv-${id}.pdf"`)
          res.end(pdf)
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        } finally {
          await browser.close()
        }
      }

      server.middlewares.use('/api/cvs', async (req, res) => {
        const [id, action] = (req.url ?? '/')
          .split('?')[0]!
          .split('/')
          .filter(Boolean)
          .map(decodeURIComponent)
        try {
          if (!id && req.method === 'GET') {
            const database = await readDatabase()
            const cvs = Object.entries(database).map(([id, { firstname, name, title }]) => ({
              id,
              firstname,
              name,
              title,
            }))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(cvs))
            return
          }
          if (id && action === 'pdf' && req.method === 'GET') {
            await exportPdf(id, res)
            return
          }
          if (id && !action && req.method === 'GET') {
            const cv = (await readDatabase())[id]
            if (!cv) {
              res.statusCode = 404
              res.end(`aucun CV ne correspond à « ${id} ».`)
              return
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(cv))
            return
          }
          if (id && !action && req.method === 'PUT') {
            let body = ''
            for await (const chunk of req) body += chunk
            const database = await readDatabase()
            if (!database[id]) {
              res.statusCode = 404
              res.end(`aucun CV ne correspond à « ${id} ».`)
              return
            }
            database[id] = JSON.parse(body)
            await writeFile(databaseFile, JSON.stringify(database, null, 2) + '\n', 'utf-8')
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
  plugins: [vue(), vueDevTools(), bddApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
