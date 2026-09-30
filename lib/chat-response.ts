type LooseObject = Record<string, unknown>

function asObject(value: unknown): LooseObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as LooseObject : null
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n')
  const object = asObject(value)
  if (object) {
    const content = object.content ?? object.text ?? object.output
    if (content !== undefined) return asText(content)
    return Object.entries(object)
      .map(([key, item]) => `**${key.replace(/[_-]/g, ' ')}**\n${asText(item)}`)
      .filter((line) => !line.endsWith('\n'))
      .join('\n\n')
  }
  return ''
}

function normalizeResponseSections(raw: string) {
  return raw
    .replace(/\bHigh Risks\b/gi, '## High risks')
    .replace(/\bSuggested Redlines\b/gi, '## Suggested redlines')
    .replace(/\bPotential Enforceability Issues\b/gi, '## Potential Enforceability Issues')
    .replace(/\bRecommendations\b/gi, '## Recommendations')
    .replace(/\n\s*\n\s*##/g, '\n\n##')
}

export function assistantText(data: unknown): string {
  if (typeof data === 'string') {
    const trimmed = data.trim()
    const fenced = trimmed.match(/^```(?:json|markdown|md)?\s*([\s\S]*?)\s*```$/i)
    const content = fenced?.[1]?.trim() ?? trimmed
    try {
      return normalizeResponseSections(assistantText(JSON.parse(content)))
    } catch {
      return normalizeResponseSections(content)
    }
  }
  if (Array.isArray(data)) return data.length ? assistantText(data[0]) : ''

  const object = asObject(data)
  if (!object) return normalizeResponseSections(asText(data))
  for (const key of ['output', 'response', 'answer', 'reply', 'text', 'message']) {
    if (object[key] !== undefined && object[key] !== object) {
      const value = assistantText(object[key])
      if (value) return normalizeResponseSections(value)
    }
  }

  const title = asText(object.title ?? object.riskTitle ?? object.headline)
  const overview = asText(object.overview ?? object.summary ?? object.riskDescription)
  const highRisks = object.highRisks ?? object.high_risks ?? object.riskyClauses ?? object.flaggedClauses ?? object.keyRisks
  const redlines = object.suggestedRedlines ?? object.suggested_redlines ?? object.redlines ?? object.counterProposals ?? object.proposedRedlines
  const enforceability = object.potentialEnforceabilityIssues ?? object.potential_enforceability_issues ?? object.enforceabilityIssues ?? object.enforceability
  const recommendations = object.recommendations ?? object.nextSteps
  const sections: string[] = []
  if (title) sections.push(`# ${title}`)
  if (overview) sections.push(overview)
  if (Array.isArray(highRisks) && highRisks.length) {
    sections.push(`## High risks\n${highRisks.map((risk) => {
      const item = asObject(risk)
      if (!item) return `- **HIGH RISK** ${asText(risk)}`
      const name = asText(item.title ?? item.name ?? item.clause) || 'Flagged clause'
      const detail = asText(item.reason ?? item.explanation ?? item.risk ?? item.detail ?? item.issue)
      return `- **HIGH RISK** ${name}${detail ? `: ${detail}` : ''}`
    }).join('\n')}`)
  }
  if (Array.isArray(redlines) && redlines.length) {
    sections.push(`## Suggested redlines\n${redlines.map((item) => {
      const redline = asObject(item)
      return redline
        ? `- **${asText(redline.title ?? redline.clause ?? redline.section) || 'Clause'}**: ${asText(redline.suggestedRevision ?? redline.suggested ?? redline.revision ?? redline.text ?? redline.detail)}`
        : `- ${asText(item)}`
    }).join('\n')}`)
  }
  if (Array.isArray(enforceability) && enforceability.length) {
    sections.push(`## Potential Enforceability Issues\n${enforceability.map((item) => `- ${asText(item)}`).join('\n')}`)
  }
  if (Array.isArray(recommendations) && recommendations.length) {
    sections.push(`## Recommendations\n${recommendations.map((item) => `- ${asText(item)}`).join('\n')}`)
  }
  if (sections.length) return normalizeResponseSections(sections.join('\n\n'))
  return normalizeResponseSections(asText(object) || 'The analysis service returned an empty response.')
}