import { resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createServerApp } from './app.ts'

const port = Number(process.env.PORT ?? 3000)
const staticRoot = resolve(process.env.STATIC_ROOT ?? 'dist')

const { app, migrate, close } = createServerApp({
  databaseUrl: process.env.DATABASE_URL,
  logoFile: resolve(staticRoot, 'images/zenika.png'),
  baseUrl: () => `http://localhost:${port}/`,
})

await migrate()

const root = new Hono()
  .route('/', app)
  .all('/api/*', (c) => c.text('ressource introuvable.', 404))
  .use('*', serveStatic({ root: staticRoot }))
  .get('*', serveStatic({ root: staticRoot, path: 'index.html' }))

const server = serve({ fetch: root.fetch, port }, ({ port }) => {
  console.log(`zen-cv listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close()
  await close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
