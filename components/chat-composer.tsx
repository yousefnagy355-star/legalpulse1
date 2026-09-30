'use client'

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, FileText, LoaderCircle, Plus, X } from 'lucide-react'
import type { ChatSessionRecord } from '@/lib/chat'

const ACCEPTED = '.pdf,.docx,.txt'
const MAX_FILE_BYTES = 10 * 1024 * 1024

type ChatComposerProps = {
  sessionId: string
  userId: string | null
  selectedState: string
  accessToken: string | null
  onRequireAuth: () => void
  onUserMessage: (sessionId: string, content: string) => void
  onAssistantMessage: (sessionId: string, content: string, session: ChatSessionRecord | null) => void
  onPendingChange: (pending: boolean) => void
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read this file.'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const separator = result.indexOf(',')
      if (separator < 0) reject(new Error('Could not encode this file.'))
      else resolve(result.slice(separator + 1))
    }
    reader.readAsDataURL(file)
  })
}

export function ChatComposer({
  sessionId,
  userId,
  selectedState,
  accessToken,
  onRequireAuth,
  onUserMessage,
  onAssistantMessage,
  onPendingChange,
}: ChatComposerProps) {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  function acceptFile(candidate?: File) {
    if (!candidate) return
    const extension = candidate.name.toLowerCase().split('.').pop()
    if (!['pdf', 'docx', 'txt'].includes(extension ?? '')) {
      setError('Choose a PDF, DOCX, or TXT file.')
      return
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setError('Files must be 10 MB or smaller.')
      return
    }
    setError('')
    setFile(candidate)
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || (!message.trim() && !file)) return

    const submittedMessage = message.trim()
    const submittedFile = file
    setMessage('')
    setFile(null)
    if (messageRef.current) messageRef.current.style.height = '24px'
    setError('')

    const userMessage = submittedFile
      ? [submittedMessage, `Attached file: ${submittedFile.name}`].filter(Boolean).join('\n\n')
      : submittedMessage
    onUserMessage(sessionId, userMessage)
    setPending(true)
    onPendingChange(true)

    try {
      const fileData = submittedFile ? await fileToBase64(submittedFile) : null
      const payload = {
        userId: String(userId || 'guest_user'),
        sessionId: String(sessionId || 'default_session'),
        selectedState: String(selectedState || 'California'),
        message: String(submittedMessage),
        fileName: submittedFile?.name ? String(submittedFile.name) : null,
        fileData: typeof fileData === 'string' && fileData.length > 0 ? fileData : null,
      }
      const requestBody = JSON.stringify(payload)
      console.debug('[LegalPulse] n8n request JSON body:', requestBody)

      const headers = new Headers({ 'Content-Type': 'application/json' })
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: requestBody,
      })
      const result = await response.json() as { assistantMessage?: string; session?: ChatSessionRecord | null; error?: string }
      if (!response.ok) {
        if (response.status === 401) onRequireAuth()
        throw new Error(result.error || 'The message could not be sent.')
      }
      onAssistantMessage(sessionId, result.assistantMessage || 'The analysis service returned an empty response.', result.session ?? null)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not reach the analysis service. Please try again.')
    } finally {
      setPending(false)
      onPendingChange(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-30 w-[min(92vw,48rem)] -translate-x-1/2 lg:left-[calc(50%+8.5rem)] lg:w-[min(calc(100vw-21rem),48rem)]">
      {error && (
        <p role="alert" className="mb-2 rounded-lg border border-rose-400/20 bg-[#171d24] px-4 py-2.5 text-sm text-rose-300 shadow-lg">
          {error}
        </p>
      )}
      <form
        ref={formRef}
        onSubmit={sendMessage}
        className="rounded-[1.75rem] border border-white/[0.11] bg-[#1a2129] p-2 shadow-[0_16px_60px_rgba(0,0,0,0.38)] transition-colors focus-within:border-slate-500"
      >
        {file && (
          <div className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] py-1.5 pl-2.5 pr-1.5 text-xs text-slate-300">
            <FileText className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
            <span className="max-w-64 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Remove attached file"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              acceptFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending || file !== null}
            className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Attach a contract file"
            title="Attach PDF, DOCX, or TXT"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
          <label className="sr-only" htmlFor="legal-message">Message LegalPulse</label>
          <textarea
            ref={messageRef}
            id="legal-message"
            value={message}
            disabled={pending}
            onChange={(event) => {
              setMessage(event.target.value)
              event.currentTarget.style.height = '24px'
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 144)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a contract or paste its text…"
            rows={1}
            className="max-h-36 min-h-10 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-[15px] leading-5 text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-70"
          />
          <button
            type="submit"
            disabled={pending || (!message.trim() && !file)}
            className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            aria-label={pending ? 'Sending message' : 'Send message'}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </form>
      <p className="mt-2 px-4 text-center text-xs text-gray-500">
        LegalPulse AI can make mistakes. Verify important legal info with an attorney.
      </p>
    </div>
  )
}