import type { ContractRecord } from '@/lib/contracts'

export type Severity = 'low' | 'medium' | 'high'

export type RiskyClause = {
  title: string
  originalText: string
  reason: string
  severity: Severity
  suggestedRevision: string
}

export type ContractSummary = {
  contractType: string
  parties: string[]
  financialObligations: string[]
  startDate: string
  endDate: string
  duration: string
  terminationTerms: string[]
  jurisdiction: string
}

export type ContractAnalysis = {
  title: string
  overview: string
  riskScore: number | null
  summary: ContractSummary
  riskyClauses: RiskyClause[]
  redlines: RiskyClause[]
  recommendations: string[]
}

export type AnalyzeResponse =
  | {
      ok: true
      analysis: ContractAnalysis | null
      raw: string
      source: 'text' | 'file'
      fileName?: string
      contract?: ContractRecord
      contractId?: string
    }
  | { ok: false; error: string }

type Loose = Record<string, unknown>

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(', ')
  if (value && typeof value === 'object') {
    return Object.values(value as Loose).map(asString).filter(Boolean).join(' — ')
  }
  return ''
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean)
  const single = asString(value)
  return single ? [single] : []
}

function pick(obj: Loose | undefined, keys: string[]): unknown {
  if (!obj) return undefined
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

function normalizeSeverity(value: unknown, fallbackScore?: number | null): Severity {
  const s = asString(value).toLowerCase()
  if (/high|عال|خطير|red|أحمر|8|9|10/.test(s)) return 'high'
  if (/low|منخفض|green|أخضر/.test(s)) return 'low'
  if (/medium|متوسط|yellow|أصفر/.test(s)) return 'medium'
  if (fallbackScore != null) return fallbackScore >= 8 ? 'high' : fallbackScore >= 4 ? 'medium' : 'low'
  return 'medium'
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export function extractPayload(data: unknown): { object: Loose | null; raw: string } {
  let current: unknown = data
  if (Array.isArray(current)) current = current[0]

  if (current && typeof current === 'object') {
    const obj = current as Loose
    const inner = pick(obj, ['output', 'text', 'response', 'result', 'data', 'message'])
    if (inner !== undefined && !pick(obj, ['riskScore', 'risk_score', 'riskyClauses', 'flaggedClauses', 'summary'])) {
      return extractPayload(inner)
    }
    return { object: obj, raw: JSON.stringify(obj, null, 2) }
  }

  if (typeof current === 'string') {
    try {
      const parsed = JSON.parse(stripFences(current))
      if (parsed && typeof parsed === 'object') {
        return { object: Array.isArray(parsed) ? (parsed[0] as Loose) : (parsed as Loose), raw: current }
      }
    } catch {
      // Not JSON — the agent replied in free text.
    }
    return { object: null, raw: current }
  }

  return { object: null, raw: '' }
}

export function normalizeAnalysis(obj: Loose | null): ContractAnalysis | null {
  if (!obj) return null

  const scoreRaw = pick(obj, ['riskScore', 'risk_score', 'overallRiskScore', 'score', 'overall_risk_score'])
  const scoreNum = Number.parseFloat(asString(scoreRaw))
  const riskScore = Number.isFinite(scoreNum) ? Math.min(10, Math.max(1, Math.round(scoreNum))) : null

  const summaryObj = (pick(obj, ['summary', 'executiveSummary', 'executive_summary']) ?? obj) as Loose
  const summarySource = typeof summaryObj === 'object' ? summaryObj : ({} as Loose)

  const toClause = (item: unknown, index: number): RiskyClause => {
    const c = (item && typeof item === 'object' ? item : { originalText: item }) as Loose
    return {
      title: asString(pick(c, ['title', 'clauseTitle', 'name', 'clause'])) || `Clause ${index + 1}`,
      originalText: asString(pick(c, ['originalText', 'original', 'original_text', 'quote', 'clauseText', 'text'])),
      reason: asString(pick(c, ['reason', 'explanation', 'why', 'risk', 'issue'])),
      severity: normalizeSeverity(pick(c, ['severity', 'level', 'riskLevel'])),
      suggestedRevision: asString(
        pick(c, ['suggestedRevision', 'suggested', 'suggested_revision', 'suggestion', 'alternative', 'counterProposal', 'revision']),
      ),
    }
  }

  const clausesRaw = pick(obj, ['riskyClauses', 'flaggedClauses', 'risky_clauses', 'clauses', 'risks', 'redFlags'])
  const riskyClauses: RiskyClause[] = Array.isArray(clausesRaw) ? clausesRaw.map(toClause) : []

  const redlinesRaw = pick(obj, ['redlines', 'redlining', 'counterProposals', 'suggestions'])
  const redlines: RiskyClause[] = Array.isArray(redlinesRaw)
    ? redlinesRaw.map(toClause).filter((r) => r.suggestedRevision)
    : riskyClauses.filter((c) => c.suggestedRevision)

  const duration = asString(pick(summarySource, ['duration', 'term']))
  const analysis: ContractAnalysis = {
    title: meaningful(asString(pick(obj, ['riskTitle', 'title', 'headline']))),
    overview: meaningful(asString(pick(obj, ['overview', 'riskDescription', 'verdict', 'conclusion', 'riskSummary']))),
    riskScore,
    summary: {
      contractType: meaningful(asString(pick(summarySource, ['contractType', 'type']))),
      parties: cleanList(pick(summarySource, ['parties', 'contractParties'])),
      financialObligations: cleanList(
        pick(summarySource, ['financialObligations', 'financial_obligations', 'payments', 'amounts']),
      ),
      startDate: meaningful(asString(pick(summarySource, ['startDate', 'start_date', 'effectiveDate']))),
      endDate: meaningful(asString(pick(summarySource, ['endDate', 'end_date', 'expiryDate']))),
      duration: meaningful(duration),
      terminationTerms: cleanList(
        pick(summarySource, ['terminationTerms', 'terminationConditions', 'termination_terms', 'termination']),
      ),
      jurisdiction: meaningful(asString(pick(summarySource, ['jurisdiction', 'governingLaw']))),
    },
    riskyClauses,
    redlines,
    recommendations: splitRecommendations(pick(obj, ['recommendations', 'nextSteps', 'advice'])),
  }

  const hasContent =
    riskScore !== null ||
    riskyClauses.length > 0 ||
    analysis.summary.parties.length > 0 ||
    analysis.overview.length > 0
  return hasContent ? analysis : null
}

const EMPTY_VALUES = /^(not specified\.?|n\/a|none\.?|غير محدد\.?|غير مذكور\.?|لا يوجد\.?|-)$/i

function meaningful(value: string): string {
  return EMPTY_VALUES.test(value.trim()) ? '' : value
}

function cleanList(value: unknown): string[] {
  return asList(value).map(meaningful).filter(Boolean)
}

function splitRecommendations(value: unknown): string[] {
  if (Array.isArray(value)) return cleanList(value)
  const text = asString(value)
  if (!text) return []
  return text
    .split(/\n+|(?=\s\d+\.\s)/)
    .map((line) => line.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean)
}

export function riskBand(score: number | null): { label: string; tone: Severity } {
  if (score === null) return { label: 'Unrated', tone: 'medium' }
  if (score >= 7) return { label: 'High Risk', tone: 'high' }
  if (score >= 4) return { label: 'Medium Risk', tone: 'medium' }
  return { label: 'Low Risk', tone: 'low' }
}
