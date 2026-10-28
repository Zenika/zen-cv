import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      projects: [
        {
          extends: true,
          test: { name: 'app', environment: 'jsdom', include: ['src/**/*.spec.ts'] },
        },
        {
          extends: true,
          test: { name: 'server', environment: 'node', include: ['server/**/*.spec.ts'] },
        },
      ],
    },
  }),
)
