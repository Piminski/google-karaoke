import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { config as loadEnv } from 'dotenv'
import { defineConfig, type Plugin } from 'vite'

import { fetchNewsPath } from './server/fetchNewsPath'

loadEnv()

function newsApiPlugin(): Plugin {
  const handler = async (
    _req: import('http').IncomingMessage,
    res: import('http').ServerResponse,
  ) => {
    try {
      const data = await fetchNewsPath()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: (error as Error).message }))
    }
  }

  return {
    name: 'news-api',
    configureServer(server) {
      server.middlewares.use('/api/news-path', (req, res, next) => {
        if (req.method !== 'GET') return next()
        void handler(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/news-path', (req, res, next) => {
        if (req.method !== 'GET') return next()
        void handler(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), newsApiPlugin()],
})
