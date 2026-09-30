import { authenticateRequest } from '@/lib/supabase/server'

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export async function GET(request: Request) {
  const authenticated = await authenticateRequest(request)
  if (!authenticated) return fail('Sign in to view saved contracts.', 401)

  const { data, error } = await authenticated.supabase
    .from('contracts')
    .select('id, title, state, risk_score, source, file_name, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Could not load contract history:', error.message)
    return fail('Could not load saved contracts. Check the Supabase contracts migration.', 503)
  }

  return Response.json({ contracts: data })
}