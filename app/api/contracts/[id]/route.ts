import { authenticateRequest } from '@/lib/supabase/server'

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authenticated = await authenticateRequest(request)
  if (!authenticated) return fail('Sign in to view saved contracts.', 401)

  const { id } = await params
  const { data, error } = await authenticated.supabase
    .from('contracts')
    .select('id, title, state, risk_score, source, file_name, created_at, analysis, raw_output')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Could not load saved contract:', error.message)
    return fail('Could not load this saved report.', 503)
  }
  if (!data) return fail('This contract was not found.', 404)

  return Response.json({ contract: data })
}