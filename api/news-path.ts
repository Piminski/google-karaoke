import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchNewsPath } from '../server/fetchNewsPath.js'

export const config = {
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const data = await fetchNewsPath()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
