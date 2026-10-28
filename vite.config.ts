import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const databaseFile = fileURLToPath(new URL('./src/bdd/cv-database.json', import.meta.url))
const zenikaLogoFile = fileURLToPath(new URL('./public/images/zenika.png', import.meta.url))

type ServerModule = typeof import('./server/app.ts')
type Listener = (req: IncomingMessage, res: ServerResponse) => Promise<void>

// Serves /api in dev with the Hono app of server/, reloaded when its code changes
function apiServer(): Plugin {
  return {
    name: 'api-server',
    configureServer(server) {
      let current:
        { module: ServerModule; listener: Listener; close: () => Promise<void> } | undefined

      async function getListener() {
        const module = (await server.ssrLoadModule('/server/app.ts')) as ServerModule
        if (current?.module !== module) {
          await current?.close()
          const { getRequestListener } = await import('@hono/node-server')
          const { app, close } = module.createServerApp({
            databaseFile,
            logoFile: zenikaLogoFile,
            baseUrl: () => server.resolvedUrls?.local[0] ?? 'http://localhost:5173/',
          })
          current = { module, listener: getRequestListener(app.fetch), close }
        }
        return current.listener
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          await (
            await getListener()
          )(req, res)
        } catch (error) {
          next(error)
        }
      })
      server.httpServer?.on('close', () => current?.close())
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), apiServer()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
