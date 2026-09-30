import type { ChatSessionRecord } from '@/lib/chat'
import { after } from 'next/server'
import { assistantText } from '@/lib/chat-response'
import { fetchN8n, N8N_FILE_WEBHOOK_URL, N8N_WEBHOOK_URL } from '@/lib/n8n'
import { authenticateRequest, getAnonymousSupabase } from '@/lib/supabase/server'
import { US_STATES } from '@/lib/us-states'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_MESSAGE_CHARS = 200_000

function fail(error: string, status: number) {
  return Response.json({ error }, { status })
}

function isFileData(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const maxBase64Length = Math.ceil(MAX_FILE_BYTES / 3) * 4
  return value.length > 0
    && value.length <= maxBase64Length
    && /^[A-Za-z0-9+/]*={0,2}$/.test(value)
}

export async function POST(request: Request) {
  const hasAuthorization = request.headers.has('authorization')
  const authenticated = await authenticateRequest(request)
  if (hasAuthorization && !authenticated) return fail('Your sign-in session expired. Sign in again to continue.', 401)

  let body: { userId?: unknown; sessionId?: unknown; selectedState?: unknown; message?: unknown; fileName?: unknown; fileData?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail('Send a valid JSON chat request.', 400)
  }

  const sessionId = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : 'default_session'
  const selectedState = typeof body.selectedState === 'string' && body.selectedState ? body.selectedState : 'California'
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const fileName = typeof body.fileName === 'string' && body.fileName ? body.fileName : null
  const fileData = body.fileData == null ? null : body.fileData

  if (sessionId !== 'default_session' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return fail('Start a new chat before sending a message.', 400)
  }
  if (!US_STATES.includes(selectedState as (typeof US_STATES)[number])) return fail('Select a valid US state.', 400)
  if (message.length > MAX_MESSAGE_CHARS) return fail('Message is too long.', 413)
  if (fileData !== null && !isFileData(fileData)) return fail('The attached file data is invalid or larger than 10 MB.', 400)
  if ((fileData === null) !== (fileName === null)) return fail('Include both fileName and base64 fileData for attachments.', 400)
  if (!message && !fileData) return fail('Write a message or attach a file.', 400)

  const userId = authenticated?.user.id ?? 'guest_user'
  const hasFile = fileData !== null && fileName !== null
  let webhookBody: FormData | string
  if (hasFile) {
    let binaryData: string
    try {
      binaryData = atob(fileData)
    } catch {
      return fail('The attached file data is invalid.', 400)
    }

    const fileBytes = Uint8Array.from(binaryData, (character) => character.charCodeAt(0))
    if (fileBytes.byteLength > MAX_FILE_BYTES) return fail('The attached file data is invalid or larger than 10 MB.', 413)

    const formData = new FormData()
    formData.append('file', new Blob([fileBytes]), fileName)
    formData.append('sessionId', sessionId)
    formData.append('userId', userId)
    formData.append('selectedState', selectedState)
    formData.append('message', message)
    webhookBody = formData
  } else {
    webhookBody = JSON.stringify({ userId, sessionId, selectedState, message, fileName, fileData })
  }

  let upstream: Response
  try {
    upstream = await fetchN8n(hasFile ? N8N_FILE_WEBHOOK_URL : N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: hasFile ? undefined : { 'Content-Type': 'application/json' },
      body: webhookBody,
    })
  } catch {
    return fail('The n8n analysis service did not respond. Please try again.', 502)
  }

  const responseText = await upstream.text()
  if (!upstream.ok) {
    const detail = upstream.status === 404
      ? 'The webhook was not found or its workflow is inactive.'
      : `The workflow returned status ${upstream.status}.`
    return fail(`n8n could not complete this analysis. ${detail}`, 502)
  }

  let responseData: unknown = responseText
  try {
    responseData = JSON.parse(responseText)
  } catch {
    // Plain text is a valid response from an n8n webhook.
  }
  const assistantMessage = assistantText(responseData)
  const now = new Date().toISOString()
  const title = message.slice(0, 72) || fileName || 'New chat'
  const savedSession: ChatSessionRecord | null = authenticated
    ? { session_id: sessionId, title, selected_state: selectedState, created_at: now, updated_at: now }
    : null

  after(async () => {
    try {
      const database = authenticated?.supabase ?? getAnonymousSupabase()

      if (authenticated) {
        try {
          const { data: existing, error: lookupError } = await database
            .from('chat_sessions')
            .select('id, title')
            .eq('id', sessionId)
            .eq('user_id', authenticated.user.id)
            .maybeSingle()
          if (lookupError) throw lookupError

          const sessionTitle = existing?.title && existing.title !== 'New chat' ? existing.title : title
          const sessionWrite = existing
            ? await database.from('chat_sessions')
              .update({ title: sessionTitle, selected_state: selectedState })
              .eq('id', sessionId)
              .eq('user_id', authenticated.user.id)
            : await database.from('chat_sessions')
              .insert({ id: sessionId, user_id: authenticated.user.id, title: sessionTitle, selected_state: selectedState })
          if (sessionWrite.error) throw sessionWrite.error
        } catch (error) {
          console.warn('Chat session could not be saved:', error)
        }
      }

      const userContent = [message, fileName ? `Attached file: ${fileName}` : ''].filter(Boolean).join('\n\n')
      const userHistory = {
        type: 'human',
        content: userContent,
        additional_kwargs: fileName ? { fileName } : {},
        response_metadata: {},
      }
      const assistantHistory = {
        type: 'ai',
        content: assistantMessage,
        additional_kwargs: {},
        response_metadata: {},
      }
      const { error: historyError } = await database
        .from('n8n_chat_histories')
        .insert([
          { session_id: sessionId, message: userHistory },
          { session_id: sessionId, message: assistantHistory },
        ])
      if (historyError) console.warn('Chat messages could not be saved:', historyError)
    } catch (error) {
      console.warn('Chat persistence is unavailable:', error)
    }
  })

  return Response.json({ assistantMessage, sessionId, session: savedSession })
}