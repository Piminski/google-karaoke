import { fetchNewsPath } from '../server/fetchNewsPath'

export const config = {
  maxDuration: 60,
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const data = await fetchNewsPath()
    return Response.json(data)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
