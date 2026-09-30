const STEPS = [
  { title: 'Upload & Parse', body: 'Paste text or upload a PDF, DOCX, or TXT. We extract and structure the full contract.' },
  { title: 'Risk Scoring', body: 'The AI assigns a 1–10 risk score based on clause severity and legal standards.' },
  { title: 'Clause Detection', body: 'Every problematic clause is flagged with a plain-language explanation of why it matters.' },
  { title: 'Counter-Proposals', body: 'Get ready-to-send alternative wording you can negotiate with immediately.' },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="flex flex-col gap-8 border-t border-border pt-12">
      <div className="flex flex-col gap-2">
        <h2 id="how-heading" className="font-serif text-3xl font-bold tracking-tight">
          How LegalPulse works
        </h2>
        <p className="text-muted-foreground">Four layers of analysis, from raw contract to negotiation-ready report.</p>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <span className="flex size-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-ink-foreground">
              {i + 1}
            </span>
            <h3 className="font-serif text-lg font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
