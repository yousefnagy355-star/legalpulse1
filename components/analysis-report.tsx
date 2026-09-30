'use client'

import { useState } from 'react'
import { AlertTriangle, Check, ClipboardList, Copy, Download, Lightbulb, PenLine, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { riskBand, type AnalyzeResponse, type ContractAnalysis, type Severity } from '@/lib/analysis'

const toneText: Record<Severity, string> = {
  low: 'text-risk-low',
  medium: 'text-risk-medium',
  high: 'text-risk-high',
}
const toneBorder: Record<Severity, string> = {
  low: 'border-risk-low',
  medium: 'border-risk-medium',
  high: 'border-risk-high',
}
const toneSoft: Record<Severity, string> = {
  low: 'bg-risk-low/10 text-risk-low',
  medium: 'bg-risk-medium/10 text-risk-medium',
  high: 'bg-risk-high/10 text-risk-high',
}
const severityLabel: Record<Severity, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
}

function Section({
  icon: Icon,
  iconClass,
  title,
  children,
}: {
  icon: typeof ClipboardList
  iconClass: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border-[1.5px] border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border bg-muted px-6 py-4">
        <span className={cn('flex size-9 items-center justify-center rounded-lg', iconClass)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h3 className="font-serif text-lg font-semibold">{title}</h3>
      </header>
      <div className="p-6">{children}</div>
    </section>
  )
}

function RiskGauge({ analysis }: { analysis: ContractAnalysis }) {
  const band = riskBand(analysis.riskScore)
  return (
    <section
      aria-label="Overall risk score"
      className="flex flex-col gap-6 rounded-2xl border-[1.5px] border-border bg-card p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8"
    >
      <div
        className={cn(
          'flex size-32 shrink-0 flex-col items-center justify-center rounded-full border-[6px]',
          toneBorder[band.tone],
          toneSoft[band.tone],
        )}
      >
        <span className="font-serif text-5xl font-bold leading-none">{analysis.riskScore ?? '–'}</span>
        <span className="text-xs opacity-70">/ 10</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className={cn('w-fit rounded-full px-3 py-1 text-sm font-semibold', toneSoft[band.tone])}>
          {band.label}
        </span>
        <h3 className="font-serif text-2xl font-bold text-balance">
          {analysis.title || 'Contract Risk Assessment'}
        </h3>
        {analysis.overview && <p className="leading-relaxed text-muted-foreground text-pretty">{analysis.overview}</p>}
      </div>
    </section>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? 'Copied!' : 'Copy suggestion'}
    </button>
  )
}

function buildTextReport(a: ContractAnalysis) {
  const s = a.summary
  const lines = [
    '=== LEGALPULSE AI — CONTRACT ANALYSIS REPORT ===',
    `Generated: ${new Date().toLocaleString('en-US')}`,
    '',
    `RISK SCORE: ${a.riskScore ?? 'N/A'}/10 (${riskBand(a.riskScore).label.toUpperCase()})`,
    a.title,
    a.overview,
    '',
    '--- EXECUTIVE SUMMARY ---',
    s.contractType && `Contract type: ${s.contractType}`,
    s.parties.length && `Parties: ${s.parties.join('; ')}`,
    s.duration && `Duration: ${s.duration}`,
    s.financialObligations.length && `Financial terms: ${s.financialObligations.join('; ')}`,
    s.terminationTerms.length && `Termination: ${s.terminationTerms.join('; ')}`,
    s.jurisdiction && `Jurisdiction: ${s.jurisdiction}`,
    '',
    '--- FLAGGED CLAUSES ---',
    ...a.riskyClauses.map((c) => `[${c.severity.toUpperCase()}] ${c.title}\n  -> ${c.reason}`),
    '',
    '--- SUGGESTED REDLINES ---',
    ...a.redlines.map((c) => `${c.title}\n  Original: ${c.originalText || '—'}\n  Suggested: ${c.suggestedRevision}`),
    '',
    '--- RECOMMENDATIONS ---',
    ...a.recommendations.map((r) => `- ${r}`),
    '',
    '=== END OF REPORT ===',
    'Disclaimer: AI-generated analysis for informational purposes only. Not legal advice.',
  ]
  return lines.filter((l): l is string => typeof l === 'string').join('\n')
}

export function AnalysisReport({
  result,
  onReset,
}: {
  result: Extract<AnalyzeResponse, { ok: true }>
  onReset: () => void
}) {
  const { analysis, raw, fileName } = result

  if (!analysis) {
    const readableOutput = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
    return (
      <Section icon={ClipboardList} iconClass="bg-primary/10 text-primary" title="Analysis result">
        <p className="whitespace-pre-wrap leading-relaxed">
          {readableOutput || 'The workflow returned no structured report. Make sure "Respond to Webhook" returns the AI Agent output as JSON.'}
        </p>
      </Section>
    )
  }

  const { summary } = analysis
  const summaryFields = [
    { label: 'Parties', value: summary.parties.join('; ') },
    { label: 'Contract Type', value: summary.contractType },
    {
      label: 'Duration',
      value: [summary.duration, summary.startDate && `from ${summary.startDate}`, summary.endDate && `to ${summary.endDate}`]
        .filter(Boolean)
        .join(' '),
    },
    { label: 'Financial Terms', value: summary.financialObligations.join('; ') },
    { label: 'Termination', value: summary.terminationTerms.join('; ') },
    { label: 'Jurisdiction', value: summary.jurisdiction },
  ].filter((f) => f.value)

  const redlines = analysis.redlines

  function exportReport() {
    const blob = new Blob([buildTextReport(analysis!)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'LegalPulse-Report.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-3xl font-bold tracking-tight">Contract Report</h2>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
      </div>

      <RiskGauge analysis={analysis} />

      {summaryFields.length > 0 && (
        <Section icon={ClipboardList} iconClass="bg-primary/10 text-primary" title="Executive Summary">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaryFields.map((f) => (
              <div key={f.label} className="flex flex-col gap-1.5 rounded-xl bg-muted px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-semibold leading-snug">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section icon={AlertTriangle} iconClass="bg-risk-high/10 text-risk-high" title="Flagged Clauses">
        {analysis.riskyClauses.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {analysis.riskyClauses.map((c, i) => (
              <li
                key={i}
                className={cn('flex flex-col gap-2 rounded-r-xl border-l-[3px] bg-muted px-4 py-3.5', toneBorder[c.severity])}
              >
                <span
                  className={cn(
                    'w-fit rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider',
                    toneSoft[c.severity],
                  )}
                >
                  {severityLabel[c.severity]}
                </span>
                <h4 className="font-serif text-base font-semibold">{c.title}</h4>
                {c.reason && <p className="text-sm leading-relaxed text-muted-foreground">{c.reason}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No significant risky clauses detected. The contract appears relatively standard.</p>
        )}
      </Section>

      <Section icon={PenLine} iconClass="bg-risk-low/10 text-risk-low" title="Suggested Redlines">
        <div className="flex flex-col gap-4">
          {redlines.length > 0 ? (
            redlines.map((c, i) => (
              <div key={i} className="overflow-hidden rounded-xl border-[1.5px] border-border">
                <p className="border-b border-border bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground">
                  {/^clause\s*\d+$/i.test(c.title) ? `Clause ${i + 1}` : `Clause ${i + 1}: ${c.title}`}
                </p>
                <div className="flex flex-col gap-3 p-4">
                  {c.originalText && (
                    <div className="rounded-lg border border-risk-high/25 bg-risk-high/5 px-3 py-2.5 font-mono text-sm leading-relaxed text-risk-high">
                      <span className="mb-1 block text-[0.7rem] font-bold uppercase tracking-wider opacity-75">Original</span>
                      <span className="line-through decoration-risk-high/50">{c.originalText}</span>
                    </div>
                  )}
                  <div className="rounded-lg border border-risk-low/25 bg-risk-low/5 px-3 py-2.5 font-mono text-sm leading-relaxed text-risk-low">
                    <span className="mb-1 block text-[0.7rem] font-bold uppercase tracking-wider opacity-75">Suggested</span>
                    {c.suggestedRevision}
                  </div>
                  <CopyButton value={c.suggestedRevision} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No redlines needed — the clauses appear fair and standard.</p>
          )}
          <p className="rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            These suggestions are AI-generated for informational purposes only and do not constitute legal advice.
            Consult a qualified attorney before signing any contract.
          </p>
        </div>
      </Section>

      {analysis.recommendations.length > 0 && (
        <Section icon={Lightbulb} iconClass="bg-risk-medium/10 text-risk-medium" title="Attorney Recommendations">
          <ul className="flex list-disc flex-col gap-2 pl-5 leading-relaxed marker:text-primary">
            {analysis.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex flex-wrap gap-3 pt-3">
        <Button onClick={exportReport} size="lg" className="h-12 min-w-44 flex-1 gap-2">
          <Download className="size-4" aria-hidden="true" />
          Export Report as Text
        </Button>
        <Button onClick={onReset} variant="outline" size="lg" className="h-12 gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          Analyze New Contract
        </Button>
      </div>
    </div>
  )
}
