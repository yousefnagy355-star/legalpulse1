'use client'

import { useEffect, useState } from 'react'

const STEPS = [
  'Reading contract structure…',
  'Identifying parties and obligations…',
  'Scanning for risky clauses…',
  'Computing risk score…',
  'Drafting counter-proposals…',
  'Finalizing report…',
]

export function AnalysisProgress() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5 py-5">
      <div className="flex items-center justify-center gap-3 py-3">
        <span
          className="size-7 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-foreground">Analyzing your contract…</p>
          <p className="mt-1 text-xs text-muted-foreground">{STEPS[step]}</p>
        </div>
      </div>
      <div className="space-y-4" aria-hidden="true">
        <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="size-24 shrink-0 animate-pulse rounded-full bg-muted sm:size-32" />
          <div className="flex flex-1 flex-col gap-3">
            <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-36 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-36 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </div>
    </div>
  )
}
