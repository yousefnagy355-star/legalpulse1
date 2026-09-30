'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Check, ChevronDown, FileText, Globe2, LogOut, Menu, Plus, Sparkles, X } from 'lucide-react'
import { AuthModal } from '@/components/auth-modal'
import { ChatComposer } from '@/components/chat-composer'
import { ChatMessage } from '@/components/chat-message'
import type { ChatSessionRecord, ChatThreadMessage } from '@/lib/chat'
import { getBrowserSupabase, isSupabaseConfigured } from '@/lib/supabase/browser'
import { US_STATES } from '@/lib/us-states'

function groupSessions(sessions: ChatSessionRecord[]) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const groups = new Map<string, ChatSessionRecord[]>([
    ['Today', []],
    ['Yesterday', []],
    ['Previous 7 days', []],
    ['Earlier', []],
  ])

  for (const session of sessions) {
    const date = new Date(session.updated_at ?? session.created_at ?? 0)
    const age = Math.floor((today.getTime() - date.getTime()) / 86_400_000)
    const label = date.toDateString() === today.toDateString()
      ? 'Today'
      : date.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : age < 7
          ? 'Previous 7 days'
          : 'Earlier'
    groups.get(label)?.push(session)
  }

  return [...groups].filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, sessions: items }))
}

export function ChatAppShell() {
  const authConfigured = isSupabaseConfigured()
  const [session, setSession] = useState<Session | null>(null)
  const [selectedState, setSelectedState] = useState('California')
  const [chatSessions, setChatSessions] = useState<ChatSessionRecord[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [messages, setMessages] = useState<ChatThreadMessage[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [analysisPending, setAnalysisPending] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const messageListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveSessionId(crypto.randomUUID())
  }, [])

  useEffect(() => {
    if (!authConfigured) return
    const supabase = getBrowserSupabase()
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession)
    })
    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [authConfigured])

  useEffect(() => {
    if (!session?.access_token) {
      setChatSessions([])
      return
    }
    let mounted = true
    setHistoryLoading(true)
    void fetch('/api/chat-sessions', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json() as { sessions?: ChatSessionRecord[]; error?: string }
        if (mounted) {
          setChatSessions(response.ok && Array.isArray(payload.sessions) ? payload.sessions : [])
          setHistoryError('')
        }
      })
      .catch(() => {
        if (mounted) {
          setChatSessions([])
          setHistoryError('')
        }
      })
      .finally(() => {
        if (mounted) setHistoryLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [session?.access_token])

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, analysisPending])

  const historyGroups = groupSessions(chatSessions)
  const user = session?.user
  const userName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'LegalPulse member')

  function startNewChat() {
    setActiveSessionId(crypto.randomUUID())
    setMessages([])
    setHistoryError('')
    setMobileNavOpen(false)
  }

  async function openChat(chatSession: ChatSessionRecord) {
    if (!session?.access_token) {
      setAuthOpen(true)
      return
    }
    setActiveSessionId(chatSession.session_id)
    setSelectedState(chatSession.selected_state)
    setMessages([])
    setThreadLoading(true)
    setHistoryError('')
    setMobileNavOpen(false)
    try {
      const response = await fetch(`/api/chat-sessions/${encodeURIComponent(chatSession.session_id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      const payload = await response.json() as { session?: ChatSessionRecord; messages?: ChatThreadMessage[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not load this chat.')
      setMessages(payload.messages ?? [])
      if (payload.session) setSelectedState(payload.session.selected_state)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not load this chat.')
    } finally {
      setThreadLoading(false)
    }
  }

  function addUserMessage(sessionId: string, content: string) {
    if (sessionId !== activeSessionId) return
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content }])
  }

  function addAssistantMessage(sessionId: string, content: string, savedSession: ChatSessionRecord | null) {
    if (sessionId !== activeSessionId) return
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content }])
    if (savedSession) {
      setChatSessions((current) => {
        const existing = current.find((item) => item.session_id === savedSession.session_id)
        const updated = { ...savedSession, title: existing?.title || savedSession.title }
        return [updated, ...current.filter((item) => item.session_id !== savedSession.session_id)]
      })
    }
  }

  async function handleProfileClick() {
    if (!session) {
      setAuthOpen(true)
      return
    }
    await getBrowserSupabase().auth.signOut()
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b1015] text-slate-100">
      {mobileNavOpen && (
        <button type="button" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation menu" />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[min(86vw,18rem)] shrink-0 flex-col overflow-hidden border-r border-white/7 bg-[#11171e] transition-transform duration-200 lg:static lg:z-auto lg:w-68 lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-18 shrink-0 items-center justify-between border-b border-white/7 px-5">
          <a href="#workspace" className="flex items-center gap-3" aria-label="LegalPulse AI workspace">
            <img src="/legalpulse-scale.svg" alt="" className="size-9 rounded-lg" aria-hidden="true" />
            <span className="font-serif text-lg font-semibold text-white">LegalPulse <span className="text-emerald-400">AI</span></span>
          </a>
          <button type="button" onClick={() => setMobileNavOpen(false)} className="flex size-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/6 hover:text-white lg:hidden" aria-label="Close navigation">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 pt-5">
          <button type="button" onClick={startNewChat} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300">
            <Plus className="size-4" aria-hidden="true" /> New chat
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-7">
          <div className="mb-3 flex items-center justify-between px-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Chat history</h2>
            <span className="text-[11px] tabular-nums text-slate-600">{String(chatSessions.length).padStart(2, '0')}</span>
          </div>
          <nav aria-label="Saved chat sessions" className="space-y-5">
            {historyGroups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h3 className="mb-1.5 px-2 text-[11px] font-medium text-slate-500">{group.label}</h3>
                <ul className="space-y-1">
                  {group.sessions.map((chat) => (
                    <li key={chat.session_id}>
                      <button type="button" onClick={() => void openChat(chat)} aria-current={activeSessionId === chat.session_id ? 'page' : undefined}
                        className={`group flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors ${activeSessionId === chat.session_id ? 'bg-white/8 text-white' : 'text-slate-400 hover:bg-white/4.5 hover:text-slate-200'}`}>
                        <FileText className="mt-0.5 size-4 shrink-0 text-slate-500 group-hover:text-slate-300" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{chat.title}</span>
                                          <span className="mt-1 block truncate text-[11px] text-slate-500">{chat.selected_state}{chat.updated_at ? ` · ${new Date(chat.updated_at).toLocaleDateString()}` : ''}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          {historyLoading && <p className="px-2 py-3 text-xs text-slate-500">Loading saved chats…</p>}
          {!historyLoading && session && chatSessions.length === 0 && <p className="px-2 py-3 text-xs leading-relaxed text-slate-500">No saved chats yet</p>}
          {!session && <p className="px-2 py-3 text-xs leading-relaxed text-slate-500">Guest chats are not saved to history. Sign in to keep them.</p>}
          {historyError && <p role="alert" className="px-2 py-3 text-xs leading-relaxed text-rose-300">{historyError}</p>}
        </div>

        <div className="shrink-0 border-t border-white/[0.07] p-3">
          <button type="button" onClick={() => void handleProfileClick()} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-xs font-semibold text-slate-200">{userName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-200">{user ? userName : 'Sign in'}</span>
              <span className="block truncate text-xs text-slate-500">{user?.email || 'Connect your workspace'}</span>
            </span>
            {user && <LogOut className="size-4 shrink-0 text-slate-500" aria-label="Sign out" />}
          </button>
        </div>
      </aside>

      <div id="workspace" className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex min-h-18 items-center justify-between gap-3 border-b border-white/7 bg-[#0b1015]/95 px-4 backdrop-blur sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileNavOpen(true)} className="flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-300 hover:bg-white/6 lg:hidden" aria-label="Open navigation menu">
              <Menu className="size-4" aria-hidden="true" />
            </button>
            <details className="group relative">
              <summary className="flex h-9 max-w-[min(56vw,18rem)] cursor-pointer list-none items-center gap-2 rounded-md border border-white/10 bg-white/2.5 px-3 text-sm text-slate-200 hover:border-white/20 [&::-webkit-details-marker]:hidden">
                <Globe2 className="size-4 shrink-0 text-blue-400" aria-hidden="true" />
                <span className="min-w-0 truncate">{selectedState}</span>
                <ChevronDown className="size-3.5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="absolute left-0 top-11 z-50 w-[min(86vw,19rem)] rounded-lg border border-slate-700 bg-[#151d25] p-2 shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between px-2 pb-2 pt-1">
                  <div><p className="text-sm font-medium text-slate-100">Jurisdiction</p><p className="mt-0.5 text-xs text-slate-500">Select one US state</p></div>
                  <span className="text-[11px] text-slate-500">United States</span>
                </div>
                <div role="listbox" aria-label="US state jurisdiction" className="max-h-72 overflow-y-auto border-t border-white/[0.07] pt-1">
                  {US_STATES.map((state) => {
                    const selected = selectedState === state
                    return <button key={state} type="button" role="option" aria-selected={selected} onClick={(event) => { setSelectedState(state); event.currentTarget.closest('details')?.removeAttribute('open') }} className="flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm text-slate-300 hover:bg-white/5"><span className="flex-1">{state}</span>{selected && <Check className="size-4 text-emerald-400" aria-hidden="true" />}</button>
                  })}
                </div>
              </div>
            </details>
          </div>
        </header>

        <main className="relative flex h-full flex-1 flex-col overflow-hidden px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:px-10">
          {!authConfigured && <p role="alert" className="mx-auto mb-4 w-full max-w-4xl rounded-md border border-amber-400/20 bg-amber-400/6 px-4 py-3 text-sm text-amber-200">Supabase is not configured. Add its project URL and publishable key to <code>.env.local</code>.</p>}
          <div ref={messageListRef} className="w-full flex-1 overflow-y-auto scrollbar-none">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pb-8">
              {threadLoading ? (
                <div role="status" className="space-y-5 py-8"><div className="h-16 w-2/3 animate-pulse self-end rounded-2xl bg-slate-800" /><div className="h-36 animate-pulse rounded-xl bg-slate-800/70" /><p className="text-sm text-slate-500">Loading chat history…</p></div>
              ) : messages.length ? (
                <div className="space-y-7">{messages.map((item) => <ChatMessage key={item.id} role={item.role} content={item.content} />)}</div>
              ) : (
                <section className="flex flex-1 flex-col items-center justify-center pb-14 text-center" aria-labelledby="welcome-heading">
                <span className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-300"><Sparkles className="size-5" aria-hidden="true" /></span>
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">LegalPulse AI</p>
                <h1 id="welcome-heading" className="max-w-2xl font-serif text-3xl font-medium leading-tight text-slate-100 sm:text-4xl">What legal query or contract are we reviewing today?</h1>
                </section>
              )}
              {analysisPending && !threadLoading && <div role="status" className="flex items-center gap-3 py-2 text-sm text-slate-400"><span className="flex gap-1"><i className="size-1.5 animate-pulse rounded-full bg-emerald-300" /><i className="size-1.5 animate-pulse rounded-full bg-emerald-300 [animation-delay:150ms]" /><i className="size-1.5 animate-pulse rounded-full bg-emerald-300 [animation-delay:300ms]" /></span>Reviewing your message…</div>}
              {historyError && <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">{historyError}</p>}
            </div>
          </div>
          <ChatComposer
            key={activeSessionId}
            sessionId={activeSessionId}
            userId={user?.id ?? null}
            selectedState={selectedState}
            accessToken={session?.access_token ?? null}
            onRequireAuth={() => setAuthOpen(true)}
            onUserMessage={addUserMessage}
            onAssistantMessage={addAssistantMessage}
            onPendingChange={setAnalysisPending}
          />
        </main>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}