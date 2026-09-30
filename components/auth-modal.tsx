'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'

type AuthModalProps = {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  if (!open) return null

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')
    try {
      const supabase = getBrowserSupabase()
      if (mode === 'sign-up') {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        })
        if (authError) throw authError
        if (!data.session) {
          setMessage('Account created. Check your email to confirm your address, then sign in.')
          return
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
      }
      onClose()
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function continueWithGoogle() {
    setPending(true)
    setError('')
    setMessage('')
    try {
      const { error: authError } = await getBrowserSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (authError) throw authError
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Google sign-in could not be started.')
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close sign-in dialog" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-slate-700 bg-[#141b23] p-6 shadow-2xl shadow-black/50 sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-white"
          aria-label="Close sign-in dialog"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-400">LegalPulse AI</p>
          <h2 id="auth-title" className="mt-2 font-serif text-2xl font-semibold text-white">
            {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">
            {mode === 'sign-in' ? 'Sign in to analyze and access saved contracts.' : 'Create a secure workspace for your contract reviews.'}
          </p>
        </div>

        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-slate-600 bg-slate-800/60 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          <span className="font-semibold text-base" aria-hidden="true">G</span>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-slate-500">
          <span className="h-px flex-1 bg-slate-700" />
          or with email
          <span className="h-px flex-1 bg-slate-700" />
        </div>

        <form onSubmit={submitEmail} className="space-y-4">
          {mode === 'sign-up' && (
            <div className="space-y-1.5">
              <label htmlFor="auth-name" className="text-xs font-medium text-slate-300">Full name</label>
              <input
                id="auth-name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-xs font-medium text-slate-300">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-xs font-medium text-slate-300">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
            />
          </div>

          {error && <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-sm text-rose-300">{error}</p>}
          {message && <p role="status" className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-300">{message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          {mode === 'sign-in' ? 'New to LegalPulse?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in')
              setError('')
              setMessage('')
            }}
            className="font-medium text-emerald-300 hover:text-emerald-200"
          >
            {mode === 'sign-in' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </div>
  )
}