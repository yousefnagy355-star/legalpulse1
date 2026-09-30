const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL
  ?? 'https://n8n.command-system.online/webhook/analyze-contract'
const N8N_FILE_WEBHOOK_URL = process.env.N8N_FILE_WEBHOOK_URL
  ?? 'https://n8n.command-system.online/webhook/media'

const MAX_ATTEMPTS = 3
const ATTEMPT_TIMEOUT_MS = 40_000
const BACKOFF_BASE_MS = 500
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function fetchN8n(url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-cache, no-store, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Idempotency-Key', headers.get('Idempotency-Key') ?? crypto.randomUUID())

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        cache: 'no-store',
        signal,
      })

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
        return response
      }

      await response.body?.cancel().catch(() => undefined)
    } catch (error) {
      if (init.signal?.aborted || attempt === MAX_ATTEMPTS - 1) throw error
    }

    await wait(BACKOFF_BASE_MS * 2 ** attempt)
  }

  throw new Error('The n8n request failed after three attempts.')
}

export { N8N_FILE_WEBHOOK_URL, N8N_WEBHOOK_URL }