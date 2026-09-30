export type ChatSessionRecord = {
  session_id: string
  title: string
  selected_state: string
  created_at?: string
  updated_at?: string
}

export type ChatThreadMessage = {
  id: string | number
  role: 'user' | 'assistant'
  content: string
}

