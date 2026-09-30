import { authenticateRequest } from '@/lib/supabase/server'

function fail(error: string, status: number) {
  return Response.json({ error }, { status })
}

export async function GET(request: Request) {
  const authenticated = await authenticateRequest(request)
  if (!authenticated) return Response.json({ sessions: [] })

  const { data, error } = await authenticated.supabase
    .from('chat_sessions')
    .select('id, title, selected_state')
    .eq('user_id', authenticated.user.id)
    .limit(100)

  if (error) {
    console.error('Could not load chat sessions:', error.message)
    return Response.json({ sessions: [] })
  }
  return Response.json({ sessions: (data ?? []).map((chat) => ({ ...chat, session_id: chat.id })) })
}