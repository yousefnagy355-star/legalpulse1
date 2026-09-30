import type { ChatThreadMessage } from '@/lib/chat'
import { authenticateRequest } from '@/lib/supabase/server'

function fail(error: string, status: number) {
  return Response.json({ error }, { status })
}

function messageText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(messageText).filter(Boolean).join('\n')
  if (value && typeof value === 'object') {
    const message = value as Record<string, unknown>
    return messageText(message.content ?? message.text ?? message.output)
  }
  return ''
}

function normalizeMessage(row: { id: string | number; message: unknown }): ChatThreadMessage | null {
  if (!row.message || typeof row.message !== 'object') return null
  const message = row.message as Record<string, unknown>
  const data = message.data && typeof message.data === 'object' ? message.data as Record<string, unknown> : null
  const kind = String(message.type ?? data?.type ?? '').toLowerCase()
  const role = /human|user/.test(kind) ? 'user' : /ai|assistant/.test(kind) ? 'assistant' : null
  const content = messageText(message.content ?? data?.content)
  return role && content ? { id: row.id, role, content } : null
}

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const authenticated = await authenticateRequest(request)
  if (!authenticated) return fail('Sign in to load a saved chat.', 401)

  const { sessionId } = await params
  const { data: chatSession, error: sessionError } = await authenticated.supabase
    .from('chat_sessions')
    .select('id, title, selected_state')
    .eq('id', sessionId)
    .eq('user_id', authenticated.user.id)
    .maybeSingle()

  if (sessionError) {
    console.error('Could not verify chat ownership:', sessionError.message)
    return fail('Could not load this chat session.', 503)
  }
  if (!chatSession) return fail('This chat session was not found.', 404)

  const { data, error } = await authenticated.supabase
    .from('n8n_chat_histories')
    .select('id, message')
    .eq('session_id', sessionId)
    .order('id', { ascending: true })

  if (error) {
    console.error('Could not load n8n chat history:', error.message)
    return fail('Could not read n8n_chat_histories. Confirm it is exposed in Supabase and its owner-only policy is installed.', 503)
  }

  const messages = (data ?? []).map(normalizeMessage).filter((item): item is ChatThreadMessage => item !== null)
  return Response.json({ session: { ...chatSession, session_id: chatSession.id }, messages })
}