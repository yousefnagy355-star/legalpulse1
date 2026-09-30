'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function stripCodeFence(content: string) {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json|markdown|md)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

function cleanContent(content: string) {
  const normalized = stripCodeFence(content)

  try {
    const parsed: unknown = JSON.parse(normalized)
    if (typeof parsed === 'string') return stripCodeFence(parsed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const values = parsed as Record<string, unknown>
      for (const key of ['markdown', 'content', 'text', 'output', 'response', 'message', 'assistantMessage']) {
        if (typeof values[key] === 'string') return stripCodeFence(values[key])
      }
    }
  } catch {
    return normalized
  }

  return normalized
}

function textContent(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textContent).join('')
  return ''
}

function FormattedMessage({ content }: { content: string }) {
  return (
    <article className="max-w-full text-[15px] leading-7 text-slate-200 [&_a]:text-blue-300 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-400/50 [&_blockquote]:bg-slate-900/50 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_h1]:mb-4 [&_h1]:mt-7 [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-slate-100 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: ({ children }) => /high\s*risk|high\s*severity/i.test(textContent(children))
            ? <span className="mx-0.5 inline-flex items-center rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 align-middle text-[10px] font-bold uppercase leading-4 tracking-wide text-rose-300">{children}</span>
            : <strong className="font-semibold text-slate-100">{children}</strong>,
          code: ({ children }) => <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-200">{children}</code>,
          pre: ({ children }) => <div className="my-3 overflow-x-auto rounded-md border border-slate-700 bg-slate-900 p-3 text-sm">{children}</div>,
        }}
      >
        {cleanContent(content)}
      </ReactMarkdown>
    </article>
  )
}

export function ChatMessage({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#232d37] px-4 py-3 text-sm leading-6 text-slate-100 sm:max-w-[78%]">
          {content}
        </div>
      </div>
    )
  }

  return <FormattedMessage content={content} />
}
