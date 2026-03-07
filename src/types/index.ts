export interface Attachment {
  type: 'image' | 'file'
  name: string
  mimeType: string
  data: string  // base64 dataURL for image, text content for file
}

export interface ModelConfig {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  modelId: string
  createdAt: number
}

export type ConversationMode = 'single' | 'multi-parallel' | 'multi-roundrobin'

export interface Message {
  id: string
  conversationId: string
  parentId: string | null
  role: 'user' | 'assistant' | 'system'
  modelId?: string
  content: string
  attachments?: Attachment[]
  children: string[]
  createdAt: number
  isStreaming?: boolean
}

export interface Conversation {
  id: string
  title: string
  mode: ConversationMode
  models: string[]
  rootMessageId: string | null
  activePathIds: string[]
  systemPrompt?: string   // per-conversation system instructions
  modelInstructions?: Record<string, string>  // round-robin: per-model instructions (modelId → prompt)
  createdAt: number
  updatedAt: number
}
