import type { ContractAnalysis } from '@/lib/analysis'

export type ContractRecord = {
  id: string
  title: string
  state: string
  risk_score: number | null
  source: 'text' | 'file'
  file_name: string | null
  created_at: string
}

export type ContractDetail = ContractRecord & {
  analysis: ContractAnalysis
  raw_output: string
}