import { createClient } from '@supabase/supabase-js'

function projectUrl(url: string) {
  return url.replace(/\/rest\/v1\/?$/, '')
}

function getPublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
}

export function getAnonymousSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = getPublicKey()
  if (!url || !anonKey) throw new Error('Supabase is not configured.')

  return createClient(projectUrl(url), anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function authenticateRequest(request: Request) {
  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = getPublicKey()
  if (!accessToken || !url || !anonKey) return null

  const supabase = createClient(projectUrl(url), anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) return null
  return { supabase, user: data.user }
}