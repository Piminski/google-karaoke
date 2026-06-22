import { config as loadEnv } from 'dotenv'
import express from 'express'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { fetchNewsPath } from './fetchNewsPath.ts'

loadEnv()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '../dist')
const port = Number(process.env.PORT) || 3000

const app = express()

app.get('/api/news-path', async (_req, res) => {
  try {
    const data = await fetchNewsPath()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

app.use(express.static(distPath))

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, () => {
  console.log(`News Karaoke running at http://localhost:${port}`)
})
