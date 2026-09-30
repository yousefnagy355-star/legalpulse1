import { extractPayload, normalizeAnalysis, type AnalyzeResponse } from '@/lib/analysis'
import { fetchN8n, N8N_WEBHOOK_URL } from '@/lib/n8n'
import { US_STATES } from '@/lib/us-states'
import { authenticateRequest } from '@/lib/supabase/server'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TEXT_CHARS = 200_000
const MIN_TEXT_CHARS = 40

function fail(error: string, status: number) {
  return Response.json({ ok: false, error } satisfies AnalyzeResponse, { status })
}

async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer })
    return value
  }

  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    return buffer.toString('utf-8')
  }

  throw new Error('UNSUPPORTED')
}

export async function POST(request: Request) {
  const authenticated = await authenticateRequest(request)
  if (!authenticated) return fail('Sign in to analyze and save contracts.', 401)

  const contentType = request.headers.get('content-type') ?? ''
  let file: FormDataEntryValue | null = null
  let pastedText = ''
  let state = ''
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { contractText?: unknown; state?: unknown }
      pastedText = typeof body.contractText === 'string' ? body.contractText.trim() : ''
      state = typeof body.state === 'string' ? body.state : ''
    } else if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      file = form.get('file')
      pastedText = typeof form.get('contractText') === 'string' ? (form.get('contractText') as string).trim() : ''
      state = typeof form.get('state') === 'string' ? (form.get('state') as string) : ''
    } else {
      return fail('Send contract text as JSON or upload a supported file.', 415)
    }
  } catch {
    return fail('Invalid request.', 400)
  }

  if (!US_STATES.includes(state as (typeof US_STATES)[number])) {
    return fail('Select a valid US state jurisdiction.', 400)
  }

  let contractText = pastedText
  let source: 'text' | 'file' = 'text'
  let fileName: string | undefined

  if (typeof File !== 'undefined' && file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return fail('File is larger than 10 MB.', 413)
    try {
      contractText = (await extractFileText(file)).trim()
      source = 'file'
      fileName = file.name
    } catch (error) {
      if (error instanceof Error && error.message === 'UNSUPPORTED') {
        return fail('Unsupported file type. Please upload a PDF, DOCX, or TXT file.', 415)
      }
      return fail('Could not read that file. Try copying the contract text and pasting it instead.', 422)
    }
  }

  if (contractText.length < MIN_TEXT_CHARS) {
    return fail(
      source === 'file'
        ? 'We could not find enough text in that file (it may be a scanned image). Please paste the contract text instead.'
        : 'That text is too short to be a contract. Please paste the full agreement.',
      422,
    )
  }
  contractText = contractText.slice(0, MAX_TEXT_CHARS)

  let upstream: Response
  try {
    upstream = await fetchN8n(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authenticated.user.id,
        contractText,
        state,
      }),
    })
  } catch {
    return fail('The analysis server (n8n) is not responding. Make sure the workflow is Active.', 502)
  }

  const bodyText = await upstream.text()

  if (!upstream.ok) {
    const hint =
      upstream.status === 404
        ? 'The webhook was not found or the workflow is not Active.'
        : 'The n8n workflow hit an error — check Executions in n8n.'
    return fail(`n8n returned an error (${upstream.status}). ${hint}`, 502)
  }

  let data: unknown = bodyText
  try {
    data = JSON.parse(bodyText)
  } catch {
    // Plain-text response from "Respond to Webhook".
  }

  const { object, raw } = extractPayload(data)
  const analysis = normalizeAnalysis(object)
  if (!analysis) return fail('The n8n workflow returned a response that could not be structured into a contract report.', 502)

  const title = analysis.title || analysis.summary.contractType || fileName?.replace(/\.[^.]+$/, '') || 'Contract analysis'
  const { data: contract, error: saveError } = await authenticated.supabase
    .from('contracts')
    .insert({
      user_id: authenticated.user.id,
      title,
      state,
      contract_text: contractText,
      source,
      file_name: fileName ?? null,
      analysis,
      raw_output: raw,
      risk_score: analysis.riskScore,
    })
    .select('id, title, state, risk_score, source, file_name, created_at')
    .single()

  if (saveError || !contract) {
    console.error('Could not save contract analysis:', saveError?.message)
    return fail('Analysis finished, but the report could not be saved. Check the Supabase contracts migration and try again.', 503)
  }

  return Response.json({
    ok: true,
    analysis,
    raw,
    source,
    fileName,
    contract,
    contractId: contract.id,
  } satisfies AnalyzeResponse)
}
